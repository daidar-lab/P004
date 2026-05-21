import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from '../config/bedrock';
import { db } from '../config/database';

interface ExecutionParams {
  slug: string;
  clientApiKeyId: string;
  requestBody: any;
}

// 1. CAMADA DE ABSTRAÇÃO: Centraliza as regras e identificadores estáveis dos modelos
const MODEL_MAPPING: Record<
  string, 
  { aws_id: string; provider: 'claude' | 'titan' | 'meta' | 'mistral'; isMultimodal: boolean }
> = {
  // Família de Texto Proprietária (Amazon) - Atualizado
  'TITAN_EXPRESS': {
    aws_id: 'us.amazon.nova-lite-v1:0', 
    provider: 'titan', // Mantido para compatibilidade interna, se necessário
    isMultimodal: true 
  },
  'TITAN_LITE': {
    aws_id: 'us.amazon.nova-micro-v1:0', 
    provider: 'titan',
    isMultimodal: false
  },

  // Família Claude (Anthropic) - Atualizado
  'CLAUDE_HAIKU': {
    aws_id: 'global.anthropic.claude-haiku-4-5-20251001-v1:0', 
    provider: 'claude',
    isMultimodal: true
  },
  'CLAUDE_SONNET': {
    aws_id: 'global.anthropic.claude-sonnet-4-6', 
    provider: 'claude',
    isMultimodal: true
  },

  // Família Llama (Meta) - Atualizado
  'LLAMA_8B': {
    aws_id: 'us.meta.llama3-1-8b-instruct-v1:0',
    provider: 'meta',
    isMultimodal: false
  },
  'LLAMA_70B': {
    aws_id: 'us.meta.llama3-3-70b-instruct-v1:0',
    provider: 'meta',
    isMultimodal: false
  },
  'LLAMA_SMALL_MULTIMODAL': {
    aws_id: 'us.meta.llama3-2-11b-instruct-v1:0',
    provider: 'meta',
    isMultimodal: true
  },

  // Família Mistral (Mistral AI) - Atualizado
  'MISTRAL_SMALL': {
    aws_id: 'us.mistral.ministral-3-8b-instruct-v1:0',
    provider: 'mistral',
    isMultimodal: false
  },
  'MISTRAL_LARGE': {
    aws_id: 'us.mistral.mistral-large-2407-v1:0',
    provider: 'mistral',
    isMultimodal: false
  }
};

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

      const { endpoint_id, aws_model_id: dbModelAlias, temperature, system_prompt, user_prompt_template } = contextResult.rows[0];
      endpointId = endpoint_id;

      const modelConfig = MODEL_MAPPING[dbModelAlias];
      if (!modelConfig) {
        const error: any = new Error(`Alias de modelo [${dbModelAlias}] cadastrado no banco não possui mapeamento no backend.`);
        error.statusCode = 501;
        throw error;
      }

      awsModelId = modelConfig.aws_id;

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

      // 2. MONTAGEM DO CONTEXTO DE CONTEÚDO (Suporte unificado a Texto e Imagem/Multimodalidade)
      const messageContent: any[] = [];
      const { imageBase64, mimeType } = requestBody;

      if (modelConfig.isMultimodal && imageBase64 && mimeType) {
        // Formato unificado da Converse API para enviar imagens (Nova, Claude e Llama leem igual!)
        // O SDK espera o buffer puro ou string tratada. Passamos em formato de bytes/Uint8Array se necessário,
        // mas a estrutura padrão aceita o objeto diretamente dependendo da versão. Ajustado para o padrão seguro do SDK v3:
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        
        messageContent.push({
          image: {
            format: mimeType.split('/')[1] || 'jpeg', // Transforma "image/png" em "png"
            source: {
              bytes: Buffer.from(base64Data, 'base64')
            }
          }
        });
      } else if (modelConfig.isMultimodal && (!imageBase64 || !mimeType)) {
        const error: any = new Error('Payload inválido para análise visual. Atributos imageBase64 e mimeType são obrigatórios.');
        error.statusCode = 400;
        throw error;
      }

      // Adiciona o texto do prompt original na mensagem
      messageContent.push({ text: finalUserText });

      // 3. EXECUÇÃO DA CONVERSE API (Estrutura idêntica para qualquer LLM da lista)
      const command = new ConverseCommand({
        modelId: modelConfig.aws_id,
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ],
        // O system prompt entra como uma propriedade dedicada na Converse API
        system: system_prompt ? [{ text: system_prompt }] : undefined,
        inferenceConfig: {
          maxTokens: 2048,
          temperature: Number.parseFloat(temperature) || 0.7
        }
      });

      // Dispara a requisição usando o bedrockClient injetado do seu arquivo de configuração
      const response = await bedrockClient.send(command);

      // Coleta automática e precisa de tokens para a sua auditoria
      if (response.usage) {
        tokensInput = response.usage.inputTokens || 0;
        tokensOutput = response.usage.outputTokens || 0;
      }

      const latencyMs = Date.now() - startTime;

      // Captura o texto final retornado
      const responseText = response.output?.message?.content?.[0]?.text || '';

      // Grava o log com sucesso
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

      // Grava o log registrando a falha
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
