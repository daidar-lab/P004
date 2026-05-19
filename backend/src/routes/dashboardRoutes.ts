import { Router, Request, Response } from 'express';
import { db } from '../config/database';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    // Buscar estatísticas de Endpoints
    const endpointsQuery = `
      SELECT 
        id, slug, name, aws_model_id, temperature, is_active 
      FROM synapse.endpoints
      ORDER BY created_at DESC;
    `;
    const endpointsResult = await db.query(endpointsQuery);
    const endpointsList = endpointsResult.rows;
    const activeEndpoints = endpointsList.filter(e => e.is_active).length;
    const totalEndpoints = endpointsList.length;

    // Buscar estatísticas de API Keys
    const keysQuery = `
      SELECT id, is_active 
      FROM synapse.api_keys;
    `;
    const keysResult = await db.query(keysQuery);
    const keysList = keysResult.rows;
    const activeKeys = keysList.filter(k => k.is_active).length;
    const totalKeys = keysList.length;

    // Como ainda não temos tabelas de log de requisições, vamos enviar 0 para estas métricas por enquanto
    // Isso preparará a estrutura para quando adicionarmos o interceptador de logs.
    const stats = {
      endpoints: {
        active: activeEndpoints,
        total: totalEndpoints,
        list: endpointsList.map(ep => ({
          ...ep,
          temperature: parseFloat(ep.temperature)
        }))
      },
      apiKeys: {
        active: activeKeys,
        total: totalKeys
      },
      requests: {
        today: 0,
        successRate: 0
      },
      recentActivity: []
    };

    return res.status(200).json(stats);
  } catch (error) {
    console.error('[ERRO NA ROTA /v1/dashboard/stats]:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar estatísticas do dashboard' });
  }
});
