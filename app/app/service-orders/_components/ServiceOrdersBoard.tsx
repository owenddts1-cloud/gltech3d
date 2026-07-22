"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ClipboardText,
  Plus,
  Trash,
  Clock,
  Tag,
  Printer,
  Sparkle,
  Warning,
  MagnifyingGlass,
  Cube,
  PencilSimple,
} from "@/lib/ui/icons";
import {
  createServiceOrder, updateServiceOrderStatus, updateServiceOrder, deleteServiceOrder,
  type ServiceOrderView,
} from "@/app/actions/service-orders/actions";
import { quickCreateContact } from "@/app/actions/contacts/actions";
import { quickCreateSaleChannel, type SaleChannelOption } from "@/app/actions/sale-channels/actions";
import { quickCreateMaterial, type MaterialOption } from "@/app/actions/materials/actions";
import { SO_STATUSES, type SoStatus, type SoPriority } from "@/lib/schemas/service-orders";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { paginate, OS_PAGE_SIZE, resolveDropPosition } from "@/app/app/service-orders/_lib/board";

type ContactLite = { id: string; name: string | null };

/** Opções do combobox de cliente ("Sem cliente" + contatos ordenados). */
function contactOptions(contacts: ContactLite[]): ComboboxOption[] {
  return [
    { value: "", label: "— Sem cliente —" },
    ...contacts
      .map((c) => ({ value: c.id, label: c.name || "(sem nome)" }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
  ];
}

/** allowCreate do combobox de cliente: cria contato com cadastro PENDENTE. */
function clientAllowCreate(onCreated: (c: ContactLite) => void) {
  return {
    label: (q: string) => `Adicionar "${q}" como novo cliente`,
    onCreate: async (name: string): Promise<ComboboxOption | null> => {
      const res = await quickCreateContact({ name });
      if (!res.ok) {
        toast.error(res.error);
        return null;
      }
      if (!res.existed) {
        toast.success("Cliente criado com cadastro pendente — complete depois em Contatos.");
        onCreated({ id: res.contact.id, name: res.contact.name });
      }
      return { value: res.contact.id, label: res.contact.name };
    },
  };
}

/** Opções do combobox de canal ("Sem canal" + canais ordenados). */
function channelOptions(channels: SaleChannelOption[]): ComboboxOption[] {
  return [
    { value: "", label: "— Sem canal —" },
    ...channels
      .map((c) => ({ value: c.id, label: c.name }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
  ];
}

/** allowCreate do combobox de canal: cadastra um canal de venda novo pra org. */
function channelAllowCreate(onCreated: (c: SaleChannelOption) => void) {
  return {
    label: (q: string) => `Adicionar "${q}" como novo canal`,
    onCreate: async (name: string): Promise<ComboboxOption | null> => {
      const res = await quickCreateSaleChannel({ name });
      if (!res.ok) {
        toast.error(res.error);
        return null;
      }
      if (!res.existed) {
        toast.success("Canal de venda criado.");
        onCreated(res.channel);
      }
      return { value: res.channel.id, label: res.channel.name };
    },
  };
}

/** allowCreate do combobox de material: o valor gravado é o NOME (texto livre). */
function materialAllowCreate(onCreated: (m: MaterialOption) => void) {
  return {
    label: (q: string) => `Adicionar "${q}" como novo material`,
    onCreate: async (name: string): Promise<ComboboxOption | null> => {
      const res = await quickCreateMaterial({ name });
      if (!res.ok) {
        toast.error(res.error);
        return null;
      }
      if (!res.existed) {
        toast.success("Material adicionado às sugestões.");
        onCreated(res.material);
      }
      return { value: res.material.name, label: res.material.name };
    },
  };
}

type OrderBy = "posicao" | "valor" | "sla" | "recente";

const COLUMNS: { id: SoStatus; label: string; accent: string; bgClass: string; borderClass: string; dotClass: string }[] = [
  { id: "orcamento", label: "Orçamento", accent: "#EAB308", bgClass: "bg-amber-500/[0.02] dark:bg-amber-500/[0.01]", borderClass: "border-amber-500/10 hover:border-amber-500/20", dotClass: "bg-amber-500" },
  { id: "aprovado", label: "Aprovado / Fila", accent: "#06B6D4", bgClass: "bg-cyan-500/[0.02] dark:bg-cyan-500/[0.01]", borderClass: "border-cyan-500/10 hover:border-cyan-500/20", dotClass: "bg-cyan-500" },
  { id: "em_producao", label: "Em Produção", accent: "#F97316", bgClass: "bg-orange-500/[0.02] dark:bg-orange-500/[0.01]", borderClass: "border-orange-500/10 hover:border-orange-500/20", dotClass: "bg-orange-500" },
  { id: "pronto_entrega", label: "Pronto p/ Entrega", accent: "#3B82F6", bgClass: "bg-blue-500/[0.02] dark:bg-blue-500/[0.01]", borderClass: "border-blue-500/10 hover:border-blue-500/20", dotClass: "bg-blue-500" },
  { id: "concluido", label: "Concluído", accent: "#10B981", bgClass: "bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01]", borderClass: "border-emerald-500/10 hover:border-emerald-500/20", dotClass: "bg-emerald-500" },
];

const STATUS_LABEL = Object.fromEntries(COLUMNS.map((c) => [c.id, c.label])) as Record<SoStatus, string>;

const PRIORITY_META: Record<SoPriority, { label: string; cls: string }> = {
  alta: { label: "Alta", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
  media: { label: "Média", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  baixa: { label: "Baixa", cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20" },
};

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function slaInfo(iso: string | null, status: SoStatus): { label: string; tone: string } | null {
  if (!iso || status === "concluido") return null;
  const diffDays = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (diffDays < 0) return { label: `Atrasada ${-diffDays}d`, tone: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border-rose-500/20" };
  if (diffDays <= 3) return { label: `Vence em ${diffDays}d`, tone: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20" };
  return { label: `Prazo: ${diffDays}d`, tone: "bg-muted text-muted-foreground border-border/40" };
}

interface Props {
  initialOrders: ServiceOrderView[];
  contacts: Array<{ id: string; name: string | null }>;
  saleChannels: SaleChannelOption[];
  materials: MaterialOption[];
  /** Abre o detalhe desta O.S. ao montar (deep-link ?os=<id> vindo do Dashboard). */
  openOsId?: string;
}

export function ServiceOrdersBoard({ initialOrders, contacts, saleChannels, materials, openOsId }: Props) {
  const [orders, setOrders] = useState<ServiceOrderView[]>(initialOrders);
  // Lista viva de contatos: o "Outro cliente" (allowCreate) acrescenta aqui.
  const [contactList, setContactList] = useState<ContactLite[]>(contacts);
  // Idem para canal de venda e material — o allowCreate dos Comboboxes acrescenta aqui.
  const [channelList, setChannelList] = useState<SaleChannelOption[]>(saleChannels);
  const [materialList, setMaterialList] = useState<MaterialOption[]>(materials);
  const [, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Filtros
  const [priorityFilter, setPriorityFilter] = useState<"todas" | SoPriority>("todas");
  const [clientFilter, setClientFilter] = useState<string>("todos");
  const [riskOnly, setRiskOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minValue, setMinValue] = useState("");
  const [orderBy, setOrderBy] = useState<OrderBy>("posicao");
  // Paginação por coluna (5 O.S. visíveis por vez, reseta quando um filtro muda).
  const [pages, setPages] = useState<Record<SoStatus, number>>(
    () => Object.fromEntries(SO_STATUSES.map((s) => [s, 1])) as Record<SoStatus, number>,
  );
  // Detalhe/edição de uma O.S.
  const [detailOrder, setDetailOrder] = useState<ServiceOrderView | null>(null);
  // Prefill vindo do simulador de Projetos ("Copiar e Gerar OS"). Antes o
  // ProjectsClient gravava esta chave e nada a lia — o dado era descartado.
  const [prefill, setPrefill] = useState<{ title?: string; notes?: string; total?: number } | null>(
    null,
  );

  useEffect(() => {
    const raw = localStorage.getItem("gltech_prefill_os");
    if (!raw) return;
    localStorage.removeItem("gltech_prefill_os"); // consome uma vez só
    try {
      const parsed = JSON.parse(raw) as { title?: string; notes?: string; total?: number };
      setPrefill(parsed);
      setDialogOpen(true);
    } catch {
      // payload corrompido: ignora em silêncio, não trava a tela
    }
  }, []);

  // Abre o detalhe quando chega com ?os=<id> (deep-link do Dashboard).
  useEffect(() => {
    if (!openOsId) return;
    const o = orders.find((x) => x.id === openOsId);
    if (o) setDetailOrder(o);
    // roda só uma vez por id vindo do servidor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOsId]);

  // Qualquer filtro mudando invalida a página atual de cada coluna.
  useEffect(() => {
    setPages(Object.fromEntries(SO_STATUSES.map((s) => [s, 1])) as Record<SoStatus, number>);
  }, [searchTerm, priorityFilter, clientFilter, riskOnly, dateFrom, dateTo, minValue, orderBy]);

  // Lista de clientes presentes nas O.S. (para o filtro).
  const clientOptions = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) if (o.contactName) set.add(o.contactName);
    return Array.from(set).sort();
  }, [orders]);

  // Filtros: busca (título/cliente) + prioridade + cliente + SLA em risco +
  // período (createdAt) + valor mínimo.
  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const minCents = minValue.trim() ? Math.round(Number(minValue.replace(",", ".")) * 100) : null;
    return orders.filter((o) => {
      if (term && !(o.title.toLowerCase().includes(term) || (o.contactName?.toLowerCase().includes(term)))) return false;
      if (priorityFilter !== "todas" && o.priority !== priorityFilter) return false;
      if (clientFilter !== "todos" && o.contactName !== clientFilter) return false;
      if (dateFrom && o.createdAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && o.createdAt.slice(0, 10) > dateTo) return false;
      if (minCents !== null && !Number.isNaN(minCents) && o.totalCents < minCents) return false;
      if (riskOnly) {
        const info = slaInfo(o.slaDueAt, o.status);
        if (!(info?.tone.includes("rose") || info?.tone.includes("amber"))) return false;
      }
      return true;
    });
  }, [orders, searchTerm, priorityFilter, clientFilter, riskOnly, dateFrom, dateTo, minValue]);

  // Group by status, ordenando dentro da coluna conforme o "Ordenar por".
  const byStatus = useMemo(() => {
    const map = Object.fromEntries(SO_STATUSES.map((s) => [s, [] as ServiceOrderView[]])) as Record<SoStatus, ServiceOrderView[]>;
    for (const o of filteredOrders) {
      map[o.status].push(o);
    }
    const cmp: Record<OrderBy, (a: ServiceOrderView, b: ServiceOrderView) => number> = {
      posicao: (a, b) => a.position - b.position,
      valor: (a, b) => b.totalCents - a.totalCents,
      sla: (a, b) => {
        const da = a.slaDueAt ? new Date(a.slaDueAt).getTime() : Infinity;
        const db = b.slaDueAt ? new Date(b.slaDueAt).getTime() : Infinity;
        return da - db;
      },
      recente: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    };
    for (const k of Object.keys(map) as SoStatus[]) {
      map[k].sort(cmp[orderBy]);
    }
    return map;
  }, [filteredOrders, orderBy]);

  // Calculate sum totals per column
  const columnTotals = useMemo(() => {
    const totals = Object.fromEntries(SO_STATUSES.map((s) => [s, 0])) as Record<SoStatus, number>;
    for (const o of orders) {
      totals[o.status] += o.totalCents;
    }
    return totals;
  }, [orders]);

  // Pipeline metrics
  const metrics = useMemo(() => {
    const active = orders.filter((o) => o.status !== "concluido");
    const totalPipelineVal = active.reduce((s, o) => s + o.totalCents, 0);
    const completedVal = orders.filter((o) => o.status === "concluido").reduce((s, o) => s + o.totalCents, 0);
    const activeProduction = orders.filter((o) => o.status === "em_producao" || o.status === "aprovado").length;
    
    const slaRisk = orders.filter((o) => {
      const info = slaInfo(o.slaDueAt, o.status);
      return info?.tone.includes("rose") || info?.tone.includes("amber");
    }).length;

    return { totalPipelineVal, completedVal, activeProduction, slaRisk };
  }, [orders]);

  function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId as SoStatus;
    // O índice do DnD é relativo à página visível da coluna — converte pro
    // índice real entre todas as O.S. da coluna antes de persistir.
    const realPosition = resolveDropPosition(pages[newStatus] ?? 1, OS_PAGE_SIZE, destination.index);
    setOrders((prev) =>
      prev.map((o) => (o.id === draggableId ? { ...o, status: newStatus, position: realPosition } : o)),
    );
    startTransition(async () => {
      const res = await updateServiceOrderStatus({ id: draggableId, status: newStatus, position: realPosition });
      if (!res.ok) toast.error("Não foi possível mover a OS");
    });
  }

  function onDelete(id: string) {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    startTransition(async () => {
      const res = await deleteServiceOrder(id);
      if (!res.ok) toast.error("Não foi possível excluir");
      else toast.success("OS excluída");
    });
  }

  return (
    <div className="space-y-6 p-6 mx-auto max-w-7xl animate-in fade-in duration-200">
      {/* ─── Premium Header ─── */}
      <header className="relative overflow-hidden rounded-xl border border-border bg-surface p-6">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-24" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent border border-accent/20 shadow-sm animate-pulse-subtle">
              <ClipboardText size={26} weight="duotone" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Ordens de Serviço</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Monitore a esteira de fabricação 3D, controle orçamentos e acompanhe prazos de entrega (SLA).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar OS ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 w-64 rounded-lg text-xs"
              />
            </div>
            <NewOsDialog
              open={dialogOpen}
              onOpenChange={(v) => {
                setDialogOpen(v);
                if (!v) setPrefill(null); // fechou: não reaproveita o prefill
              }}
              contacts={contactList}
              onContactCreated={(c) => setContactList((prev) => [...prev, c])}
              channels={channelList}
              onChannelCreated={(c) => setChannelList((prev) => [...prev, c])}
              materials={materialList}
              onMaterialCreated={(m) => setMaterialList((prev) => [...prev, m])}
              prefill={prefill}
              onCreated={(o) => setOrders((prev) => [o, ...prev])}
            />
          </div>
        </div>
      </header>

      {/* ─── Deals-Style KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Valor no Pipeline</span>
            <Tag size={14} className="text-cyan-500" />
          </div>
          <span className="mt-2 block text-2xl font-extrabold text-foreground tabular-nums">
            {brl(metrics.totalPipelineVal)}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">soma de todas as OS em aberto</span>
        </Card>

        <Card className="p-4 rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Faturamento Concluído</span>
            <Sparkle size={14} className="text-emerald-500" />
          </div>
          <span className="mt-2 block text-2xl font-extrabold text-foreground tabular-nums">
            {brl(metrics.completedVal)}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">pedidos entregues com sucesso</span>
        </Card>

        <Card className="p-4 rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Em Produção</span>
            <Printer size={14} className="text-orange-500" />
          </div>
          <span className="mt-2 block text-2xl font-extrabold text-foreground tabular-nums">
            {metrics.activeProduction}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">impressoras em operação ativa</span>
        </Card>

        <Card className="p-4 rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">SLA em Risco</span>
            <Warning size={14} className={metrics.slaRisk > 0 ? "text-rose-500" : ""} />
          </div>
          <span className="mt-2 block text-2xl font-extrabold text-foreground tabular-nums">
            {metrics.slaRisk}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">prazos expirados ou &lt; 3 dias</span>
        </Card>
      </div>

      {/* ─── Filtros ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Filtros:</span>
        <Combobox
          className="h-8 w-40 rounded-lg text-xs"
          value={priorityFilter}
          onChange={(v) => setPriorityFilter(v as "todas" | SoPriority)}
          options={[
            { value: "todas", label: "Toda prioridade" },
            { value: "alta", label: "Alta" },
            { value: "media", label: "Média" },
            { value: "baixa", label: "Baixa" },
          ]}
          searchPlaceholder="Buscar prioridade…"
        />
        <Combobox
          className="h-8 w-44 rounded-lg text-xs"
          value={clientFilter}
          onChange={(v) => setClientFilter(v)}
          options={[
            { value: "todos", label: "Todos os clientes" },
            ...clientOptions.map((c) => ({ value: c, label: c })),
          ]}
          searchPlaceholder="Buscar cliente…"
        />
        <label className="flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2 text-xs text-muted-foreground">
          De
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Criadas a partir de" className="bg-transparent text-xs text-text outline-none" />
        </label>
        <label className="flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2 text-xs text-muted-foreground">
          Até
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Criadas até" className="bg-transparent text-xs text-text outline-none" />
        </label>
        <label className="flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2 text-xs text-muted-foreground">
          ≥ R$
          <input inputMode="decimal" value={minValue} onChange={(e) => setMinValue(e.target.value)} placeholder="0" aria-label="Valor mínimo" className="w-14 bg-transparent text-xs text-text outline-none" />
        </label>
        <Combobox
          className="h-8 w-40 rounded-lg text-xs"
          value={orderBy}
          onChange={(v) => setOrderBy(v as OrderBy)}
          options={[
            { value: "posicao", label: "Ordem manual" },
            { value: "valor", label: "Maior valor" },
            { value: "sla", label: "Prazo (SLA)" },
            { value: "recente", label: "Mais recente" },
          ]}
          searchPlaceholder="Ordenar por…"
        />
        <button
          type="button"
          onClick={() => setRiskOnly((v) => !v)}
          aria-pressed={riskOnly}
          className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${riskOnly ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400" : "border-border bg-surface text-muted-foreground hover:text-foreground"}`}
        >
          <Warning size={13} /> Só em risco
        </button>
        {(priorityFilter !== "todas" || clientFilter !== "todos" || riskOnly || searchTerm || dateFrom || dateTo || minValue || orderBy !== "posicao") && (
          <button
            type="button"
            onClick={() => {
              setPriorityFilter("todas"); setClientFilter("todos"); setRiskOnly(false); setSearchTerm("");
              setDateFrom(""); setDateTo(""); setMinValue(""); setOrderBy("posicao");
            }}
            className="h-8 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Limpar
          </button>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">{filteredOrders.length} O.S.</span>
      </div>

      {/* ─── Board ─── */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex items-start gap-4 overflow-x-auto pb-2">
          {COLUMNS.map((col) => {
            const { items: pageItems, totalPages } = paginate(byStatus[col.id], pages[col.id] ?? 1, OS_PAGE_SIZE);
            return (
            <div key={col.id} className={`flex w-[280px] shrink-0 flex-col rounded-xl border border-border/80 ${col.bgClass} min-h-[80px]`}>
              {/* Column Header */}
              <div className="flex items-center justify-between px-3.5 py-3 border-b border-border/40 bg-surface/40 backdrop-blur-xs rounded-t-xl">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${col.dotClass}`} />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">{col.label}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                  <span>{byStatus[col.id].length}</span>
                  <span className="text-muted-foreground/30">|</span>
                  <span className="font-mono">{brl(columnTotals[col.id])}</span>
                </div>
              </div>

              {/* Column Body Droppable */}
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex flex-1 flex-col gap-3 p-3 transition-colors duration-200 ${
                      snapshot.isDraggingOver ? "bg-accent-soft/30 dark:bg-accent-soft/10" : ""
                    }`}
                  >
                    {pageItems.map((o, i) => {
                      const sla = slaInfo(o.slaDueAt, o.status);
                      const contactInit = o.contactName 
                        ? o.contactName.trim().split(/\s+/).slice(0, 2).map(n => n[0] ?? "").join("").toUpperCase()
                        : "C";

                      // Create a color hash for client avatar gradients
                      const charCodeSum = o.contactName
                        ? o.contactName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
                        : o.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
                      
                      const gradients = [
                        "from-cyan-500 to-blue-500 text-white",
                        "from-emerald-500 to-teal-500 text-white",
                        "from-orange-400 to-rose-500 text-white",
                        "from-purple-500 to-pink-500 text-white",
                        "from-amber-400 to-orange-500 text-white",
                      ];
                      const avatarGradient = gradients[charCodeSum % gradients.length] ?? "from-slate-400 to-slate-500 text-white";

                      return (
                        <Draggable key={o.id} draggableId={o.id} index={i}>
                          {(dp, ds) => (
                            <div
                              ref={dp.innerRef}
                              {...dp.draggableProps}
                              {...dp.dragHandleProps}
                              onClick={() => setDetailOrder(o)}
                              className={`group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border bg-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
                                ds.isDragging 
                                  ? "rotate-[1deg] shadow-lg ring-2 ring-accent/30 scale-105 border-accent bg-surface-elevated"
                                  : "border-border"
                              }`}
                              style={{ 
                                ...dp.draggableProps.style, 
                                borderLeftWidth: "4px",
                                borderLeftColor: col.accent,
                              }}
                            >
                              <div>
                                {/* Title and actions */}
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="line-clamp-2 text-xs font-bold text-foreground leading-snug tracking-tight group-hover:text-accent transition-colors">
                                    {o.title}
                                  </h3>
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDetailOrder(o); }}
                                      className="text-muted-foreground hover:text-accent hover:bg-accent-soft p-1 rounded-lg"
                                      aria-label="Ver/editar OS"
                                    >
                                      <PencilSimple size={12} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(o.id);
                                      }}
                                      className="opacity-0 transition-opacity duration-150 group-hover:opacity-100 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg"
                                      aria-label="Excluir OS"
                                    >
                                      <Trash size={12} />
                                    </button>
                                  </div>
                                </div>

                                {/* Customer details with overlapping gradient avatar */}
                                {o.contactName && (
                                  <div className="mt-3 flex items-center gap-2">
                                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient} text-[9px] font-bold shadow-2xs`}>
                                      {contactInit}
                                    </div>
                                    <p className="text-[10px] font-semibold text-muted-foreground truncate max-w-[130px]" title={o.contactName}>
                                      {o.contactName}
                                    </p>
                                  </div>
                                )}

                                {/* Priority + material tags */}
                                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                  <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${PRIORITY_META[o.priority].cls}`}>
                                    {PRIORITY_META[o.priority].label}
                                  </span>
                                  {o.material && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                                      <Cube size={9} weight="bold" /> {o.material}
                                    </span>
                                  )}
                                </div>

                                {/* Slicer Technical Details */}
                                {o.slicerNotes?.notes && (
                                  <div className="mt-2.5 rounded-lg bg-muted/50 border border-border/40 px-2.5 py-1.5 text-[9px] text-muted-foreground leading-relaxed font-medium">
                                    <span className="font-bold text-foreground/75 block text-[8px] uppercase tracking-wider mb-0.5">Notas Técnicas:</span>
                                    <span className="line-clamp-2 block italic">{o.slicerNotes.notes}</span>
                                  </div>
                                )}
                              </div>

                              {/* Footer details */}
                              <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-border/40">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-extrabold text-foreground tabular-nums">
                                    {brl(o.totalCents)}
                                  </span>
                                  {o.qty > 1 && (
                                    <span className="text-[9px] font-bold text-accent bg-accent-soft px-1.5 py-0.5 rounded border border-accent/10">
                                      {o.qty}x
                                    </span>
                                  )}
                                </div>

                                {sla && (
                                  <span className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase ${sla.tone} shadow-2xs`}>
                                    <Clock size={10} /> 
                                    {sla.label}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {/* Paginação da coluna: 5 O.S. visíveis por vez */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 border-t border-border/40 px-3 py-2">
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((n) => (
                    <PageBtn
                      key={n}
                      n={n}
                      active={n === (pages[col.id] ?? 1)}
                      onClick={() => setPages((p) => ({ ...p, [col.id]: n }))}
                    />
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Detalhe / edição de uma O.S. */}
      <OsEditDialog
        order={detailOrder}
        contacts={contactList}
        onContactCreated={(c) => setContactList((prev) => [...prev, c])}
        channels={channelList}
        onChannelCreated={(c) => setChannelList((prev) => [...prev, c])}
        materials={materialList}
        onMaterialCreated={(m) => setMaterialList((prev) => [...prev, m])}
        onOpenChange={(v) => { if (!v) setDetailOrder(null); }}
        onSaved={(patched) => {
          setOrders((prev) => prev.map((o) => (o.id === patched.id ? patched : o)));
          setDetailOrder(null);
        }}
      />
    </div>
  );
}

function OsEditDialog({
  order, contacts, onContactCreated, channels, onChannelCreated, materials, onMaterialCreated, onOpenChange, onSaved,
}: {
  order: ServiceOrderView | null;
  contacts: ContactLite[];
  onContactCreated: (c: ContactLite) => void;
  channels: SaleChannelOption[];
  onChannelCreated: (c: SaleChannelOption) => void;
  materials: MaterialOption[];
  onMaterialCreated: (m: MaterialOption) => void;
  onOpenChange: (v: boolean) => void;
  onSaved: (o: ServiceOrderView) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState(() => formFromOrder(order));
  const [lastId, setLastId] = useState<string | null>(order?.id ?? null);
  // Re-sincroniza o form quando abre para outra O.S.
  if (order && order.id !== lastId) { setLastId(order.id); setF(formFromOrder(order)); }

  if (!order) return null;

  function submit() {
    if (!order) return;
    if (!f.title.trim()) return toast.error("Informe o título da OS");
    const contact = contacts.find((c) => c.id === f.contactId);
    const payload = {
      title: f.title.trim(),
      contactId: f.contactId || null,
      contactName: f.contactId ? (contact?.name ?? null) : (f.contactName || null),
      status: f.status,
      priority: f.priority,
      material: f.material.trim() || null,
      channelId: f.channelId || null,
      total: f.total ? Number(f.total.replace(",", ".")) : 0,
      qty: Number(f.qty) || 1,
      slaDueAt: f.sla ? new Date(f.sla).toISOString() : null,
      notes: f.notes.trim() || undefined,
    };
    startTransition(async () => {
      const res = await updateServiceOrder(order.id, payload);
      if (!res.ok) { toast.error(res.error || "Erro ao salvar"); return; }
      toast.success("O.S. atualizada");
      onSaved({
        ...order,
        title: payload.title,
        contactId: payload.contactId,
        contactName: payload.contactName,
        status: payload.status,
        priority: payload.priority,
        material: payload.material,
        channelId: payload.channelId,
        totalCents: Math.round((payload.total ?? 0) * 100),
        qty: payload.qty,
        slaDueAt: payload.slaDueAt,
        slicerNotes: payload.notes ? { ...order.slicerNotes, notes: payload.notes } : order.slicerNotes,
      });
    });
  }

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl border border-border bg-surface text-xs max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">Ordem de Serviço</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ed-title">Título / Produto</Label>
            <Input id="ed-title" value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} className="h-9 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ed-status">Status</Label>
              <Combobox
                id="ed-status"
                className="h-9 rounded-lg text-xs"
                value={f.status}
                onChange={(v) => setF((p) => ({ ...p, status: v as SoStatus }))}
                options={SO_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
                searchPlaceholder="Buscar status…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-priority">Prioridade</Label>
              <Combobox
                id="ed-priority"
                className="h-9 rounded-lg text-xs"
                value={f.priority}
                onChange={(v) => setF((p) => ({ ...p, priority: v as SoPriority }))}
                options={(Object.keys(PRIORITY_META) as SoPriority[]).map((p) => ({ value: p, label: PRIORITY_META[p].label }))}
                searchPlaceholder="Buscar prioridade…"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-contact">Cliente</Label>
            <Combobox
              id="ed-contact"
              className="h-9 rounded-lg text-xs"
              value={f.contactId}
              onChange={(v) => setF((p) => ({ ...p, contactId: v }))}
              options={contactOptions(contacts)}
              searchPlaceholder="Buscar cliente…"
              allowCreate={clientAllowCreate(onContactCreated)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-channel">Canal de venda</Label>
            <Combobox
              id="ed-channel"
              className="h-9 rounded-lg text-xs"
              value={f.channelId}
              onChange={(v) => setF((p) => ({ ...p, channelId: v }))}
              options={channelOptions(channels)}
              searchPlaceholder="Buscar canal…"
              allowCreate={channelAllowCreate(onChannelCreated)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ed-total">Valor (R$)</Label>
              <Input id="ed-total" inputMode="decimal" value={f.total} onChange={(e) => setF((p) => ({ ...p, total: e.target.value }))} className="h-9 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-qty">Qtd</Label>
              <Input id="ed-qty" inputMode="numeric" value={f.qty} onChange={(e) => setF((p) => ({ ...p, qty: e.target.value }))} className="h-9 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-material">Material</Label>
              <Combobox
                id="ed-material"
                className="h-9 rounded-lg text-xs"
                value={f.material}
                onChange={(v) => setF((p) => ({ ...p, material: v }))}
                options={materials.map((m) => ({ value: m.name, label: m.name }))}
                searchPlaceholder="Buscar material…"
                allowCreate={materialAllowCreate(onMaterialCreated)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-sla">Prazo (SLA)</Label>
            <Input id="ed-sla" type="date" value={f.sla} onChange={(e) => setF((p) => ({ ...p, sla: e.target.value }))} className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-notes">Notas técnicas</Label>
            <Input id="ed-notes" value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} className="h-9 rounded-lg" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button size="sm" className="rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent/90" onClick={submit} disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formFromOrder(o: ServiceOrderView | null) {
  return {
    title: o?.title ?? "",
    contactId: o?.contactId ?? "",
    contactName: o?.contactName ?? "",
    status: (o?.status ?? "orcamento") as SoStatus,
    priority: (o?.priority ?? "media") as SoPriority,
    material: o?.material ?? "",
    channelId: o?.channelId ?? "",
    total: o ? String(o.totalCents / 100) : "",
    qty: String(o?.qty ?? 1),
    sla: o?.slaDueAt ? o.slaDueAt.slice(0, 10) : "",
    notes: o?.slicerNotes?.notes ?? "",
  };
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-5 shadow-2xs ${className}`}>
      {children}
    </div>
  );
}

function PageBtn({ n, active, onClick }: { n: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold transition-colors ${
        active
          ? "border border-accent bg-accent-soft text-accent"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {n}
    </button>
  );
}

function NewOsDialog({
  open, onOpenChange, contacts, onContactCreated, channels, onChannelCreated, materials, onMaterialCreated, prefill, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contacts: ContactLite[];
  onContactCreated: (c: ContactLite) => void;
  channels: SaleChannelOption[];
  onChannelCreated: (c: SaleChannelOption) => void;
  materials: MaterialOption[];
  onMaterialCreated: (m: MaterialOption) => void;
  prefill?: { title?: string; notes?: string; total?: number } | null;
  onCreated: (o: ServiceOrderView) => void;
}) {
  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [total, setTotal] = useState("");
  const [qty, setQty] = useState("1");
  const [sla, setSla] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<SoPriority>("media");
  const [material, setMaterial] = useState("");
  const [pending, startTransition] = useTransition();

  // Aplica o prefill do simulador de Projetos quando o dialog abre com ele.
  useEffect(() => {
    if (open && prefill) {
      setTitle(prefill.title ?? "");
      setNotes(prefill.notes ?? "");
      setTotal(prefill.total != null ? String(prefill.total) : "");
    }
  }, [open, prefill]);

  function reset() {
    setTitle(""); setContactId(""); setChannelId(""); setTotal(""); setQty("1"); setSla(""); setNotes("");
    setPriority("media"); setMaterial("");
  }

  function submit() {
    if (!title.trim()) return toast.error("Informe o título da OS");
    const contact = contacts.find((c) => c.id === contactId);
    const payload = {
      title: title.trim(),
      contactId: contactId || null,
      contactName: contact?.name ?? undefined,
      priority,
      material: material.trim() || null,
      channelId: channelId || null,
      total: total ? Number(total.replace(",", ".")) : 0,
      qty: Number(qty) || 1,
      slaDueAt: sla ? new Date(sla).toISOString() : null,
      notes: notes.trim() || undefined,
    };
    startTransition(async () => {
      const res = await createServiceOrder(payload);
      if (!res.ok) {
        toast.error(res.error || "Erro ao criar OS");
        return;
      }
      toast.success("OS criada");
      onCreated(res.order);
      reset();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if (!val) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-lg h-9 gap-1.5 font-semibold text-xs bg-accent text-white hover:bg-accent/90">
          <Plus size={14} weight="bold" /> Nova OS
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-xl border border-border bg-surface text-xs">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">Nova Ordem de Serviço</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="os-title">Título do Pedido</Label>
            <Input id="os-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: 10x Chaveiro Personalizado Banguela" className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="os-contact">Cliente</Label>
            <Combobox
              id="os-contact"
              className="h-9 rounded-lg text-xs"
              value={contactId}
              onChange={(v) => setContactId(v)}
              options={contactOptions(contacts)}
              placeholder="— Sem cliente —"
              searchPlaceholder="Buscar ou digitar novo cliente…"
              allowCreate={clientAllowCreate(onContactCreated)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="os-channel">Canal de venda</Label>
            <Combobox
              id="os-channel"
              className="h-9 rounded-lg text-xs"
              value={channelId}
              onChange={(v) => setChannelId(v)}
              options={channelOptions(channels)}
              placeholder="— Sem canal —"
              searchPlaceholder="Buscar ou digitar novo canal…"
              allowCreate={channelAllowCreate(onChannelCreated)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="os-total">Valor Total (R$)</Label>
              <Input id="os-total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0,00" className="h-9 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="os-qty">Quantidade (Unidades)</Label>
              <Input id="os-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className="h-9 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="os-priority">Prioridade</Label>
              <Combobox
                id="os-priority"
                className="h-9 rounded-lg text-xs"
                value={priority}
                onChange={(v) => setPriority(v as SoPriority)}
                options={(Object.keys(PRIORITY_META) as SoPriority[]).map((p) => ({ value: p, label: PRIORITY_META[p].label }))}
                searchPlaceholder="Buscar prioridade…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="os-material">Material</Label>
              <Combobox
                id="os-material"
                className="h-9 rounded-lg text-xs"
                value={material}
                onChange={(v) => setMaterial(v)}
                options={materials.map((m) => ({ value: m.name, label: m.name }))}
                placeholder="PLA, ABS, PETG..."
                searchPlaceholder="Buscar ou digitar novo material…"
                allowCreate={materialAllowCreate(onMaterialCreated)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="os-sla">Prazo de Entrega (SLA)</Label>
            <Input id="os-sla" type="date" value={sla} onChange={(e) => setSla(e.target.value)} className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="os-notes">Notas Técnicas do Fatiador</Label>
            <Input id="os-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: Altura de camada 0.2mm, preenchimento 15%, suportes orgânicos..." className="h-9 rounded-lg" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" className="rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent/90" onClick={submit} disabled={pending}>
            {pending ? "Salvando..." : "Criar Ordem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
