import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockClient } from "../config/bedrock";

// Prompt do sistema focado em inspeção visual e descrição técnica
const INTERVENTION_SYSTEM_PROMPT = `
Você é um engenheiro de manutenção e inspetor técnico especialista em IA. 
Sua tarefa é analisar a imagem fornecida (enviada em anexo) que retrata uma situação de intervenção técnica ou avaria.
Gere uma descrição detalhada, técnica e formal da imagem, identificando:
1. O problema visual estrutural, elétrico ou mecânico aparente.
2. Possíveis riscos associados à situação apresentada.
3. Recomendações técnicas preliminares para a equipe de campo.

Retorne a resposta estruturada em formato JSON com os campos: { "analiseVisual": "", "riscosIdentificados": [], "recomendacoes": [] }. Não adicione marcações markdown como \`\`\`json no início ou fim do texto.
`;

interface ImageInput {
  base64Data: string; // A string base64 da imagem (sem o prefixo "data:image/png;base64,")
  mimeType: string;   // Ex: "image/jpeg", "image/png"
}

export const analyzeInterventionImage = async (image: ImageInput) => {
  // NOTA: Para chamadas multimodais (texto + imagem), certifica-te de que o modelo ativado 
  // no painel do Bedrock suporta visão (como as variações do Anthropic Claude 3, por exemplo).
  // Ajusta o MODEL_ID conforme o que o Bruno definir no painel da AWS.
  const MODEL_ID = "anthropic.claude-3-sonnet-20240229-v1:0"; 

  // Estrutura de payload para modelos Anthropic Claude no Bedrock (suporta imagens nativamente)
  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 2048,
    temperature: 0.2,
    system: INTERVENTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.mimeType,
              data: image.base64Data
            }
          },
          {
            type: "text",
            text: "Por favor, analise esta imagem de intervenção técnica de acordo com as instruções do sistema."
          }
        ]
      }
    ]
  };

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  // No formato do Claude, a resposta vem dentro de content[0].text
  return responseBody.content[0].text;
};