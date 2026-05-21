CREATE SCHEMA synapse AUTHORIZATION postgres;
-- synapse.api_keys definição

-- Drop table

-- DROP TABLE synapse.api_keys;

CREATE TABLE synapse.api_keys (
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
CREATE INDEX idx_api_keys_value ON synapse.api_keys USING btree (api_key) WHERE (is_active = true);


-- synapse.endpoints definição

-- Drop table

-- DROP TABLE synapse.endpoints;

CREATE TABLE synapse.endpoints (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	slug varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	aws_model_id varchar(100) NOT NULL,
	temperature numeric(3, 2) DEFAULT 0.50 NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	is_multimodal bool DEFAULT false NULL,
	CONSTRAINT endpoints_pkey PRIMARY KEY (id),
	CONSTRAINT endpoints_slug_key UNIQUE (slug)
);
CREATE INDEX idx_endpoints_slug ON synapse.endpoints USING btree (slug);


-- synapse.users definição

-- Drop table

-- DROP TABLE synapse.users;

CREATE TABLE synapse.users (
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
CREATE INDEX idx_users_username ON synapse.users USING btree (username);


-- synapse.api_key_permissions definição

-- Drop table

-- DROP TABLE synapse.api_key_permissions;

CREATE TABLE synapse.api_key_permissions (
	api_key_id uuid NOT NULL,
	endpoint_id uuid NOT NULL,
	granted_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT api_key_permissions_pkey PRIMARY KEY (api_key_id, endpoint_id),
	CONSTRAINT fk_permissions_endpoint FOREIGN KEY (endpoint_id) REFERENCES synapse.endpoints(id) ON DELETE CASCADE,
	CONSTRAINT fk_permissions_key FOREIGN KEY (api_key_id) REFERENCES synapse.api_keys(id) ON DELETE CASCADE
);


-- synapse.prompts_history definição

-- Drop table

-- DROP TABLE synapse.prompts_history;

CREATE TABLE synapse.prompts_history (
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
CREATE INDEX idx_prompts_current ON synapse.prompts_history USING btree (endpoint_id) WHERE (is_current = true);


-- synapse.request_logs definição

-- Drop table

-- DROP TABLE synapse.request_logs;

CREATE TABLE synapse.request_logs (
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
CREATE INDEX idx_request_logs_api_key_id ON synapse.request_logs USING btree (api_key_id);
CREATE INDEX idx_request_logs_created_at ON synapse.request_logs USING btree (created_at);