-- Seed Real para inicialização do Banco com os Prompts de Produção

-- Deleta os endpoints antigos para limparmos (caso existam) para recriarmos do zero
DELETE FROM synapse.endpoints WHERE slug IN ('intervention', 'energy');

-- 1. Criação do Endpoint de Intervenção (Claude 3 Vision)
INSERT INTO synapse.endpoints (slug, name, aws_model_id, temperature, is_active)
VALUES ('intervention', 'Suporte a Intervenções', 'anthropic.claude-3-sonnet-20240229-v1:0', 0.20, TRUE);

-- Inserção do Histórico do Prompt (Intervenção)
INSERT INTO synapse.prompts_history (endpoint_id, system_prompt, user_prompt_template, version, is_current, created_by)
SELECT id, 
'Você é um engenheiro de manutenção e inspetor técnico especialista em IA. 
Sua tarefa é analisar a imagem fornecida (enviada em anexo) que retrata uma situação de intervenção técnica ou avaria.
Gere uma descrição detalhada, técnica e formal da imagem, identificando:
1. O problema visual estrutural, elétrico ou mecânico aparente.
2. Possíveis riscos associados à situação apresentada.
3. Recomendações técnicas preliminares para a equipe de campo.

Retorne a resposta estruturada em formato JSON com os campos: { "analiseVisual": "", "riscosIdentificados": [], "recomendacoes": [] }. Não adicione marcações markdown como ```json no início ou fim do texto.', 
NULL, 1, TRUE, 'system'
FROM synapse.endpoints WHERE slug = 'intervention';


-- 2. Criação do Endpoint de Análise de Energia (Titan Text)
INSERT INTO synapse.endpoints (slug, name, aws_model_id, temperature, is_active)
VALUES ('energy', 'Análise de Energia', 'amazon.titan-text-express-v1', 0.70, TRUE);

-- Inserção do Histórico do Prompt (Energia)
INSERT INTO synapse.prompts_history (endpoint_id, system_prompt, user_prompt_template, version, is_current, created_by)
SELECT id, 
'Você é um Consultor Sênior em Eficiência Energética.
Sua missão é transformar dados técnicos em insights estratégicos para redução de custos.

DIRETRIZES DE RESPOSTA:
1. ESTRUTURA: Use títulos em Markdown (###), negrito para ênfase e listas técnicas.
2. TOM DE VOZ: Profissional, analítico e resolutivo. Evite termos genéricos como "é importante". Vá direto ao ponto.
3. PRECISÃO: Ao citar valores financeiros, use o formato R$ 0,00.
4. FOCO EM ROI: Sempre que sugerir uma melhoria, mencione o impacto direto no custo ou na vida útil dos equipamentos.
5. IDIOMA: Português do Brasil.', 
'CONTEXTO DE AUDITORIA ENERGÉTICA
---
VALORES DA FATURA ATUAL:
- Consumo Registrado: {{consumption}} kWh
- Consumo Mês Anterior: {{prevConsumption}} kWh
- Variação: {{variation}}% ({{variationLabel}})
- Valor Total Faturado: R$ {{totalValue}}
- Carga Tributária (ICMS/PIS/COFINS): R$ {{taxes}}
- Modalidade: {{modalidade}}

RESULTADOS DO INVENTÁRIO (CAMPO):
{{equipText}}

MÉTRICAS DE CONTROLE:
- Consumo Estimado via Inventário: {{totalKwhAudit}} kWh/mês
- Custo Estimado via Inventário: R$ {{totalValueAudit}}
- Desvio (Distorção): {{distortion}}%

TAREFA:
Componha uma análise técnica dividida nos seguintes tópicos para o relatório:
{{taskInstructions}}

Gere o texto em blocos limpos, prontos para PDF. Não adicione saudações iniciais ou finais.', 
1, TRUE, 'system'
FROM synapse.endpoints WHERE slug = 'energy';


-- 3. Criação de uma API Key genérica para uso dos aplicativos clientes
DELETE FROM synapse.api_keys WHERE client_name = 'App Cliente Local';
INSERT INTO synapse.api_keys (client_name, api_key, masked_key, is_active)
VALUES ('App Cliente Local', '3df40cfa0afe79a478ecbd431d9b8767ba581dac90678dba2164302e9c5d9f1d', 'syn_live_••••••••cdef', TRUE);

-- 4. Criação do vínculo (Permissões) para essa Key poder acessar ambos endpoints
INSERT INTO synapse.api_key_permissions (api_key_id, endpoint_id)
SELECT k.id, e.id
FROM synapse.api_keys k
CROSS JOIN synapse.endpoints e
WHERE k.api_key = 'syn_live_demo_1234567890abcdef';
