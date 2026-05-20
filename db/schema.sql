-- Criar o namespace dedicado do produto
CREATE SCHEMA IF NOT EXISTS synapse;

-- 1. Tabela de Endpoints Dinâmicos
CREATE TABLE IF NOT EXISTS synapse.endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    aws_model_id VARCHAR(100) NOT NULL,
    temperature NUMERIC(3,2) DEFAULT 0.50,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Histórico de Prompts (Versionamento)
CREATE TABLE IF NOT EXISTS synapse.prompts_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID NOT NULL,
    system_prompt TEXT NOT NULL,
    user_prompt_template TEXT,
    version INT NOT NULL DEFAULT 1,
    is_current BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    
    CONSTRAINT fk_endpoint FOREIGN KEY (endpoint_id) 
        REFERENCES synapse.endpoints(id) ON DELETE CASCADE,
    CONSTRAINT uq_endpoint_version UNIQUE (endpoint_id, version)
);

-- 3. Tabela de Autenticação Perimetral (API Keys Dinâmicas)
CREATE TABLE IF NOT EXISTS synapse.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name VARCHAR(100) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    masked_key VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 4. Tabela de Vínculo: Permissões Cruzadas
CREATE TABLE IF NOT EXISTS synapse.api_key_permissions (
    api_key_id UUID NOT NULL,
    endpoint_id UUID NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (api_key_id, endpoint_id),
    CONSTRAINT fk_permissions_key FOREIGN KEY (api_key_id) 
        REFERENCES synapse.api_keys(id) ON DELETE CASCADE,
    CONSTRAINT fk_permissions_endpoint FOREIGN KEY (endpoint_id) 
        REFERENCES synapse.endpoints(id) ON DELETE CASCADE
);

-- 5. Tabela de Controle de Usuários e Perfis (Dashboard & RBAC)
CREATE TABLE IF NOT EXISTS synapse.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Índices de Performance no Schema Dedicado
CREATE INDEX IF NOT EXISTS idx_endpoints_slug ON synapse.endpoints(slug);
CREATE INDEX IF NOT EXISTS idx_prompts_current ON synapse.prompts_history(endpoint_id) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_api_keys_value ON synapse.api_keys(api_key) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_username ON synapse.users(username);