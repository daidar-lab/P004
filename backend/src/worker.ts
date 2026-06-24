import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message
} from "@aws-sdk/client-sqs";
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { sqsClient } from "./config/sqs";
import { bedrockClient } from "./config/bedrock";
import { db } from "./config/database";
import { TextractService } from "./services/textractService";
import dotenv from "dotenv";

dotenv.config();

const QUEUE_URL = process.env.AWS_SQS_QUEUE_URL;
const MAX_PROMPT_CHARS = 100000;

interface SNSMessageBody {
  JobId?: string;
  Status?: string;
  [key: string]: any;
}

/**
 * Interpolates variables in format {{variable}} with data
 */
function interpolateTemplate(template: string, data: Record<string, any>): string {
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
}

/**
 * Updates DB job state to FAILED
 */
async function markJobAsFailed(jobId: string, errorMsg: string) {
  try {
    await db.query(
      `UPDATE synapse.document_jobs 
       SET status = 'FAILED', error_message = $1, updated_at = NOW() 
       WHERE job_id = $2`,
      [errorMsg.substring(0, 500), jobId]
    );
    console.log(`[WORKER] Job ${jobId} marcado como FAILED: ${errorMsg}`);
  } catch (err) {
    console.error(`[WORKER] Erro crítico ao atualizar status de falha para ${jobId}:`, err);
  }
}

/**
 * Deletes a message from SQS safely
 */
async function deleteSQSMessage(receiptHandle: string) {
  if (!QUEUE_URL) return;
  try {
    await sqsClient.send(new DeleteMessageCommand({
      QueueUrl: QUEUE_URL,
      ReceiptHandle: receiptHandle
    }));
    console.log('[WORKER] Mensagem removida da fila SQS.');
  } catch (err) {
    console.error('[WORKER] Erro ao deletar mensagem da fila SQS:', err);
  }
}

/**
 * Process single SQS message
 */
