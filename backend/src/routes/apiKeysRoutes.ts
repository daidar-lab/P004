import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import crypto from 'crypto';

export const apiKeysRouter = Router();

apiKeysRouter.get('/', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT id, client_name, api_key, is_active, created_at, expires_at
      FROM synapse.api_keys
      ORDER BY created_at DESC;
    `;
    const result = await db.query(query);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('[ERRO] GET /v1/apikeys:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar chaves de API' });
  }
});

apiKeysRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { client_name } = req.body;
    if (!client_name) {
      return res.status(400).json({ error: 'O nome do cliente/aplicação é obrigatório.' });
    }
    
    // Gera uma chave estilo Stripe: syn_live_...
    const randomHex = crypto.randomBytes(16).toString('hex');
    const newApiKey = `syn_live_${randomHex}`;
    
    const insertQuery = `
      INSERT INTO synapse.api_keys (client_name, api_key, is_active)
      VALUES ($1, $2, TRUE)
      RETURNING id, client_name, api_key, is_active, created_at, expires_at
    `;
    const result = await db.query(insertQuery, [client_name, newApiKey]);
    
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[ERRO] POST /v1/apikeys:', error);
    return res.status(500).json({ error: 'Erro ao gerar API Key' });
  }
});

apiKeysRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    const updateQuery = `
      UPDATE synapse.api_keys
      SET is_active = $1
      WHERE id = $2
      RETURNING id, is_active
    `;
    const result = await db.query(updateQuery, [is_active, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API Key não encontrada' });
    }
    
    return res.status(200).json({ success: true, is_active: result.rows[0].is_active });
  } catch (error) {
    console.error('[ERRO] PUT /v1/apikeys:', error);
    return res.status(500).json({ error: 'Erro ao atualizar API Key' });
  }
});
