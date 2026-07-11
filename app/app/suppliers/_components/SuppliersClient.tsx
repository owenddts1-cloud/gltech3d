"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Handshake, Receipt, Package, Plus, Trash, Phone, Globe, Star, Coins, Warning,
  MagnifyingGlass, ShieldCheck, CaretLeft, CaretRight,
} from "@/lib/ui/icons";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell,
} from "recharts";
import {
  createSupplier, deleteSupplier, createPurchase,
  type SuppliersData,
} from "@/app/actions/suppliers/actions";
import { SUPPLIER_CATEGORIES, type SupplierCategory } from "@/lib/schemas/suppliers";

const brlCents = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);

const CATEGORY_LABEL: Record<SupplierCategory, string> = {
  filament: "Filamentos / Insumos", printer: "Impressoras / Peças", shipping: "Logística / Frete",
  tools: "Bancada / Ferramentas", other: "Outros",
};

function ReliabilityGauge({ score }: { score: number }) {
  const r = 22, sw = 4.5, c = 2 * Math.PI * r, offset = c - (score / 100) * c;
  const color = score >= 90 ? "stroke-emerald-500" : score >= 70 ? "stroke-amber-500" : "stroke-rose-500";
  return (
    <div className="relative flex items-center justify-center h-14 w-14 shrink-0">
      <svg className="w-full h-full -rotate-90">
        <circle cx="28" cy="28" r={r} className="stroke-muted fill-transparent" strokeWidth={sw} />
        <circle cx="28" cy="28" r={r} className={cn("fill-transparent transition-all duration-500", color)} strokeWidth={sw} strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[10px] font-black font-mono text-foreground">{score}%</span>
    </div>
  );
}

