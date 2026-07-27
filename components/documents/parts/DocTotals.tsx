import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";
import { brlNumberFromCents } from "@/lib/format/money";
import { PAYMENT_METHOD_LABEL } from "@/lib/schemas/service-order-documents";
import { formatDateBr } from "@/lib/format/document";
import { Coins } from "@/lib/ui/icons";

/**
 * Bloco de resumo financeiro com rótulos em cobre.
 *
 * O prazo de entrega vinha com `|| "60 dias"` — uma promessa contratual
 * inventada. A linha de desconto imprimia o texto `"Valor com desconto"` quando
 * não havia desconto, que não é dado nenhum. Ambos saíram: linha sem valor não
 * é impressa. VALOR FINAL é o único campo sempre presente, porque é o que
 * define o documento.
 */
export function DocTotals({ snapshot }: { snapshot: DocumentSnapshot }) {
  const { totals, docType, payment, terms, serviceOrder } = snapshot;

  const paymentLabel = payment.methodNote || PAYMENT_METHOD_LABEL[payment.method];
  const completionDate = formatDateBr(serviceOrder.slaDueAt);

  const rows: Array<{ label: string; value: string }> = [];
  if (paymentLabel) rows.push({ label: "PAGAMENTO", value: paymentLabel });
  if (totals.discountCents > 0) {
    rows.push({ label: "DESCONTO", value: `R$ ${brlNumberFromCents(totals.discountCents)}` });
  }
  if (totals.shippingCents > 0) {
    rows.push({ label: "FRETE", value: `R$ ${brlNumberFromCents(totals.shippingCents)}` });
  }

  const tailRows: Array<{ label: string; value: string }> = [];
  if (docType !== "recibo") {
    if (terms.deliveryEstimate) {
      tailRows.push({ label: "PRAZO DE ENTREGA", value: terms.deliveryEstimate });
    }
    if (completionDate) {
      tailRows.push({ label: "DATA FINAL CONCLUSÃO", value: completionDate });
    }
  }

  return (
    <div className="doc-summary-card-wrapper">
      <div className="doc-card-header">
        <div className="doc-card-icon-badge">
          <Coins size={16} weight="bold" />
        </div>
        <h3 className="doc-card-title">
          {docType === "recibo" ? "RESUMO DO PAGAMENTO" : "RESUMO FINANCEIRO E PRAZOS"}
        </h3>
      </div>

      <div className="doc-summary-box-pdf">
        <table className="doc-summary-table-pdf">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="doc-summary-label-cell">{r.label}</td>
                <td className="doc-summary-val-cell">{r.value}</td>
              </tr>
            ))}
            <tr className="doc-summary-final-row">
              <td className="doc-summary-label-cell font-black">
                {docType === "recibo" ? "VALOR QUITADO" : "VALOR FINAL"}
              </td>
              <td className="doc-summary-val-cell font-black">
                R$ {brlNumberFromCents(totals.totalCents)}
              </td>
            </tr>
            {tailRows.map((r) => (
              <tr key={r.label}>
                <td className="doc-summary-label-cell">{r.label}</td>
                <td className="doc-summary-val-cell">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
