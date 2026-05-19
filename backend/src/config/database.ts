import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Configura o Pool utilizando a string de conexão estruturada do seu .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log para garantir que a conexão está saudável no startup da aplicação
pool.on('connect', () => {
  console.log('[B/SYNAPSE] Pool de conexão com o PostgreSQL estabelecido com sucesso.');
});

pool.on('error', (err) => {
  console.error('[ERRO CRÍTICO NO BANCO] Erro inesperado em cliente ocioso do Postgres:', err);
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
  connect: () => pool.connect(),
};