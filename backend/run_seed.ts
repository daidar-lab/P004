import fs from 'fs';
import path from 'path';
import { db } from './src/config/database';
import dotenv from 'dotenv';

dotenv.config();

async function runSeed() {
  try {
    const seedPath = path.join(__dirname, '../db/seed_real.sql');
    const sql = fs.readFileSync(seedPath, 'utf-8');

    console.log('Iniciando inserção no banco de dados...');
    await db.query(sql);
    console.log('✅ Endpoints e Prompts criados com sucesso!');

    process.exit(0);
  } catch (err) {
    console.error('❌ Erro ao rodar o seed:', err);
    process.exit(1);
  }
}

runSeed();
