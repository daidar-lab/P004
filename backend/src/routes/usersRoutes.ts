import { Router, Response } from 'express';
import { db } from '../config/database';
import { hashPassword } from '../utils/cryptoUtils';
import { userAuth, AuthenticatedUserRequest } from '../middlewares/userAuthMiddleware';
import { adminOnly } from '../middlewares/adminOnlyMiddleware';

export const usersRouter = Router();

// Aplica autenticação e restrição de administrador a todas as rotas deste grupo
usersRouter.use(userAuth);
usersRouter.use(adminOnly);

/**
 * GET /v1/users
 * Retorna todos os usuários cadastrados (excluindo os hashes de senha).
 */
usersRouter.get('/', async (req: AuthenticatedUserRequest, res: Response) => {
  try {
    const result = await db.query(
      'SELECT id, username, name, role, created_at, updated_at FROM synapse.users ORDER BY created_at DESC'
    );
    return res.status(200).json(result.rows);
  } catch (error: any) {
    console.error('[ERRO GET /v1/users]:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Falha interna ao carregar a lista de usuários.' 
    });
  }
});

/**
 * POST /v1/users
 * Cadastra um novo usuário no gateway.
 */
usersRouter.post('/', async (req: AuthenticatedUserRequest, res: Response) => {
  try {
    const { username, name, password, role } = req.body;

    if (!username || !name || !password || !role) {
      return res.status(400).json({ 
        success: false, 
        error: 'Todos os campos (username, name, password, role) são obrigatórios.' 
      });
    }

    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({ 
        success: false, 
        error: 'Cargo inválido. O cargo deve ser: admin ou user.' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'A senha deve possuir pelo menos 6 caracteres.' 
      });
    }

    // Verifica se já existe um usuário com o mesmo username
    const checkUser = await db.query(
      'SELECT id FROM synapse.users WHERE LOWER(username) = $1',
      [username.trim().toLowerCase()]
    );
    
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Este nome de usuário já está sendo utilizado.' 
      });
    }

    // Criptografa a senha usando PBKDF2 (SHA-512)
    const passwordHash = hashPassword(password);

    const result = await db.query(
      `INSERT INTO synapse.users (username, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, name, role, created_at`,
      [username.trim().toLowerCase(), name.trim(), passwordHash, role]
    );

    return res.status(201).json(result.rows[0]);

  } catch (error: any) {
    console.error('[ERRO POST /v1/users]:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Falha interna ao criar um novo usuário.' 
    });
  }
});

/**
 * PUT /v1/users/:id
 * Atualiza as informações de um usuário. Permite alteração opcional de senha.
 */
usersRouter.put('/:id', async (req: AuthenticatedUserRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { username, name, password, role } = req.body;

    if (!username || !name || !role) {
      return res.status(400).json({ 
        success: false, 
        error: 'Campos nome, username e cargo são obrigatórios.' 
      });
    }

    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({ 
        success: false, 
        error: 'Cargo inválido. O cargo deve ser: admin ou user.' 
      });
    }

    // Garante que o novo username não colida com outro usuário existente
    const checkUser = await db.query(
      'SELECT id FROM synapse.users WHERE LOWER(username) = $1 AND id <> $2',
      [username.trim().toLowerCase(), id]
    );
    
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Este nome de usuário já está sendo utilizado por outra conta.' 
      });
    }

    let queryText = '';
    let queryParams = [];

    // Se uma nova senha for fornecida, atualiza com hash. Caso contrário, atualiza apenas dados cadastrais.
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ 
          success: false, 
          error: 'A nova senha deve possuir no mínimo 6 caracteres.' 
        });
      }
      const passwordHash = hashPassword(password);
      queryText = `
        UPDATE synapse.users 
        SET username = $1, name = $2, password_hash = $3, role = $4, updated_at = NOW() 
        WHERE id = $5
        RETURNING id, username, name, role, updated_at
      `;
      queryParams = [username.trim().toLowerCase(), name.trim(), passwordHash, role, id];
    } else {
      queryText = `
        UPDATE synapse.users 
        SET username = $1, name = $2, role = $3, updated_at = NOW() 
        WHERE id = $4
        RETURNING id, username, name, role, updated_at
      `;
      queryParams = [username.trim().toLowerCase(), name.trim(), role, id];
    }

    const result = await db.query(queryText, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Usuário não encontrado para atualização.' 
      });
    }

    return res.status(200).json(result.rows[0]);

  } catch (error: any) {
    console.error('[ERRO PUT /v1/users/:id]:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Falha interna ao atualizar as informações do usuário.' 
    });
  }
});

/**
 * DELETE /v1/users/:id
 * Remove um usuário. Bloqueia a autoexclusão.
 */
usersRouter.delete('/:id', async (req: AuthenticatedUserRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id;

    // Impede o admin logado de deletar a si mesmo
    if (id === currentUserId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Restrição de segurança: Você não pode excluir a sua própria conta ativa.' 
      });
    }

    const result = await db.query(
      'DELETE FROM synapse.users WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Usuário não encontrado para exclusão.' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Usuário removido com sucesso.' 
    });

  } catch (error: any) {
    console.error('[ERRO DELETE /v1/users/:id]:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Falha interna ao excluir o usuário.' 
    });
  }
});
