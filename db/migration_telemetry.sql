-- Migration: Telemetria e Logs em Tempo Real
-- Criado em: 2026-05-20

CREATE TABLE IF NOT EXISTS synapse.request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID,
    endpoint_id UUID,
    slug VARCHAR(50) NOT NULL,
    latency_ms INTEGER NOT NULL,
    aws_model_id VARCHAR(100),
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    status_code INTEGER NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_logs_api_key FOREIGN KEY (api_key_id) 
        REFERENCES synapse.api_keys(id) ON DELETE SET NULL,
    CONSTRAINT fk_logs_endpoint FOREIGN KEY (endpoint_id) 
        REFERENCES synapse.endpoints(id) ON DELETE SET NULL
);

-- Índices para otimização de consultas de telemetria
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON synapse.request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_api_key_id ON synapse.request_logs(api_key_id);
