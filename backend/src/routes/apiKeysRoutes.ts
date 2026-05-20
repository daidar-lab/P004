import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import crypto from 'crypto';

export const apiKeysRouter = Router();

// ✅ TIPAGEM DO BODY
type CreateApiKeyBody = {
  client_name: string;
};


// ✅ GET - Listar API Keys
apiKeysRouter.get('/', async (req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT id, client_name, masked_key AS api_key, is_active, created_at, expires_at
      FROM synapse.api_keys
      ORDER BY created_at DESC;
    `);

    return res.status(200).json(result.rows);

  } catch (error) {
    console.error('[ERRO] GET /v1/apikeys:', error);
    return res.status(500).json({ error: 'Erro ao buscar API Keys' });
  }
});


// ✅ POST - Criar API Key + AUTOMATIZAR PERMISSÕES
apiKeysRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { client_name } = req.body as CreateApiKeyBody;

    if (!client_name) {
      return res.status(400).json({
        error: 'O nome do cliente/aplicação é obrigatório.'
      });
    }

    // 🔐 GERAÇÃO DA CHAVE
    const randomHex = crypto.randomBytes(16).toString('hex');
    const newApiKey = `syn_live_${randomHex}`;
    const hashedKey = crypto.createHash('sha256').update(newApiKey).digest('hex');
    const maskedKey = `syn_live_••••••••${randomHex.slice(-4)}`;

    // ✅ INSERE API KEY (salva o hash em api_key e o valor mascarado em masked_key)
    const result = await db.query(
      `
      INSERT INTO synapse.api_keys (client_name, api_key, masked_key, is_active)
      VALUES ($1, $2, $3, TRUE)
      RETURNING id, client_name, is_active, created_at, expires_at
      `,
      [client_name, hashedKey, maskedKey]
    );

    const createdKey = result.rows[0];

    // ✅ BUSCAR TODOS OS ENDPOINTS ATIVOS
    const endpointsResult = await db.query(
      `SELECT id FROM synapse.endpoints WHERE is_active = true;`
    );

    const endpoints = endpointsResult.rows as { id: string }[];

    // ✅ CRIAR PERMISSÕES AUTOMATICAMENTE
    await Promise.all(
      endpoints.map(endpoint =>
        db.query(
          `
          INSERT INTO synapse.api_key_permissions (api_key_id, endpoint_id, granted_at)
          VALUES ($1, $2, NOW())
          `,
          [createdKey.id, endpoint.id]
        )
      )
    );

    // ✅ RETORNA A CHAVE (IMPORTANTE: só aparece aqui em formato legível para cópia única)
    return res.status(201).json({
      id: createdKey.id,
      client_name: createdKey.client_name,
      api_key: newApiKey,
      is_active: createdKey.is_active,
      created_at: createdKey.created_at,
      expires_at: createdKey.expires_at
    });

  } catch (error) {
    console.error('[ERRO] POST /v1/apikeys:', error);
    return res.status(500).json({ error: 'Erro ao gerar API Key' });
  }
});


// ✅ PUT - Ativar / Desativar API Key
apiKeysRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body as { is_active: boolean };

    const result = await db.query(
      `
      UPDATE synapse.api_keys
      SET is_active = $1
      WHERE id = $2
      RETURNING id, is_active
      `,
      [is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API Key não encontrada' });
    }

    return res.status(200).json({
      success: true,
      is_active: result.rows[0].is_active
    });

  } catch (error) {
    console.error('[ERRO] PUT /v1/apikeys:', error);
    return res.status(500).json({ error: 'Erro ao atualizar API Key' });
  }
});