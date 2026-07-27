import { Warning } from "@/lib/ui/icons";

/**
 * Faixa que marca uma tela como prévia não funcional.
 *
 * Existe porque os módulos de Automações e Criação de Conteúdo entraram no repo
 * como protótipo, com dados fixos apresentados como se fossem reais — inclusive
 * um cliente n8n que devolvia `success: true` quando a rede falhava. Enquanto o
 * backend não existir, a tela precisa dizer isso na cara, e não deixar o usuário
 * descobrir sozinho que o resultado era inventado.
 */
export function DemoBanner({ children }: { children?: React.ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-xl border border-warning bg-warning-bg px-4 py-3 text-warning-fg"
    >
      <Warning size={16} weight="bold" className="mt-0.5 shrink-0" />
      <div className="text-xs leading-relaxed">
        <strong className="font-semibold">Prévia da interface.</strong>{" "}
        {children ?? (
          <>
            Os dados nesta tela são de demonstração e as ações estão desativadas — este módulo
            ainda está em construção.
          </>
        )}
      </div>
    </div>
  );
}
