import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/cryptoUtils';

// Estendemos a interface de Request do Express para adicionar a propriedade 'user'
export interface AuthenticatedUserRequest extends Request {
  user?: {
    id: string;
    username: string;
    name: string;
    role: 'admin' | 'user';
  };
}

/**
 * Middleware que intercepta e valida requisições contendo Token JWT no cabeçalho Authorization.
 */
export const userAuth = (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        error: 'Acesso negado. Token de autenticação não fornecido no cabeçalho.' 
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Acesso negado. O cabeçalho de autenticação deve estar no formato: Bearer <token>' 
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        error: 'Acesso negado. Token inválido, violado ou expirado.' 
      });
    }

    // Vincula os dados decodificados do usuário na requisição
    req.user = {
      id: decoded.id,
      username: decoded.username,
      name: decoded.name,
      role: decoded.role
    };

    return next();
  } catch (error) {
    console.error('[ERRO MIDDLEWARE USER AUTH]:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Falha interna ao processar a validação do token do usuário.' 
    });
  }
};
