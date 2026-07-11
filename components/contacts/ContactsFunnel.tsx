"use client";

import Link from "next/link";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Kanban } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";

/**
 * Aba "Funil" dos Contatos — reusa o board de pipelines existente.
 * O `KanbanBoard` faz o próprio fetch (useBoard), drag/move e realtime quando
 * recebe apenas `pipelineId`. Nenhuma lógica de negócio nova.
 */
export function ContactsFunnel({ pipelineId }: { pipelineId: string | null }) {
  if (!pipelineId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Kanban size={24} weight="duotone" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text">Nenhum pipeline configurado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crie um funil de vendas para visualizar os leads por estágio.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="rounded-lg">
          <Link href="/app/settings/tenant/pipelines">Configurar pipeline</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto">
      <KanbanBoard pipelineId={pipelineId} />
    </div>
  );
}
