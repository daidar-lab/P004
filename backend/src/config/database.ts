import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

db.on('connect', () => {
  console.log('[B/SYNAPSE] Pool de conexão com o PostgreSQL estabelecido com sucesso.');
});

db.on('error', (err) => {
  console.error('[ERRO CRÍTICO NO BANCO]:', err);
});
