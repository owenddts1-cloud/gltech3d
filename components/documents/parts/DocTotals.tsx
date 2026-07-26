import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";
import { brlNumberFromCents } from "@/lib/format/money";
import { PAYMENT_METHOD_LABEL } from "@/lib/schemas/service-order-documents";
import { formatDateBr } from "@/lib/format/document";
import { Coins } from "@/lib/ui/icons";

export function DocTotals({ snapshot }: { snapshot: DocumentSnapshot }) {
  const { totals, docType, payment, terms, serviceOrder } = snapshot;

  const paymentLabel = payment.methodNote || PAYMENT_METHOD_LABEL[payment.method] || "Pix";
  const deliveryTerm = terms.deliveryEstimate || "60 dias";
  const completionDate = serviceOrder.slaDueAt ? formatDateBr(serviceOrder.slaDueAt) : "—";

  return (
    <div className="doc-summary-card-wrapper">
      <div className="doc-card-header">
        <div className="doc-card-icon-badge">
          <Coins size={16} weight="bold" />
        </div>
        <h3 className="doc-card-title">RESUMO FINANCEIRO E PRAZOS</h3>
      </div>

      <div className="doc-summary-box-pdf">
        <table className="doc-summary-table-pdf">
          <tbody>
            <tr>
              <td className="doc-summary-label-cell">PAGAMENTO</td>
              <td className="doc-summary-val-cell">{paymentLabel}</td>
            </tr>
            <tr>
              <td className="doc-summary-label-cell">DESCONTO</td>
              <td className="doc-summary-val-cell">
                {totals.discountCents > 0
                  ? `R$ ${brlNumberFromCents(totals.discountCents)}`
                  : "Valor com desconto"}
              </td>
            </tr>
            <tr className="doc-summary-final-row">
              <td className="doc-summary-label-cell font-black">VALOR FINAL</td>
              <td className="doc-summary-val-cell font-black text-amber-600">
                R$ {brlNumberFromCents(totals.totalCents)}
              </td>
            </tr>
            {docType !== "recibo" && (
              <>
                <tr>
                  <td className="doc-summary-label-cell">PRAZO DE ENTREGA</td>
                  <td className="doc-summary-val-cell">{deliveryTerm}</td>
                </tr>
                <tr>
                  <td className="doc-summary-label-cell">DATA FINAL CONCLUSÃO</td>
                  <td className="doc-summary-val-cell">{completionDate}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
