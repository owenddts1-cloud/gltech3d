import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";
import { lineTotalCents } from "@/app/app/service-orders/_lib/document-draft";
import { brlNumberFromCents } from "@/lib/format/money";

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : qty.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function DocItemsTable({ snapshot }: { snapshot: DocumentSnapshot }) {
  const { items, options } = snapshot;
  const mode = options.photoDisplayMode ?? "table";
  const showPhotos =
    (mode === "table" || mode === "both") && options.showItemPhotos && items.some((i) => i.imageUrl);
  const showPrices = options.showUnitPrices;

  // Usa o subtotal do snapshot, que é o mesmo que o servidor recalcula na emissão
  // (`withDerivedFields`). Recalcular aqui por fora deixava o SUBTOTAL da tabela
  // divergir do VALOR FINAL do resumo — no mesmo papel.
  const subtotalCents = snapshot.totals.subtotalCents;

  return (
    <div className="doc-items-section-pdf">
      <table className="doc-items-pdf">
        <thead>
          <tr>
            <th className="doc-col-idx">Nº</th>
            {showPhotos ? <th className="doc-col-photo">Foto</th> : null}
            <th>ITEM</th>
            <th className="doc-col-qty">QTD</th>
            {showPrices ? <th className="doc-col-money">VALOR UNIT.</th> : null}
            <th className="doc-col-money">VALOR TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.name}-${index}`}>
              <td className="doc-col-idx">{index + 1}</td>
              {showPhotos ? (
                <td className="doc-col-photo">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="doc-item-photo" src={item.imageUrl} alt="" />
                  ) : null}
                </td>
              ) : null}
              <td>
                <div className="doc-item-name">{item.name}</div>
                {item.description ? <div className="doc-item-desc">{item.description}</div> : null}
              </td>
              <td className="doc-col-qty">{formatQty(item.qty)}</td>
              {showPrices ? (
                <td className="doc-col-money">R$ {brlNumberFromCents(item.unitPriceCents)}</td>
              ) : null}
              <td className="doc-col-money">R$ {brlNumberFromCents(lineTotalCents(item))}</td>
            </tr>
          ))}
          {/* Linha de Subtotal */}
          <tr className="doc-subtotal-row">
            <td colSpan={showPhotos ? 3 : 2} className="doc-subtotal-label font-bold">
              SUBTOTAL
            </td>
            <td className="doc-col-qty">—</td>
            {showPrices ? <td>—</td> : null}
            <td className="doc-col-money font-bold">R$ {brlNumberFromCents(subtotalCents)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
