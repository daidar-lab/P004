import { Router, Request, Response } from 'express';
import { BSynapseService } from '../services/bsynapseService';
import { TextractService } from '../services/textractService';
import { db } from '../config/database';
import { parseTextractBlocks, convertToCsv } from '../utils/textractParser';
import multer from 'multer';
import mammoth from 'mammoth';
import PDFDocument from 'pdfkit';

export const analyzeRouter = Router();

// Configura o armazenamento em memória do multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024 // Limite de 30MB para processamento síncrono
  }
});

// Definimos uma interface para estender o Request com as informações que o middleware injetou
interface AuthenticatedRequest extends Request {
  apiKeyInfo?: {
    id: string;
    client_name: string;
    api_key: string;
  };
}

// 💥 ROTA UNIVERSAL ASSÍNCRONA: O ":slug" captura o endpoint, inicia o Textract e salva como PROCESSING
analyzeRouter.post('/:slug/async', async (req: AuthenticatedRequest, res: Response) => {
  const slug = req.params.slug as string;
  const clientApiKeyId = req.apiKeyInfo?.id;
  const { s3Bucket, s3Key } = req.body;

  try {
    if (!clientApiKeyId) {
      return res.status(401).json({ success: false, error: 'Contexto de autenticação ausente.' });
    }

    if (!s3Bucket || !s3Key) {
      return res.status(400).json({ success: false, error: 'Os parâmetros s3Bucket e s3Key são obrigatórios.' });
    }

    // 1. Resolve o endpoint e valida a permissão
    const contextQuery = `
      SELECT e.id AS endpoint_id
      FROM synapse.endpoints e
      INNER JOIN synapse.api_key_permissions per ON per.endpoint_id = e.id
      WHERE e.slug = $1 
        AND per.api_key_id = $2 
        AND e.is_active = TRUE;
    `;
    const contextResult = await db.query(contextQuery, [slug, clientApiKeyId]);

    if (contextResult.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acesso negado ou endpoint inexistente para este token.' });
    }

    const endpointId = contextResult.rows[0].endpoint_id;

    // 2. Inicia o Textract
    const jobId = await TextractService.startAnalysis(s3Bucket, s3Key);

    // 3. Salva no banco com status PROCESSING
    await db.query(
      `INSERT INTO synapse.document_jobs 
        (job_id, status, s3_bucket, s3_key, endpoint_id, api_key_id) 
       VALUES ($1, 'PROCESSING', $2, $3, $4, $5)`,
      [jobId, 'PROCESSING', s3Bucket, s3Key, endpointId, clientApiKeyId]
    );

    return res.status(202).json({
      success: true,
      jobId,
      status: 'PROCESSING'
    });

  } catch (error: any) {
    console.error(`[ERRO NA ROTA DINÂMICA ASSÍNCRONA /:${slug}/async]:`, error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || 'Falha ao iniciar processamento assíncrono.'
    });
  }
});

