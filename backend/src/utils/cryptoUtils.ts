import crypto from 'node:crypto';

// Segredo do JWT lido do .env ou com fallback seguro
const JWT_SECRET = process.env.JWT_SECRET || 'synapse-super-secret-key-12345';

/**
 * Cria um hash seguro usando PBKDF2 com salt aleatório.
 * Retorna no formato 'salt:hash'.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifica se a senha fornecida bate com a versão hasheada salva no banco.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, originalHash] = parts;
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === originalHash;
  } catch (error) {
    return false;
  }
}

/**
 * Gera um token JWT assinado digitalmente com validade de 24 horas usando crypto nativo.
 */
export function generateToken(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

  // Define expiração padrão para 24 horas a partir do momento atual
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');

  const signature = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

/**
 * Valida a assinatura de um token JWT e verifica se está expirado.
 * Retorna o payload decodificado se válido, ou null caso contrário.
 */
export function verifyToken(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (signature !== expectedSignature) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));

    // Verifica expiração temporal
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}
