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
  public static async executeDynamicAnalysis({ slug, clientApiKeyId, requestBody }: ExecutionParams) {
    
    // 1. VERIFICAÇÃO DE PERMISSÃO E RESOLUÇÃO DE METADADOS DO ENDPOINT
    const contextQuery = `
      SELECT 
        e.id AS endpoint_id,
        e.aws_model_id,
        e.temperature,
        p.system_prompt
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

    const { aws_model_id, temperature, system_prompt } = contextResult.rows[0];

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
        temperature: parseFloat(temperature),
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
      // Injetamos os dados estruturados do cliente dentro do escopo do prompt
      const stringifiedBody = JSON.stringify(requestBody, null, 2);
      
      awsPayload = {
        inputText: `System Instruction: ${system_prompt}\n\nClient Data Context:\n${stringifiedBody}\n\nExecute a análise estruturada e retorne os resultados.`,
        textGenerationConfig: {
          maxTokenCount: 2048,
          stopSequences: [],
          temperature: parseFloat(temperature),
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

    // Tratamento dos retornos específicos de cada player
    if (aws_model_id.includes('claude')) {
      return parsedData.content[0].text;
    } else if (aws_model_id.includes('titan')) {
      return parsedData.results[0].outputText;
    }

    return parsedData;
  }
}