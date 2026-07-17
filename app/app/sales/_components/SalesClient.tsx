"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingCart, Wallet, Receipt, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DataTable, { type Column } from "@/app/app/dashboard/_components/DataTable";
import { createSale, deleteSale } from "@/app/actions/sales/actions";
import {
  SALES_PLATFORMS,
  SALES_STATUSES,
  type SaleRow,
  type SalesKpis,
} from "@/lib/sales/config";

const brl = (cents: number): string =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dateBR = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  enviado: "Enviado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

interface Props {
  /** Fixa a plataforma (sub-aba). Undefined = visão geral (todas). */
  platform?: string;
  title: string;
  subtitle: string;
  initialSales: SaleRow[];
  byPlatform: { platform: string; totalCents: number; count: number }[];
  /** Slot opcional acima dos KPIs (ex.: status da integração Shopee). */
  banner?: React.ReactNode;
}

export default function SalesClient({
  platform,
  title,
  subtitle,
  initialSales,
  byPlatform,
  banner,
}: Props) {
  const [sales, setSales] = useState(initialSales);
  const [dialogOpen, setDialogOpen] = useState(false);

  // KPIs recalculados no cliente ao adicionar/remover (evita refetch).
  const kpis = useMemo<SalesKpis>(() => {
    const active = sales.filter((s) => s.status !== "cancelado");
    const total = active.reduce((s, r) => s + r.totalCents, 0);
    const commission = active.reduce((s, r) => s + r.commissionCents, 0);
    return {
      totalCents: total,
      netCents: total - commission,
      count: active.length,
      avgTicketCents: active.length ? Math.round(total / active.length) : 0,
    };
  }, [sales]);

  const columns: Column<SaleRow>[] = useMemo(
    () => [
      { key: "date", header: "Data", value: (r) => r.soldAt, cell: (r) => dateBR(r.soldAt) },
      ...(platform
        ? []
        : [{ key: "platform", header: "Canal", value: (r: SaleRow) => r.platform } as Column<SaleRow>]),
      { key: "customer", header: "Cliente", value: (r) => r.customerName ?? "—" },
      {
        key: "status",
        header: "Status",
        value: (r) => r.status,
        cell: (r) => (
          <Badge variant={r.status === "cancelado" ? "destructive" : "secondary"} className="font-normal">
            {STATUS_LABEL[r.status] ?? r.status}
          </Badge>
        ),
      },
      {
        key: "commission",
        header: "Comissão",
        value: (r) => r.commissionCents,
        align: "right",
        cell: (r) => <span className="text-muted-foreground">{brl(r.commissionCents)}</span>,
      },
      {
        key: "total",
        header: "Total",
        value: (r) => r.totalCents,
        align: "right",
        cell: (r) => <span className="font-mono font-medium">{brl(r.totalCents)}</span>,
      },
      {
        key: "acoes",
        header: "",
        value: () => "",
        noFilter: true,
        cell: (r) => (
          <button
            type="button"
            aria-label="Excluir venda"
            onClick={() => void handleDelete(r.id)}
            className="rounded p-1 text-muted-foreground hover:text-error"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ),
      },
    ],
    // handleDelete referencia estado a cada render; memoizar por platform basta
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platform],
  );

  async function handleDelete(id: string) {
    const snapshot = sales;
    setSales((prev) => prev.filter((s) => s.id !== id));
    const r = await deleteSale(id);
    if (!r.ok) {
      setSales(snapshot);
      toast.error(r.error);
    } else {
      toast.success("Venda removida.");
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <NewSaleDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          fixedPlatform={platform}
          onCreated={(s) => setSales((prev) => [s, ...prev])}
        />
      </header>

      {banner}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Faturamento" value={brl(kpis.totalCents)} icon={Wallet} hint="Fora cancelados" />
        <Kpi label="Líquido" value={brl(kpis.netCents)} icon={TrendingUp} hint="Menos comissões" />
        <Kpi label="Pedidos" value={String(kpis.count)} icon={ShoppingCart} hint="No período" />
        <Kpi label="Ticket médio" value={brl(kpis.avgTicketCents)} icon={Receipt} hint="Por pedido" />
      </div>

      {/* Breakdown por canal — só na visão geral */}
      {!platform && byPlatform.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold">Por canal</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {byPlatform.map((p) => (
              <div key={p.platform} className="rounded-xl border border-border p-3">
                <div className="text-xs font-medium text-muted-foreground">{p.platform}</div>
                <div className="mt-1 font-mono text-lg font-semibold">{brl(p.totalCents)}</div>
                <div className="text-[11px] text-muted-foreground">{p.count} pedidos</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Pedidos lançados</h2>
        <DataTable
          rows={sales}
          columns={columns}
          empty="Nenhuma venda lançada ainda. Clique em “Lançar venda”."
        />
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-start justify-between">
        <div className="text-sm font-medium">{label}</div>
        <span className="rounded-xl bg-accent-soft p-2 text-accent">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="font-mono text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function NewSaleDialog({
  open,
  onOpenChange,
  fixedPlatform,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fixedPlatform?: string;
  onCreated: (s: SaleRow) => void;
}) {
  const [platform, setPlatform] = useState(fixedPlatform ?? "Shopee");
  const [customer, setCustomer] = useState("");
  const [status, setStatus] = useState("pago");
  const [total, setTotal] = useState("");
  const [commission, setCommission] = useState("");
  const [soldAt, setSoldAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!total.trim()) {
      toast.error("Informe o valor total.");
      return;
    }
    setSaving(true);
    const r = await createSale({
      platform: fixedPlatform ?? platform,
      customerName: customer,
      status,
      total: Number(total.replace(",", ".")),
      commission: commission ? Number(commission.replace(",", ".")) : 0,
      soldAt,
      notes,
    });
    setSaving(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    onCreated(r.sale);
    toast.success("Venda lançada.");
    setCustomer("");
    setTotal("");
    setCommission("");
    setNotes("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" />
          Lançar venda
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançar venda{fixedPlatform ? ` · ${fixedPlatform}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!fixedPlatform && (
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALES_PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-total">Valor total (R$)</Label>
              <Input id="s-total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-comm">Comissão (R$)</Label>
              <Input id="s-comm" inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="0,00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-date">Data</Label>
              <Input id="s-date" type="date" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALES_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-cust">Cliente (opcional)</Label>
            <Input id="s-cust" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nome do comprador" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-notes">Observações (opcional)</Label>
            <Textarea id="s-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando…" : "Lançar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
