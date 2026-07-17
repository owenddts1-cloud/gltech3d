"use client";

import { useState, useMemo, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Cube, Trash, Plus, Sparkle, Calculator, Clock, Receipt } from "@/lib/ui/icons";
import { toast } from "sonner";
import {
  createProject, deleteProject, createProjectNote, deleteProjectNote,
  updateProjectNote,
  type ProjectsData, type ProjectView, type ProjectNoteView,
} from "@/app/actions/projects/actions";
import type { ProjectNoteColor } from "@/lib/schemas/projects";

// ── Cost helpers ──
const calcFilament = (p: { weightGrams: number; filamentCostPerKg: number }) => p.weightGrams * (p.filamentCostPerKg / 1000);
const calcEnergy = (p: { wattage: number; printHours: number; kwhPrice: number }) => (p.wattage / 1000) * p.printHours * p.kwhPrice;
const calcDeprec = (p: { printHours: number; depreciationPerHour: number }) => p.printHours * p.depreciationPerHour;
const calcTotal = (p: ProjectView) => calcFilament(p) + calcEnergy(p) + calcDeprec(p);
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function ProjectsClient({ data }: { data: ProjectsData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"projects" | "whiteboard">("projects");
  const [, startTransition] = useTransition();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);

  const projects = data.projects;
  // Notas em estado local para o drag no plano ser otimista (sem esperar o round-trip).
  const [notes, setNotes] = useState<ProjectNoteView[]>(data.notes);
  useEffect(() => { setNotes(data.notes); }, [data.notes]);

  // Quadro livre (malha 3D estilo AutoCAD): zoom + pan + drag por pointer events.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragNoteId, setDragNoteId] = useState<string | null>(null);
  // Refs de gesto (não re-renderizam a cada movimento do ponteiro).
  const noteDrag = useRef<{ id: string; startX: number; startY: number; noteX: number; noteY: number; lastX: number; lastY: number } | null>(null);
  const panDrag = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  // Posição efetiva de uma nota (cascata perto da origem se ainda não posicionada).
  const posOf = useCallback((n: ProjectNoteView, i: number) => ({
    x: n.posX != null ? n.posX : 40 + (i % 6) * 34,
    y: n.posY != null ? n.posY : 40 + Math.floor(i / 6) * 30 + (i % 6) * 8,
  }), []);

  // Live simulator
  const [simWeight, setSimWeight] = useState(250);
  const [simHours, setSimHours] = useState(10);
  const [simFilamentCost, setSimFilamentCost] = useState(140);
  const [simWattage, setSimWattage] = useState(300);
  const [simKwhPrice, setSimKwhPrice] = useState(0.85);
  const [simDepreciation, setSimDepreciation] = useState(0.5);

  // New note form
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostColor, setNewPostColor] = useState<ProjectNoteColor>("yellow");

  const sim = useMemo(() => {
    const material = calcFilament({ weightGrams: simWeight, filamentCostPerKg: simFilamentCost });
    const power = calcEnergy({ wattage: simWattage, printHours: simHours, kwhPrice: simKwhPrice });
    const deprec = calcDeprec({ printHours: simHours, depreciationPerHour: simDepreciation });
    const total = material + power + deprec;
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
    return { material, power, deprec, total, materialPct: pct(material), powerPct: pct(power), deprecPct: pct(deprec) };
  }, [simWeight, simHours, simFilamentCost, simWattage, simKwhPrice, simDepreciation]);

  const metrics = useMemo(() => {
    const totalProjects = projects.length;
    const avgHours = totalProjects ? projects.reduce((a, p) => a + p.printHours, 0) / totalProjects : 0;
    const avgCost = totalProjects ? projects.reduce((a, p) => a + calcTotal(p), 0) / totalProjects : 0;
    const infillTypes = projects.map((p) => p.infill.split(" ")[1] ?? p.infill ?? "—").filter(Boolean);
    const popularInfill = infillTypes.length
      ? infillTypes.sort((a, b) => infillTypes.filter((v) => v === a).length - infillTypes.filter((v) => v === b).length).pop()
      : "—";
    return { totalProjects, avgHours: avgHours.toFixed(1), avgCost, popularInfill };
  }, [projects]);

  function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim()) return toast.error("Preencha título e conteúdo.");
    startTransition(async () => {
      const res = await createProjectNote({ title: newPostTitle.trim(), content: newPostContent.trim(), color: newPostColor });
      if (!res.ok) { toast.error(res.error || "Erro ao salvar"); return; }
      setNewPostTitle(""); setNewPostContent("");
      toast.success("Nota adicionada ao quadro.");
      router.refresh();
    });
  }
  function applyTemplate(type: "slicer" | "hardware" | "reminder") {
    if (type === "slicer") { setNewPostTitle("Ajuste de Retração PLA"); setNewPostContent("Usar retração de 0.8mm a 45mm/s para PLA Premium no bico direct drive."); setNewPostColor("blue"); }
    else if (type === "hardware") { setNewPostTitle("Tensão de Correia K1"); setNewPostContent("Apertar correia do eixo X/Y para remover ringing nas impressões rápidas."); setNewPostColor("pink"); }
    else { setNewPostTitle("Secagem TPU"); setNewPostContent("Deixar TPU na estufa a 55°C por 6h antes de iniciar o job."); setNewPostColor("yellow"); }
    toast.success("Template aplicado no formulário!");
  }
  function handleDeleteNote(id: string) {
    startTransition(async () => {
      const res = await deleteProjectNote(id);
      if (!res.ok) { toast.error(res.error || "Erro ao remover"); return; }
      toast.success("Nota removida.");
      router.refresh();
    });
  }

  // ── Quadro livre: arrastar nota (pointer), persistir posição no pointerup ──
  function onNotePointerDown(e: React.PointerEvent, note: ProjectNoteView, index: number) {
    e.stopPropagation(); // não inicia pan
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = posOf(note, index);
    noteDrag.current = { id: note.id, startX: e.clientX, startY: e.clientY, noteX: p.x, noteY: p.y, lastX: p.x, lastY: p.y };
    setDragNoteId(note.id);
  }
  function onNotePointerMove(e: React.PointerEvent) {
    const d = noteDrag.current;
    if (!d) return;
    const nx = d.noteX + (e.clientX - d.startX) / zoom;
    const ny = d.noteY + (e.clientY - d.startY) / zoom;
    d.lastX = nx; d.lastY = ny;
    setNotes((prev) => prev.map((n) => (n.id === d.id ? { ...n, posX: nx, posY: ny } : n)));
  }
  function onNotePointerUp() {
    const d = noteDrag.current;
    if (!d) return;
    noteDrag.current = null;
    setDragNoteId(null);
    const posX = Math.round(d.lastX);
    const posY = Math.round(d.lastY);
    startTransition(async () => {
      const res = await updateProjectNote(d.id, { posX, posY });
      if (!res.ok) { toast.error(res.error || "Erro ao mover"); router.refresh(); }
    });
  }

  // ── Pan do fundo (arrastar o plano) ──
  function onBoardPointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    panDrag.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  }
  function onBoardPointerMove(e: React.PointerEvent) {
    const d = panDrag.current;
    if (!d) return;
    setPan({ x: d.panX + (e.clientX - d.startX), y: d.panY + (e.clientY - d.startY) });
  }
  function onBoardPointerUp() { panDrag.current = null; }
  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }); }
  function handleDeleteProject(id: string) {
    startTransition(async () => {
      const res = await deleteProject(id);
      if (!res.ok) { toast.error(res.error || "Erro ao remover"); return; }
      toast.success("Projeto removido.");
      router.refresh();
    });
  }
  function handleSendToOS(p: ProjectView) {
    localStorage.setItem("gltech_prefill_os", JSON.stringify({
      title: `Fabricação: ${p.name}`,
      notes: `${p.filamentType}, Preenchimento ${p.infill}, Camada ${p.layerHeight}mm`,
      total: calcTotal(p) * 1.5,
    }));
    toast.success(`Parâmetros de "${p.name}" copiados. Abrindo Ordem de Serviço.`);
    window.location.href = "/app/service-orders";
  }

  return (
    <div className="space-y-6 p-6 mx-auto max-w-7xl animate-in fade-in duration-300">
      {/* Header */}
      <header className="relative overflow-hidden rounded-xl border border-border bg-surface p-6">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-24" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent border border-accent/20 shadow-sm">
              <Cube size={26} weight="duotone" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Projetos &amp; Engenharia</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Especificações técnicas de fatiamento, custos reais e quadro de ideias — salvos no banco.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border bg-surface p-1 shadow-2xs">
              <button onClick={() => setActiveTab("projects")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === "projects" ? "bg-accent-soft text-accent" : "text-muted-foreground hover:text-foreground"}`}>
                Fatiamento &amp; Custos
              </button>
              <button onClick={() => setActiveTab("whiteboard")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === "whiteboard" ? "bg-accent-soft text-accent" : "text-muted-foreground hover:text-foreground"}`}>
                Quadro de Ideias
              </button>
            </div>
          </div>
        </div>
      </header>

      {activeTab === "projects" && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Metric label="Projetos" value={String(metrics.totalProjects)} sub="protótipos parametrizados" icon={Cube} cls="text-primary" />
            <Metric label="Custo Médio Real" value={brl(metrics.avgCost)} sub="insumo + luz + depreciação" icon={Receipt} cls="text-emerald-500" />
            <Metric label="Tempo Médio de Job" value={`${metrics.avgHours}h`} sub="por ciclo" icon={Clock} cls="text-amber-500" />
            <Metric label="Padrão de Infill" value={String(metrics.popularInfill)} sub="mais recorrente" icon={Sparkle} cls="text-purple-500" capitalize />
          </div>

          {/* Simulator (client-only) */}
          <Card className="p-5 rounded-xl border border-border bg-surface">
            <div className="flex items-center gap-2 mb-4 border-b border-border/40 pb-3">
              <Calculator size={18} className="text-accent" />
              <div>
                <h2 className="text-sm font-bold text-foreground">Simulador de Custos ao Vivo</h2>
                <p className="text-[11px] text-muted-foreground">Estime os parâmetros antes de aprovar a OS do cliente</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <SliderField label="Peso da Peça (g)" value={simWeight} suffix="g" min={5} max={1500} step={5} onChange={setSimWeight} />
                <SliderField label="Tempo (h)" value={simHours} suffix="h" min={0.5} max={120} step={0.5} onChange={setSimHours} />
                <NumberField label="Insumo (R$/Kg)" value={simFilamentCost} onChange={setSimFilamentCost} />
                <NumberField label="Consumo (Watts)" value={simWattage} onChange={setSimWattage} />
                <NumberField label="Tarifa (R$/kWh)" value={simKwhPrice} step="0.01" onChange={setSimKwhPrice} />
                <NumberField label="Depreciação (R$/h)" value={simDepreciation} step="0.05" onChange={setSimDepreciation} />
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Custo Total</span>
                  <span className="text-3xl font-black text-foreground block mt-1 font-mono">{brl(sim.total)}</span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                  <div className="h-full bg-cyan-500" style={{ width: `${sim.materialPct}%` }} />
                  <div className="h-full bg-amber-500" style={{ width: `${sim.powerPct}%` }} />
                  <div className="h-full bg-purple-500" style={{ width: `${sim.deprecPct}%` }} />
                </div>
                <div className="space-y-2 text-xs">
                  <Legend color="bg-cyan-500" label={`Insumo (${sim.materialPct}%)`} value={brl(sim.material)} />
                  <Legend color="bg-amber-500" label={`Energia (${sim.powerPct}%)`} value={brl(sim.power)} />
                  <Legend color="bg-purple-500" label={`Depreciação (${sim.deprecPct}%)`} value={brl(sim.deprec)} />
                </div>
                <Button className="w-full h-8 rounded-lg gap-1.5 text-xs font-bold" onClick={() => {
                  localStorage.setItem("gltech_prefill_os", JSON.stringify({ title: "Simulação Customizada de Peça", notes: `Simulado: ${simWeight}g, ${simHours}h, ${simWattage}W`, total: sim.total * 1.5 }));
                  toast.success("Orçamento gerado! Parâmetros copiados.");
                  window.location.href = "/app/service-orders";
                }}>
                  <Receipt size={13} /> Copiar e Gerar OS
                </Button>
              </div>
            </div>
          </Card>

          {/* Projects grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => {
              const filCost = calcFilament(p), energyCost = calcEnergy(p), deprec = calcDeprec(p), total = calcTotal(p);
              const matPct = total ? Math.round((filCost / total) * 100) : 0;
              const pwrPct = total ? Math.round((energyCost / total) * 100) : 0;
              const depPct = 100 - matPct - pwrPct;
              return (
                <Card key={p.id} className="group rounded-xl border border-border bg-surface overflow-hidden hover:-translate-y-1 hover:shadow-md transition-all duration-200 flex flex-col">
                  <div className="p-5 border-b border-border/40 bg-accent/[0.02]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent border border-accent/20">
                        <Cube size={18} weight="duotone" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {p.filamentType && <Badge variant="neutral" className="text-[9px] font-bold py-0.5 px-2">{p.filamentType}</Badge>}
                        <button onClick={() => handleDeleteProject(p.id)} aria-label="Excluir projeto"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 p-1 rounded-md">
                          <Trash size={12} />
                        </button>
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-foreground mt-3 leading-snug">{p.name}</h3>
                    {p.description && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{p.description}</p>}
                  </div>
                  <div className="p-4 border-b border-border/40 grid grid-cols-2 gap-3 text-[10px] bg-muted/20">
                    <Spec label="Altura Camada" value={`${p.layerHeight} mm`} />
                    <Spec label="Preenchimento" value={p.infill || "—"} />
                    <Spec label="Velocidade" value={`${p.speed} mm/s`} />
                    <Spec label="Bico / Mesa" value={`${p.nozzleTemp}°C / ${p.bedTemp}°C`} />
                  </div>
                  <div className="px-5 pt-4 space-y-1.5 text-[10px]">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider block">Distribuição de Custo:</span>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                      <div className="bg-cyan-500" style={{ width: `${matPct}%` }} />
                      <div className="bg-amber-500" style={{ width: `${pwrPct}%` }} />
                      <div className="bg-purple-500" style={{ width: `${depPct}%` }} />
                    </div>
                  </div>
                  <div className="p-5 pt-3 space-y-2 text-xs flex-1 flex flex-col">
                    <Legend color="" label={`Insumo (${p.weightGrams}g)`} value={brl(filCost)} muted />
                    <Legend color="" label={`Energia (${p.printHours}h)`} value={brl(energyCost)} muted />
                    <Legend color="" label="Depreciação" value={brl(deprec)} muted />
                    <div className="flex justify-between items-center pt-2 border-t border-border/40 font-extrabold text-foreground">
                      <span>Custo de Fabricação:</span>
                      <span className="text-accent font-mono">{brl(total)}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleSendToOS(p)}
                      className="w-full h-8 rounded-lg text-xs font-bold mt-auto hover:bg-accent hover:text-white">
                      Criar OS deste Projeto
                    </Button>
                  </div>
                </Card>
              );
            })}

            {/* Add project card */}
            <button
              onClick={() => setProjectDialogOpen(true)}
              className="rounded-xl border border-dashed border-border bg-transparent p-6 flex flex-col items-center justify-center text-center hover:bg-muted/30 transition-colors group min-h-[200px]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent border border-dashed border-accent/30 group-hover:scale-105 transition-transform">
                <Plus size={22} />
              </div>
              <h3 className="text-xs font-bold text-foreground mt-3">Novo Projeto Técnico</h3>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px] leading-relaxed">Cadastre os parâmetros de fatiamento e custos de uma peça.</p>
            </button>
          </div>
        </div>
      )}

      {activeTab === "whiteboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-5 rounded-xl border border-border bg-surface flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Anotações Rápidas</h3>
                <p className="text-[11px] text-muted-foreground mb-4">Templates para agilizar anotações técnicas da oficina.</p>
                <div className="space-y-2.5">
                  <Button variant="outline" className="w-full justify-start text-[11px] h-8 rounded-lg gap-2 border-cyan-500/10 hover:bg-cyan-500/5 text-cyan-600 dark:text-cyan-400" onClick={() => applyTemplate("slicer")}>
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" /> Perfil de Fatiamento
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-[11px] h-8 rounded-lg gap-2 border-rose-500/10 hover:bg-rose-500/5 text-rose-600 dark:text-rose-400" onClick={() => applyTemplate("hardware")}>
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Manutenção de Impressora
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-[11px] h-8 rounded-lg gap-2 border-amber-500/10 hover:bg-amber-500/5 text-amber-600 dark:text-amber-500" onClick={() => applyTemplate("reminder")}>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Estufa &amp; Armazenagem
                  </Button>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground mt-4 block border-t pt-2">As notas ficam salvas no banco, por organização.</span>
            </Card>

            <Card className="lg:col-span-2 p-5 rounded-xl border border-border bg-surface">
              <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5"><Sparkle size={16} className="text-accent" /> Criar Nota no Quadro</h2>
              <form onSubmit={handleAddNote} className="space-y-3.5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-xs">
                    <Label htmlFor="post-title" className="font-semibold">Assunto</Label>
                    <Input id="post-title" placeholder="Ex: Tensão de Correia CoreXY" value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} className="h-9 rounded-lg" />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <Label className="font-semibold mb-1">Cor</Label>
                    <div className="flex gap-2 h-9 items-center">
                      {(["yellow", "pink", "blue", "green"] as const).map((col) => (
                        <button key={col} type="button" onClick={() => setNewPostColor(col)}
                          className={`h-6 w-6 rounded-full border shadow-2xs transition-all ${newPostColor === col ? "ring-2 ring-accent border-transparent scale-110" : "border-border"} ${
                            col === "yellow" ? "bg-amber-100 dark:bg-amber-500/20" : col === "pink" ? "bg-rose-100 dark:bg-rose-500/20" : col === "blue" ? "bg-sky-100 dark:bg-sky-500/20" : "bg-emerald-100 dark:bg-emerald-500/20"}`} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <Label htmlFor="post-content" className="font-semibold">Conteúdo</Label>
                  <textarea id="post-content" rows={2} placeholder="Ex: Ajustar folga do trilho linear..." value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface p-2 text-xs outline-hidden focus:ring-2 focus:ring-accent/20" />
                </div>
                <div className="flex justify-end pt-1">
                  <Button type="submit" size="sm" className="h-9 rounded-lg px-4 gap-1.5 font-bold"><Plus size={14} weight="bold" /> Adicionar ao Quadro</Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Quadro branco LIVRE — notas soltas numa malha 3D estilo AutoCAD; arraste, pan e zoom. */}
          <Card className="p-4 rounded-xl border border-border bg-surface">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">Arraste as notas livremente no plano. Arraste o fundo para mover a visão.</span>
              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
                <button onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} className="h-7 w-7 rounded-md text-sm font-bold text-muted-foreground hover:bg-surface hover:text-foreground" title="Diminuir zoom">−</button>
                <span className="w-11 text-center text-[11px] font-mono font-semibold tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))} className="h-7 w-7 rounded-md text-sm font-bold text-muted-foreground hover:bg-surface hover:text-foreground" title="Aumentar zoom">+</button>
                <button onClick={resetView} className="ml-0.5 h-7 rounded-md px-2 text-[11px] font-semibold text-muted-foreground hover:bg-surface hover:text-foreground" title="Centralizar visão">Reset</button>
              </div>
            </div>

            {/* Viewport (arrastar o fundo = pan) */}
            <div
              className="relative h-[560px] w-full overflow-hidden rounded-xl border border-border/60 bg-[#0b1120]"
              onPointerDown={onBoardPointerDown}
              onPointerMove={onBoardPointerMove}
              onPointerUp={onBoardPointerUp}
              onPointerLeave={onBoardPointerUp}
              style={{ cursor: "grab", touchAction: "none" }}
            >
              {/* Malha 3D em perspectiva (chão em fuga) — decorativa, sem capturar o ponteiro */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden style={{ perspective: "760px", perspectiveOrigin: "50% 0%" }}>
                <div
                  className="absolute left-1/2 top-[38%] h-[220%] w-[320%] -translate-x-1/2"
                  style={{
                    transform: "rotateX(64deg)",
                    transformOrigin: "50% 0%",
                    backgroundImage:
                      "linear-gradient(to right, rgba(56,189,248,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.16) 1px, transparent 1px)",
                    backgroundSize: "44px 44px",
                    maskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 62%, transparent 92%)",
                    WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 62%, transparent 92%)",
                  }}
                />
                {/* brilho de horizonte + eixo central p/ orientação */}
                <div className="absolute inset-x-0 top-[36%] h-24 bg-gradient-to-b from-sky-500/10 to-transparent" />
              </div>

              {/* Mundo: pan + zoom; notas em posição absoluta no plano */}
              <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
                {notes.map((p, i) => {
                  const pos = posOf(p, i);
                  const cls =
                    p.color === "pink" ? "bg-rose-100/95 text-rose-950 border-rose-300/60 dark:bg-rose-950/40 dark:text-rose-100 dark:border-rose-900/50" :
                    p.color === "blue" ? "bg-sky-100/95 text-sky-950 border-sky-300/60 dark:bg-sky-950/40 dark:text-sky-100 dark:border-sky-900/50" :
                    p.color === "green" ? "bg-emerald-100/95 text-emerald-950 border-emerald-300/60 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-900/50" :
                    "bg-amber-100/95 text-amber-950 border-amber-300/60 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-900/50";
                  return (
                    <div
                      key={p.id}
                      onPointerDown={(e) => onNotePointerDown(e, p, i)}
                      onPointerMove={onNotePointerMove}
                      onPointerUp={onNotePointerUp}
                      className={`group absolute w-52 select-none cursor-grab rounded-lg border p-3 shadow-lg transition-shadow hover:shadow-xl active:cursor-grabbing ${cls} ${dragNoteId === p.id ? "z-10 ring-2 ring-accent" : ""}`}
                      style={{ left: pos.x, top: pos.y, touchAction: "none" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xs font-bold tracking-tight">{p.title}</h3>
                        <button onPointerDown={(e) => e.stopPropagation()} onClick={() => handleDeleteNote(p.id)} className="opacity-30 group-hover:opacity-100 transition-opacity p-0.5" aria-label="Deletar nota"><Trash size={11} /></button>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-[11px] font-medium leading-relaxed">{p.content}</p>
                      <div className="mt-2 pt-1.5 border-t border-current/10 text-right text-[9px] font-mono opacity-60">{new Date(p.createdAt).toLocaleDateString("pt-BR")}</div>
                    </div>
                  );
                })}
                {notes.length === 0 && (
                  <div className="absolute left-10 top-10 text-xs text-sky-200/70">O quadro está vazio. Crie uma nota acima — ela aparece aqui para você arrastar.</div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      <NewProjectDialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen} onSaved={() => { setProjectDialogOpen(false); router.refresh(); }} />
    </div>
  );
}

// ── Small building blocks ──
function Metric({ label, value, sub, icon: Icon, cls, capitalize }: { label: string; value: string; sub: string; icon: typeof Cube; cls: string; capitalize?: boolean }) {
  return (
    <Card className="p-4 rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        <Icon size={14} className={cls} />
      </div>
      <span className={`mt-2 block text-2xl font-extrabold text-foreground tabular-nums truncate ${capitalize ? "capitalize" : ""}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground block mt-0.5">{sub}</span>
    </Card>
  );
}
function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground block uppercase font-bold tracking-wider">{label}</span>
      <span className="font-bold text-foreground mt-0.5 block">{value}</span>
    </div>
  );
}
function Legend({ color, label, value, muted }: { color: string; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between items-center text-muted-foreground text-[11px]">
      <span className="flex items-center gap-1.5 font-medium">{color && <span className={`h-2 w-2 rounded-full ${color}`} />}{label}</span>
      <span className={`font-bold font-mono ${muted ? "text-foreground" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
function SliderField({ label, value, suffix, min, max, step, onChange }: { label: string; value: number; suffix: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between font-semibold"><Label>{label}</Label><span className="text-accent font-mono">{value}{suffix}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-accent" />
    </div>
  );
}
function NumberField({ label, value, step, onChange }: { label: string; value: number; step?: string; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 rounded-lg text-xs" />
    </div>
  );
}

function NewProjectDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({
    name: "", filamentType: "PLA", weightGrams: "100", printHours: "5", layerHeight: "0.2", infill: "15% Gyroid",
    speed: "200", nozzleTemp: "210", bedTemp: "60", filamentCostPerKg: "130", wattage: "300", kwhPrice: "0.85",
    depreciationPerHour: "0.5", description: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  function submit() {
    if (!f.name.trim()) return toast.error("Informe o nome do projeto");
    startTransition(async () => {
      const res = await createProject({
        name: f.name.trim(), filamentType: f.filamentType, weightGrams: Number(f.weightGrams) || 0,
        printHours: Number(f.printHours) || 0, layerHeight: Number(f.layerHeight) || 0.2, infill: f.infill,
        speed: Number(f.speed) || 0, nozzleTemp: Number(f.nozzleTemp) || 0, bedTemp: Number(f.bedTemp) || 0,
        filamentCostPerKg: Number(f.filamentCostPerKg) || 0, wattage: Number(f.wattage) || 0,
        kwhPrice: Number(f.kwhPrice) || 0.85, depreciationPerHour: Number(f.depreciationPerHour) || 0,
        description: f.description,
      });
      if (!res.ok) { toast.error(res.error || "Erro ao criar projeto"); return; }
      toast.success("Projeto criado.");
      setF((prev) => ({ ...prev, name: "", description: "" }));
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-xl border border-border bg-surface text-xs max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-sm font-bold text-foreground">Novo Projeto Técnico</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>Nome</Label><Input value={f.name} onChange={set("name")} placeholder="Ex: Foguete TVC Estágio 1" className="h-9 rounded-lg" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Filamento</Label><Input value={f.filamentType} onChange={set("filamentType")} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Preenchimento</Label><Input value={f.infill} onChange={set("infill")} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Peso (g)</Label><Input inputMode="decimal" value={f.weightGrams} onChange={set("weightGrams")} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Tempo (h)</Label><Input inputMode="decimal" value={f.printHours} onChange={set("printHours")} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Camada (mm)</Label><Input inputMode="decimal" value={f.layerHeight} onChange={set("layerHeight")} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Velocidade (mm/s)</Label><Input inputMode="numeric" value={f.speed} onChange={set("speed")} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Bico (°C)</Label><Input inputMode="numeric" value={f.nozzleTemp} onChange={set("nozzleTemp")} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Mesa (°C)</Label><Input inputMode="numeric" value={f.bedTemp} onChange={set("bedTemp")} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Custo insumo (R$/kg)</Label><Input inputMode="decimal" value={f.filamentCostPerKg} onChange={set("filamentCostPerKg")} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Consumo (W)</Label><Input inputMode="numeric" value={f.wattage} onChange={set("wattage")} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Tarifa (R$/kWh)</Label><Input inputMode="decimal" value={f.kwhPrice} onChange={set("kwhPrice")} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Depreciação (R$/h)</Label><Input inputMode="decimal" value={f.depreciationPerHour} onChange={set("depreciationPerHour")} className="h-9 rounded-lg" /></div>
          </div>
          <div className="space-y-1.5"><Label>Descrição</Label><Input value={f.description} onChange={set("description")} placeholder="Notas do projeto..." className="h-9 rounded-lg" /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" className="rounded-lg text-xs font-semibold" onClick={submit} disabled={pending}>{pending ? "Salvando..." : "Criar projeto"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
