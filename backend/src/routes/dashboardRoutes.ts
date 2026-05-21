import { Router, Request, Response } from 'express';
import { db } from '../config/database';

export const dashboardRouter = Router();

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60 || diffMs < 0) return 'Agora mesmo';
  if (diffMin < 60) return `${diffMin}m atrás`;
  if (diffHr < 24) return `${diffHr}h atrás`;
  return date.toLocaleDateString('pt-BR');
}

dashboardRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    // 1. Buscar estatísticas de Endpoints
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

    // 2. Buscar estatísticas de API Keys
    const keysQuery = `
      SELECT id, is_active 
      FROM synapse.api_keys;
    `;
    const keysResult = await db.query(keysQuery);
    const keysList = keysResult.rows;
    const activeKeys = keysList.filter(k => k.is_active).length;
    const totalKeys = keysList.length;

    // 3. Buscar estatísticas de Requisições de Hoje (fuso horário local/banco de dados)
    const requestsQuery = `
      SELECT 
        COUNT(*) AS total_today,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 400 THEN 1 END) AS success_today
      FROM synapse.request_logs
      WHERE created_at >= CURRENT_DATE;
    `;
    const requestsResult = await db.query(requestsQuery);
    const todayRequests = Number.parseInt(requestsResult.rows[0]?.total_today || '0', 10);
    const successRequests = Number.parseInt(requestsResult.rows[0]?.success_today || '0', 10);
    const successRate = todayRequests > 0
      ? Math.round((successRequests / todayRequests) * 100)
      : 100;

    // 4. Buscar últimas 10 atividades (logs de requisição recentes)
 // 4. Buscar últimas 10 atividades (logs de requisição recentes) com telemetria de tokens
    const activityQuery = `
      SELECT 
        slug,
        status_code,
        latency_ms,
        tokens_input,   -- 👈 Adicionado para puxar do banco
        tokens_output,  -- 👈 Adicionado para puxar do banco
        created_at
      FROM synapse.request_logs
      ORDER BY created_at DESC
      LIMIT 10;
    `;
    const activityResult = await db.query(activityQuery);
    const recentActivity = activityResult.rows.map(row => {
      const isOk = row.status_code >= 200 && row.status_code < 400;
      const latency = row.latency_ms < 1000
        ? `${row.latency_ms}ms`
        : `${(row.latency_ms / 1000).toFixed(1)}s`;

      return {
        status: isOk ? 'ok' : 'error',
        endpoint: row.slug,
        latency,
        time: getRelativeTime(new Date(row.created_at)),
        // 🌟 Repassando para o React ler no payload do JSON:
        tokens_input: row.tokens_input,
        tokens_output: row.tokens_output
      };
    });
    const stats = {
      endpoints: {
        active: activeEndpoints,
        total: totalEndpoints,
        list: endpointsList.map(ep => ({
          ...ep,
          temperature: Number.parseFloat(ep.temperature)
        }))
      },
      apiKeys: {
        active: activeKeys,
        total: totalKeys
      },
      requests: {
        today: todayRequests,
        successRate: successRate
      },
      recentActivity: recentActivity
    };
    return res.status(200).json(stats);
  } catch (error) {
    console.error('[ERRO NA ROTA /v1/dashboard/stats]:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar estatísticas do dashboard' });
  }
});

// New route: Get request logs with filters & pagination
dashboardRouter.get('/request-logs', async (req: Request, res: Response) => {
  try {
    const { slug, sort, order, limit = '20', offset = '0', startDate, endDate } = req.query as any;
    // Allow sorting by any column that exists in the table
    const allowedSort = ['id', 'api_key_id', 'endpoint_id', 'slug', 'latency_ms', 'aws_model_id', 'tokens_input', 'tokens_output', 'status_code', 'error_message', 'created_at'];
    const sortField = allowedSort.includes(String(sort)) ? String(sort) : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    const lim = Math.min(parseInt(String(limit), 10), 100);
    const off = Math.max(parseInt(String(offset), 10), 0);

    // Build dynamic WHERE clause and values
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (slug) {
      conditions.push(`slug = $${idx}`);
      values.push(slug);
      idx++;
    }
    if (startDate) {
      conditions.push(`created_at >= $${idx}`);
      values.push(startDate);
      idx++;
    }
    if (endDate) {
      conditions.push(`created_at <= $${idx}`);
      values.push(endDate);
      idx++;
    }
    const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const query = `
      SELECT id, api_key_id, endpoint_id, slug, latency_ms, aws_model_id, tokens_input, tokens_output, status_code, error_message, created_at
      FROM synapse.request_logs
      ${whereClause}
      ORDER BY ${sortField} ${sortOrder}
      LIMIT $${idx} OFFSET $${idx + 1};
    `;
    values.push(lim, off);

    const result = await db.query(query, values);
    // Get total count with same filters (without pagination)
    const countQuery = `SELECT COUNT(*) FROM synapse.request_logs ${whereClause};`;
    const countRes = await db.query(countQuery, values.slice(0, values.length - 2)); // exclude limit/offset
    const total = parseInt(countRes.rows[0].count, 10);
    return res.status(200).json({ logs: result.rows, total });
  } catch (error) {
    console.error('[ERROR GET /v1/dashboard/request-logs]:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar logs de requisição' });
  }
});
