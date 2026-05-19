# P004 - Proxy Server para Inteligência Artificial (AWS Bedrock)

Este projeto consiste em um microsserviço de **Proxy Server** desenvolvido em **Node.js** com **TypeScript**. O objetivo principal da aplicação é centralizar, proteger e intermediar as requisições de IA generativa de outros ecossistemas da empresa — especificamente o **P001 (Audit Energy)** e o **P007 (Comunicado de Intervenção)** — direcionando-as com segurança para o serviço de nuvem **AWS Bedrock**.

---

## 🏛️ Decisões Técnicas e Arquitetura

### 1. Stack Tecnológica
* **Node.js (v22+):** Escolhido como ambiente de execução principal pela sua eficiência em operações de I/O assíncronas e alta performance para APIs REST.
* **TypeScript:** Adotado para garantir tipagem estática, auto-complete preciso do SDK da AWS, prevenção de bugs em tempo de desenvolvimento e facilidade de manutenção a longo prazo.
* **Express:** Framework minimalista e robusto utilizado para o roteamento e gerenciamento de middlewares.
* **@aws-sdk/client-bedrock-runtime:** SDK oficial e nativo da AWS para comunicação direta com os modelos do Bedrock, garantindo menor latência e maior compatibilidade.

### 2. Padrão de Projeto (Service Pattern)
A arquitetura foi dividida em três camadas claras para garantir alta modularidade e independência de regras de negócio:
* **Rotas (`src/routes`):** Atuam como portas de entrada (controllers), sendo responsáveis exclusivamente por receber as requisições HTTP, validar a presença dos dados obrigatórios e responder ao cliente.
* **Middlewares (`src/middlewares`):** Camada de interceptação encarregada da segurança de perímetro antes que a requisição chegue ao destino.
* **Serviços (`src/services`):** O "cérebro" da aplicação. É onde residem as regras de negócios específicas de cada projeto, o processamento de dados internos, as instruções de prompts de sistema e as integrações estruturadas com a AWS.

---

## 🔒 Segurança (Middleware de Autenticação)

Para mitigar riscos de exposição pública e controle de custos na AWS, as rotas de análise são estritamente privadas e protegidas por um middleware de **API Key**. 
Toda requisição externa obrigatoriamente deve incluir no cabeçalho HTTP o campo `x-api-key`. O Proxy valida o token comparando-o com as chaves injetadas em ambiente (`.env`). Se o token for inválido ou ausente, a requisição é abortada imediatamente com código **`401 Unauthorized`**.

---

## 🔀 Integrações e Contratos de Uso

O Proxy está desenhado para manter total compatibilidade com o formato técnico original esperado pelas aplicações integradas (retorno de texto simples formatado em Markdown pronto para interfaces ou PDFs).

### 1. Módulo Audit Energy (P001)
* **Rota:** `POST /v1/analyze/energy`
* **Objetivo:** Receber dados de faturas elétricas reais e realizar o cruzamento técnico com o inventário de carga levantado em campo pela equipe, calculando distorções de consumo e sugerindo planos de eficiência energética orientados a ROI.
* **Modelo de IA:** Amazon Titan Text (ou equivalente configurado em texto).
* **Payload de Entrada (JSON):**
```json
{
  "faturaData": {
    "medidaConsumoTUSDForaPonta": 5200,
    "valorTotalRS": 3100.00,
    "custoICMSRS": 350.00,
    "custoPISPASEPRS": 50.00,
    "custoCOFINSRS": 120.00,
    "modalidadeTarifaria": "Verde"
  },
  "equipmentList": [
    { "name": "Ar Condicionado", "quantity": 3, "power_w": 1500, "hours_per_day": 8 }
  ],
  "previousMonthData": {
    "medidaConsumoTUSDForaPonta": 4900
  }
}