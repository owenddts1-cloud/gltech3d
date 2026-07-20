"use client";

/**
 * Sales shell (stage E1) — orchestrates the reference-CRM layout:
 * header + stats line, KPI cards with sparklines/deltas, costs strip,
 * pending alert, toolbar (period/search/facets/view/density) and the three
 * views (Tabela real · Kanban DnD real E2 · Timeline placeholder E3).
 *
 * All filtering happens client-side over `initialSales` (small volume).
 * Preferences (density + saved views) persist in localStorage.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteSale } from "@/app/actions/sales/actions";
import type { ContactOption } from "@/app/actions/contacts/actions";
import { type SaleProductOption, type SaleRow } from "@/lib/sales/config";
import { FULFILLMENT_LABEL, PAYMENT_LABEL } from "@/lib/sales/config";
import NewSaleDialog from "./NewSaleDialog";
import SalesHeader, { type HeaderStats } from "./SalesHeader";
import SalesKpis, { CostsStrip, type KpiDeltas } from "./SalesKpis";
import PendingAlert from "./PendingAlert";
import SalesToolbar from "./SalesToolbar";
import SalesTableView from "./SalesTableView";
import SalesKanbanView from "./SalesKanbanView";
import SalesTimelineView from "./SalesTimelineView";
import SaleDrawer from "./SaleDrawer";
import {
  DEFAULT_FILTERS,
  activeRows,
  applyFacets,
  applyFilters,
  brl,
  buildCsv,
  computeKpis,
  deltaPct,
  downloadCsv,
  inRange,
  pendingOlderThan,
  previousRange,
  resolveRange,
  sparkSeries,
  todayIso,
  type Density,
  type SalesFilters,
  type SavedView,
  type ViewMode,
} from "../_lib/view-model";

interface Props {
  /** Fixa a plataforma (sub-aba). Undefined = visão geral (todas). */
  platform?: string;
  title: string;
  subtitle: string;
  initialSales: SaleRow[];
  byPlatform: { platform: string; totalCents: number; count: number }[];
  /** Catálogo p/ vincular produto às vendas (custo/margem reais — E5). */
  productOptions?: SaleProductOption[];
  /** Contatos da org — combobox de cliente com busca + "Outro cliente". */
  contactOptions?: ContactOption[];
  /** Slot opcional acima dos KPIs (ex.: status da integração Shopee). */
  banner?: React.ReactNode;
}

/** Reads + validates a JSON preference; corrupted storage falls back safely. */
function readStoredJson<T>(key: string, guard: (v: unknown) => v is T): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch (error) {
    // Preferência corrompida não pode derrubar a página — segue com defaults.
    console.warn(`sales prefs: ignoring unreadable key "${key}"`, error);
    return null;
  }
}

function isSavedViewArray(v: unknown): v is SavedView[] {
  return (
    Array.isArray(v) &&
    v.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as SavedView).name === "string" &&
        typeof (item as SavedView).view === "string" &&
        typeof (item as SavedView).filters === "object",
    )
  );
}

