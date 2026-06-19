-- =============================================================================
-- migrate.sql — Script de migração IDEMPOTENTE
-- Seguro para rodar em banco de produção que já existe.
-- Cada statement usa IF NOT EXISTS ou ADD COLUMN IF NOT EXISTS.
-- Execute com: psql $DATABASE_URL -f db/migrate.sql
-- =============================================================================

-- 1. Schema (ignora se já existir)
CREATE SCHEMA IF NOT EXISTS synapse;

-- =============================================================================
-- TABELAS BASE (sem foreign keys ainda)
-- =============================================================================

-- 2. api_keys
CREATE TABLE IF NOT EXISTS synapse.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_name varchar(100) NOT NULL,
    api_key varchar(255) NOT NULL,
    is_active bool DEFAULT true NULL,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
    expires_at timestamptz NULL,
    masked_key varchar(100) NULL,
    CONSTRAINT api_keys_api_key_key UNIQUE (api_key),
    CONSTRAINT api_keys_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_api_keys_value ON synapse.api_keys USING btree (api_key) WHERE (is_active = true);

-- 3. endpoints
CREATE TABLE IF NOT EXISTS synapse.endpoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug varchar(50) NOT NULL,
    "name" varchar(100) NOT NULL,
    aws_model_id varchar(100) NOT NULL,
    temperature numeric(3, 2) DEFAULT 0.50 NULL,
    is_active bool DEFAULT true NULL,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
    updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
    is_multimodal bool DEFAULT false NULL,
    supports_textract bool DEFAULT false NULL,
    CONSTRAINT endpoints_pkey PRIMARY KEY (id),
    CONSTRAINT endpoints_slug_key UNIQUE (slug)
);
CREATE INDEX IF NOT EXISTS idx_endpoints_slug ON synapse.endpoints USING btree (slug);

-- 4. users
CREATE TABLE IF NOT EXISTS synapse.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username varchar(50) NOT NULL,
    "name" varchar(100) NOT NULL,
    password_hash varchar(255) NOT NULL,
    "role" varchar(20) NOT NULL,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
    updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'user'::character varying])::text[]))),
    CONSTRAINT users_username_key UNIQUE (username)
);
CREATE INDEX IF NOT EXISTS idx_users_username ON synapse.users USING btree (username);

-- =============================================================================
-- TABELAS COM FOREIGN KEYS (criadas depois das base)
-- =============================================================================

-- 5. api_key_permissions
CREATE TABLE IF NOT EXISTS synapse.api_key_permissions (
    api_key_id uuid NOT NULL,
    endpoint_id uuid NOT NULL,
    granted_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
    CONSTRAINT api_key_permissions_pkey PRIMARY KEY (api_key_id, endpoint_id),
    CONSTRAINT fk_permissions_endpoint FOREIGN KEY (endpoint_id) REFERENCES synapse.endpoints(id) ON DELETE CASCADE,
    CONSTRAINT fk_permissions_key FOREIGN KEY (api_key_id) REFERENCES synapse.api_keys(id) ON DELETE CASCADE
);

-- 6. prompts_history
CREATE TABLE IF NOT EXISTS synapse.prompts_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    endpoint_id uuid NOT NULL,
    system_prompt text NOT NULL,
    user_prompt_template text NULL,
    "version" int4 DEFAULT 1 NOT NULL,
    is_current bool DEFAULT true NULL,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
    created_by varchar(100) DEFAULT 'system'::character varying NULL,
    CONSTRAINT prompts_history_pkey PRIMARY KEY (id),
    CONSTRAINT uq_endpoint_version UNIQUE (endpoint_id, version),
    CONSTRAINT fk_endpoint FOREIGN KEY (endpoint_id) REFERENCES synapse.endpoints(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_prompts_current ON synapse.prompts_history USING btree (endpoint_id) WHERE (is_current = true);

-- 7. request_logs
CREATE TABLE IF NOT EXISTS synapse.request_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_key_id uuid NULL,
    endpoint_id uuid NULL,
    slug varchar(50) NOT NULL,
    latency_ms int4 NOT NULL,
    aws_model_id varchar(100) NULL,
    tokens_input int4 DEFAULT 0 NULL,
    tokens_output int4 DEFAULT 0 NULL,
    status_code int4 NOT NULL,
    error_message text NULL,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
    CONSTRAINT request_logs_pkey PRIMARY KEY (id),
    CONSTRAINT fk_logs_api_key FOREIGN KEY (api_key_id) REFERENCES synapse.api_keys(id) ON DELETE SET NULL,
    CONSTRAINT fk_logs_endpoint FOREIGN KEY (endpoint_id) REFERENCES synapse.endpoints(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_request_logs_api_key_id ON synapse.request_logs USING btree (api_key_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON synapse.request_logs USING btree (created_at);

-- 8. document_jobs
CREATE TABLE IF NOT EXISTS synapse.document_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id varchar(255) NOT NULL,
    status varchar(50) DEFAULT 'PROCESSING' NOT NULL,
    s3_bucket varchar(255) NOT NULL,
    s3_key varchar(255) NOT NULL,
    endpoint_id uuid NULL,
    api_key_id uuid NULL,
    raw_text text NULL,
    ai_result text NULL,
    error_message text NULL,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
    updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
    CONSTRAINT document_jobs_pkey PRIMARY KEY (id),
    CONSTRAINT document_jobs_job_id_key UNIQUE (job_id),
    CONSTRAINT fk_jobs_api_key FOREIGN KEY (api_key_id) REFERENCES synapse.api_keys(id) ON DELETE SET NULL,
    CONSTRAINT fk_jobs_endpoint FOREIGN KEY (endpoint_id) REFERENCES synapse.endpoints(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_document_jobs_job_id ON synapse.document_jobs USING btree (job_id);
CREATE INDEX IF NOT EXISTS idx_document_jobs_status ON synapse.document_jobs USING btree (status);

-- =============================================================================
-- COLUNAS ADICIONADAS APÓS O SCHEMA INICIAL (ADD COLUMN IF NOT EXISTS)
-- Adicione aqui colunas novas que podem não existir em produção antiga.
-- =============================================================================

-- supports_textract foi adicionado em versão posterior
ALTER TABLE synapse.endpoints
    ADD COLUMN IF NOT EXISTS supports_textract bool DEFAULT false NULL;

-- is_multimodal foi adicionado em versão posterior
ALTER TABLE synapse.endpoints
    ADD COLUMN IF NOT EXISTS is_multimodal bool DEFAULT false NULL;

-- endpoint_type foi adicionado em versão posterior
ALTER TABLE synapse.endpoints
    ADD COLUMN IF NOT EXISTS endpoint_type varchar(50) DEFAULT 'bedrock' NULL;

-- Tabela textract_queries
CREATE TABLE IF NOT EXISTS synapse.textract_queries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    endpoint_id uuid NOT NULL,
    query_text text NOT NULL,
    query_alias varchar(100) NOT NULL,
    sort_order int4 DEFAULT 0 NOT NULL,
    is_active bool DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
    updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
    CONSTRAINT textract_queries_pkey PRIMARY KEY (id),
    CONSTRAINT fk_tq_endpoint FOREIGN KEY (endpoint_id) REFERENCES synapse.endpoints(id) ON DELETE CASCADE
);

-- =============================================================================
-- FIM DO MIGRATE.SQL
-- =============================================================================
