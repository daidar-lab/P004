import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3334;

// Rota de teste para ver se o proxy está respondendo
app.get('/health', (req, res) => {
  res.json({ status: 'Proxy P004 operacional!' });
});

app.listen(PORT, () => {
  console.log(`[P004] Servidor Proxy rodando na porta ${PORT}`);
});