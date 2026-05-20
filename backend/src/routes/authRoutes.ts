import { Router } from 'express';
import { db } from '../config/database';
import { verifyPassword, hashPassword, generateToken } from '../utils/cryptoUtils';
import { userAuth, AuthenticatedUserRequest } from '../middlewares/userAuthMiddleware';

export const authRouter = Router();

/**
 * POST /v1/auth/login
 * Realiza autenticação de usuários, retornando o token JWT e seus dados básicos de perfil.
 */
authRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Nome de usuário e senha são obrigatórios.'
      });
    }

    // Busca o usuário correspondente no banco (case insensitive no username)
    const userRes = await db.query(
      'SELECT id, username, name, password_hash, role FROM synapse.users WHERE LOWER(username) = $1',
      [username.trim().toLowerCase()]
    );

    const user = userRes.rows[0];

    // Se o usuário não existir ou se a senha não bater
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas. Verifique o usuário e a senha.'
      });
    }

    // Gera token JWT de 24 horas contendo as informações seguras do usuário
    const token = generateToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });

  } catch (error: any) {
    console.error('[ERRO ROTA LOGIN]:', error);
    return res.status(500).json({
      success: false,
      error: 'Falha interna ao processar a autenticação de login.'
    });
  }
});

/**
 * GET /v1/auth/me
 * Retorna as informações do usuário logado baseado no token de autenticação enviado.
 */
authRouter.get('/me', userAuth, (req: AuthenticatedUserRequest, res) => {
  return res.status(200).json({
    success: true,
    user: req.user
  });
});

/**
 * PUT /v1/auth/change-password
 * Permite ao próprio usuário logado trocar sua senha de acesso.
 */
authRouter.put('/change-password', userAuth, async (req: AuthenticatedUserRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'A senha atual e a nova senha são obrigatórias.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'A nova senha deve conter pelo menos 6 caracteres.'
      });
    }

    // Busca a senha criptografada atual no banco
    const userRes = await db.query(
      'SELECT password_hash FROM synapse.users WHERE id = $1',
      [userId]
    );

    const user = userRes.rows[0];

    // Valida se a senha atual está correta antes de prosseguir
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      return res.status(400).json({
        success: false,
        error: 'A senha atual fornecida está incorreta.'
      });
    }

    // Gera o novo hash PBKDF2 e atualiza a senha no banco de dados
    const newHash = hashPassword(newPassword);
    await db.query(
      'UPDATE synapse.users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Senha atualizada com sucesso!'
    });

  } catch (error: any) {
    console.error('[ERRO ALTERAÇÃO DE SENHA]:', error);
    return res.status(500).json({
      success: false,
      error: 'Falha interna ao processar a atualização da sua senha.'
    });
  }
});
