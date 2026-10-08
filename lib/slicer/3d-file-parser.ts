/**
 * 3D File Parser (Client-Side)
 * Extração de metadados de impressão (.3mf, .gcode, .stl) no navegador
 * sem bloquear a thread principal nem requerer upload para o servidor.
 */

import JSZip from "jszip";

export interface SlicedFilamentInfo {
  id: number;
  type: string;            // PLA, PETG, ABS, TPU, Resina
  colorHex: string;        // #RRGGBB
  colorName?: string;
  weightGrams: number;
  lengthMeters?: number;
}

export interface Parsed3DFile {
  success: boolean;
  format: "3mf" | "gcode" | "stl" | "unknown";
  slicer: "BambuStudio" | "OrcaSlicer" | "PrusaSlicer" | "Cura" | "Unknown";
  filename: string;
  totalTimeSeconds: number;
  totalWeightGrams: number;
  platesCount: number;
  filaments: SlicedFilamentInfo[];
  breakdown?: {
    wallsPct: number;
    infillPct: number;
    topBottomPct: number;
    brimSupportPct: number;
  };
  warning?: string;
}

/**
 * Lê os primeiros 64KB e os últimos 64KB de um arquivo de texto.
 */
async function readGcodeChunks(file: File): Promise<string> {
  const chunkSize = 65536; // 64KB
  const headBlob = file.slice(0, chunkSize);
  const headText = await headBlob.text();

  if (file.size <= chunkSize) {
    return headText;
  }

  const tailStart = Math.max(0, file.size - chunkSize);
  const tailBlob = file.slice(tailStart, file.size);
  const tailText = await tailBlob.text();

  return `${headText}\n...\n${tailText}`;
}

/**
 * Parser de arquivos .gcode (Cura, PrusaSlicer, BambuStudio, OrcaSlicer).
 */
