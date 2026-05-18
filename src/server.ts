import express from 'express';
import dotenv from 'dotenv';
import { energyRouter } from './routes/energyRoutes';
import { interventionRouter } from './routes/interventionRoutes';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3334;

// Rota de teste (Health Check)
app.get('/health', (req, res) => {
  res.json({ status: 'Proxy P004 operacional!' });
});

// Vinculando as rotas dos projetos sob o prefixo /v1/analyze
app.use('/v1/analyze', energyRouter);
app.use('/v1/analyze', interventionRouter);

app.listen(PORT, () => {
  console.log(`[P004] Servidor Proxy rodando na porta ${PORT}`);
});