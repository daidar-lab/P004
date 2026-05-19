import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import './config/database'; // Garante a inicialização do Pool do Postgres
import { validateApiKey } from './middlewares/authMiddleware';
import { apiLimiter } from './middlewares/rateLimitMiddleware';
import { analyzeRouter } from './routes/analyzeRoutes'; // 👈 Nosso novo roteador universal
import { endpointsRouter } from './routes/endpointsRoutes'; // 👈 Roteador para administração
import { dashboardRouter } from './routes/dashboardRoutes'; // 👈 Roteador do dashboard

dotenv.config();

const app = express();

// SOLUÇÃO COMPLIANT COM O SONARQUBE: Oculta a tecnologia do cabeçalho HTTP
app.disable('x-powered-by');

app.use(cors());
app.use(express.json());

// Aplica limitador de requisições
app.use(apiLimiter);

const PORT = process.env.PORT || 3334;

// Rota de teste (Health Check)
app.get('/health', (req, res) => {
  res.json({ status: 'B/Synapse Engine operacional!' });
});

// Rotas Administrativas (Neste momento, sem a key do cliente final)
app.use('/v1/endpoints', endpointsRouter);
app.use('/v1/dashboard', dashboardRouter);

// Middleware de segurança perimetral (Validação no Banco para rotas de IA)
app.use(validateApiKey);

// Plugamos o roteador dinâmico na base da API
app.use('/v1/analyze', analyzeRouter);

app.listen(PORT, () => {
  console.log(`[B/SYNAPSE] Servidor rodando dinamicamente na porta ${PORT}`);
});