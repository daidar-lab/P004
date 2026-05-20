import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { db } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

// Inicialização do cliente AWS Bedrock em modelo Singleton utilizando Keep-Alive
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
});

interface ExecutionParams {
  slug: string;
  clientApiKeyId: string;
  requestBody: any;
}

export class BSynapseService {
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

  public static async executeDynamicAnalysis({ slug, clientApiKeyId, requestBody }: ExecutionParams) {
    const startTime = Date.now();
    let endpointId: string | undefined;
    let awsModelId: string | undefined;
    let tokensInput = 0;
    let tokensOutput = 0;

    try {
      // 1. VERIFICAÇÃO DE PERMISSÃO E RESOLUÇÃO DE METADADOS DO ENDPOINT
      const contextQuery = `
        SELECT 
          e.id AS endpoint_id,
          e.aws_model_id,
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

      const { endpoint_id, aws_model_id, temperature, system_prompt, user_prompt_template } = contextResult.rows[0];
      endpointId = endpoint_id;
      awsModelId = aws_model_id;

      // Função auxiliar para injetar variáveis do JSON no template {{chave}}
      const interpolateTemplate = (template: string, data: Record<string, any>): string => {
        if (!template) return '';

        return template.replace(/\{\{\s*([^{}]+)\s*\}\}/g, (_, key) => {
          const safeKey = key.trim();

          if (!Object.prototype.hasOwnProperty.call(data, safeKey)) {
            return `{{${safeKey}}}`;
          }

          const val = data[safeKey];
          return val !== undefined ? val : `{{${safeKey}}}`;
        });
      };

      // 2. ORQUESTRAÇÃO E MONTAGEM DO PAYLOAD CONFORME O MODELO ALVO
      let awsPayload: any;

      // Cenário A: Integração Multimodal Claude (Processamento de Imagens - P007)
      if (aws_model_id.includes('claude')) {
        const { imageBase64, mimeType } = requestBody;

        if (!imageBase64 || !mimeType) {
          const error: any = new Error('Payload inválido para análise visual. Atributos imageBase64 e mimeType são obrigatórios.');
          error.statusCode = 400;
          throw error;
        }

        awsPayload = {
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 2000,
          temperature: Number.parseFloat(temperature),
          system: system_prompt,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mimeType,
                    data: imageBase64
                  }
                },
                {
                  type: "text",
                  text: "Execute a análise de riscos em conformidade com as diretrizes do sistema."
                }
              ]
            }
          ]
        };
      }
      // Cenário B: Integração Textual Titan (Análise de Faturas - P001)
      else if (aws_model_id.includes('titan')) {
        // Se houver um template cadastrado, injetamos os dados. Se não, formatamos o JSON cru.
        const finalUserText = user_prompt_template
          ? interpolateTemplate(user_prompt_template, requestBody)
          : `Client Data Context:\n${JSON.stringify(requestBody, null, 2)}\n\nExecute a análise estruturada e retorne os resultados.`;

        awsPayload = {
          inputText: `${system_prompt}\n\n${finalUserText}`,
          textGenerationConfig: {
            maxTokenCount: 2048,
            stopSequences: [],
            temperature: Number.parseFloat(temperature),
            topP: 0.9
          }
        };
      }
      // Fallback de Segurança
      else {
        const error: any = new Error(`Provedor de modelo [${aws_model_id}] homologado no banco mas sem driver de parser no serviço.`);
        error.statusCode = 501;
        throw error;
      }

      // 3. DESPACHO DA REQUISIÇÃO PARA O PERÍMETRO DA AWS
      const command = new InvokeModelCommand({
        modelId: aws_model_id,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(awsPayload),
      });

      const awsResponse = await bedrockClient.send(command);

      // 4. NORMALIZAÇÃO DA RESPOSTA EM TEMPO DE RUNTIME
      const responseDecoder = new TextDecoder('utf-8');
      const rawResponseBody = responseDecoder.decode(awsResponse.body);
      const parsedData = JSON.parse(rawResponseBody);

      // Extração de consumo de tokens
      if (aws_model_id.includes('claude')) {
        tokensInput = parsedData.usage?.input_tokens || 0;
        tokensOutput = parsedData.usage?.output_tokens || 0;
      } else if (aws_model_id.includes('titan')) {
        tokensInput = parsedData.inputTextTokenCount || 0;
        tokensOutput = parsedData.results?.[0]?.tokenCount || 0;
      }

      const latencyMs = Date.now() - startTime;

      // Gravação assíncrona do log de sucesso
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

      // Tratamento dos retornos específicos de cada player
      if (aws_model_id.includes('claude')) {
        return parsedData.content[0].text;
      } else if (aws_model_id.includes('titan')) {
        return parsedData.results[0].outputText;
      }

      return parsedData;

    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      const statusCode = error.statusCode || 500;

      // Gravação assíncrona do log de erro
      await this.logRequest({
        apiKeyId: clientApiKeyId,
        endpointId,
        slug,
        latencyMs,
        awsModelId,
        tokensInput,
        tokensOutput,
        statusCode,
        errorMessage: error.message || 'Erro interno de processamento.'
      });

      throw error;
    }
  }
}