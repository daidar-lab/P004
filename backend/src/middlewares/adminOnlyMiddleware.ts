import { Response, NextFunction } from 'express';
import { AuthenticatedUserRequest } from './userAuthMiddleware';

/**
 * Middleware que bloqueia a requisição caso o usuário logado não seja um Administrador ('admin').
 */
export const adminOnly = (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Acesso negado. Sessão do usuário não identificada.' 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Acesso restrito. Sua conta não possui permissões administrativas para esta ação.' 
    });
  }

  return next();
};
