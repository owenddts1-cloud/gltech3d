import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get("id");
  const category = searchParams.get("category");

  const basePath = path.join(
    process.cwd(),
    "Imports_github",
    "awesome-n8n-templates-main",
    "awesome-n8n-templates-main"
  );

  if (!fs.existsSync(basePath)) {
    return NextResponse.json({ error: "Diretório de templates n8n não encontrado." }, { status: 404 });
  }

  // Se solicitou um ID específico, busca o arquivo JSON correspondente
  if (templateId) {
    try {
      const indexData = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "lib", "n8n", "templates-data.json"), "utf8")
      );
      const item = indexData.find((t: { id: string }) => t.id === templateId);
      if (item) {
        // Encontra o arquivo nas subpastas
        const foundFile = findJsonFile(basePath, item.filename);
        if (foundFile) {
          const jsonContent = JSON.parse(fs.readFileSync(foundFile, "utf8"));
          return NextResponse.json({ ...item, jsonContent });
        }
      }
    } catch {
      return NextResponse.json({ error: "Erro ao carregar o conteúdo do template JSON." }, { status: 500 });
    }
  }

  // Retorna lista com filtro por categoria
  try {
    const rawData = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "lib", "n8n", "templates-data.json"), "utf8")
    );
    let filtered = rawData;
    if (category && category !== "all") {
      filtered = rawData.filter((t: { category: string }) => t.category === category);
    }
    return NextResponse.json({ total: filtered.length, templates: filtered });
  } catch {
    return NextResponse.json({ error: "Erro ao ler a biblioteca de templates." }, { status: 500 });
  }
}

function findJsonFile(dir: string, filename: string): string | null {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !file.startsWith(".")) {
      const found = findJsonFile(fullPath, filename);
      if (found) return found;
    } else if (file === filename) {
      return fullPath;
    }
  }
  return null;
}
