'use client';

import { Check, CloudUpload, TriangleAlert, Dot } from 'lucide-react';
import type { SaveStatus } from '@/hooks/useAutosave';

/**
 * Feedback do auto-save. Sem isto o salvamento automático vira ato de fé —
 * o usuário não sabe se pode fechar a aba.
 */
export default function SaveIndicator({
  status,
  error,
  lastSavedAt,
}: {
  status: SaveStatus;
  error: string | null;
  lastSavedAt: Date | null;
}) {
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-error">
        <TriangleAlert className="h-3.5 w-3.5" />
        {error ?? 'Falha ao salvar'} — tentando de novo
      </span>
    );
  }
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
        Salvando…
      </span>
    );
  }
  if (status === 'dirty') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Dot className="h-3.5 w-3.5" />
        Alterações não salvas
      </span>
    );
  }
  if (status === 'saved' || lastSavedAt) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-success" />
        Salvo
        {lastSavedAt &&
          ` às ${lastSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
      </span>
    );
  }
  return null;
}
