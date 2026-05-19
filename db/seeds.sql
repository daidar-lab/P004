-- 1. Inserir os endpoints bases no schema isolado
INSERT INTO synapse.endpoints (slug, name, aws_model_id, temperature) VALUES
('energy', 'Audit Energy Analytics', 'amazon.titan-text-express-v1', 0.50),
('intervention', 'Segurança do Trabalho - Visão Computacional', 'anthropic.claude-3-haiku-20240307-v1:0', 0.20);

-- 2. Vincular os Prompts de Sistema iniciais
INSERT INTO synapse.prompts_history (endpoint_id, system_prompt, version, is_current)
VALUES 
((SELECT id FROM synapse.endpoints WHERE slug = 'energy'), 'Você é uma IA especialista em auditoria de faturas de energia elétrica...', 1, TRUE),
((SELECT id FROM synapse.endpoints WHERE slug = 'intervention'), 'Você é uma IA especialista em engenharia de segurança do trabalho e análise visual de riscos...', 1, TRUE);

-- 3. Cadastrar os tokens temporários de teste do seu .env
INSERT INTO synapse.api_keys (client_name, api_key) VALUES
('P001 - Audit Energy', 'audit_energy_secret_token_123'),
('P007 - Comunicado de Intervenção', 'comunicado_intervencao_secret_token_789');

-- 4. Criar os vínculos de permissões na tabela intermediária
INSERT INTO synapse.api_key_permissions (api_key_id, endpoint_id) VALUES
((SELECT id FROM synapse.api_keys WHERE client_name = 'P001 - Audit Energy'), (SELECT id FROM synapse.endpoints WHERE slug = 'energy')),
((SELECT id FROM synapse.api_keys WHERE client_name = 'P007 - Comunicado de Intervenção'), (SELECT id FROM synapse.endpoints WHERE slug = 'intervention')); 