import { PlugsConnected, Warning } from "@/lib/ui/icons";

/**
 * Card honesto do status da integração automática com a Shopee. Enquanto as
 * credenciais não são preenchidas, deixa claro que o modo é manual e o que
 * falta — sem prometer botão que não funciona.
 */
export function ShopeeStatusCard({ configured }: { configured: boolean }) {
  if (configured) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-success bg-success-bg px-4 py-3 text-sm text-success-fg">
        <PlugsConnected size={18} weight="duotone" aria-hidden />
        Integração Shopee configurada. Os pedidos podem ser sincronizados automaticamente.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4">
      <div className="flex items-start gap-2">
        <Warning size={18} weight="duotone" className="mt-0.5 shrink-0 text-warning-fg" aria-hidden />
        <div className="text-sm">
          <p className="font-medium">Integração automática ainda não configurada</p>
          <p className="mt-1 text-muted-foreground">
            Por enquanto, lance os pedidos da Shopee manualmente aqui. Para sincronizar
            automaticamente, crie um app em{" "}
            <a
              href="https://open.shopee.com/"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-2"
            >
              open.shopee.com
            </a>{" "}
            e defina as variáveis <code className="font-mono text-xs">SHOPEE_PARTNER_ID</code> e{" "}
            <code className="font-mono text-xs">SHOPEE_PARTNER_KEY</code> no ambiente.
          </p>
        </div>
      </div>
    </div>
  );
}
