"use client";

import { useEffect, useRef } from "react";

/**
 * Barra flutuante da folha impressa. `data-no-print` a remove do papel — o CSS de
 * impressão do documento e o de defesa em `globals.css` escondem qualquer elemento
 * marcado assim.
 */
export function PrintBar({ number, auto }: { number: string; auto: boolean }) {
  const fired = useRef(false);

  useEffect(() => {
    // `?auto=1` vem de quem acabou de emitir: abre o diálogo de impressão sozinho.
    // O ref evita disparar de novo num re-render do StrictMode em dev.
    if (!auto || fired.current) return;
    fired.current = true;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [auto]);

  return (
    <div
      data-no-print
      className="fixed bottom-0 left-0 right-0 z-40 flex flex-wrap items-center justify-center gap-3 border-t border-border bg-surface/95 px-4 py-3 text-xs backdrop-blur"
    >
      <span className="font-semibold text-foreground">{number}</span>
      <span className="text-text-muted">
        No diálogo de impressão, escolha A4 e desmarque &ldquo;Cabeçalhos e rodapés&rdquo;.
      </span>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent/90"
      >
        Imprimir / Salvar PDF
      </button>
    </div>
  );
}
