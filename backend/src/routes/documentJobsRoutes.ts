import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { TextractService } from '../services/textractService';

export const documentJobsRouter = Router();

// List all document jobs for the dashboard view
documentJobsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        dj.id,
        dj.job_id,
        dj.status,
        dj.s3_bucket,
        dj.s3_key,
        dj.raw_text,
        dj.ai_result,
        dj.error_message,
        dj.created_at,
        dj.updated_at,
        e.name AS endpoint_name,
        e.slug AS endpoint_slug,
        ak.client_name
      FROM synapse.document_jobs dj
      LEFT JOIN synapse.endpoints e ON dj.endpoint_id = e.id
      LEFT JOIN synapse.api_keys ak ON dj.api_key_id = ak.id
      ORDER BY dj.created_at DESC;
    `;
    const result = await db.query(query);
    return res.status(200).json({
      success: true,
      jobs: result.rows
    });
  } catch (error: any) {
    console.error('[ERRO] GET /v1/document-jobs:', error.message);
    return res.status(500).json({ error: 'Erro ao buscar jobs de documentos.' });
  }
});

// Trigger a new document job directly from the admin dashboard
documentJobsRouter.post('/', async (req: Request, res: Response) => {
  const { s3Bucket, s3Key, endpointId } = req.body;

  try {
    if (!s3Bucket || !s3Key || !endpointId) {
      return res.status(400).json({ error: 'Os campos s3Bucket, s3Key e endpointId são obrigatórios.' });
    }

    // Verify endpoint exists
    const epQuery = `SELECT id FROM synapse.endpoints WHERE id = $1 AND is_active = true`;
    const epResult = await db.query(epQuery, [endpointId]);
    if (epResult.rows.length === 0) {
      return res.status(404).json({ error: 'Endpoint não encontrado ou inativo.' });
    }

    // Start Textract
    const jobId = await TextractService.startAnalysis(s3Bucket, s3Key);

    // Save job status to DB
    const insertQuery = `
      INSERT INTO synapse.document_jobs 
        (job_id, status, s3_bucket, s3_key, endpoint_id, api_key_id)
      VALUES ($1, 'PROCESSING', $2, $3, $4, NULL);
    `;
    await db.query(insertQuery, [jobId, s3Bucket, s3Key, endpointId]);

    return res.status(201).json({
      success: true,
      jobId,
      status: 'PROCESSING'
    });
  } catch (error: any) {
    console.error('[ERRO] POST /v1/document-jobs:', error.message);
    return res.status(500).json({ error: error.message || 'Erro ao iniciar job de documento.' });
  }
});
