import { Block } from "@aws-sdk/client-textract";

export interface TextractGeometricLine {
  Text: string;
  Confidence: number;
  Geometry: {
    BoundingBox: {
      Top: number;
      Left: number;
      Width: number;
      Height: number;
    };
  };
}

export interface TextractParsedData {
  text: string;
  tables: string[][][];
  keyValuePairs: Record<string, string>;
  rawBlocks: TextractGeometricLine[];
}

export function parseTextractBlocks(blocks: Block[]): TextractParsedData {
  const textLines: string[] = [];
  const keyValuePairs: Record<string, string> = {};
  const tables: string[][][] = [];
  const rawBlocks: TextractGeometricLine[] = [];

  // Map para buscar blocos por ID
  const blockMap = new Map<string, Block>();
  for (const block of blocks) {
    if (block.Id) {
      blockMap.set(block.Id, block);
    }
  }

  // Extração de linhas de texto e mapeamento geométrico
  for (const block of blocks) {
    if (block.BlockType === "LINE" && block.Text) {
      textLines.push(block.Text);

      if (block.Geometry?.BoundingBox) {
        rawBlocks.push({
          Text: block.Text,
          Confidence: block.Confidence || 0,
          Geometry: {
            BoundingBox: {
              Top: block.Geometry.BoundingBox.Top || 0,
              Left: block.Geometry.BoundingBox.Left || 0,
              Width: block.Geometry.BoundingBox.Width || 0,
              Height: block.Geometry.BoundingBox.Height || 0,
            },
          },
        });
      }
    }
  }

  // Helper para extrair texto de IDs de relacionamento
  const getRelationshipText = (ids?: string[]): string => {
    if (!ids) return "";
    return ids
      .map(id => blockMap.get(id))
      .filter(b => b && (b.BlockType === "WORD" || b.BlockType === "SELECTION_ELEMENT"))
      .map(b => {
        if (b!.BlockType === "SELECTION_ELEMENT") {
          return b!.SelectionStatus === "SELECTED" ? "[X]" : "[ ]";
        }
        return b!.Text || "";
      })
      .join(" ")
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Extração de Key-Value Pairs
  for (const block of blocks) {
    if (block.BlockType === "KEY_VALUE_SET" && block.EntityTypes?.includes("KEY")) {
      const keyText = getRelationshipText(block.Relationships?.find(r => r.Type === "CHILD")?.Ids);
      const valueBlockId = block.Relationships?.find(r => r.Type === "VALUE")?.Ids?.[0];
      const valueBlock = valueBlockId ? blockMap.get(valueBlockId) : null;
      let valueText = "";

      if (valueBlock) {
        valueText = getRelationshipText(valueBlock.Relationships?.find(r => r.Type === "CHILD")?.Ids);
      }

      if (keyText && keyText.trim()) {
        keyValuePairs[keyText.trim()] = valueText.trim();
      }
    }
  }

  // Extração de Tabelas — sem nenhum filtro de domínio, espelha exatamente o que o Textract retornou
  for (const block of blocks) {
    if (block.BlockType === "TABLE") {
      const tableRows: Record<number, Record<number, string>> = {};
      let maxRow = 0;
      let maxCol = 0;

      const cellIds = block.Relationships?.find(r => r.Type === "CHILD")?.Ids || [];

      // Inicializa a estrutura de células (incluindo merged cells via row/col span)
      for (const cellId of cellIds) {
        const cell = blockMap.get(cellId);
        if (cell && cell.BlockType === "CELL" && cell.RowIndex !== undefined && cell.ColumnIndex !== undefined) {
          const r = cell.RowIndex - 1;
          const c = cell.ColumnIndex - 1;
          const rowSpan = cell.RowSpan || 1;
          const colSpan = cell.ColumnSpan || 1;

          for (let rs = 0; rs < rowSpan; rs++) {
            for (let cs = 0; cs < colSpan; cs++) {
              if (!tableRows[r + rs]) tableRows[r + rs] = {};
              if (tableRows[r + rs][c + cs] === undefined) {
                tableRows[r + rs][c + cs] = "";
              }
              if ((r + rs) > maxRow) maxRow = r + rs;
              if ((c + cs) > maxCol) maxCol = c + cs;
            }
          }
        }
      }

      // Injeta os valores nas células
      for (const cellId of cellIds) {
        const cell = blockMap.get(cellId);
        if (cell && cell.BlockType === "CELL" && cell.RowIndex !== undefined && cell.ColumnIndex !== undefined) {
          const cellText = getRelationshipText(cell.Relationships?.find(r => r.Type === "CHILD")?.Ids);
          const r = cell.RowIndex - 1;
          const c = cell.ColumnIndex - 1;
          tableRows[r][c] = cellText;
        }
      }

      // Constrói o array 2D sem nenhuma filtragem — todas as linhas do Textract são preservadas
      const tableData: string[][] = [];
      for (let r = 0; r <= maxRow; r++) {
        const row: string[] = [];
        for (let c = 0; c <= maxCol; c++) {
          row.push(tableRows[r]?.[c] ?? "");
        }
        tableData.push(row);
      }

      if (tableData.length > 0) {
        tables.push(tableData);
      }
    }
  }

  return {
    text: textLines.join("\n"),
    tables,
    keyValuePairs,
    rawBlocks,
  };
}

export function convertToCsv(parsedData: TextractParsedData): string {
  let csvContent = "";

  const sanitizeCell = (cell: string): string => {
    let cleaned = cell.replace(/[\r\n]+/g, " ").trim();
    cleaned = cleaned.replace(/"/g, '""');
    return `"${cleaned}"`;
  };

  // Key-Value Pairs como seção inicial do CSV
  if (Object.keys(parsedData.keyValuePairs).length > 0) {
    csvContent += `Chave;Valor\n`;
    for (const [key, value] of Object.entries(parsedData.keyValuePairs)) {
      csvContent += `${sanitizeCell(key)};${sanitizeCell(value)}\n`;
    }
    csvContent += "\n";
  }

  // Tabelas — exporta todas diretamente como vieram do Textract, sem nenhuma filtragem semântica
  if (parsedData.tables && parsedData.tables.length > 0) {
    parsedData.tables.forEach((table, tableIndex) => {
      if (table.length === 0) return;

      if (parsedData.tables.length > 1) {
        csvContent += `--- Tabela ${tableIndex + 1} ---\n`;
      }

      table.forEach((row) => {
        csvContent += row.map(sanitizeCell).join(";") + "\n";
      });

      csvContent += "\n";
    });
  }

  // Fallback: texto corrido se não houver tabelas nem key-value pairs
  if (csvContent === "" && parsedData.text) {
    csvContent += "Texto Extraído\n";
    parsedData.text.split("\n").forEach(line => {
      if (line.trim()) {
        csvContent += `${sanitizeCell(line)}\n`;
      }
    });
  }

  return csvContent;
}