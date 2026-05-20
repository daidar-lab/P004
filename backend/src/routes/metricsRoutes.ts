import { Router, Request, Response } from 'express';
import { db } from '../config/database';

export const metricsRouter = Router();

metricsRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    // Consulta agregada para trazer as métricas do dia de forma eficiente
    const metricsQuery = `
      SELECT 
        COUNT(*) AS total_today,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 400 THEN 1 END) AS success_today,
        COALESCE(AVG(latency_ms), 0) AS avg_latency_today,
        SUM(tokens_input + tokens_output) AS total_tokens_today
      FROM synapse.request_logs
      WHERE created_at >= CURRENT_DATE;
    `;

    const result = await db.query(metricsQuery);
    const row = result.rows[0];

    const todayRequests = Number.parseInt(row.total_today || '0', 10);
    const successToday = Number.parseInt(row.success_today || '0', 10);
    const successRate = todayRequests > 0
      ? Number.parseFloat(((successToday / todayRequests) * 100).toFixed(2))
      : 100.0;
    const avgLatency = Math.round(Number.parseFloat(row.avg_latency_today || '0'));
    const totalTokens = Number.parseInt(row.total_tokens_today || '0', 10);

    return res.status(200).json({
      success: true,
      todayRequests,
      successRate,
      averageLatencyMs: avgLatency,
      totalTokensConsumed: totalTokens
    });
  } catch (error) {
    console.error('[ERRO NA ROTA /v1/metrics/summary]:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao computar resumo de métricas'
    });
  }
});