// 💥 ROTA DIRETA (SÍNCRONA): Recebe o arquivo e devolve JSON ou CSV de forma direta
analyzeRouter.post('/:slug/direct', upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  const slug = req.params.slug as string;
  const clientApiKeyId = req.apiKeyInfo?.id;
  const format = (req.query.format as string || 'json').toLowerCase();

  try {
    if (!clientApiKeyId) {
      return res.status(401).json({ success: false, error: 'Contexto de autenticação ausente.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'O arquivo na chave "file" é obrigatório.' });
    }

    // 1. Resolve o endpoint e valida a permissão / suporte a Textract
    const contextQuery = `
      SELECT e.id AS endpoint_id, e.supports_textract
      FROM synapse.endpoints e
      INNER JOIN synapse.api_key_permissions per ON per.endpoint_id = e.id
      WHERE e.slug = $1 
        AND per.api_key_id = $2 
        AND e.is_active = TRUE;
    `;
    const contextResult = await db.query(contextQuery, [slug, clientApiKeyId]);

    if (contextResult.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acesso negado ou endpoint inexistente para este token.' });
    }

    const { endpoint_id, supports_textract } = contextResult.rows[0];

    if (!supports_textract) {
      return res.status(400).json({ success: false, error: 'Este endpoint não está configurado para suportar extração direta de documentos (Textract).' });
    }

    // Buscar as queries ativas do endpoint
    const queriesQuery = `
      SELECT query_text, query_alias
      FROM synapse.textract_queries
      WHERE endpoint_id = $1 AND is_active = TRUE
      ORDER BY sort_order ASC;
    `;
    const queriesResult = await db.query(queriesQuery, [endpoint_id]);
    const endpointQueries = queriesResult.rows.map(row => ({
      Text: row.query_text,
      Alias: row.query_alias
    }));

    const fileMime = req.file.mimetype;
    const originalName = req.file.originalname.toLowerCase();
    let parsedResult = {
      text: "",
      tables: [] as string[][][],
      keyValuePairs: {} as Record<string, string>,
      rawBlocks: [] as any[],
      queryResults: {} as Record<string, string>
    };

    const isWord = fileMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || originalName.endsWith('.docx');

    if (isWord) {
      // Processa arquivo Word direto via Mammoth
      const extract = await mammoth.extractRawText({ buffer: req.file.buffer });
      parsedResult.text = extract.value;
    } else {
      // Processa PDF/Imagem usando fluxo assíncrono interno via S3 temporário
      const tempBucket = process.env.AWS_TEMP_S3_BUCKET || process.env.AWS_S3_BUCKET;
      
      if (!tempBucket) {
        return res.status(500).json({ success: false, error: 'A variável de ambiente AWS_TEMP_S3_BUCKET não está configurada no servidor.' });
      }

      // 1. Nome único temporário
      const fileExt = originalName.split('.').pop() || 'pdf';
      const tempKey = `temp_uploads/direct_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      try {
        // 2. Upload para o S3
        await TextractService.uploadToS3(tempBucket, tempKey, req.file.buffer, fileMime);

        // 3. Inicia análise assíncrona
        // NOTA: AWS Textract não suporta LAYOUT combinado com QUERIES no mesmo job.
        // Quando há queries configuradas, usamos TABLES + FORMS + QUERIES (sem LAYOUT).
        const features = endpointQueries.length > 0
          ? ["TABLES", "FORMS", "QUERIES"]
          : ["TABLES", "FORMS", "LAYOUT"];
        const jobId = await TextractService.startAnalysis(tempBucket, tempKey, features, endpointQueries);

        // 4. Polling síncrono interno com limite de timeout
        let jobStatus = 'IN_PROGRESS';
        const pollingIntervalMs = 4000;  // Polling a cada 4 segundos
        const maxTimeSeconds = 300;      // Timeout de 5 minutos para documentos grandes
        const startTime = Date.now();
        let blocks: any[] = [];

        const { textractClient } = require('../config/textract');
        const { GetDocumentAnalysisCommand } = require('@aws-sdk/client-textract');

        while (jobStatus === 'IN_PROGRESS' || jobStatus === 'STARTING') {
          const elapsedMs = Date.now() - startTime;
          if (elapsedMs > (maxTimeSeconds * 1000)) {
            throw new Error(`Timeout de processamento do documento excedeu ${maxTimeSeconds} segundos.`);
          }

          await new Promise(resolve => setTimeout(resolve, pollingIntervalMs));

          const statusRes = await textractClient.send(new GetDocumentAnalysisCommand({ JobId: jobId }));
          jobStatus = statusRes.JobStatus || 'IN_PROGRESS';

          console.log(`[Textract] Status: ${jobStatus} | Elapsed: ${Math.round(elapsedMs / 1000)}s`);

          if (jobStatus === 'SUCCEEDED') {
            // Obtém todos os blocos paginados
            blocks = await TextractService.getFullBlocksList(jobId);
            break;
          }

          if (jobStatus === 'FAILED' || jobStatus === 'PARTIAL_SUCCESS') {
            throw new Error(`O processamento do Textract falhou com status: ${jobStatus}`);
          }
        }

        // 5. Parsear os blocos retornados
        parsedResult = parseTextractBlocks(blocks);

      } finally {
        // 6. Garante a remoção do arquivo temporário do S3 em qualquer cenário
        try {
          await TextractService.deleteFromS3(tempBucket, tempKey);
        } catch (s3DelErr: any) {
          console.warn(`[Aviso] Falha ao deletar arquivo temporário ${tempKey} no S3:`, s3DelErr.message);
        }
      }
    }

    // Grava telemetria básica de logs de requisição no banco (opcional/adaptado)
    await BSynapseService.logRequest({
      apiKeyId: clientApiKeyId,
      endpointId: endpoint_id,
      slug,
      latencyMs: 100, // aproximado ou calculado
      statusCode: 200
    });

    // ==========================================
    // TRATAMENTO DE EXPORTAÇÃO: CSV
    // ==========================================
    if (format === 'csv') {
      const csvData = convertToCsv(parsedResult);
      
      // \ufeff avisa o Excel para abrir em UTF-8 direto, corrigindo a acentuação (João)
      const bomCsvData = '\ufeff' + csvData;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=extracted_${Date.now()}.csv`);
      return res.status(200).send(bomCsvData);
    }

// ==========================================
    // TRATAMENTO DE EXPORTAÇÃO: PDF (Renderização Dinâmica via Textract)
    // ==========================================
    if (format === 'pdf') {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: true });
      const chunks: any[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=extracted_${Date.now()}.pdf`);
        return res.status(200).send(pdfBuffer);
      });

      const PAGE_WIDTH = 782; // largura útil em paisagem A4 (842 - 2*30)
      const START_X = 30;
      const MARGIN_BOTTOM = 30;

      // --- HELPER DE QUEBRA DE PÁGINA (só adiciona página se realmente necessário) ---
      let isSwappingPage = false;
      const checkPageBounds = (neededHeight: number) => {
        const pageBottom = doc.page.height - MARGIN_BOTTOM;
        if (doc.y + neededHeight > pageBottom && !isSwappingPage) {
          isSwappingPage = true;
          doc.addPage();
          doc.y = 30; // Margem superior da nova página
          isSwappingPage = false;
          return true;
        }
        return false;
      };

      // --- ESPAÇAMENTO SEGURO: nunca empurra o cursor além do limite da página ---
      const safeSpace = (pixels: number) => {
        const pageBottom = doc.page.height - MARGIN_BOTTOM;
        const available = pageBottom - doc.y;
        if (available > pixels) {
          doc.y += pixels;
        } else {
          // Se o espaço seguro não couber na página atual, força a criação de uma página nova
          // em vez de deixar o cursor colado na borda inferior ou gerar quebra incorreta depois
          checkPageBounds(pixels);
        }
      };

      // --- CABEÇALHO GENÉRICO DO RELATÓRIO ---
      doc.fillColor('#1a73e8').font('Helvetica-Bold').fontSize(16).text('B/SYNAPSE — EXTRAÇÃO DE DOCUMENTO', { align: 'center' });
      doc.moveDown(0.3);
      doc.moveTo(START_X, doc.y).lineTo(812, doc.y).strokeColor('#1a73e8').lineWidth(1.5).stroke();
      doc.moveDown(0.5);

      doc.fillColor('#555555').font('Helvetica').fontSize(9);
      doc.text(`Documento de Origem: `, { continued: true }).font('Helvetica-Bold').text(req.file?.originalname || 'documento');
      doc.font('Helvetica').text(`Data da Análise: `, { continued: true }).font('Helvetica-Bold').text(new Date().toLocaleString('pt-BR'));
      doc.font('Helvetica').text(`Estratégia: `, { continued: true }).font('Helvetica-Bold').text('Análise via AWS Textract (TABLES + FORMS + LAYOUT)');
      safeSpace(14);
      doc.moveTo(START_X, doc.y).lineTo(812, doc.y).strokeColor('#e0e0e0').lineWidth(1).stroke();
      safeSpace(10);

      // --- SEÇÃO 0: CONSULTAS (QUERIES NATIVAS) ---
      if (parsedResult.queryResults && Object.keys(parsedResult.queryResults).length > 0) {
        checkPageBounds(30);
        doc.fillColor('#1a73e8').font('Helvetica-Bold').fontSize(11).text('Consultas Customizadas (Queries)', START_X, doc.y);
        safeSpace(8);

        const queryColWidths = [250, PAGE_WIDTH - 250];

        // Cabeçalho da seção Queries
        const queryHeaderY = doc.y;
        doc.rect(START_X, queryHeaderY, PAGE_WIDTH, 18).fill('#f1f3f4');
        ['Query / Campo', 'Resultado'].forEach((label, idx) => {
          const cellX = START_X + queryColWidths.slice(0, idx).reduce((a, b) => a + b, 0);
          doc.rect(cellX, queryHeaderY, queryColWidths[idx], 18).strokeColor('#cccccc').lineWidth(0.4).stroke();
          doc.fillColor('#1a73e8').font('Helvetica-Bold').fontSize(8).text(label, cellX + 4, queryHeaderY + 5, { width: queryColWidths[idx] - 8 });
        });
        doc.y = queryHeaderY + 18;

        Object.entries(parsedResult.queryResults).forEach(([query, answer], qIdx) => {
          const lineText = [query, answer];
          let maxH = 10;
          doc.fontSize(7);
          lineText.forEach((t, i) => {
            const h = doc.heightOfString(t, { width: queryColWidths[i] - 8 });
            if (h > maxH) maxH = h;
          });
          const qRowH = maxH + 6;

          checkPageBounds(qRowH);
          const qY = doc.y;

          if (qIdx % 2 === 0) {
            doc.rect(START_X, qY, PAGE_WIDTH, qRowH).fill('#f7f8fa');
          }

          lineText.forEach((t, i) => {
            const cellX = START_X + queryColWidths.slice(0, i).reduce((a, b) => a + b, 0);
            doc.rect(cellX, qY, queryColWidths[i], qRowH).strokeColor('#d0d0d0').lineWidth(0.4).stroke();
            doc.fillColor('#202124').font('Helvetica').fontSize(7).text(t, cellX + 4, qY + 3, { width: queryColWidths[i] - 8, ellipsis: true });
          });

          doc.y = qY + qRowH;
        });

        safeSpace(10);
      }

      // --- SEÇÃO 1: TABELAS ---
      // Mescla tabelas consecutivas com mesmo número de colunas para evitar a
      // quebra artificial que o Textract faz por página do PDF original.
      const mergedTables: string[][][] = [];
      if (parsedResult.tables && parsedResult.tables.length > 0) {
        for (const rawTable of parsedResult.tables) {
          if (!rawTable || rawTable.length === 0) continue;
          const numCols = rawTable[0].length;
          const last = mergedTables[mergedTables.length - 1];
          // Se a tabela anterior tem o mesmo número de colunas → é continuação, une
          if (last && last[0].length === numCols) {
            last.push(...rawTable);
          } else {
            mergedTables.push([...rawTable]);
          }
        }
      }

      if (mergedTables.length > 0) {
        mergedTables.forEach((table, tableIndex) => {
          if (!table || table.length === 0) return;

          const numCols = table[0].length || 1;
          const colWidth = Math.floor(PAGE_WIDTH / numCols);
          const colWidths = Array(numCols).fill(colWidth);
          colWidths[numCols - 1] = PAGE_WIDTH - colWidth * (numCols - 1);

          if (mergedTables.length > 1) {
            checkPageBounds(18);
            doc.fillColor('#1a73e8').font('Helvetica-Bold').fontSize(10).text(`Tabela ${tableIndex + 1}`, START_X, doc.y);
            safeSpace(6);
          }

          table.forEach((row, rowIndex) => {
            let maxCellHeight = 10;
            doc.fontSize(7);
            row.forEach((cell, cIdx) => {
              const h = doc.heightOfString(String(cell ?? ''), { width: colWidths[cIdx] - 8 });
              if (h > maxCellHeight) maxCellHeight = h;
            });
            const rowHeight = maxCellHeight + 6;

            checkPageBounds(rowHeight);

            const rowY = doc.y;

            if (rowIndex % 2 === 0) {
              doc.rect(START_X, rowY, PAGE_WIDTH, rowHeight).fill('#f7f8fa');
            }

            row.forEach((cell, cIdx) => {
              const cellX = START_X + colWidths.slice(0, cIdx).reduce((a, b) => a + b, 0);

              doc.rect(cellX, rowY, colWidths[cIdx], rowHeight)
                .strokeColor('#d0d0d0')
                .lineWidth(0.4)
                .stroke();

              doc.fillColor('#202124').font('Helvetica').fontSize(7);

              doc.text(String(cell ?? ''), cellX + 4, rowY + 3, {
                width: colWidths[cIdx] - 8,
                height: maxCellHeight,
                ellipsis: true,
                align: 'left'
              });
            });

            doc.y = rowY + rowHeight;
          });

          safeSpace(10);
        });
      }

      // --- SEÇÃO 2: KEY-VALUE PAIRS ---
      if (Object.keys(parsedResult.keyValuePairs).length > 0) {
        checkPageBounds(30);
        doc.fillColor('#1a73e8').font('Helvetica-Bold').fontSize(11).text('Pares Chave-Valor', START_X, doc.y);
        safeSpace(8);

        const kvColWidths = [250, PAGE_WIDTH - 250];

        // Cabeçalho da seção KV
        const kvHeaderY = doc.y;
        doc.rect(START_X, kvHeaderY, PAGE_WIDTH, 18).fill('#f1f3f4');
        ['Chave', 'Valor'].forEach((label, idx) => {
          const cellX = START_X + kvColWidths.slice(0, idx).reduce((a, b) => a + b, 0);
          doc.rect(cellX, kvHeaderY, kvColWidths[idx], 18).strokeColor('#cccccc').lineWidth(0.4).stroke();
          doc.fillColor('#1a73e8').font('Helvetica-Bold').fontSize(8).text(label, cellX + 4, kvHeaderY + 5, { width: kvColWidths[idx] - 8 });
        });
        doc.y = kvHeaderY + 18;

        Object.entries(parsedResult.keyValuePairs).forEach(([key, value], kvIdx) => {
          const lineText = [key, value];
          let maxH = 10;
          doc.fontSize(7);
          lineText.forEach((t, i) => {
            const h = doc.heightOfString(t, { width: kvColWidths[i] - 8 });
            if (h > maxH) maxH = h;
          });
          const kvRowH = maxH + 6;

          checkPageBounds(kvRowH);
          const kvY = doc.y;

          if (kvIdx % 2 === 0) {
            doc.rect(START_X, kvY, PAGE_WIDTH, kvRowH).fill('#f7f8fa');
          }

          lineText.forEach((t, i) => {
            const cellX = START_X + kvColWidths.slice(0, i).reduce((a, b) => a + b, 0);
            doc.rect(cellX, kvY, kvColWidths[i], kvRowH).strokeColor('#d0d0d0').lineWidth(0.4).stroke();
            doc.fillColor('#202124').font('Helvetica').fontSize(7).text(t, cellX + 4, kvY + 3, { width: kvColWidths[i] - 8, ellipsis: true });
          });

          doc.y = kvY + kvRowH;
        });

        safeSpace(10);
      }

      // --- SEÇÃO 3: TEXTO CORRIDO (fallback quando não há tabelas nem key-value) ---
      if (!parsedResult.tables?.length && !Object.keys(parsedResult.keyValuePairs).length && parsedResult.text) {
        checkPageBounds(20);
        doc.fillColor('#1a73e8').font('Helvetica-Bold').fontSize(11).text('Texto Extraído', START_X, doc.y);
        doc.moveDown(0.5);
        doc.fillColor('#202124').font('Helvetica').fontSize(9);
        parsedResult.text.split('\n').forEach(line => {
          if (line.trim()) {
            checkPageBounds(14);
            doc.text(line.trim(), START_X, doc.y, { width: PAGE_WIDTH });
          }
        });
      }

      // --- NUMERAÇÃO DE PÁGINAS ---
      // Removida a paginação conforme solicitado para evitar comportamento de duplicação do PDFKit.

      doc.end();
      return;
    }
    // ==========================================
    // RETORNO PADRÃO: JSON
    // ==========================================
    return res.status(200).json({
      success: true,
      data: parsedResult
    });

  } catch (error: any) {
    console.error(`[ERRO NA ROTA DINÂMICA DIRETA /:${slug}/direct]:`, error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || 'Falha ao processar arquivo diretamente.'
    });
  }
});

// 💥 ROTA DE STATUS: Permite que a aplicação externa consulte o status e resultado usando sua API Key
analyzeRouter.get('/jobs/:jobId', async (req: AuthenticatedRequest, res: Response) => {
  const { jobId } = req.params;
  const clientApiKeyId = req.apiKeyInfo?.id;

  try {
    if (!clientApiKeyId) {
      return res.status(401).json({ success: false, error: 'Contexto de autenticação ausente.' });
    }

    // A busca exige a validação do api_key_id associado para que um cliente não consulte jobs de outro
    const query = `
      SELECT job_id, status, raw_text, ai_result, error_message, created_at, updated_at
      FROM synapse.document_jobs
      WHERE job_id = $1 AND api_key_id = $2
    `;
    const result = await db.query(query, [jobId, clientApiKeyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Job não encontrado ou acesso não autorizado.' });
    }

    return res.status(200).json({
      success: true,
      job: result.rows[0]
    });

  } catch (error: any) {
    console.error(`[ERRO AO CONSULTAR STATUS DO JOB ${jobId}]:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'Falha ao obter status do processamento.'
    });
  }
});

// 💥 ROTA UNIVERSAL: O ":slug" captura qualquer endpoint dinamicamente
analyzeRouter.post('/:slug', async (req: AuthenticatedRequest, res: Response) => {
  const slug = req.params.slug as string;
  const clientApiKeyId = req.apiKeyInfo?.id;

  try {
    if (!clientApiKeyId) {
      return res.status(401).json({ success: false, error: 'Contexto de autenticação ausente.' });
    }

    // Chamamos o serviço universal passando o slug, o ID da chave e os dados enviados pelo cliente
    const result = await BSynapseService.executeDynamicAnalysis({
      slug,
      clientApiKeyId,
      requestBody: req.body
    });

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error(`[ERRO NA ROTA DINÂMICA /:${slug}]:`, error.message);
    
    // Tratamento de erros HTTP baseado na resposta do serviço
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || 'Falha ao processar análise dinâmica.'
    });
  }
});