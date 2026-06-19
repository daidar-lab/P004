import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';

export const endpointsRouter = Router();
const discoveryClient = new BedrockClient({ region: process.env.AWS_REGION || 'us-east-1' });

// 1. Rota para listar e traduzir os modelos reais da AWS em tempo real
endpointsRouter.get('/available-models', async (req: Request, res: Response) => {
  try {
    // Altere esta parte dentro da rota '/available-models':
    const command = new ListFoundationModelsCommand({
      byOutputModality: 'TEXT' // ◄ PROPRIEDADE CORRETA: Filtra modelos que respondem em texto/chat
    });


    const response = await discoveryClient.send(command);

    // Mapeia e limpa o retorno da AWS aplicando o tradutor inteligente
    const models = (response.modelSummaries || [])
      .filter(m => m.modelLifecycle?.status === 'ACTIVE')
      .map(m => {
        const rawId = m.modelId || '';
        let finalId = rawId;

        // Tradutor de infraestrutura: Converte IDs da AWS no formato dinâmico esperado pelo seu sistema
        if (rawId.includes('claude-3-5-sonnet') || rawId.includes('claude-v3-5-sonnet') || rawId.includes('claude-4')) {
          finalId = 'global.anthropic.claude-sonnet-4-6';
        } else if (rawId.includes('claude-3-5-haiku') || rawId.includes('claude-v3-5-haiku') || rawId.includes('claude-4-5')) {
          finalId = 'global.anthropic.claude-haiku-4-5-20251001-v1:0';
        } else if (rawId.includes('nova-lite') || (rawId.includes('titan') && rawId.includes('express'))) {
          finalId = 'us.amazon.nova-lite-v1:0';
        } else if (rawId.includes('nova-micro') || (rawId.includes('titan') && rawId.includes('lite'))) {
          finalId = 'us.amazon.nova-micro-v1:0';
        } else if (rawId.includes('llama') && rawId.includes('8b')) {
          finalId = 'us.meta.llama3-1-8b-instruct-v1:0';
        } else if (rawId.includes('llama') && rawId.includes('70b')) {
          finalId = 'us.meta.llama3-3-70b-instruct-v1:0';
        } else if (rawId.includes('ministral') || (rawId.includes('mistral') && rawId.includes('7b'))) {
          finalId = 'us.mistral.ministral-3-8b-instruct-v1:0';
        } else if (rawId.includes('mistral-large')) {
          finalId = 'us.mistral.mistral-large-2407-v1:0';
        }

        return {
          id: finalId,
          label: m.modelName || rawId,
          provider: m.providerName || 'AWS'
        };
      });

    // Elimina duplicados gerados pelo agrupamento inteligente
    const uniqueModels = models.filter((value, index, self) =>
      index === self.findIndex((t) => t.id === value.id)
    );

    return res.status(200).json(uniqueModels);
  } catch (error) {
    console.error('[ERRO NA ROTA /v1/endpoints/available-models]:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar modelos disponíveis' });
  }
});

// 2. Listar Endpoints cadastrados
endpointsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        e.id, e.slug, e.name, e.aws_model_id, e.temperature, e.is_active, e.is_multimodal, e.supports_textract, e.endpoint_type, e.created_at, e.updated_at,
        p.id as prompt_id, p.system_prompt, p.user_prompt_template, p.version, p.is_current, p.created_by, p.created_at as prompt_created_at,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', q.id,
              'endpoint_id', q.endpoint_id,
              'query_text', q.query_text,
              'query_alias', q.query_alias,
              'sort_order', q.sort_order,
              'is_active', q.is_active
            ) ORDER BY q.sort_order ASC)
            FROM synapse.textract_queries q
            WHERE q.endpoint_id = e.id
          ),
          '[]'::json
        ) as textract_queries
      FROM synapse.endpoints e
      LEFT JOIN synapse.prompts_history p ON p.endpoint_id = e.id AND p.is_current = TRUE
      ORDER BY e.created_at DESC;
    `;

    const result = await db.query(query);

    const formattedData = result.rows.map(row => {
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        aws_model_id: row.aws_model_id,
        temperature: Number.parseFloat(row.temperature),
        is_active: row.is_active,
        is_multimodal: row.is_multimodal,
        supports_textract: row.supports_textract,
        endpoint_type: row.endpoint_type || 'bedrock',
        created_at: row.created_at,
        updated_at: row.updated_at,
        textract_queries: row.textract_queries || [],
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
    const { name, slug, aws_model_id, temperature, is_active, is_multimodal, supports_textract, endpoint_type, current_prompt, textract_queries } = req.body;

    const insertEndpoint = `
      INSERT INTO synapse.endpoints (slug, name, aws_model_id, temperature, is_active, is_multimodal, supports_textract, endpoint_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at, updated_at
    `;
    const endpRes = await client.query(insertEndpoint, [slug, name, aws_model_id, temperature, is_active, is_multimodal, supports_textract || false, endpoint_type || 'bedrock']);
    const newId = endpRes.rows[0].id;

    if (current_prompt) {
      const insertPrompt = `
        INSERT INTO synapse.prompts_history (endpoint_id, system_prompt, user_prompt_template, version, is_current)
        VALUES ($1, $2, $3, 1, TRUE) RETURNING id, version, created_at
      `;
      await client.query(insertPrompt, [newId, current_prompt.system_prompt, current_prompt.user_prompt_template || null]);
    }

    if (textract_queries && Array.isArray(textract_queries)) {
      for (const tq of textract_queries) {
        const insertTq = `
          INSERT INTO synapse.textract_queries (endpoint_id, query_text, query_alias, sort_order, is_active)
          VALUES ($1, $2, $3, $4, $5)
        `;
        await client.query(insertTq, [newId, tq.query_text, tq.query_alias, tq.sort_order || 0, tq.is_active !== false]);
      }
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
    const { name, slug, aws_model_id, temperature, is_active, is_multimodal, supports_textract, endpoint_type, current_prompt, textract_queries } = req.body;

    // 1. Atualizar dados básicos
    const updateEndpoint = `
      UPDATE synapse.endpoints 
      SET name = $1, slug = $2, aws_model_id = $3, temperature = $4, is_active = $5, is_multimodal = $6, supports_textract = $7, endpoint_type = $8, updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
    `;
    await client.query(updateEndpoint, [name, slug, aws_model_id, temperature, is_active, is_multimodal, supports_textract || false, endpoint_type || 'bedrock', id]);

    // 1.2. Atualizar queries se enviadas
    if (textract_queries !== undefined && Array.isArray(textract_queries)) {
      await client.query('DELETE FROM synapse.textract_queries WHERE endpoint_id = $1', [id]);
      for (const tq of textract_queries) {
        const insertTq = `
          INSERT INTO synapse.textract_queries (endpoint_id, query_text, query_alias, sort_order, is_active)
          VALUES ($1, $2, $3, $4, $5)
        `;
        await client.query(insertTq, [id, tq.query_text, tq.query_alias, tq.sort_order || 0, tq.is_active !== false]);
      }
    }

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
