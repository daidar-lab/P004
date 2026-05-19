import express from 'express';
import dotenv from 'dotenv';
import { energyRouter } from './routes/energyRoutes';
import { interventionRouter } from './routes/interventionRoutes';
import { validateApiKey } from './middlewares/authMiddleware'; // 1. Importa o porteiro

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3334;

// Rota de teste (Health Check) - Essa fica aberta para sabermos se o servidor está vivo
app.get('/health', (req, res) => {
  res.json({ status: 'Proxy P004 operacional!' });
});

// 2. Aplicamos o middleware de segurança ANTES das rotas de IA.
// Tudo o que estiver abaixo dessa linha vai exigir a chave x-api-key no cabeçalho!
app.use(validateApiKey);

app.use('/v1/analyze', energyRouter);
app.use('/v1/analyze', interventionRouter);

app.listen(PORT, () => {
  console.log(`[P004] Servidor Proxy rodando na porta ${PORT}`);
});