"use client";

/**
 * Table view — reuses the shared DataTable (dashboard). Columns follow the
 * reference CRM: # · Data · Cliente · Canal · Status (produção) · Pagamento ·
 * Total, plus the delete action inherited from the old screen.
 */

import { useMemo } from "react";
import { PencilSimple, Trash } from "@/lib/ui/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import DataTable, { type Column } from "@/app/app/dashboard/_components/DataTable";
import {
  FULFILLMENT_LABEL,
  PAYMENT_LABEL,
  type SaleFulfillment,
  type SalePayment,
  type SaleRow,
} from "@/lib/sales/config";
import { brl, dateBR, orderCode, type Density } from "../_lib/view-model";

const FULFILLMENT_VARIANT: Record<SaleFulfillment, "neutral" | "warning" | "default" | "info" | "success" | "error"> = {
  confirmada: "neutral",
  produzindo: "warning",
  pronta: "default",
  enviada: "info",
  entregue: "success",
  cancelada: "error",
};

const PAYMENT_VARIANT: Record<SalePayment, "warning" | "success" | "error"> = {
  pendente: "warning",
  pago: "success",
  estornado: "error",
};

interface Props {
  rows: SaleRow[];
  density: Density;
  /** Overview shows the channel column; sub-tab pages hide it. */
  showPlatform: boolean;
  onDelete: (id: string) => void;
  /** Opens the sale detail drawer (E3) — wired to the # and Cliente cells. */
  onOpenSale: (id: string) => void;
}

export default function SalesTableView({
  rows,
  density,
  showPlatform,
  onDelete,
  onOpenSale,
}: Props) {
  const columns = useMemo<Column<SaleRow>[]>(
    () => [
      {
        key: "code",
        header: "#",
        value: (r) => orderCode(r),
        cell: (r) => (
          <button
            type="button"
            onClick={() => onOpenSale(r.id)}
            aria-label={`Abrir venda ${orderCode(r)}`}
            className="font-mono text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-accent hover:underline"
          >
            #{orderCode(r)}
          </button>
        ),
      },
      { key: "date", header: "Data", value: (r) => r.soldAt, cell: (r) => dateBR(r.soldAt) },
      {
        key: "customer",
        header: "Cliente",
        value: (r) => r.customerName ?? "—",
        cell: (r) => (
          <button
            type="button"
            onClick={() => onOpenSale(r.id)}
            className="text-left transition-colors hover:text-accent"
          >
            {r.customerName ?? "—"}
          </button>
        ),
      },
      ...(showPlatform
        ? [
            {
              key: "platform",
              header: "Canal",
              value: (r: SaleRow) => r.platform,
              cell: (r: SaleRow) => (
                <Badge variant="neutral" className="font-normal">
                  {r.platform}
                </Badge>
              ),
            } as Column<SaleRow>,
          ]
        : []),
      {
        key: "fulfillment",
        header: "Status",
        value: (r) => r.fulfillmentStatus,
        cell: (r) => (
          <Badge variant={FULFILLMENT_VARIANT[r.fulfillmentStatus]} className="font-normal">
            {FULFILLMENT_LABEL[r.fulfillmentStatus]}
          </Badge>
        ),
      },
      {
        key: "payment",
        header: "Pagamento",
        value: (r) => r.paymentStatus,
        cell: (r) => (
          <Badge variant={PAYMENT_VARIANT[r.paymentStatus]} className="font-normal">
            {PAYMENT_LABEL[r.paymentStatus]}
          </Badge>
        ),
      },
      {
        key: "total",
        header: "Total",
        value: (r) => r.totalCents,
        align: "right",
        cell: (r) => {
          // E5: custo/margem reais quando a venda tem produto vinculado.
          if (r.costCents == null) {
            return <span className="font-mono font-medium">{brl(r.totalCents)}</span>;
          }
          const profit = r.totalCents - r.commissionCents - r.costCents;
          const pct = r.totalCents > 0 ? Math.round((profit / r.totalCents) * 100) : 0;
          return (
            <span className="inline-flex flex-col items-end leading-tight">
              <span className="font-mono font-medium">{brl(r.totalCents)}</span>
              <span className="text-[10px] text-muted-foreground">
                custo {brl(r.costCents)} ·{" "}
                <span className={profit >= 0 ? "text-emerald-500" : "text-error-fg"}>
                  {profit >= 0 ? "+" : ""}{brl(profit)} ({pct}%)
                </span>
              </span>
            </span>
          );
        },
      },
      {
        key: "acoes",
        header: "",
        value: () => "",
        noFilter: true,
        cell: (r) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              aria-label="Editar venda"
              onClick={() => onOpenSale(r.id)}
              className="rounded p-1 text-muted-foreground hover:text-accent"
            >
              <PencilSimple className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Excluir venda"
              onClick={() => onDelete(r.id)}
              className="rounded p-1 text-muted-foreground hover:text-error"
            >
              <Trash className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [showPlatform, onDelete, onOpenSale],
  );

  return (
    <div
      // DataTable is shared with O.S./dashboard, so the density preference is
      // applied from outside (padding override) instead of forking the table.
      className={cn(density === "compacto" && "[&_tbody_td]:!py-1 [&_thead_th]:!py-1.5")}
    >
      <DataTable
        rows={rows}
        columns={columns}
        empty="Nenhuma venda lançada ainda. Clique em “Nova venda”."
      />
    </div>
  );
}
