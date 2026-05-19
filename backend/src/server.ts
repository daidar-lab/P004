import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import './config/database';

import { validateApiKey } from './middlewares/authMiddleware';
import { analyzeRouter } from './routes/analyzeRoutes';
import { apiKeysRouter } from './routes/apiKeysRoutes';
import { endpointsRouter } from './routes/endpointsRoutes';
import { dashboardRouter } from './routes/dashboardRoutes';

dotenv.config();

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

app.disable('x-powered-by');
app.use(express.json());

const PORT = process.env.PORT || 3334;

// ✅ Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'B/Synapse Engine operacional!' });
});


// ✅ ROTAS PÚBLICAS (SEM API KEY)
app.use('/v1/apikeys', apiKeysRouter);
app.use('/v1/endpoints', endpointsRouter);
app.use('/v1/dashboard', dashboardRouter);


// 🔐 MIDDLEWARE DE SEGURANÇA (SÓ DAQUI PRA BAIXO)
app.use(validateApiKey);


// ✅ ROTAS PROTEGIDAS (PRECISAM DE API KEY)
app.use('/v1/analyze', analyzeRouter);


app.listen(PORT, () => {
  console.log(`[B/SYNAPSE] Servidor rodando na porta ${PORT}`);
});
