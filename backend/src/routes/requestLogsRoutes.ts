import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { AuthenticatedUserRequest } from '../middlewares/userAuthMiddleware';

export const requestLogsRouter = Router();

/**
 * GET /request-logs
 * Returns full request log entries with optional filters:
 *  - slug: filter by endpoint slug
 *  - startDate, endDate: ISO date strings to filter by created_at
 *  - sort: column name to sort (any column in the table)
 *  - order: 'asc' or 'desc'
 *  - limit: page size (max 100)
 *  - offset: page offset
 */
requestLogsRouter.get('/', async (req: AuthenticatedUserRequest, res: Response) => {
  try {
    const {
      slug,
      startDate,
      endDate,
      sort = 'created_at',
      order = 'desc',
      limit = '20',
      offset = '0'
    } = req.query as any;

    // whitelist sortable columns
    const allowedSort = [
      'id',
      'api_key_id',
      'endpoint_id',
      'slug',
      'latency_ms',
      'aws_model_id',
      'tokens_input',
      'tokens_output',
      'status_code',
      'error_message',
      'created_at'
    ];
    const sortField = allowedSort.includes(String(sort)) ? String(sort) : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    const lim = Math.min(parseInt(String(limit), 10), 100);
    const off = Math.max(parseInt(String(offset), 10), 0);

    // Build dynamic WHERE clause
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
    // Count total matching rows (without pagination)
    const countQuery = `SELECT COUNT(*) FROM synapse.request_logs ${whereClause};`;
    const countRes = await db.query(countQuery, values.slice(0, values.length - 2));
    const total = parseInt(countRes.rows[0].count, 10);
    return res.status(200).json({ logs: result.rows, total });
  } catch (error) {
    console.error('[ERROR GET /request-logs]:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar logs de requisição' });
  }
});

requestLogsRouter.get('/slugs', async (req: AuthenticatedUserRequest, res: Response) => {
  try {
    const result = await db.query('SELECT DISTINCT slug FROM synapse.request_logs ORDER BY slug ASC');
    const slugs = result.rows.map((row: any) => row.slug);
    return res.status(200).json({ slugs });
  } catch (error) {
    console.error('[ERROR GET /request-logs/slugs]:', error);
    return res.status(500).json({ error: 'Erro ao buscar slugs de request logs' });
  }
});
