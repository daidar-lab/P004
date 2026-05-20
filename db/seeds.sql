-- 1. Inserir os endpoints bases no schema isolado

const SYNAPSE_SCHEMA = 'synapse';

// Onde você usava a string pura, mude para a constante:
// Exemplo: `SELECT * FROM ${SYNAPSE_SCHEMA}.api_keys`
INSERT INTO synapse.endpoints (slug, name, aws_model_id, temperature) VALUES
('energy', 'Audit Energy Analytics', 'amazon.titan-text-express-v1', 0.50),
('intervention', 'Segurança do Trabalho - Visão Computacional', 'anthropic.claude-3-haiku-20240307-v1:0', 0.20);

-- 2. Vincular os Prompts de Sistema iniciais
INSERT INTO synapse.prompts_history (endpoint_id, system_prompt, version, is_current)
VALUES 
((SELECT id FROM synapse.endpoints WHERE slug = 'energy'), 'Você é uma IA especialista em auditoria de faturas de energia elétrica...', 1, TRUE),
((SELECT id FROM synapse.endpoints WHERE slug = 'intervention'), 'Você é uma IA especialista em engenharia de segurança do trabalho e análise visual de riscos...', 1, TRUE);

-- 3. Cadastrar os tokens temporários de teste do seu .env
INSERT INTO synapse.api_keys (client_name, api_key, masked_key) VALUES
('P001 - Audit Energy', '5a2a9621934ccbf9fa745448b36468872bb41dd52349a8cf8d9f0ee0081ec554', 'audi_••••_123'),
('P007 - Comunicado de Intervenção', 'ceebf78f141761dbbb5bd85bcfde1b999dca1ded12a86a6554ed541bc82fda88', 'comu_••••_789');

-- 4. Criar os vínculos de permissões na tabela intermediária
INSERT INTO synapse.api_key_permissions (api_key_id, endpoint_id) VALUES
((SELECT id FROM synapse.api_keys WHERE client_name = 'P001 - Audit Energy'), (SELECT id FROM synapse.endpoints WHERE slug = 'energy')),
((SELECT id FROM synapse.api_keys WHERE client_name = 'P007 - Comunicado de Intervenção'), (SELECT id FROM synapse.endpoints WHERE slug = 'intervention')); 