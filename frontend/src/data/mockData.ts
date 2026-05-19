export type AwsModelId =
  | 'amazon.titan-text-express-v1'
  | 'amazon.titan-text-lite-v1'
  | 'anthropic.claude-3-haiku-20240307-v1:0'
  | 'anthropic.claude-3-sonnet-20240229-v1:0'
  | 'anthropic.claude-3-5-sonnet-20240620-v1:0'
  | 'meta.llama3-8b-instruct-v1:0'
  | 'meta.llama3-70b-instruct-v1:0'
  | 'mistral.mistral-7b-instruct-v0:2'

export const AWS_MODELS: { id: AwsModelId; label: string; provider: string }[] = [
  { id: 'amazon.titan-text-express-v1', label: 'Titan Text Express', provider: 'Amazon' },
  { id: 'amazon.titan-text-lite-v1', label: 'Titan Text Lite', provider: 'Amazon' },
  { id: 'anthropic.claude-3-haiku-20240307-v1:0', label: 'Claude 3 Haiku', provider: 'Anthropic' },
  { id: 'anthropic.claude-3-sonnet-20240229-v1:0', label: 'Claude 3 Sonnet', provider: 'Anthropic' },
  { id: 'anthropic.claude-3-5-sonnet-20240620-v1:0', label: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'meta.llama3-8b-instruct-v1:0', label: 'Llama 3 (8B)', provider: 'Meta' },
  { id: 'meta.llama3-70b-instruct-v1:0', label: 'Llama 3 (70B)', provider: 'Meta' },
  { id: 'mistral.mistral-7b-instruct-v0:2', label: 'Mistral 7B', provider: 'Mistral AI' },
]

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

export const MOCK_ENDPOINTS: Endpoint[] = [
  {
    id: 'a1b2c3d4-0001-0000-0000-000000000001',
    slug: 'energy',
    name: 'Análise de Energia',
    aws_model_id: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    temperature: 0.35,
    is_active: true,
    created_at: '2024-11-10T09:00:00Z',
    updated_at: '2025-01-15T14:22:00Z',
    current_prompt: {
      id: 'p1-v3',
      endpoint_id: 'a1b2c3d4-0001-0000-0000-000000000001',
      system_prompt:
        'Você é um especialista em análise de consumo de energia elétrica e eficiência energética. Seu papel é interpretar dados de consumo, identificar anomalias e sugerir medidas de economia. Sempre apresente respostas objetivas com base nos dados fornecidos. Quando relevante, indique a porcentagem de economia potencial.',
      user_prompt_template:
        'Analise os seguintes dados de consumo: {{consumption_data}}. Período de referência: {{period}}.',
      version: 3,
      is_current: true,
      created_at: '2025-01-15T14:22:00Z',
      created_by: 'admin@bsynapse.io',
    },
  },
  {
    id: 'a1b2c3d4-0002-0000-0000-000000000002',
    slug: 'intervention',
    name: 'Suporte a Intervenções',
    aws_model_id: 'anthropic.claude-3-haiku-20240307-v1:0',
    temperature: 0.6,
    is_active: true,
    created_at: '2024-11-12T10:30:00Z',
    updated_at: '2025-01-18T11:05:00Z',
    current_prompt: {
      id: 'p2-v2',
      endpoint_id: 'a1b2c3d4-0002-0000-0000-000000000002',
      system_prompt:
        'Você é um assistente de suporte técnico especializado em intervenções de campo para instalações elétricas industriais. Forneça instruções claras, seguras e passo-a-passo. Sempre priorize a segurança do técnico. Se houver risco de vida, instrua a desligar imediatamente o equipamento.',
      user_prompt_template: null,
      version: 2,
      is_current: true,
      created_at: '2025-01-18T11:05:00Z',
      created_by: 'admin@bsynapse.io',
    },
  },
  {
    id: 'a1b2c3d4-0003-0000-0000-000000000003',
    slug: 'report-gen',
    name: 'Gerador de Relatórios',
    aws_model_id: 'amazon.titan-text-express-v1',
    temperature: 0.2,
    is_active: true,
    created_at: '2024-12-01T08:00:00Z',
    updated_at: '2025-01-20T16:40:00Z',
    current_prompt: {
      id: 'p3-v1',
      endpoint_id: 'a1b2c3d4-0003-0000-0000-000000000003',
      system_prompt:
        'Você é um gerador de relatórios executivos. Transforme dados brutos em relatórios claros, profissionais e visualmente organizados. Use marcações Markdown. Inclua sempre: sumário executivo, métricas-chave, análise e recomendações.',
      user_prompt_template: 'Dados para o relatório: {{report_data}}. Formato: {{format}}.',
      version: 1,
      is_current: true,
      created_at: '2025-01-20T16:40:00Z',
      created_by: 'admin@bsynapse.io',
    },
  },
  {
    id: 'a1b2c3d4-0004-0000-0000-000000000004',
    slug: 'classifier',
    name: 'Classificador de Tickets',
    aws_model_id: 'meta.llama3-8b-instruct-v1:0',
    temperature: 0.1,
    is_active: false,
    created_at: '2024-12-15T13:00:00Z',
    updated_at: '2025-01-05T09:00:00Z',
    current_prompt: {
      id: 'p4-v1',
      endpoint_id: 'a1b2c3d4-0004-0000-0000-000000000004',
      system_prompt:
        'Classifique tickets de suporte nas categorias: URGENTE, ALTA, MEDIA ou BAIXA prioridade. Retorne apenas um JSON com os campos: prioridade, categoria e justificativa.',
      user_prompt_template: 'Ticket: {{ticket_content}}',
      version: 1,
      is_current: true,
      created_at: '2025-01-05T09:00:00Z',
      created_by: 'system',
    },
  },
]

export const MOCK_API_KEYS: ApiKey[] = [
  {
    id: 'k1',
    client_name: 'Portal Cliente — EnergiaCorp',
    api_key: 'syn_live_ec7a2f9d1b3e4c8a0f6d2e9b1a3c7f5e',
    is_active: true,
    created_at: '2024-11-01T00:00:00Z',
    expires_at: '2026-11-01T00:00:00Z',
    endpoints_count: 3,
  },
  {
    id: 'k2',
    client_name: 'App Mobile — TechField',
    api_key: 'syn_live_3f8b2c1a9e7d4f0b6a2c8e5d1f3b7a9c',
    is_active: true,
    created_at: '2024-12-10T00:00:00Z',
    expires_at: null,
    endpoints_count: 1,
  },
  {
    id: 'k3',
    client_name: 'Sistema Legado — ERPInteg',
    api_key: 'syn_live_a9c3e1f7b5d2a8e4c0f6b2d8e1a3c7f9',
    is_active: false,
    created_at: '2024-09-01T00:00:00Z',
    expires_at: '2025-01-01T00:00:00Z',
    endpoints_count: 2,
  },
  {
    id: 'k4',
    client_name: 'Dashboard BI — Analytics',
    api_key: 'syn_live_f2b8d4a0c6e1f3b9d5a7c2e8f0b4d6a2',
    is_active: true,
    created_at: '2025-01-05T00:00:00Z',
    expires_at: '2025-07-05T00:00:00Z',
    endpoints_count: 4,
  },
]
