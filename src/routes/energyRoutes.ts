import { Router } from 'express';
import { analyzeEnergyInvoice } from '../services/energyService';

const energyRouter = Router();

// Rota: POST http://localhost:3334/v1/analyze/energy
energyRouter.post('/energy', async (req, res) => {
  try {
    const { faturaData, equipmentList, previousMonthData } = req.body;

    if (!faturaData) {
      return res.status(400).json({ error: 'Os dados de faturaData são obrigatórios.' });
    }

    // Se o equipmentList vier nulo ou vazio, tratamos como array vazio
    const equipments = equipmentList || [];

    // Executa o processamento do relatório pelo Bedrock
    const relatorioMarkdown = await analyzeEnergyInvoice(faturaData, equipments, previousMonthData);

    // Retorna exatamente no formato textual puro que o front/gerador de PDF do P001 espera
    return res.json({
      success: true,
      report: relatorioMarkdown
    });

  } catch (error: any) {
    console.error('[Erro P004 Auditoria Energética]:', error);
    return res.status(500).json({ error: error.message || 'Erro ao processar auditoria via Bedrock.' });
  }
});

export { energyRouter };