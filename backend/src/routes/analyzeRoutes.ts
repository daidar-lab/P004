import { Router, Request, Response } from 'express';
import { BSynapseService } from '../services/bsynapseService';

export const analyzeRouter = Router();

// Definimos uma interface para estender o Request com as informações que o middleware injetou
interface AuthenticatedRequest extends Request {
  apiKeyInfo?: {
    id: string;
    client_name: string;
    api_key: string;
  };
}

// 💥 ROTA UNIVERSAL: O ":slug" captura qualquer endpoint dinamicamente
analyzeRouter.post('/:slug', async (req: AuthenticatedRequest, res: Response) => {
  const slug = req.params.slug as string;
  const clientApiKeyId = req.apiKeyInfo?.id;

  try {
    if (!clientApiKeyId) {
      return res.status(401).json({ success: false, error: 'Contexto de autenticação ausente.' });
    }

    // Chamamos o serviço universal passando o slug, o ID da chave e os dados enviados pelo cliente
    const result = await BSynapseService.executeDynamicAnalysis({
      slug,
      clientApiKeyId,
      requestBody: req.body
    });

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error(`[ERRO NA ROTA DINÂMICA /:${slug}]:`, error.message);
    
    // Tratamento de erros HTTP baseado na resposta do serviço
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || 'Falha ao processar análise dinâmica.'
    });
  }
});