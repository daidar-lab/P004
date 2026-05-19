import { Request, Response, NextFunction } from 'express';

export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  // Captura a chave enviada no cabeçalho HTTP "x-api-key"
  const clientApiKey = req.headers['x-api-key'];

  if (!clientApiKey) {
    return res.status(401).json({ 
      error: 'Acesso negado. Chave de API (x-api-key) não fornecida no cabeçalho.' 
    });
  }

  // Buscamos as chaves permitidas que vão estar no seu .env
  const p001Key = process.env.P001_API_KEY;
  const p007Key = process.env.P007_API_KEY;

  // Verifica se a chave recebida bate com a do P001 ou com a do P007
  if (clientApiKey === p001Key || clientApiKey === p007Key) {
    // Se bater, o Express entende que está tudo certo e passa para a rota processar
    return next();
  }

  // Se chegou aqui, a chave foi enviada mas está incorreta
  return res.status(401).json({ 
    error: 'Acesso negado. Chave de API inválida.' 
  });
};