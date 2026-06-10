import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import './config/database';

import { validateApiKey } from './middlewares/authMiddleware';
import { userAuth } from './middlewares/userAuthMiddleware';
import { authRouter } from './routes/authRoutes';
import { usersRouter } from './routes/usersRoutes';
import { analyzeRouter } from './routes/analyzeRoutes';
import { apiKeysRouter } from './routes/apiKeysRoutes';
import { requestLogsRouter } from './routes/requestLogsRoutes';
import { dashboardRouter } from './routes/dashboardRoutes';
import { endpointsRouter } from './routes/endpointsRoutes';
import { metricsRouter } from './routes/metricsRoutes';
import { documentJobsRouter } from './routes/documentJobsRoutes';

dotenv.config();

const app = express();

// Configuração do CORS dinâmica para suportar local e produção (AWS)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

app.disable('x-powered-by');
app.use(express.json());

// Definição da porta (Lê a porta da AWS ou usa a 3334 como padrão local)
const PORT = process.env.PORT || 3334;

// ✅ Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'B/Synapse Engine operacional!' });
});

// ✅ ROTA DE AUTENTICAÇÃO DE USUÁRIOS (LOGIN & PERFIL)
app.use('/v1/auth', authRouter);

// ✅ ROTA DE GERENCIAMENTO DE USUÁRIOS (ADMIN ONLY)
app.use('/v1/users', usersRouter);

// ✅ ROTAS DO PAINEL / DASHBOARD (PROTEGIDAS POR TOKEN DE USUÁRIO)
app.use('/v1/apikeys', userAuth, apiKeysRouter);
app.use('/v1/endpoints', userAuth, endpointsRouter);
app.use('/v1/request-logs', userAuth, requestLogsRouter);
app.use('/v1/metrics', userAuth, metricsRouter);
app.use('/v1/dashboard', userAuth, dashboardRouter);
app.use('/v1/document-jobs', userAuth, documentJobsRouter);

// 🔐 MIDDLEWARE DE SEGURANÇA PARA API CLIENT (SÓ DAQUI PRA BAIXO)
app.use(validateApiKey);

// ✅ ROTAS PROTEGIDAS PARA INTEGRAÇÃO EXTERNA (PRECISAM DE API KEY)
app.use('/v1/analyze', analyzeRouter);

// Captura a instância de execução do HTTP Server do Node.js
const server = app.listen(PORT, () => {
  console.log(`[B/SYNAPSE] Servidor rodando na porta ${PORT}`);
});

// 🛠️ BLINDAGEM DE TIMEOUTS PARA PROCESSAMENTO SÍNCRONO DO TEXTRACT
// Define o limite de tempo limite global para 5 minutos (300000 ms) 
// Isso garante que os seus 160 segundos de polling rodem sem interrupções do Node.
server.timeout = 300000; 

// Define o tempo limite para o recebimento dos headers HTTP
server.headersTimeout = 305000; 

// Garante que a conexão TCP fique aberta tempo suficiente para streams e arquivos pesados
server.keepAliveTimeout = 300000;