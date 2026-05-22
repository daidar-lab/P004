// frontend/src/types/index.ts - Atualizado com os IDs reais do Bedrock
export type AwsModelId =

  | 'global.anthropic.claude-sonnet-4-6'
  | 'global.anthropic.claude-haiku-4-5-20251001-v1:0'
  | 'us.amazon.nova-lite-v1:0'

  | 'us.amazon.nova-micro-v1:0'
  | 'us.meta.llama3-1-8b-instruct-v1:0'
  | 'us.meta.llama3-3-70b-instruct-v1:0'

  | 'us.mistral.ministral-3-8b-instruct-v1:0'
  | 'us.mistral.mistral-large-2407-v1:0'
  | (string & {});


export interface Endpoint {
  id: string;
  slug: string;
  name: string;
  aws_model_id: string; // O TypeScript agora vai validar os IDs de produção novos
  temperature: number;
  is_active: boolean;
  is_multimodal: boolean;
  created_at: string;
  updated_at: string;
  current_prompt?: PromptVersion;
}

export interface PromptVersion {
  id: string
  endpoint_id: string
  system_prompt: string
  user_prompt_template: string | null
  version: number
  is_current: boolean
  created_at: string
  created_by: string
}

export interface ApiKey {
  id: string
  client_name: string
  api_key: string
  is_active: boolean
  created_at: string
  expires_at: string | null
  endpoints_count: number
}