"use client";

import { useMemo, useState, useTransition } from "react";
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
} from "@/lib/ui/icons";
import {
  createServiceOrder, updateServiceOrderStatus, deleteServiceOrder,
  type ServiceOrderView,
} from "@/app/actions/service-orders/actions";
import { SO_STATUSES, type SoStatus, type SoPriority } from "@/lib/schemas/service-orders";

const COLUMNS: { id: SoStatus; label: string; accent: string; bgClass: string; borderClass: string; dotClass: string }[] = [
  { id: "orcamento", label: "Orçamento", accent: "#EAB308", bgClass: "bg-amber-500/[0.02] dark:bg-amber-500/[0.01]", borderClass: "border-amber-500/10 hover:border-amber-500/20", dotClass: "bg-amber-500" },
  { id: "aprovado", label: "Aprovado / Fila", accent: "#06B6D4", bgClass: "bg-cyan-500/[0.02] dark:bg-cyan-500/[0.01]", borderClass: "border-cyan-500/10 hover:border-cyan-500/20", dotClass: "bg-cyan-500" },
  { id: "em_producao", label: "Em Produção", accent: "#F97316", bgClass: "bg-orange-500/[0.02] dark:bg-orange-500/[0.01]", borderClass: "border-orange-500/10 hover:border-orange-500/20", dotClass: "bg-orange-500" },
  { id: "pos_processamento", label: "Pós-Processo", accent: "#8B5CF6", bgClass: "bg-violet-500/[0.02] dark:bg-violet-500/[0.01]", borderClass: "border-violet-500/10 hover:border-violet-500/20", dotClass: "bg-violet-500" },
  { id: "pronto_entrega", label: "Pronto p/ Entrega", accent: "#3B82F6", bgClass: "bg-blue-500/[0.02] dark:bg-blue-500/[0.01]", borderClass: "border-blue-500/10 hover:border-blue-500/20", dotClass: "bg-blue-500" },
  { id: "concluido", label: "Concluído", accent: "#10B981", bgClass: "bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01]", borderClass: "border-emerald-500/10 hover:border-emerald-500/20", dotClass: "bg-emerald-500" },
];

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
}

export function ServiceOrdersBoard({ initialOrders, contacts }: Props) {
  const [orders, setOrders] = useState<ServiceOrderView[]>(initialOrders);
  const [, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter orders by search term (searches titles & contact names)
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(
      (o) =>
        o.title.toLowerCase().includes(term) ||
        (o.contactName && o.contactName.toLowerCase().includes(term))
    );
  }, [orders, searchTerm]);

  // Group by status
  const byStatus = useMemo(() => {
    const map = Object.fromEntries(SO_STATUSES.map((s) => [s, [] as ServiceOrderView[]])) as Record<SoStatus, ServiceOrderView[]>;
    for (const o of filteredOrders) {
      map[o.status].push(o);
    }
    for (const k of Object.keys(map) as SoStatus[]) {
      map[k].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [filteredOrders]);

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
    setOrders((prev) =>
      prev.map((o) => (o.id === draggableId ? { ...o, status: newStatus, position: destination.index } : o)),
    );
    startTransition(async () => {
      const res = await updateServiceOrderStatus({ id: draggableId, status: newStatus, position: destination.index });
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
              onOpenChange={setDialogOpen}
              contacts={contacts}
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

      {/* ─── Board ─── */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {COLUMNS.map((col) => (
            <div key={col.id} className={`flex w-[280px] shrink-0 flex-col rounded-xl border border-border/80 ${col.bgClass} min-h-[500px]`}>
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
                    {byStatus[col.id].map((o, i) => {
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
                              className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
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
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-5 shadow-2xs ${className}`}>
      {children}
    </div>
  );
}

function NewOsDialog({
  open, onOpenChange, contacts, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contacts: Array<{ id: string; name: string | null }>;
  onCreated: (o: ServiceOrderView) => void;
}) {
  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState("");
  const [total, setTotal] = useState("");
  const [qty, setQty] = useState("1");
  const [sla, setSla] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<SoPriority>("media");
  const [material, setMaterial] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setTitle(""); setContactId(""); setTotal(""); setQty("1"); setSla(""); setNotes("");
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
      onCreated({
        id: crypto.randomUUID(),
        title: payload.title,
        contactId: payload.contactId,
        contactName: payload.contactName ?? null,
        status: "orcamento",
        priority: payload.priority,
        material: payload.material,
        totalCents: Math.round((payload.total ?? 0) * 100),
        qty: payload.qty,
        slaDueAt: payload.slaDueAt,
        slicerNotes: payload.notes ? { notes: payload.notes } : {},
        position: 0,
        createdAt: new Date().toISOString(),
      });
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
            <Label htmlFor="os-contact">Cliente Vinculado</Label>
            <select
              id="os-contact"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs outline-hidden focus:ring-2 focus:ring-accent/20"
            >
              <option value="">— Sem cliente —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name || "(sem nome)"}</option>
              ))}
            </select>
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
              <select
                id="os-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as SoPriority)}
                className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs outline-hidden focus:ring-2 focus:ring-accent/20"
              >
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="os-material">Material</Label>
              <Input id="os-material" value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="PLA, ABS, PETG..." className="h-9 rounded-lg" />
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
