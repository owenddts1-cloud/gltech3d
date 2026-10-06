import { Info } from "@/lib/ui/icons";

/**
 * Honest status card for the Shopee tab.
 *
 * There is NO Shopee integration code yet (no OAuth, no order webhook, no sync
 * job). Having `SHOPEE_PARTNER_ID` / `SHOPEE_PARTNER_KEY` set only means the
 * credentials were provided, so the card must never promise automatic sync —
 * sales are registered manually in both states. It also never asks the customer
 * to edit environment variables: that is an operator task, not theirs.
 */
export function ShopeeStatusCard({ configured }: { configured: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4">
      <div className="flex items-start gap-2">
        <Info size={18} weight="duotone" className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="text-sm">
          <p className="font-medium">As vendas da Shopee são registradas manualmente</p>
          <p className="mt-1 text-muted-foreground">
            Lance aqui cada pedido da sua loja na Shopee. A integração automática (importar
            pedidos sem digitar) está planejada e ainda não está disponível.
            {configured
              ? " As credenciais da Shopee já foram informadas e serão usadas quando a integração for liberada."
              : null}
          </p>
        </div>
      </div>
    </div>
  );
}
