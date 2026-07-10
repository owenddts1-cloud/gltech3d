"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, FileText, ChartBar, Printer } from "@/lib/ui/icons";

/**
 * Barra de ações premium reusada no topo dos módulos (Novo / Importar /
 * Exportar / Imprimir). No milestone 1 são visuais: informam via toast que a
 * ação entra quando o módulo for ativado. Cada módulo troca `primaryLabel`.
 */
export function ModuleToolbar({
  primaryLabel = "Novo",
  moduleName,
}: {
  primaryLabel?: string;
  moduleName: string;
}) {
  const soon = (what: string) =>
    toast.message(`${what} — em breve`, {
      description: `Disponível quando o módulo "${moduleName}" for ativado.`,
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="sm" onClick={() => soon("Importar planilha")}>
        <FileText aria-hidden />
        Importar
      </Button>
      <Button variant="ghost" size="sm" onClick={() => soon("Exportar")}>
        <ChartBar aria-hidden />
        Exportar
      </Button>
      <Button variant="ghost" size="sm" onClick={() => soon("Imprimir relatório")}>
        <Printer aria-hidden />
        Imprimir
      </Button>
      <Button variant="primary" size="sm" onClick={() => soon(primaryLabel)}>
        <Plus aria-hidden />
        {primaryLabel}
      </Button>
    </div>
  );
}