function parseGcodeContent(content: string, filename: string): Parsed3DFile {
  let slicer: Parsed3DFile["slicer"] = "Unknown";
  let totalTimeSeconds = 0;
  let totalWeightGrams = 0;
  let filamentLengthMeters = 0;

  // 1. Identificar Slicer
  if (/Cura/i.test(content)) {
    slicer = "Cura";
  } else if (/BambuStudio/i.test(content)) {
    slicer = "BambuStudio";
  } else if (/OrcaSlicer/i.test(content)) {
    slicer = "OrcaSlicer";
  } else if (/PrusaSlicer/i.test(content) || /Slic3r/i.test(content)) {
    slicer = "PrusaSlicer";
  }

  // 2. Extrair Tempo
  // Padrão Cura: ;TIME:7200
  const curaTimeMatch = content.match(/;TIME:(\d+)/i);
  if (curaTimeMatch && curaTimeMatch[1]) {
    totalTimeSeconds = parseInt(curaTimeMatch[1], 10);
  } else {
    // Padrão Prusa/Bambu/Orca: ; estimated printing time (normal mode) = 3h 15m 30s
    // ou ; estimated printing time = 1d 2h 3m
    const estimatedTimeMatch = content.match(
      /;\s*estimated printing time.*?=\s*(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/i
    );
    if (estimatedTimeMatch) {
      const days = parseInt(estimatedTimeMatch[1] || "0", 10);
      const hours = parseInt(estimatedTimeMatch[2] || "0", 10);
      const minutes = parseInt(estimatedTimeMatch[3] || "0", 10);
      const seconds = parseInt(estimatedTimeMatch[4] || "0", 10);
      totalTimeSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
    }
  }

  // 3. Extrair Peso em Gramas
  // Padrão Cura: ;Filament weight = 45.5 ou ;Filament weight [g] = 45.5
  const curaWeightMatch = content.match(/;Filament weight(?:\s*\[g\])?\s*=\s*([\d.]+)/i);
  if (curaWeightMatch && curaWeightMatch[1]) {
    totalWeightGrams = parseFloat(curaWeightMatch[1]);
  } else {
    // Padrão Prusa/Bambu/Orca: ; filament used [g] = 120.45
    const prusaWeightMatch = content.match(/;\s*filament used\s*\[g\]\s*=\s*([\d.]+)/i);
    if (prusaWeightMatch && prusaWeightMatch[1]) {
      totalWeightGrams = parseFloat(prusaWeightMatch[1]);
    }
  }

  // Se peso não foi encontrado diretamente, verificar comprimento
  const lengthMatch = content.match(/;(?:\s*filament used\s*\[(?:mm|m)\]|Filament used:)\s*([\d.]+)(m|mm)?/i);
  if (lengthMatch && lengthMatch[1]) {
    const val = parseFloat(lengthMatch[1]);
    const unit = lengthMatch[2] || "mm";
    filamentLengthMeters = unit === "mm" ? val / 1000 : val;
    if (totalWeightGrams === 0 && filamentLengthMeters > 0) {
      // 1.75mm PLA tem ~3g por metro
      totalWeightGrams = Math.round(filamentLengthMeters * 2.98 * 100) / 100;
    }
  }

  const success = totalTimeSeconds > 0 || totalWeightGrams > 0;

  return {
    success,
    format: "gcode",
    slicer,
    filename,
    totalTimeSeconds,
    totalWeightGrams,
    platesCount: 1,
    filaments: [
      {
        id: 1,
        type: "PLA",
        colorHex: "#3B82F6",
        colorName: "Padrão GCode",
        weightGrams: totalWeightGrams,
        lengthMeters: filamentLengthMeters > 0 ? filamentLengthMeters : undefined,
      },
    ],
    breakdown: {
      wallsPct: 50,
      infillPct: 35,
      topBottomPct: 10,
      brimSupportPct: 5,
    },
    warning: !success ? "Não foram encontrados metadados de tempo ou peso neste GCode." : undefined,
  };
}

/**
 * Parser de arquivos .3mf (Bambu Studio, OrcaSlicer, PrusaSlicer).
 */
async function parse3mfFile(file: File): Promise<Parsed3DFile> {
  try {
    const zip = await JSZip.loadAsync(file);
    let slicer: Parsed3DFile["slicer"] = "BambuStudio";
    let totalTimeSeconds = 0;
    let totalWeightGrams = 0;
    let platesCount = 1;
    const filaments: SlicedFilamentInfo[] = [];

    // 1. Procurar Metadata/slice_info.config (Padrão Bambu Studio / OrcaSlicer)
    const sliceInfoFile = zip.file(/Metadata\/slice_info\.config/i)[0];
    if (sliceInfoFile) {
      const xmlText = await sliceInfoFile.async("text");

      // Detectar OrcaSlicer
      if (/OrcaSlicer/i.test(xmlText)) {
        slicer = "OrcaSlicer";
      }

      // Extrair tempo (prediction em segundos)
      const timeMatches = xmlText.match(/prediction\s*=\s*["']?(\d+)["']?/gi);
      if (timeMatches) {
        for (const tm of timeMatches) {
          const val = tm.match(/\d+/);
          if (val) totalTimeSeconds += parseInt(val[0], 10);
        }
      }

      // Contar placas (<plate ...>)
      const plateMatches = xmlText.match(/<plate\b/gi);
      if (plateMatches && plateMatches.length > 0) {
        platesCount = plateMatches.length;
      }

      // Extrair filamentos: <filament id="1" type="PLA" color="#FFFFFF" used_g="45.2" used_m="15.1" />
      const filamentRegex = /<filament\b([^>]+)\/?>/gi;
      let fMatch;
      let idx = 1;
      while ((fMatch = filamentRegex.exec(xmlText)) !== null) {
        const attrs = fMatch[1];
        const typeMatch = attrs.match(/type\s*=\s*["']([^"']+)["']/i);
        const colorMatch = attrs.match(/color\s*=\s*["']([^"']+)["']/i);
        const weightMatch = attrs.match(/used_g\s*=\s*["']([\d.]+)["']/i);
        const meterMatch = attrs.match(/used_m\s*=\s*["']([\d.]+)["']/i);

        const weight = weightMatch ? parseFloat(weightMatch[1]) : 0;
        const colorHex = colorMatch ? (colorMatch[1].startsWith("#") ? colorMatch[1] : `#${colorMatch[1]}`) : "#10B981";

        if (weight > 0) {
          totalWeightGrams += weight;
          filaments.push({
            id: idx++,
            type: typeMatch ? typeMatch[1] : "PLA",
            colorHex,
            colorName: colorHex,
            weightGrams: Math.round(weight * 100) / 100,
            lengthMeters: meterMatch ? parseFloat(meterMatch[1]) : undefined,
          });
        }
      }
    }

    // 2. Se não achou slice_info, tentar Metadata/Slic3r_PE.config (PrusaSlicer)
    if (filaments.length === 0) {
      const prusaConfig = zip.file(/Metadata\/Slic3r_PE\.config/i)[0];
      if (prusaConfig) {
        slicer = "PrusaSlicer";
        const text = await prusaConfig.async("text");
        const parsed = parseGcodeContent(text, file.name);
        totalTimeSeconds = parsed.totalTimeSeconds;
        totalWeightGrams = parsed.totalWeightGrams;
        filaments.push(...parsed.filaments);
      }
    }

    // Se achou peso mas nenhum filamento individual
    if (filaments.length === 0 && totalWeightGrams > 0) {
      filaments.push({
        id: 1,
        type: "PLA",
        colorHex: "#F59E0B",
        colorName: "Material Principal",
        weightGrams: totalWeightGrams,
      });
    }

    const success = totalTimeSeconds > 0 || totalWeightGrams > 0;

    return {
      success,
      format: "3mf",
      slicer,
      filename: file.name,
      totalTimeSeconds,
      totalWeightGrams: Math.round(totalWeightGrams * 100) / 100,
      platesCount,
      filaments: filaments.length > 0 ? filaments : [
        { id: 1, type: "PLA", colorHex: "#3B82F6", weightGrams: totalWeightGrams }
      ],
      breakdown: {
        wallsPct: 53,
        infillPct: 37,
        topBottomPct: 9,
        brimSupportPct: 1,
      },
      warning: !success ? "O arquivo .3mf não contém metadados de fatiamento válidos." : undefined,
    };
  } catch (err) {
    return {
      success: false,
      format: "3mf",
      slicer: "Unknown",
      filename: file.name,
      totalTimeSeconds: 0,
      totalWeightGrams: 0,
      platesCount: 1,
      filaments: [],
      warning: `Erro ao abrir arquivo .3mf: ${err instanceof Error ? err.message : "Arquivo corrompido"}`,
    };
  }
}

/**
 * Tratamento de arquivos .stl
 */
async function parseStlFile(file: File): Promise<Parsed3DFile> {
  let estimatedWeight = 50; // Fallback estimado

  try {
    // Leitura rápida do tamanho em bytes para estimar complexidade
    const sizeMb = file.size / (1024 * 1024);
    // Estimativa empírica aproximada baseada no tamanho da malha STL
    estimatedWeight = Math.min(1000, Math.max(15, Math.round(sizeMb * 25)));
  } catch {
    estimatedWeight = 50;
  }

  return {
    success: true,
    format: "stl",
    slicer: "Unknown",
    filename: file.name,
    totalTimeSeconds: Math.round(estimatedWeight * 120), // ~2 min por grama
    totalWeightGrams: estimatedWeight,
    platesCount: 1,
    filaments: [
      {
        id: 1,
        type: "PLA",
        colorHex: "#C89666",
        colorName: "Estimativa STL",
        weightGrams: estimatedWeight,
      },
    ],
    warning:
      "Arquivos STL são malhas geométricas brutas sem suporte, infill e velocidades definidos. Para cálculo 100% exato, exporte o .gcode ou .3mf no seu fatiador.",
  };
}

/**
 * Ponto de entrada unificado para leitura de arquivos 3D no cliente.
 */
export async function parse3DFile(file: File): Promise<Parsed3DFile> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".3mf")) {
    return parse3mfFile(file);
  }

  if (name.endsWith(".gcode") || name.endsWith(".gco")) {
    const content = await readGcodeChunks(file);
    return parseGcodeContent(content, file.name);
  }

  if (name.endsWith(".stl")) {
    return parseStlFile(file);
  }

  return {
    success: false,
    format: "unknown",
    slicer: "Unknown",
    filename: file.name,
    totalTimeSeconds: 0,
    totalWeightGrams: 0,
    platesCount: 1,
    filaments: [],
    warning: "Formato não suportado. Envie arquivos .gcode, .3mf ou .stl.",
  };
}
