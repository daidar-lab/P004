// models.ts - Atualizado com as strings reais que vão para o banco de dados
import type { AwsModelId } from '../types';

export const AWS_MODELS: { id: AwsModelId; label: string; provider: string }[] = [
  // Família Amazon Nova (Substitutos do Titan)
  { id: 'us.amazon.nova-lite-v1:0', label: 'Amazon Nova Lite (Multimodal)', provider: 'Amazon' },
  { id: 'us.amazon.nova-micro-v1:0', label: 'Amazon Nova Micro (Texto)', provider: 'Amazon' },

  // Família Claude (Anthropic)
  { id: 'global.anthropic.claude-sonnet-4-6', label: 'Claude 4.6 Sonnet (Mais Avançado)', provider: 'Anthropic' },
  { id: 'global.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude 4.5 Haiku (Rápido)', provider: 'Anthropic' },

  // Família Llama (Meta)
  { id: 'us.meta.llama3-1-8b-instruct-v1:0', label: 'Llama 3.1 (8B)', provider: 'Meta' },
  { id: 'us.meta.llama3-3-70b-instruct-v1:0', label: 'Llama 3.3 (70B)', provider: 'Meta' },

  // Família Mistral (Mistral AI)
  { id: 'us.mistral.ministral-3-8b-instruct-v1:0', label: 'Ministral 3 (8B)', provider: 'Mistral AI' },
  { id: 'us.mistral.mistral-large-2407-v1:0', label: 'Mistral Large 3', provider: 'Mistral AI' }
];
