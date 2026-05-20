-- Migration: Hash de API Keys e Mascaramento
-- Executado em: 2026-05-20

ALTER TABLE synapse.api_keys ADD COLUMN IF NOT EXISTS masked_key VARCHAR(100);

-- Atualização das chaves semente conhecidas
UPDATE synapse.api_keys
SET api_key = '3df40cfa0afe79a478ecbd431d9b8767ba581dac90678dba2164302e9c5d9f1d',
    masked_key = 'syn_live_••••••••cdef'
WHERE api_key = 'syn_live_demo_1234567890abcdef';

UPDATE synapse.api_keys
SET api_key = '5a2a9621934ccbf9fa745448b36468872bb41dd52349a8cf8d9f0ee0081ec554',
    masked_key = 'audi_••••_123'
WHERE api_key = 'audit_energy_secret_token_123';

UPDATE synapse.api_keys
SET api_key = 'ceebf78f141761dbbb5bd85bcfde1b999dca1ded12a86a6554ed541bc82fda88',
    masked_key = 'comu_••••_789'
WHERE api_key = 'comunicado_intervencao_secret_token_789';
