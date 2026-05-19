import rateLimit from 'express-rate-limit';

// Rate Limiter middleware to prevent abuse and API exhaustion
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limite de 100 requisições por windowMs por IP
  message: {
    success: false,
    error: 'Muitas requisições originadas deste IP, por favor tente novamente após 15 minutos.'
  },
  standardHeaders: true, // Retorna os headers de rate limit no formato padrão `RateLimit-*`
  legacyHeaders: false, // Desabilita os headers antigos `X-RateLimit-*`
});
