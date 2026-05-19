import express from 'express';
import dotenv from 'dotenv';
import './config/database'; // Garante a inicialização do Pool do Postgres
import { validateApiKey } from './middlewares/authMiddleware';
import { analyzeRouter } from './routes/analyzeRoutes'; // 👈 Nosso novo roteador universal

dotenv.config();

const app = express();

// SOLUÇÃO COMPLIANT COM O SONARQUBE: Oculta a tecnologia do cabeçalho HTTP
app.disable('x-powered-by'); 

app.use(express.json());

const PORT = process.env.PORT || 3334;

// Rota de teste (Health Check)
app.get('/health', (req, res) => {
  res.json({ status: 'B/Synapse Engine operacional!' });
});

// Middleware de segurança perimetral (Validação no Banco)
app.use(validateApiKey);

// Plugamos o roteador dinâmico na base da API
app.use('/v1/analyze', analyzeRouter);

app.listen(PORT, () => {
  console.log(`[B/SYNAPSE] Servidor rodando dinamicamente na porta ${PORT}`);
});