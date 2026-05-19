import type { AwsModelId } from '../types'

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
