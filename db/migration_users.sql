-- Migration: Criação da tabela de Usuários e Perfis
-- Executado em: 2026-05-20

CREATE TABLE IF NOT EXISTS synapse.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON synapse.users(username);

-- Seeds de Usuários Padrões
-- Admin (senha: admin123)
-- User (senha: user123)
-- Observação: Serão inseridos programaticamente ou via script de sementes.
