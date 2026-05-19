import express from 'express';
import dotenv from 'dotenv';
import { energyRouter } from './routes/energyRoutes';
import { interventionRouter } from './routes/interventionRoutes';
import { validateApiKey } from './middlewares/authMiddleware';

dotenv.config();

const app = express();

// 👉 SOLUÇÃO COMPLIANT COM O SONARQUBE: Oculta a tecnologia do cabeçalho HTTP
app.disable('x-powered-by'); 

app.use(express.json());

const PORT = process.env.PORT || 3334;

// Rota de teste (Health Check)
app.get('/health', (req, res) => {
  res.json({ status: 'Proxy P004 operacional!' });
});

// Middleware de segurança
app.use(validateApiKey);

app.use('/v1/analyze', energyRouter);
app.use('/v1/analyze', interventionRouter);

app.listen(PORT, () => {
  console.log(`[P004] Servidor Proxy rodando na porta ${PORT}`);
});