export default function SalesClient({
  platform,
  title,
  subtitle,
  initialSales,
  byPlatform,
  productOptions = [],
  contactOptions = [],
  banner,
}: Props) {
  const [sales, setSales] = useState(initialSales);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filters, setFilters] = useState<SalesFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewMode>("tabela");
  const [density, setDensity] = useState<Density>("confortavel");
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [alertDismissed, setAlertDismissed] = useState(false);
  /** Sale open in the detail drawer (E3). Null = closed. */
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  // localStorage keys are namespaced per sub-tab (overview ≠ Shopee etc.).
  const storagePrefix = `gl3d.sales.${platform ?? "all"}`;

  // Preferências carregam num effect (só roda no cliente — evita mismatch SSR).
  useEffect(() => {
    const d = window.localStorage.getItem(`${storagePrefix}.density`);
    if (d === "compacto" || d === "confortavel") setDensity(d);
    const views = readStoredJson(`${storagePrefix}.views`, isSavedViewArray);
    if (views) setSavedViews(views);
  }, [storagePrefix]);

  const today = useMemo(() => todayIso(), []);

  // ─── Dados derivados (tudo client-side, volume pequeno) ────────────────────
  const filtered = useMemo(() => applyFilters(sales, filters, today), [sales, filters, today]);
  const range = useMemo(() => resolveRange(filters, today), [filters, today]);
  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const spark = useMemo(() => sparkSeries(filtered, range), [filtered, range]);

  // Deltas vs período anterior equivalente (mesmas facetas, janela deslocada).
  const deltas = useMemo<KpiDeltas>(() => {
    const prev = previousRange(range);
    if (!prev) return { net: null, total: null, count: null, avg: null };
    const prevRows = applyFacets(sales, filters).filter((r) => inRange(r.soldAt, prev));
    const p = computeKpis(prevRows);
    return {
      net: deltaPct(kpis.netCents, p.netCents),
      total: deltaPct(kpis.totalCents, p.totalCents),
      count: deltaPct(kpis.count, p.count),
      avg: deltaPct(kpis.avgTicketCents, p.avgTicketCents),
    };
  }, [sales, filters, range, kpis]);

  // Meta do mês: lucro líquido do mês-calendário atual, ignorando o filtro de data.
  const monthNetCents = useMemo(() => {
    const monthStart = `${today.slice(0, 7)}-01`;
    return activeRows(sales)
      .filter((r) => r.soldAt >= monthStart && r.soldAt <= today)
      .reduce((s, r) => s + r.totalCents - r.commissionCents, 0);
  }, [sales, today]);

  // Alerta de pendências: olha o conjunto inteiro, não o recorte filtrado.
  const pendingOld = useMemo(() => pendingOlderThan(sales, today), [sales, today]);
  const pendingOldSum = pendingOld.reduce((s, r) => s + r.totalCents, 0);

  const headerStats = useMemo<HeaderStats>(() => {
    return {
      count: kpis.count,
      totalCents: kpis.totalCents,
      avgTicketCents: kpis.avgTicketCents,
      marginPct: kpis.totalCents > 0 ? (kpis.netCents / kpis.totalCents) * 100 : null,
      pendingCount: filtered.filter((r) => r.paymentStatus === "pendente").length,
    };
  }, [kpis, filtered]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const patchFilters = useCallback((patch: Partial<SalesFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  /** Kanban/drawer optimistic patch + rollback: mutates one sale in the source-of-truth state. */
  const handleSalePatch = useCallback((id: string, patch: Partial<SaleRow>) => {
    setSales((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const handleOpenSale = useCallback((id: string) => setSelectedSaleId(id), []);
  const closeDrawer = useCallback(() => setSelectedSaleId(null), []);

  // The drawer reads the live row from `sales`, so optimistic patches made in
  // any view (kanban move, drawer actions) render everywhere at once.
  const selectedSale = useMemo(
    () => sales.find((s) => s.id === selectedSaleId) ?? null,
    [sales, selectedSaleId],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const snapshot = sales;
      setSales((prev) => prev.filter((s) => s.id !== id));
      void deleteSale(id).then((r) => {
        if (!r.ok) {
          setSales(snapshot);
          toast.error(r.error);
        } else {
          toast.success("Venda removida.");
        }
      });
    },
    [sales],
  );

  function changeDensity(d: Density) {
    setDensity(d);
    window.localStorage.setItem(`${storagePrefix}.density`, d);
  }

  function persistViews(next: SavedView[]) {
    setSavedViews(next);
    window.localStorage.setItem(`${storagePrefix}.views`, JSON.stringify(next));
  }

  function saveView(name: string) {
    const next = [
      ...savedViews.filter((v) => v.name !== name),
      { name, filters, view } satisfies SavedView,
    ];
    persistViews(next);
    toast.success(`Visão “${name}” salva.`);
  }

  function applyView(v: SavedView) {
    setFilters({ ...DEFAULT_FILTERS, ...v.filters });
    setView(v.view);
  }

  function deleteView(name: string) {
    persistViews(savedViews.filter((v) => v.name !== name));
  }

  function exportCsv() {
    if (filtered.length === 0) {
      toast.error("Nada para exportar com os filtros atuais.");
      return;
    }
    const csv = buildCsv(filtered, { fulfillment: FULFILLMENT_LABEL, payment: PAYMENT_LABEL });
    downloadCsv(csv, `vendas-gltech3d-${today}.csv`);
    toast.success(`${filtered.length} vendas exportadas.`);
  }

  function showPending() {
    // "Ver pendentes": abre o recorte completo com o filtro de pagamento pendente.
    setFilters((prev) => ({ ...prev, preset: "tudo", payments: ["pendente"] }));
    setView("tabela");
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-6">
      <SalesHeader
        title={title}
        subtitle={subtitle}
        stats={headerStats}
        savedViews={savedViews}
        onSaveView={saveView}
        onApplyView={applyView}
        onDeleteView={deleteView}
        onExport={exportCsv}
        newSaleSlot={
          <NewSaleDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            fixedPlatform={platform}
            productOptions={productOptions}
            contactOptions={contactOptions}
            onCreated={(s) => setSales((prev) => [s, ...prev])}
          />
        }
      />

      {banner}

      {!alertDismissed && (
        <PendingAlert
          count={pendingOld.length}
          sumCents={pendingOldSum}
          onShowPending={showPending}
          onDismiss={() => setAlertDismissed(true)}
        />
      )}

      <SalesKpis kpis={kpis} deltas={deltas} spark={spark} monthNetCents={monthNetCents} />

      <CostsStrip
        commissionCents={kpis.totalCents - kpis.netCents - kpis.costCents}
        productCostCents={kpis.costCents}
        totalCents={kpis.totalCents}
        netCents={kpis.netCents}
      />

      <SalesToolbar
        filters={filters}
        onFilters={patchFilters}
        view={view}
        onView={setView}
        density={density}
        onDensity={changeDensity}
        fixedPlatform={platform}
      />

      {view === "tabela" && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <SalesTableView
            rows={filtered}
            density={density}
            showPlatform={!platform}
            onDelete={handleDelete}
            onOpenSale={handleOpenSale}
          />
        </section>
      )}
      {view === "kanban" && (
        <SalesKanbanView rows={filtered} onPatch={handleSalePatch} onOpenSale={handleOpenSale} />
      )}
      {view === "timeline" && (
        <SalesTimelineView rows={filtered} onOpenSale={handleOpenSale} />
      )}

      <SaleDrawer
        sale={selectedSale}
        onClose={closeDrawer}
        onPatch={handleSalePatch}
        productOptions={productOptions}
        contactOptions={contactOptions}
      />

      {/* Breakdown por canal — só na visão geral (dados vêm do servidor). */}
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
    </div>
  );
}
