import { Router } from 'express';
import { analyzeInterventionImage } from '../services/interventionService';

const interventionRouter = Router();

interventionRouter.post('/intervention', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ 
        success: false,
        error: 'Campos obrigatórios ausentes: imageBase64 e mimeType.' 
      });
    }

    const textoAnalise = await analyzeInterventionImage({
      base64Data: imageBase64,
      mimeType: mimeType
    });

    return res.json({
      success: true,
      analise_ia: textoAnalise
    });

  } catch (error: any) {
    // Log robusto com timestamp no terminal
    console.error(`[ERRO CRÍTICO P004 - INTERVENÇÃO] [${new Date().toISOString()}]:`, error);

    // Tratamento focado no contrato do P007
    if (error.name === 'UnrecognizedClientException') {
      return res.status(500).json({
        success: false,
        error: 'Erro de infraestrutura: Chaves de acesso AWS incorretas no servidor Proxy.'
      });
    }

    if (error.name === 'ThrottlingException' || error.statusCode === 429) {
      return res.status(429).json({
        success: false,
        error: 'Limite de requisições da AWS Bedrock atingido. Tente novamente em instantes.'
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: 'O serviço de análise visual da IA está indisponível no momento.' 
    });
  }
});

export { interventionRouter };