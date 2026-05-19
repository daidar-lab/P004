import { Router } from 'express';
import { analyzeEnergyInvoice } from '../services/energyService';

const energyRouter = Router();

energyRouter.post('/energy', async (req, res) => {
  try {
    const { faturaData, equipmentList, previousMonthData } = req.body;

    if (!faturaData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Os dados de faturaData são obrigatórios.' 
      });
    }

    const equipments = equipmentList || [];
    const relatorioMarkdown = await analyzeEnergyInvoice(faturaData, equipments, previousMonthData);

    return res.json({
      success: true,
      report: relatorioMarkdown
    });

  } catch (error: any) {
    // Log detalhado no terminal do servidor para você, Davi, saber exatamente o que houve
    console.error(`[ERRO CRÍTICO P004 - ENERGIA] [${new Date().toISOString()}]:`, error);

    // Tratamento amigável para a aplicação cliente (P001)
    if (error.name === 'UnrecognizedClientException') {
      return res.status(500).json({
        success: false,
        error: 'Erro de infraestrutura: Credenciais da AWS inválidas ou expiradas.'
      });
    }

    if (error.name === 'ValidationException') {
      return res.status(400).json({
        success: false,
        error: 'Erro de validação: O formato dos dados enviados ao Bedrock está incorreto.'
      });
    }

    // Erro genérico caso seja outra coisa (ex: timeout)
    return res.status(500).json({ 
      success: false, 
      error: 'Falha temporária ao processar auditoria com o serviço de IA Bedrock.' 
    });
  }
});

export { energyRouter };