async function processMessage(message: Message) {
  const receiptHandle = message.ReceiptHandle;
  if (!receiptHandle) return;

  let jobId: string | undefined;
  let status: string | undefined;

  // STEP 1 — PARSE MESSAGE
  let bodyJson: any;
  let snsMsg: SNSMessageBody;
  try {
    if (!message.Body) throw new Error("Mensagem sem Body");
    bodyJson = JSON.parse(message.Body);

    // In SQS-SNS subscription, the SNS notification is in bodyJson.Message
    if (bodyJson.Message) {
      snsMsg = JSON.parse(bodyJson.Message);
    } else {
      snsMsg = bodyJson; // Fallback directly
    }
  } catch (err: any) {
    console.error("[WORKER][STEP 1] Falha de parse no Body/Message:", err.message);
    // GATE: FAIL ➔ DELETE MESSAGE + EXIT
    await deleteSQSMessage(receiptHandle);
    return;
  }

  // STEP 2 — VALIDATE SNS
  jobId = snsMsg.JobId;
  status = snsMsg.Status;

  if (!jobId || typeof jobId !== "string" || jobId.trim() === "") {
    console.error("[WORKER][STEP 2] JobId inválido ou ausente.");
    await deleteSQSMessage(receiptHandle);
    return;
  }

  const validStatuses = ["SUCCEEDED", "FAILED", "PARTIAL_SUCCESS"];
  if (!status || !validStatuses.includes(status)) {
    console.error(`[WORKER][STEP 2] Status inválido ou ausente: ${status}`);
    await deleteSQSMessage(receiptHandle);
    return;
  }

  console.log(`[WORKER] Iniciando processamento do Job ID: ${jobId} (Status SQS: ${status})`);

  // STEP 3 — LOAD DB STATE
  let jobResult: any;
  try {
    const res = await db.query(
      `SELECT id, status, endpoint_id, api_key_id FROM synapse.document_jobs WHERE job_id = $1`,
      [jobId]
    );
    if (res.rows.length === 0) {
      console.warn(`[WORKER][STEP 3] Job ${jobId} não encontrado no banco de dados.`);
      // GATE: IF not found ➔ DELETE MESSAGE
      await deleteSQSMessage(receiptHandle);
      return;
    }
    jobResult = res.rows[0];
  } catch (err: any) {
    console.error("[WORKER][STEP 3] Erro ao carregar estado do banco:", err.message);
    // Do not delete message to allow retry on DB failure
    return;
  }

  // STEP 4 — IDEMPOTÊNCIA
  if (jobResult.status !== 'PROCESSING') {
    console.log(`[WORKER][STEP 4] Job ${jobId} já está com status ${jobResult.status}. Ignorando e deletando.`);
    // GATE: IF status != PROCESSING ➔ DELETE MESSAGE + EXIT
    await deleteSQSMessage(receiptHandle);
    return;
  }

  // STEP 5 — STATUS TEXTRACT
  if (status !== 'SUCCEEDED') {
    // GATE: IF Status != SUCCEEDED ➔ UPDATE job.status = FAILED
    await markJobAsFailed(jobId, "TEXTRACT_FAILED");
    await deleteSQSMessage(receiptHandle);
    return;
  }

  try {
    const startTime = Date.now();

    // STEP 6 — PAGINAÇÃO TEXTRACT
    console.log(`[WORKER][STEP 6] Obtendo resultado paginado do Textract para Job ${jobId}...`);
    const { rawText, totalLines } = await TextractService.getBlocksAndText(jobId);

    // GATE: IF blocks.length == 0 ➔ FAIL
    if (totalLines === 0 || !rawText || rawText.trim() === "") {
      throw new Error("TEXTRACT_NO_TEXT_EXTRACTED");
    }

    // STEP 7 & 8 — EXTRAÇÃO E NORMALIZAÇÃO
    // INVARIANT R8: raw_text MUST be truncated before Bedrock
    const normalizedText = rawText.slice(0, MAX_PROMPT_CHARS);
    console.log(`[WORKER][STEP 7/8] Texto extraído (${rawText.length} chars, normalizado para ${normalizedText.length} chars).`);

    // STEP 9 — CHAMADA BEDROCK
    console.log(`[WORKER][STEP 9] Carregando prompts e model para Endpoint ID: ${jobResult.endpoint_id}`);
    const contextQuery = `
      SELECT 
        e.aws_model_id,
        e.temperature,
        p.system_prompt,
        p.user_prompt_template
      FROM synapse.endpoints e
      INNER JOIN synapse.prompts_history p ON p.endpoint_id = e.id
      WHERE e.id = $1 
        AND e.is_active = TRUE 
        AND p.is_current = TRUE;
    `;
    const contextRes = await db.query(contextQuery, [jobResult.endpoint_id]);
    if (contextRes.rows.length === 0) {
      throw new Error("ENDPOINT_CONFIG_NOT_FOUND");
    }

    const {
      aws_model_id,
      temperature,
      system_prompt,
      user_prompt_template
    } = contextRes.rows[0];

    if (!aws_model_id) {
      throw new Error("AWS_MODEL_ID_NOT_CONFIGURED");
    }

    // Interpolate template or fallback
    const userPromptText = user_prompt_template
      ? interpolateTemplate(user_prompt_template, { text: normalizedText })
      : `Análise do seguinte documento:\n\n${normalizedText}`;

    console.log(`[WORKER][STEP 9] Invocando Bedrock (${aws_model_id})...`);

    const command = new ConverseCommand({
      modelId: aws_model_id,
      messages: [
        {
          role: 'user',
          content: [{ text: userPromptText }]
        }
      ],
      system: system_prompt ? [{ text: system_prompt }] : undefined,
      inferenceConfig: {
        maxTokens: 4096,
        temperature: Number.parseFloat(temperature) || 0.5
      }
    });

    const bedrockResponse = await bedrockClient.send(command);
    const aiResult = bedrockResponse.output?.message?.content?.[0]?.text;

    // GATE: output_text != null AND length > 0
    if (!aiResult || aiResult.trim() === "") {
      throw new Error("BEDROCK_EMPTY_RESPONSE");
    }

    // STEP 10 — PERSISTÊNCIA SUCESSO
    console.log(`[WORKER][STEP 10] Salvando resultado no banco de dados...`);
    const updateRes = await db.query(
      `UPDATE synapse.document_jobs
       SET status = 'COMPLETED',
           raw_text = $1,
           ai_result = $2,
           updated_at = NOW()
       WHERE job_id = $3 AND status = 'PROCESSING'`,
      [normalizedText, aiResult, jobId]
    );

    // GATE: IF rows affected != 1 ➔ FAIL
    if (updateRes.rowCount !== 1) {
      throw new Error("DB_UPDATE_CONCURRENCY_ERROR");
    }

    const processingMs = Date.now() - startTime;
    console.log(`[WORKER] Job ${jobId} COMPLETED com sucesso em ${processingMs}ms!`);

    // STEP 11 — DELETE MESSAGE
    // INVARIANT R6: DeleteMessage SOMENTE após persistência DB confirmada
    await deleteSQSMessage(receiptHandle);

    // Success log representation (as per output contract)
    console.log(JSON.stringify({
      job_id: jobId,
      status: "COMPLETED",
      metrics: {
        raw_text_chars: normalizedText.length,
        lines_extracted: totalLines,
        processing_ms: processingMs
      }
    }, null, 2));

  } catch (err: any) {
    console.error(`[WORKER][GLOBAL_FAIL] Erro no processamento do Job ${jobId}:`, err.message);

    // STEP FAIL (GLOBAL)
    await markJobAsFailed(jobId || "UNKNOWN", err.message || "UNKNOWN_ERROR");
    await deleteSQSMessage(receiptHandle);

    console.log(JSON.stringify({
      job_id: jobId || "UNKNOWN",
      status: "FAILED",
      error: {
        code: err.message || "UNKNOWN_ERROR",
        stage: err.message?.includes("TEXTRACT") ? "TEXTRACT" :
          err.message?.includes("BEDROCK") ? "BEDROCK" :
            err.message?.includes("DB") ? "DB" : "VALIDATION",
        retryable: false
      }
    }, null, 2));
  }
}

/**
 * SQS Polling Loop Daemon
 */
async function startWorker() {
  if (!QUEUE_URL) {
    console.error("ERRO CRÍTICO: A variável de ambiente AWS_SQS_QUEUE_URL não está configurada.");
    process.exit(1);
  }

  console.log(`[WORKER] SQS Poller ativo na fila: ${QUEUE_URL}`);

  while (true) {
    try {
      // STEP 0 — POLLING
      const response = await sqsClient.send(new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        WaitTimeSeconds: 20,
        MaxNumberOfMessages: 10
      }));

      const messages = response.Messages || [];
      if (messages.length > 0) {
        console.log(`[WORKER] Recebidas ${messages.length} mensagens.`);
        for (const msg of messages) {
          await processMessage(msg);
        }
      }
    } catch (err: any) {
      console.error("[WORKER] Erro no polling da fila SQS:", err.message);
      // Wait a few seconds before retrying to prevent hot loop on connection errors
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Start polling
startWorker().catch(err => {
  console.error("[WORKER] Fatal error:", err);
  process.exit(1);
});
