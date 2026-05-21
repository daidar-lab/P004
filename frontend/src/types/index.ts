export type AwsModelId = 
  | 'TITAN_EXPRESS' 
  | 'TITAN_LITE' 
  | 'CLAUDE_HAIKU' 
  | 'CLAUDE_SONNET' 
  | 'LLAMA3_8B' 
  | 'LLAMA3_70B' 
  | 'MISTRAL_7B';

export interface Endpoint {
  id: string
  slug: string
  name: string
  aws_model_id: AwsModelId // O TypeScript vai garantir que aqui só entre os aliases novos
  temperature: number
  is_active: boolean
  created_at: string
  updated_at: string
  current_prompt?: PromptVersion
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