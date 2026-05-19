export type AwsModelId =
  | 'amazon.titan-text-express-v1'
  | 'amazon.titan-text-lite-v1'
  | 'anthropic.claude-3-haiku-20240307-v1:0'
  | 'anthropic.claude-3-sonnet-20240229-v1:0'
  | 'anthropic.claude-3-5-sonnet-20240620-v1:0'
  | 'meta.llama3-8b-instruct-v1:0'
  | 'meta.llama3-70b-instruct-v1:0'
  | 'mistral.mistral-7b-instruct-v0:2'

export interface Endpoint {
  id: string
  slug: string
  name: string
  aws_model_id: AwsModelId
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
