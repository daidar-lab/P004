import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from '../config/bedrock';
import { db } from '../config/database';

interface ExecutionParams {
  slug: string;
  clientApiKeyId: string;
  requestBody: any;
}

export class BSynapseService {
  /**
   * Grava assincronamente os metadados e telemetria da requisição na tabela de auditoria
   */
  public static async logRequest(params: {
    apiKeyId?: string;
    endpointId?: string;
    slug: string;
    latencyMs: number;
    awsModelId?: string;
    tokensInput?: number;
    tokensOutput?: number;
    statusCode: number;
    errorMessage?: string;
  }) {
    try {
      const query = `
        INSERT INTO synapse.request_logs 
          (api_key_id, endpoint_id, slug, latency_ms, aws_model_id, tokens_input, tokens_output, status_code, error_message)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, $9);
      `;
      await db.query(query, [
        params.apiKeyId || null,
        params.endpointId || null,
        params.slug,
        params.latencyMs,
        params.awsModelId || null,
        params.tokensInput || 0,
        params.tokensOutput || 0,
        params.statusCode,
        params.errorMessage || null
      ]);
    } catch (e) {
      console.error('[ERRO AO GRAVAR LOG DE TELEMETRIA]:', e);
    }
  }

  /**
   * Executa a orquestração dinâmica do prompt baseado no endpoint requisitado pelo slug
   */
  public static async executeDynamicAnalysis({ slug, clientApiKeyId, requestBody }: ExecutionParams) {
    const startTime = Date.now();
    let endpointId: string | undefined;
    let awsModelId: string | undefined;
    let tokensInput = 0;
    let tokensOutput = 0;

    try {
      // 1. VERIFICAÇÃO DE PERMISSÃO E RESOLUÇÃO DE METADADOS DO ENDPOINT (Lendo direto a estrutura real)
      const contextQuery = `
        SELECT 
          e.id AS endpoint_id,
          e.aws_model_id,     -- ID físico real vindo do banco (Ex: 'global.anthropic.claude-sonnet-4-6')
          e.is_multimodal,    -- Flag que você acabou de criar e validar via SQL
          e.temperature,
          p.system_prompt,
          p.user_prompt_template
        FROM synapse.endpoints e
        INNER JOIN synapse.api_key_permissions per ON per.endpoint_id = e.id
        INNER JOIN synapse.prompts_history p ON p.endpoint_id = e.id
        WHERE e.slug = $1 
          AND per.api_key_id = $2 
          AND e.is_active = TRUE 
          AND p.is_current = TRUE;
      `;

      const contextResult = await db.query(contextQuery, [slug, clientApiKeyId]);

      if (contextResult.rows.length === 0) {
        const error: any = new Error('Acesso negado ou endpoint inexistente para este token.');
        error.statusCode = 403;
        throw error;
      }

      const { 
        endpoint_id, 
        aws_model_id, 
        is_multimodal, 
        temperature, 
        system_prompt, 
        user_prompt_template 
      } = contextResult.rows[0];
      
      endpointId = endpoint_id;
      awsModelId = aws_model_id; 

      if (!awsModelId) {
        const error: any = new Error(`O endpoint [${slug}] não possui um aws_model_id válido configurado no banco.`);
        error.statusCode = 500;
        throw error;
      }

      // Função auxiliar para injetar variáveis do JSON no template {{chave}}
      const interpolateTemplate = (template: string, data: Record<string, any>): string => {
        if (!template) return '';
        let result = template;
        let startIndex = result.indexOf('{{');

        while (startIndex !== -1) {
          const endIndex = result.indexOf('}}', startIndex);
          if (endIndex === -1) break;

          const rawKey = result.substring(startIndex + 2, endIndex);
          const safeKey = rawKey.trim();

          let replacement = `{{${safeKey}}}`;
          if (Object.hasOwn(data, safeKey)) {
            const val = data[safeKey];
            if (val !== undefined) {
              replacement = String(val);
            }
          }

          result = result.substring(0, startIndex) + replacement + result.substring(endIndex + 2);
          startIndex = result.indexOf('{{', startIndex + replacement.length);
        }
        return result;
      };

      const finalUserText = user_prompt_template
        ? interpolateTemplate(user_prompt_template, requestBody)
        : `Client Data Context:\n${JSON.stringify(requestBody, null, 2)}\n\nExecute a análise estruturada e retorne os resultados.`;


        // 2. MONTAGEM DO CONTEXTO DE CONTEÚDO (Híbrido e Inteligente)
      const messageContent: any[] = [];
      const { imageBase64, mimeType } = requestBody;

      // Se o modelo suportar imagem E o usuário de fato enviou uma imagem, nós processamos ela
      if (is_multimodal && imageBase64 && mimeType) {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        
        messageContent.push({
          image: {
            format: mimeType.split('/')[1] || 'jpeg',
            source: {
              bytes: Buffer.from(base64Data, 'base64')
            }
          }
        });
      } 
// REMOVIDO: O bloco 'else if' que disparava o erro 400 foi removido.
// Se 'is_multimodal' for TRUE mas não vier imagem, o backend apenas ignora e envia o texto abaixo.

// Adiciona o texto do prompt na mensagem (Sempre obrigatório)
messageContent.push({ text: finalUserText });

// Adiciona o texto do prompt na mensagem (Sempre obrigatório)
messageContent.push({ text: finalUserText });

// REMOVIDO: O bloco 'else if' que disparava o erro 400 foi removido.
// Se 'is_multimodal' for TRUE mas não vier imagem, o backend apenas ignora e envia o texto abaixo.

// Adiciona o texto do prompt na mensagem (Sempre obrigatório)
messageContent.push({ text: finalUserText });


      // 3. EXECUÇÃO DA CONVERSE API (Sem condicionais de provedores)
      const command = new ConverseCommand({
        modelId: awsModelId,
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ],
        system: system_prompt ? [{ text: system_prompt }] : undefined,
        inferenceConfig: {
          maxTokens: 2048,
          temperature: Number.parseFloat(temperature) || 0.7
        }
      });

      const response = await bedrockClient.send(command);

      // Coleta automática de tokens para a telemetria
      if (response.usage) {
        tokensInput = response.usage.inputTokens || 0;
        tokensOutput = response.usage.outputTokens || 0;
      }

      const latencyMs = Date.now() - startTime;
      
      // Captura o texto retornado pelo tradutor universal do Bedrock
      const responseText = response.output?.message?.content?.[0]?.text || '';

      // Grava o log com sucesso de execução
      await this.logRequest({
        apiKeyId: clientApiKeyId,
        endpointId,
        slug,
        latencyMs,
        awsModelId,
        tokensInput,
        tokensOutput,
        statusCode: 200
      });

      return {
        success: true,
        data: responseText
      };

    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      const statusCode = error.statusCode || 500;

      // Grava o log registrando o erro que aconteceu na execução
      await this.logRequest({
        apiKeyId: clientApiKeyId,
        endpointId,
        slug,
        latencyMs,
        awsModelId,
        tokensInput,
        tokensOutput,
        statusCode,
        errorMessage: error.message
      });

      throw error;
    }
  }
}
