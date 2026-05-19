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
        temperature: parseFloat(row.temperature), // Converter NUMERIC para number
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
