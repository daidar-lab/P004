import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';

// Estendemos a interface do Express para poder anexar informações personalizadas no objeto 'req'
interface AuthenticatedRequest extends Request {
  apiKeyInfo?: {
    id: string;
    client_name: string;
    api_key: string;
  };
}

export const validateApiKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Captura a chave enviada no cabeçalho HTTP "x-api-key"
    const clientApiKey = req.headers['x-api-key'];

    if (!clientApiKey) {
      return res.status(401).json({ 
        success: false,
        error: 'Acesso negado. Chave de API (x-api-key) não fornecida no cabeçalho.' 
      });
    }

    // Consulta banco de dados verificando integridade, status ativo e validade temporal
    const queryText = `
      SELECT id, client_name, api_key 
      FROM synapse.api_keys 
      WHERE api_key = $1 
        AND is_active = TRUE 
        AND (expires_at IS NULL OR expires_at > NOW());
    `;

    const result = await db.query(queryText, [clientApiKey]);

    // Se o banco retornar zero linhas, a chave informada não é válida ou está inativa
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        error: 'Acesso negado. Chave de API inválida ou revogada.' 
      });
    }

    // Anexamos as informações validadas da chave na requisição para consumo futuro pelas rotas
    req.apiKeyInfo = result.rows[0];

    // Autoriza o Express a prosseguir para o ciclo de rotas
    return next();

  } catch (error) {
    console.error(`[ERRO CRÍTICO DE PERÍMETRO] [${new Date().toISOString()}]:`, error);
    return res.status(500).json({
      success: false,
      error: 'Falha interna ao processar a autenticação de segurança no servidor.'
    });
  }
};