export function SuppliersClient({ data }: { data: SuppliersData }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 6;

  const { suppliers, purchases, filaments } = data;

  const suppliersStats = useMemo(() => suppliers.map((sup) => {
    const materials = filaments.filter((f) => f.supplier?.toLowerCase().trim() === sup.name.toLowerCase().trim());
    const totalSpend = purchases
      .filter((p) => (p.supplierId ? p.supplierId === sup.id : p.supplierName.toLowerCase() === sup.name.toLowerCase()))
      .reduce((s, p) => s + p.qty * p.unitPriceCents, 0);
    return { ...sup, materialsCount: materials.length, totalSpendCents: totalSpend };
  }), [suppliers, filaments, purchases]);

  const summary = useMemo(() => {
    const totalSuppliers = suppliers.length;
    const totalSpendCents = purchases.reduce((s, p) => s + p.qty * p.unitPriceCents, 0);
    const avgDelivery = totalSuppliers ? suppliers.reduce((s, x) => s + x.avgDeliveryDays, 0) / totalSuppliers : 0;
    const highCostAlerts = filaments.filter((f) => f.costPerGram > 0.12).length;
    return { totalSuppliers, totalSpendCents, avgDelivery: avgDelivery.toFixed(1), highCostAlerts };
  }, [suppliers, purchases, filaments]);

  const chartData = useMemo(() => filaments.map((f) => ({
    name: f.name.length > 15 ? f.name.slice(0, 15) + "…" : f.name, fullName: f.name, cost: f.costPerGram,
  })), [filaments]);

  const filteredPurchases = useMemo(() => {
    const q = search.toLowerCase();
    return purchases.filter((p) => p.itemName.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q));
  }, [purchases, search]);
  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / perPage));
  const pagePurchases = filteredPurchases.slice((page - 1) * perPage, page * perPage);

  function onDeleteSupplier(id: string) {
    startTransition(async () => {
      const res = await deleteSupplier(id);
      if (!res.ok) { toast.error(res.error || "Erro ao remover"); return; }
      toast.success("Fornecedor removido."); router.refresh();
    });
  }

  return (
    <div className="space-y-6 p-6 mx-auto max-w-7xl animate-in fade-in duration-200">
      {/* Header */}
      <header className="relative overflow-hidden rounded-xl border border-border bg-surface p-6">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-24" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Handshake size={26} weight="duotone" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Gestão de Fornecedores</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Cadastro de parceiros de insumos, histórico de compras e comparação de preços de filamento.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-lg h-9 gap-1.5 font-semibold text-xs" onClick={() => setLogOpen(true)} disabled={suppliers.length === 0}>
              <Receipt size={14} /> Registrar Compra
            </Button>
            <Button size="sm" className="rounded-lg h-9 gap-1.5 font-semibold text-xs" onClick={() => setAddOpen(true)}>
              <Plus size={14} weight="bold" /> Novo Fornecedor
            </Button>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Parceiros" value={String(summary.totalSuppliers)} sub="fornecedores cadastrados" icon={Handshake} cls="text-accent" />
        <Kpi label="Gasto Acumulado" value={brlCents(summary.totalSpendCents)} sub="histórico de compras" icon={Coins} cls="text-emerald-500" />
        <Kpi label="Prazo Médio" value={`${summary.avgDelivery} dias`} sub="tempo médio de entrega" icon={Package} cls="text-amber-500" />
        <Kpi label="Alertas de Inflação" value={String(summary.highCostAlerts)} sub="insumos acima de R$0,12/g" icon={Warning} cls={summary.highCostAlerts > 0 ? "text-amber-500" : "text-muted-foreground"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Directory */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Diretório de Fornecedores</h2>
          {suppliersStats.length === 0 ? (
            <Card className="p-10 text-center rounded-xl border border-dashed border-border bg-surface">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><Handshake size={22} weight="duotone" /></div>
              <p className="mt-3 text-sm font-semibold text-foreground">Nenhum fornecedor cadastrado</p>
              <p className="mt-1 text-xs text-muted-foreground">Clique em “Novo Fornecedor” para começar.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suppliersStats.map((sup) => {
                const score = sup.rating * 20;
                return (
                  <Card key={sup.id} className="p-5 rounded-xl border border-border bg-surface flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-foreground truncate">{sup.name}</h3>
                          <span className="text-[10px] text-muted-foreground mt-0.5 block font-bold">{CATEGORY_LABEL[sup.category]}</span>
                        </div>
                        <ReliabilityGauge score={score} />
                      </div>
                      <div className="mt-4 space-y-2.5 text-xs">
                        <Row label="Contato" value={sup.contactPerson || "—"} />
                        <Row label="Prazo médio" value={`${sup.avgDeliveryDays} dias`} />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground font-medium">Classificação:</span>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} size={11} weight={i < sup.rating ? "fill" : "regular"} className={i < sup.rating ? "text-amber-500" : "text-muted-foreground/40"} />
                            ))}
                          </div>
                        </div>
                        <Row label="Materiais" value={`${sup.materialsCount} vinculados`} />
                        <div className="flex justify-between border-t border-border/60 pt-2 mt-1">
                          <span className="text-muted-foreground font-bold">Investido:</span>
                          <span className="font-bold text-foreground font-mono">{brlCents(sup.totalSpendCents)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                      <div className="flex gap-2">
                        {sup.website && (
                          <a href={sup.website.startsWith("http") ? sup.website : `https://${sup.website}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" title="Visitar site"><Globe size={13} /></Button>
                          </a>
                        )}
                        {sup.phone && (
                          <a href={`https://wa.me/${sup.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg text-emerald-600 dark:text-emerald-400" title="WhatsApp"><Phone size={13} weight="fill" /></Button>
                          </a>
                        )}
                      </div>
                      <button onClick={() => onDeleteSupplier(sup.id)} aria-label="Excluir"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500">
                        <Trash size={13} />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: chart + purchase history */}
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-accent" /> Matriz de Custo/g dos Filamentos
            </h2>
            <Card className="p-4 rounded-xl border border-border bg-surface">
              <div className="h-56 w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                      <XAxis type="number" tick={{ fontSize: 9, fill: "var(--color-text-muted)" }} tickFormatter={(v) => `R$${v.toFixed(2)}`} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} width={80} />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length && payload[0]) {
                            const d = payload[0].payload as { fullName: string; cost: number };
                            return (
                              <div className="rounded-lg border border-border bg-surface p-2.5 shadow-md text-[10px] space-y-0.5">
                                <p className="font-bold text-foreground">{d.fullName}</p>
                                <p className="text-accent font-bold">Custo/g: R$ {d.cost.toFixed(3)}</p>
                                <p className="text-muted-foreground">Benchmark: R$ 0,12</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="cost" radius={[0, 4, 4, 0]} barSize={10}>
                        {chartData.map((e, i) => (
                          <Cell key={i} fill={e.cost <= 0.09 ? "#10b981" : e.cost <= 0.12 ? "#f59e0b" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem filamentos cadastrados.</div>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Histórico de Compras</h2>
            <Card className="p-4 rounded-xl border border-border bg-surface space-y-3">
              <div className="relative">
                <MagnifyingGlass className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar compra…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-8 rounded-lg text-xs" />
              </div>
              <div className="divide-y divide-border/60 max-h-[260px] overflow-y-auto">
                {pagePurchases.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{p.itemName}</p>
                      <span className="text-[10px] text-muted-foreground block">{p.supplierName} · {p.qty} un</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-foreground font-mono">{brlCents(p.qty * p.unitPriceCents)}</span>
                      <span className="block text-[9px] text-muted-foreground font-mono mt-0.5">{p.purchasedAt}</span>
                    </div>
                  </div>
                ))}
                {filteredPurchases.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Nenhum registro.</p>}
              </div>
              {totalPages > 1 && (
                <div className="flex justify-between items-center pt-2 border-t border-border/60 text-[10px]">
                  <span className="text-muted-foreground font-bold">Página {page} de {totalPages}</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" disabled={page === 1} onClick={() => setPage(page - 1)} className="h-6 w-6 rounded-md"><CaretLeft className="h-3 w-3" /></Button>
                    <Button variant="outline" size="icon" disabled={page === totalPages} onClick={() => setPage(page + 1)} className="h-6 w-6 rounded-md"><CaretRight className="h-3 w-3" /></Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <AddSupplierDialog open={addOpen} onOpenChange={setAddOpen} onSaved={() => { setAddOpen(false); router.refresh(); }} />
      <LogPurchaseDialog open={logOpen} onOpenChange={setLogOpen} suppliers={suppliers} onSaved={() => { setLogOpen(false); router.refresh(); }} />
    </div>
  );
}

function Kpi({ label, value, sub, icon: Icon, cls }: { label: string; value: string; sub: string; icon: typeof Handshake; cls: string }) {
  return (
    <Card className="p-4 rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        <Icon size={14} className={cls} />
      </div>
      <span className="mt-2 block text-2xl font-extrabold text-foreground tabular-nums truncate">{value}</span>
      <span className="text-[10px] text-muted-foreground block mt-0.5">{sub}</span>
    </Card>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground font-medium">{label}:</span>
      <span className="font-semibold text-foreground truncate max-w-[55%] text-right">{value}</span>
    </div>
  );
}

function AddSupplierDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({ name: "", category: "filament" as SupplierCategory, contactPerson: "", phone: "", website: "", rating: "5", avgDeliveryDays: "5" });
  const setK = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  function submit() {
    if (!f.name.trim()) return toast.error("Informe o nome do fornecedor");
    startTransition(async () => {
      const res = await createSupplier({
        name: f.name.trim(), category: f.category, contactPerson: f.contactPerson, phone: f.phone,
        website: f.website, rating: Number(f.rating) || 5, avgDeliveryDays: Number(f.avgDeliveryDays) || 5,
      });
      if (!res.ok) { toast.error(res.error || "Erro ao cadastrar"); return; }
      toast.success("Fornecedor cadastrado.");
      setF({ name: "", category: "filament", contactPerson: "", phone: "", website: "", rating: "5", avgDeliveryDays: "5" });
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl border border-border bg-surface text-xs">
        <DialogHeader><DialogTitle className="text-sm font-bold text-foreground">Cadastrar Fornecedor</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>Nome da empresa</Label><Input value={f.name} onChange={setK("name")} placeholder="Ex: eSun Distribuidora" className="h-9 rounded-lg" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <select value={f.category} onChange={setK("category")} className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs outline-hidden focus:ring-2 focus:ring-accent/20">
                {SUPPLIER_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>Entrega (dias)</Label><Input inputMode="numeric" value={f.avgDeliveryDays} onChange={setK("avgDeliveryDays")} className="h-9 rounded-lg" /></div>
          </div>
          <div className="space-y-1.5"><Label>Pessoa de contato</Label><Input value={f.contactPerson} onChange={setK("contactPerson")} placeholder="Ex: Carlos Mota" className="h-9 rounded-lg" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>WhatsApp/Telefone</Label><Input value={f.phone} onChange={setK("phone")} placeholder="Ex: 11988887777" className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Website</Label><Input value={f.website} onChange={setK("website")} placeholder="exemplo.com.br" className="h-9 rounded-lg" /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Avaliação</Label>
            <select value={f.rating} onChange={setK("rating")} className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs outline-hidden focus:ring-2 focus:ring-accent/20">
              <option value="5">Excelente</option><option value="4">Muito bom</option><option value="3">Regular</option><option value="2">Instável</option><option value="1">Crítico</option>
            </select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" className="rounded-lg text-xs font-semibold" onClick={submit} disabled={pending}>{pending ? "Salvando..." : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogPurchaseDialog({ open, onOpenChange, suppliers, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  suppliers: SuppliersData["suppliers"]; onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [supplierId, setSupplierId] = useState("");
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");

  function submit() {
    const sup = suppliers.find((s) => s.id === supplierId);
    if (!sup) return toast.error("Selecione o fornecedor");
    if (!item.trim()) return toast.error("Informe o item");
    startTransition(async () => {
      const res = await createPurchase({
        supplierId: sup.id, supplierName: sup.name, itemName: item.trim(),
        qty: Number(qty) || 1, unitPrice: price ? Number(price.replace(",", ".")) : 0,
      });
      if (!res.ok) { toast.error(res.error || "Erro ao registrar"); return; }
      toast.success("Compra registrada.");
      setSupplierId(""); setItem(""); setQty("1"); setPrice("");
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl border border-border bg-surface text-xs">
        <DialogHeader><DialogTitle className="text-sm font-bold text-foreground">Registrar Compra</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Fornecedor</Label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs outline-hidden focus:ring-2 focus:ring-accent/20">
              <option value="">Selecione…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label>Item comprado</Label><Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Ex: PLA Premium Cinza 1kg" className="h-9 rounded-lg" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Quantidade</Label><Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Preço unit. (R$)</Label><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" className="h-9 rounded-lg" /></div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" className="rounded-lg text-xs font-semibold" onClick={submit} disabled={pending}>{pending ? "Salvando..." : "Registrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
