import type { AwsModelId } from '../types';

export const AWS_MODELS: { id: AwsModelId; label: string; provider: string }[] = [
  // Família Titan (Amazon)
  { id: 'TITAN_EXPRESS', label: 'Titan Text Express', provider: 'Amazon' },
  { id: 'TITAN_LITE', label: 'Titan Text Lite', provider: 'Amazon' },

  // Família Claude (Anthropic)
  { id: 'CLAUDE_HAIKU', label: 'Claude 3 Haiku', provider: 'Anthropic' },
  { id: 'CLAUDE_SONNET', label: 'Claude 3.5 Sonnet', provider: 'Anthropic' },

  // Família Llama (Meta)
  { id: 'LLAMA3_8B', label: 'Llama 3 (8B)', provider: 'Meta' },
  { id: 'LLAMA3_70B', label: 'Llama 3 (70B)', provider: 'Meta' },

  // Família Mistral (Mistral AI)
  { id: 'MISTRAL_7B', label: 'Mistral 7B', provider: 'Mistral AI' },
];