import { Router } from 'express';
import { analyzeInterventionImage } from '../services/interventionService';

const interventionRouter = Router();

// Rota: POST http://localhost:3334/v1/analyze/intervention
interventionRouter.post('/intervention', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    // Validação dos dados de entrada vindos do P007
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ 
        error: 'Preenchimento obrigatório em falta: imageBase64 e mimeType são necessários.' 
      });
    }

    // Executa a chamada ao serviço do Bedrock
    const resultadoIa = await analyzeInterventionImage({
      base64Data: imageBase64,
      mimeType: mimeType
    });

    // Devolve o relatório gerado pela IA mapeado num objeto JSON limpo
    return res.json({
      success: true,
      description: JSON.parse(resultadoIa)
    });

  } catch (error) {
    console.error('[Erro P004 Intervenção]:', error);
    return res.status(500).json({ 
      error: 'Erro interno ao processar a imagem via Bedrock.' 
    });
  }
});

export { interventionRouter };