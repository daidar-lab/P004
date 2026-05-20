import { Router, Request, Response } from 'express';
import { db } from '../config/database';

export const endpointsRouter = Router();

endpointsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        e.id, 
        e.slug, 
        e.name, 
        e.aws_model_id, 
        e.temperature, 
        e.is_active, 
        e.created_at, 
        e.updated_at,
        p.id as prompt_id, 
        p.system_prompt, 
        p.user_prompt_template, 
        p.version, 
        p.is_current, 
        p.created_by, 
        p.created_at as prompt_created_at
      FROM synapse.endpoints e
      LEFT JOIN synapse.prompts_history p ON p.endpoint_id = e.id AND p.is_current = TRUE
      ORDER BY e.created_at DESC;
    `;

    const result = await db.query(query);

    // Mapear os resultados para bater com a interface do Frontend
    const formattedData = result.rows.map(row => {
      const endpoint = {
        id: row.id,
        slug: row.slug,
        name: row.name,
        aws_model_id: row.aws_model_id,
        temperature: Number.parseFloat(row.temperature), // Converter NUMERIC para number
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
        current_prompt: row.prompt_id ? {
          id: row.prompt_id,
          endpoint_id: row.id,
          system_prompt: row.system_prompt,
          user_prompt_template: row.user_prompt_template,
          version: row.version,
          is_current: row.is_current,
          created_at: row.prompt_created_at,
          created_by: row.created_by
        } : undefined
      };
      return endpoint;
    });

    return res.status(200).json(formattedData);
  } catch (error) {
    console.error('[ERRO NA ROTA /v1/endpoints]:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar endpoints' });
  }
});

// Criar um novo Endpoint
endpointsRouter.post('/', async (req: Request, res: Response) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { name, slug, aws_model_id, temperature, is_active, current_prompt } = req.body;

    const insertEndpoint = `
      INSERT INTO synapse.endpoints (slug, name, aws_model_id, temperature, is_active)
      VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, updated_at
    `;
    const endpRes = await client.query(insertEndpoint, [slug, name, aws_model_id, temperature, is_active]);
    const newId = endpRes.rows[0].id;

    if (current_prompt) {
      const insertPrompt = `
        INSERT INTO synapse.prompts_history (endpoint_id, system_prompt, user_prompt_template, version, is_current)
        VALUES ($1, $2, $3, 1, TRUE) RETURNING id, version, created_at
      `;
      await client.query(insertPrompt, [newId, current_prompt.system_prompt, current_prompt.user_prompt_template || null]);
    }

    await client.query('COMMIT');
    return res.status(201).json({ success: true, id: newId });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[ERRO NA ROTA POST /v1/endpoints]:', error);
    if (error.code === '23505') { // unique_violation
      return res.status(400).json({ error: 'O slug já está em uso.' });
    }
    return res.status(500).json({ error: 'Erro interno ao criar endpoint' });
  } finally {
    client.release();
  }
});

// Atualizar um Endpoint Existente
endpointsRouter.put('/:id', async (req: Request, res: Response) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { name, slug, aws_model_id, temperature, is_active, current_prompt } = req.body;

    // 1. Atualizar dados básicos
    const updateEndpoint = `
      UPDATE synapse.endpoints 
      SET name = $1, slug = $2, aws_model_id = $3, temperature = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
    `;
    await client.query(updateEndpoint, [name, slug, aws_model_id, temperature, is_active, id]);

    // 2. Lidar com o versionamento do prompt (se enviado)
    if (current_prompt) {
      // Buscar o prompt atual
      const currentRes = await client.query(
        'SELECT system_prompt, user_prompt_template, version FROM synapse.prompts_history WHERE endpoint_id = $1 AND is_current = TRUE',
        [id]
      );

      let needsNewVersion = true;
      let nextVersion = 1;

      if (currentRes.rows.length > 0) {
        const current = currentRes.rows[0];
        nextVersion = current.version + 1;

        // Verifica se o texto mudou de fato
        const oldUserTpl = current.user_prompt_template || '';
        const newUserTpl = current_prompt.user_prompt_template || '';

        if (current.system_prompt === current_prompt.system_prompt && oldUserTpl === newUserTpl) {
          needsNewVersion = false;
        }
      }

      if (needsNewVersion) {
        // Desativa o atual
        await client.query('UPDATE synapse.prompts_history SET is_current = FALSE WHERE endpoint_id = $1 AND is_current = TRUE', [id]);

        // Insere a versão nova
        await client.query(`
          INSERT INTO synapse.prompts_history (endpoint_id, system_prompt, user_prompt_template, version, is_current)
          VALUES ($1, $2, $3, $4, TRUE)
        `, [id, current_prompt.system_prompt, current_prompt.user_prompt_template || null, nextVersion]);
      }
    }

    await client.query('COMMIT');
    return res.status(200).json({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[ERRO NA ROTA PUT /v1/endpoints]:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'O slug já está em uso.' });
    }
    return res.status(500).json({ error: 'Erro interno ao atualizar endpoint' });
  } finally {
    client.release();
  }
});
