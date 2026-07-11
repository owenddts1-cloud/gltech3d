"use client";

import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Cube, 
  Trash, 
  Plus, 
  Sparkle,
  Calculator,
  Clock,
  Receipt,
} from "@/lib/ui/icons";
import { toast } from "sonner";

interface TechnicalProject {
  id: string;
  name: string;
  filamentType: string;
  weightGrams: number;
  printHours: number;
  layerHeight: number;
  infill: string;
  speed: number;
  nozzleTemp: number;
  bedTemp: number;
  description: string;
  filamentCostPerKg: number;
  wattage: number;
  kwhPrice: number;
  depreciationPerHour: number;
}

interface PostIt {
  id: string;
  title: string;
  content: string;
  color: "yellow" | "pink" | "blue" | "green";
  createdAt: string;
}

const INITIAL_PROJECTS: TechnicalProject[] = [
  {
    id: "proj-1",
    name: "Foguete Modelo TVC - Estágio 1",
    filamentType: "PETG Carbon",
    weightGrams: 340,
    printHours: 14.5,
    layerHeight: 0.20,
    infill: "15% Gyroid",
    speed: 180,
    nozzleTemp: 245,
    bedTemp: 80,
    description: "Foguete aerodinâmico com montagem de servo TVC de alta resistência térmica.",
    filamentCostPerKg: 180,
    wattage: 350,
    kwhPrice: 0.85,
    depreciationPerHour: 0.60
  },
  {
    id: "proj-2",
    name: "Articulado Dragão Dragaozinho",
    filamentType: "PLA Silk Dual",
    weightGrams: 160,
    printHours: 8.2,
    layerHeight: 0.16,
    infill: "10% Lightning",
    speed: 250,
    nozzleTemp: 210,
    bedTemp: 60,
    description: "Brinquedo decorativo articulado de grande apelo visual para vendas na Shopee.",
    filamentCostPerKg: 130,
    wattage: 280,
    kwhPrice: 0.85,
    depreciationPerHour: 0.40
  },
  {
    id: "proj-3",
    name: "Suporte de Celular MagSafe",
    filamentType: "ABS Premium",
    weightGrams: 85,
    printHours: 3.8,
    layerHeight: 0.20,
    infill: "40% Grid",
    speed: 150,
    nozzleTemp: 255,
    bedTemp: 100,
    description: "Suporte rígido automotivo projetado para resistir à exposição solar de painéis.",
    filamentCostPerKg: 110,
    wattage: 380,
    kwhPrice: 0.85,
    depreciationPerHour: 0.50
  }
];

const INITIAL_POSTITS: PostIt[] = [
  {
    id: "post-1",
    title: "Bico Aço Temperado",
    content: "Comprar bico de 0.6mm de aço temperado para imprimir os filamentos de fibra de carbono sem entupir.",
    color: "pink",
    createdAt: new Date().toISOString()
  },
  {
    id: "post-2",
    title: "Carretel de 2KG",
    content: "Projetar no Fusion 360 um extensor de spool do gabinete da Bambu para caber bobinas maiores de 2kg.",
    color: "yellow",
    createdAt: new Date().toISOString()
  },
  {
    id: "post-3",
    title: "Retração TPU",
    content: "Diminuir velocidade de retração para 20mm/s no perfil de TPU da impressora K1 para evitar que embole na extrusora.",
    color: "blue",
    createdAt: new Date().toISOString()
  }
];

// Cost calculator helpers
const calculateFilamentCost = (p: { weightGrams: number; filamentCostPerKg: number }) => {
  return (p.weightGrams * (p.filamentCostPerKg / 1000));
};

const calculateElectricityCost = (p: { wattage: number; printHours: number; kwhPrice: number }) => {
  return ((p.wattage / 1000) * p.printHours * p.kwhPrice);
};

const calculateDepreciation = (p: { printHours: number; depreciationPerHour: number }) => {
  return (p.printHours * p.depreciationPerHour);
};

const calculateTotalCost = (p: { weightGrams: number; filamentCostPerKg: number; wattage: number; printHours: number; kwhPrice: number; depreciationPerHour: number }) => {
  return calculateFilamentCost(p) + calculateElectricityCost(p) + calculateDepreciation(p);
};

export default function ProjectsPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"projects" | "whiteboard">("projects");
  const [projects, setProjects] = useState<TechnicalProject[]>(INITIAL_PROJECTS);
  const [postIts, setPostIts] = useState<PostIt[]>(INITIAL_POSTITS);

  // Live Simulator States
  const [simWeight, setSimWeight] = useState(250);
  const [simHours, setSimHours] = useState(10);
  const [simFilamentCost, setSimFilamentCost] = useState(140);
  const [simWattage, setSimWattage] = useState(300);
  const [simKwhPrice, setSimKwhPrice] = useState(0.85);
  const [simDepreciation, setSimDepreciation] = useState(0.50);

  // New PostIt form state
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostColor, setNewPostColor] = useState<"yellow" | "pink" | "blue" | "green">("yellow");

  // Load from local storage if exists
  useEffect(() => {
    setMounted(true);
    const savedPostIts = localStorage.getItem("gltech-whiteboard-notes");
    if (savedPostIts) {
      try {
        setPostIts(JSON.parse(savedPostIts));
      } catch (e) {
        console.error("Erro ao carregar post-its", e);
      }
    }
    const savedProjects = localStorage.getItem("gltech-projects-list");
    if (savedProjects) {
      try {
        setProjects(JSON.parse(savedProjects));
      } catch (e) {
        console.error("Erro ao carregar projetos", e);
      }
    }
  }, []);

  // Save changes
  const savePostIts = (updated: PostIt[]) => {
    setPostIts(updated);
    localStorage.setItem("gltech-whiteboard-notes", JSON.stringify(updated));
  };

  const handleAddPostIt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      return toast.error("Por favor, preencha o título e conteúdo do post-it.");
    }
    const newNote: PostIt = {
      id: `post-${Date.now()}`,
      title: newPostTitle.trim(),
      content: newPostContent.trim(),
      color: newPostColor,
      createdAt: new Date().toISOString()
    };
    const updated = [newNote, ...postIts];
    savePostIts(updated);
    setNewPostTitle("");
    setNewPostContent("");
    toast.success("Nota adicionada ao quadro branco!");
  };

  const applyPostItTemplate = (type: "slicer" | "hardware" | "reminder") => {
    if (type === "slicer") {
      setNewPostTitle("Ajuste de Retração PLA");
      setNewPostContent("Usar retração de 0.8mm a 45mm/s para filamento PLA Premium no bico direct drive.");
      setNewPostColor("blue");
    } else if (type === "hardware") {
      setNewPostTitle("Tensão de Correia K1");
      setNewPostContent("Apertar correia do eixo X/Y usando tensor manual para remover linhas de ringing nas impressões rápidas.");
      setNewPostColor("pink");
    } else {
      setNewPostTitle("Lembrete Secagem TPU");
      setNewPostContent("Deixar filamento TPU na estufa de secagem a 55°C por pelo menos 6 horas antes de iniciar o job.");
      setNewPostColor("yellow");
    }
    toast.success("Template aplicado no formulário!");
  };

  const handleDeletePostIt = (id: string) => {
    const updated = postIts.filter((p) => p.id !== id);
    savePostIts(updated);
    toast.success("Nota removida do quadro.");
  };



  // Live simulator computations
  const simulatorResults = useMemo(() => {
    const filamentParams = { weightGrams: simWeight, filamentCostPerKg: simFilamentCost };
    const powerParams = { wattage: simWattage, printHours: simHours, kwhPrice: simKwhPrice };
    const deprecParams = { printHours: simHours, depreciationPerHour: simDepreciation };

    const material = calculateFilamentCost(filamentParams);
    const power = calculateElectricityCost(powerParams);
    const deprec = calculateDepreciation(deprecParams);
    const total = material + power + deprec;

    const materialPct = total > 0 ? Math.round((material / total) * 100) : 0;
    const powerPct = total > 0 ? Math.round((power / total) * 100) : 0;
    const deprecPct = total > 0 ? Math.round((deprec / total) * 100) : 0;

    return { material, power, deprec, total, materialPct, powerPct, deprecPct };
  }, [simWeight, simHours, simFilamentCost, simWattage, simKwhPrice, simDepreciation]);

  // Overall metadata metrics
  const summaryMetrics = useMemo(() => {
    const totalProjects = projects.length;
    const avgHours = projects.reduce((acc, p) => acc + p.printHours, 0) / (totalProjects || 1);
    const avgCost = projects.reduce((acc, p) => acc + calculateTotalCost(p), 0) / (totalProjects || 1);
    const infillTypes = projects.map(p => p.infill.split(" ")[1] ?? "Gyroid");
    const popularInfill = infillTypes.sort((a,b) =>
      infillTypes.filter(v => v===a).length - infillTypes.filter(v => v===b).length
    ).pop() ?? "Gyroid";

    return { totalProjects, avgHours: avgHours.toFixed(1), avgCost, popularInfill };
  }, [projects]);

  const brl = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const handleSendToOS = (p: TechnicalProject) => {
    toast.success(`Parâmetros de "${p.name}" copiados! Redirecionando para abrir Ordem de Serviço.`);
    // Save to local storage for quick access in OS form
    localStorage.setItem("gltech_prefill_os", JSON.stringify({
      title: `Fabricação: ${p.name}`,
      notes: `${p.filamentType}, Preenchimento ${p.infill}, Camada ${p.layerHeight}mm`,
      total: calculateTotalCost(p) * 1.5, // 50% margin
    }));
    window.location.href = "/app/service-orders";
  };

  if (!mounted) {
    return (
      <div className="space-y-6 p-6 mx-auto max-w-7xl">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 mx-auto max-w-7xl animate-in fade-in duration-300">
      {/* ─── Premium Header ─── */}
      <header className="relative overflow-hidden rounded-xl border border-border bg-surface p-6">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-24" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent border border-accent/20 shadow-sm animate-pulse-subtle">
              <Cube size={26} weight="duotone" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Projetos & Engenharia</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Especificações técnicas de fatiamento, calculadora avançada de custos reais e quadro de brainstorming.
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex rounded-lg border border-border bg-surface p-1 shadow-2xs">
            <button
              onClick={() => setActiveTab("projects")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === "projects"
                  ? "bg-accent-soft text-accent"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Fatiamento & Custos
            </button>
            <button
              onClick={() => setActiveTab("whiteboard")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === "whiteboard"
                  ? "bg-accent-soft text-accent"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Quadro de Ideias
            </button>
          </div>
        </div>
      </header>

      {/* ─── TAB CONTENT: PROJECTS ─── */}
      {activeTab === "projects" && (
        <div className="space-y-6">
          
          {/* Quick Metrics Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 rounded-xl border border-border bg-surface">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">Projetos Ativos</span>
                <Cube size={14} className="text-primary" />
              </div>
              <span className="mt-2 block text-2xl font-extrabold text-foreground tabular-nums">
                {summaryMetrics.totalProjects}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">protótipos parametrizados</span>
            </Card>

            <Card className="p-4 rounded-xl border border-border bg-surface">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">Custo Médio Real</span>
                <Receipt size={14} className="text-emerald-500" />
              </div>
              <span className="mt-2 block text-2xl font-extrabold text-foreground tabular-nums">
                {brl(summaryMetrics.avgCost)}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">insumos + luz + depreciação</span>
            </Card>

            <Card className="p-4 rounded-xl border border-border bg-surface">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">Tempo Médio de Job</span>
                <Clock size={14} className="text-amber-500" />
              </div>
              <span className="mt-2 block text-2xl font-extrabold text-foreground tabular-nums">
                {summaryMetrics.avgHours}h
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">por ciclo de fabricação</span>
            </Card>

            <Card className="p-4 rounded-xl border border-border bg-surface">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">Padrão de Infill</span>
                <Sparkle size={14} className="text-purple-500" />
              </div>
              <span className="mt-2 block text-2xl font-extrabold text-foreground truncate capitalize">
                {summaryMetrics.popularInfill}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">geometria mais calculada</span>
            </Card>
          </div>

          {/* Interactive Cost Simulator Widget */}
          <Card className="p-5 rounded-xl border border-border bg-surface">
            <div className="flex items-center gap-2 mb-4 border-b border-border/40 pb-3">
              <Calculator size={18} className="text-accent" />
              <div>
                <h2 className="text-sm font-bold text-foreground">Live Prototyper - Simulador de Faturamento & Custos</h2>
                <p className="text-[11px] text-muted-foreground">Simule os parâmetros reais antes de aprovar a ordem de serviço do cliente</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Sliders and Inputs */}
              <div className="lg:col-span-2 space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Weight Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-semibold">
                      <Label htmlFor="sim-weight">Peso da Peça (Gramas)</Label>
                      <span className="text-accent font-mono">{simWeight}g</span>
                    </div>
                    <input
                      id="sim-weight"
                      type="range"
                      min="5"
                      max="1500"
                      step="5"
                      value={simWeight}
                      onChange={(e) => setSimWeight(Number(e.target.value))}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                  </div>

                  {/* Print Hours Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-semibold">
                      <Label htmlFor="sim-hours">Tempo de Impressão (Horas)</Label>
                      <span className="text-accent font-mono">{simHours}h</span>
                    </div>
                    <input
                      id="sim-hours"
                      type="range"
                      min="0.5"
                      max="120"
                      step="0.5"
                      value={simHours}
                      onChange={(e) => setSimHours(Number(e.target.value))}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                  </div>

                  {/* Filament cost / kg */}
                  <div className="space-y-1.5">
                    <Label htmlFor="sim-fil-cost">Preço do Insumo (R$ por Kg)</Label>
                    <Input
                      id="sim-fil-cost"
                      type="number"
                      value={simFilamentCost}
                      onChange={(e) => setSimFilamentCost(Number(e.target.value))}
                      className="h-8 rounded-lg text-xs"
                    />
                  </div>

                  {/* Machine consumption */}
                  <div className="space-y-1.5">
                    <Label htmlFor="sim-wattage">Consumo Médio da Impressora (Watts)</Label>
                    <Input
                      id="sim-wattage"
                      type="number"
                      value={simWattage}
                      onChange={(e) => setSimWattage(Number(e.target.value))}
                      className="h-8 rounded-lg text-xs"
                    />
                  </div>

                  {/* Kwh Price */}
                  <div className="space-y-1.5">
                    <Label htmlFor="sim-kwh">Tarifa de Energia (R$ por kWh)</Label>
                    <Input
                      id="sim-kwh"
                      type="number"
                      step="0.01"
                      value={simKwhPrice}
                      onChange={(e) => setSimKwhPrice(Number(e.target.value))}
                      className="h-8 rounded-lg text-xs"
                    />
                  </div>

                  {/* Depreciation */}
                  <div className="space-y-1.5">
                    <Label htmlFor="sim-deprec">Depreciação de Hardware (R$ por Hora)</Label>
                    <Input
                      id="sim-deprec"
                      type="number"
                      step="0.05"
                      value={simDepreciation}
                      onChange={(e) => setSimDepreciation(Number(e.target.value))}
                      className="h-8 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic breakdown pie/progress cards */}
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Custo Total de Fabricação</span>
                  <span className="text-3xl font-black text-foreground block mt-1 font-mono">
                    {brl(simulatorResults.total)}
                  </span>
                </div>

                {/* Segmented bar breakdown */}
                <div className="space-y-3 text-xs">
                  <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                    <div 
                      className="h-full bg-cyan-500" 
                      style={{ width: `${simulatorResults.materialPct}%` }}
                      title={`Filamento: ${simulatorResults.materialPct}%`}
                    />
                    <div 
                      className="h-full bg-amber-500" 
                      style={{ width: `${simulatorResults.powerPct}%` }}
                      title={`Eletricidade: ${simulatorResults.powerPct}%`}
                    />
                    <div 
                      className="h-full bg-purple-500" 
                      style={{ width: `${simulatorResults.deprecPct}%` }}
                      title={`Depreciação: ${simulatorResults.deprecPct}%`}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="h-2 w-2 rounded-full bg-cyan-500" />
                        Insumo ({simulatorResults.materialPct}%)
                      </span>
                      <span className="font-bold text-foreground font-mono">{brl(simulatorResults.material)}</span>
                    </div>

                    <div className="flex justify-between items-center text-muted-foreground">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Energia ({simulatorResults.powerPct}%)
                      </span>
                      <span className="font-bold text-foreground font-mono">{brl(simulatorResults.power)}</span>
                    </div>

                    <div className="flex justify-between items-center text-muted-foreground">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="h-2 w-2 rounded-full bg-purple-500" />
                        Depreciação ({simulatorResults.deprecPct}%)
                      </span>
                      <span className="font-bold text-foreground font-mono">{brl(simulatorResults.deprec)}</span>
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full h-8 rounded-lg bg-accent text-white font-bold text-xs gap-1.5"
                  onClick={() => {
                    toast.success("Orçamento gerado! Parâmetros copiados.");
                    localStorage.setItem("gltech_prefill_os", JSON.stringify({
                      title: "Simulação Customizada de Peça",
                      notes: `Simulado: ${simWeight}g, Tempo: ${simHours}h, Consumo: ${simWattage}W`,
                      total: simulatorResults.total * 1.5, // 50% profit markup
                    }));
                    window.location.href = "/app/service-orders";
                  }}
                >
                  <Receipt size={13} />
                  Copiar e Gerar OS
                </Button>
              </div>
            </div>
          </Card>

          {/* Active Projects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => {
              const filCost = calculateFilamentCost(p);
              const energyCost = calculateElectricityCost(p);
              const deprec = calculateDepreciation(p);
              const totalCost = calculateTotalCost(p);

              const matPct = Math.round((filCost / totalCost) * 100);
              const pwrPct = Math.round((energyCost / totalCost) * 100);
              const depPct = 100 - matPct - pwrPct;

              return (
                <Card 
                  key={p.id} 
                  className="rounded-xl border border-border bg-surface overflow-hidden hover:-translate-y-1 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                >
                  {/* Visual Header */}
                  <div className="p-5 border-b border-border/40 bg-accent/[0.02]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent border border-accent/20">
                        <Cube size={18} weight="duotone" />
                      </div>
                      <Badge variant="neutral" className="text-[9px] font-bold py-0.5 px-2 bg-muted border text-muted-foreground">
                        {p.filamentType}
                      </Badge>
                    </div>
                    <h3 className="text-sm font-bold text-foreground mt-3 leading-snug">
                      {p.name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                  </div>

                  {/* Slicer Settings Grid */}
                  <div className="p-4 border-b border-border/40 grid grid-cols-2 gap-3 text-[10px] bg-muted/20">
                    <div>
                      <span className="text-muted-foreground block uppercase font-bold tracking-wider">Altura Camada</span>
                      <span className="font-bold text-foreground mt-0.5 block">{p.layerHeight} mm</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block uppercase font-bold tracking-wider">Preenchimento</span>
                      <span className="font-bold text-foreground mt-0.5 block">{p.infill}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block uppercase font-bold tracking-wider">Velocidade</span>
                      <span className="font-bold text-foreground mt-0.5 block">{p.speed} mm/s</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block uppercase font-bold tracking-wider">Bico / Mesa</span>
                      <span className="font-bold text-foreground mt-0.5 block">{p.nozzleTemp}°C / {p.bedTemp}°C</span>
                    </div>
                  </div>

                  {/* Cost breakdown progress bar */}
                  <div className="px-5 pt-4 space-y-1.5 text-[10px]">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider block">Distribuição de Custo:</span>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                      <div className="bg-cyan-500" style={{ width: `${matPct}%` }} title={`Filamento: ${matPct}%`} />
                      <div className="bg-amber-500" style={{ width: `${pwrPct}%` }} title={`Eletricidade: ${pwrPct}%`} />
                      <div className="bg-purple-500" style={{ width: `${depPct}%` }} title={`Depreciação: ${depPct}%`} />
                    </div>
                  </div>

                  {/* Cost Breakdown Details */}
                  <div className="p-5 pt-3 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                      <span>Insumo ({p.weightGrams}g):</span>
                      <span className="font-medium text-foreground font-mono">{brl(filCost)}</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                      <span>Energia ({p.printHours}h):</span>
                      <span className="font-medium text-foreground font-mono">{brl(energyCost)}</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                      <span>Depreciação:</span>
                      <span className="font-medium text-foreground font-mono">{brl(deprec)}</span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-border/40 font-extrabold text-foreground">
                      <span>Custo de Fabricação:</span>
                      <span className="text-xs text-accent font-mono font-bold">{brl(totalCost)}</span>
                    </div>

                    {/* Integrated CTA */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendToOS(p)}
                      className="w-full h-8 rounded-lg text-xs font-bold mt-2 hover:bg-accent hover:text-white"
                    >
                      Criar OS deste Projeto
                    </Button>
                  </div>
                </Card>
              );
            })}

            {/* Slicer importer placeholder */}
            <Card className="rounded-xl border border-dashed border-border bg-transparent p-6 flex flex-col items-center justify-center text-center hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => toast.info("Funcionalidade de upload de arquivo 3D em desenvolvimento!")}>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent border border-dashed border-accent/30 group-hover:scale-105 transition-transform duration-200">
                <Plus size={22} />
              </div>
              <h3 className="text-xs font-bold text-foreground mt-3">Importar Fatiamento</h3>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px] leading-relaxed">
                Arraste arquivo <strong>STL</strong>, <strong>3MF</strong> ou perfil do fatiador para carregar pesos e velocidades.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* ─── TAB CONTENT: WHITEBOARD ─── */}
      {activeTab === "whiteboard" && (
        <div className="space-y-6">
          
          {/* Quick template triggers & note adding form */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Template helpers */}
            <Card className="p-5 rounded-xl border border-border bg-surface flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Anotações Rápidas</h3>
                <p className="text-[11px] text-muted-foreground mb-4">Insira templates pré-definidos para agilizar anotações técnicas e lembretes da oficina.</p>
                <div className="space-y-2.5">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-[11px] h-8 rounded-lg gap-2 border-cyan-500/10 hover:bg-cyan-500/5 text-cyan-600 dark:text-cyan-400"
                    onClick={() => applyPostItTemplate("slicer")}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    Perfil de Fatiamento (Cura)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-[11px] h-8 rounded-lg gap-2 border-rose-500/10 hover:bg-rose-500/5 text-rose-600 dark:text-rose-400"
                    onClick={() => applyPostItTemplate("hardware")}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    Manutenção de Impressora
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-[11px] h-8 rounded-lg gap-2 border-amber-500/10 hover:bg-amber-500/5 text-amber-600 dark:text-amber-500"
                    onClick={() => applyPostItTemplate("reminder")}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Estufa & Armazenagem
                  </Button>
                </div>
              </div>
              
              <span className="text-[10px] text-muted-foreground mt-4 block border-t pt-2">
                * As notas do quadro branco ficam salvas no seu navegador.
              </span>
            </Card>

            {/* Note creation form */}
            <Card className="lg:col-span-2 p-5 rounded-xl border border-border bg-surface">
              <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
                <Sparkle size={16} className="text-accent animate-pulse" />
                Criar Nota no Quadro Técnico
              </h2>
              
              <form onSubmit={handleAddPostIt} className="space-y-3.5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-xs">
                    <Label htmlFor="post-title" className="font-semibold">Assunto</Label>
                    <Input
                      id="post-title"
                      placeholder="Ex: Tensão de Correia CoreXY"
                      value={newPostTitle}
                      onChange={(e) => setNewPostTitle(e.target.value)}
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <Label className="font-semibold mb-1">Cor do Post-it</Label>
                    <div className="flex gap-2 h-9 items-center">
                      {(["yellow", "pink", "blue", "green"] as const).map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setNewPostColor(col)}
                          className={`h-6 w-6 rounded-full border shadow-2xs transition-all ${
                            newPostColor === col ? "ring-2 ring-accent border-transparent scale-110" : "border-border"
                          } ${
                            col === "yellow" ? "bg-amber-100 dark:bg-amber-500/20" :
                            col === "pink" ? "bg-rose-100 dark:bg-rose-500/20" :
                            col === "blue" ? "bg-sky-100 dark:bg-sky-500/20" : "bg-emerald-100 dark:bg-emerald-500/20"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <Label htmlFor="post-content" className="font-semibold">Conteúdo da Anotação</Label>
                  <textarea
                    id="post-content"
                    rows={2}
                    placeholder="Ex: Ajustar folga do trilho linear para evitar vibrações excessivas..."
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface p-2 text-xs outline-hidden focus:ring-2 focus:ring-accent/20"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <Button type="submit" size="sm" className="h-9 rounded-lg px-4 gap-1.5 font-bold bg-accent text-white hover:bg-accent/90">
                    <Plus size={14} weight="bold" />
                    <span>Adicionar ao Quadro</span>
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Whiteboard Board Cork Grid */}
          <div className="relative p-8 rounded-2xl border border-border/80 bg-muted/20 min-h-[350px]">
            {/* Grid dot pattern simulating technical noticeboard */}
            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
            
            <div className="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {postIts.map((p) => {
                const colorClasses = 
                  p.color === "pink" ? "bg-rose-100/90 text-rose-950 border-rose-300/60 dark:bg-rose-950/20 dark:text-rose-200 dark:border-rose-900/30" :
                  p.color === "blue" ? "bg-sky-100/90 text-sky-950 border-sky-300/60 dark:bg-sky-950/20 dark:text-sky-200 dark:border-sky-900/30" :
                  p.color === "green" ? "bg-emerald-100/90 text-emerald-950 border-emerald-300/60 dark:bg-emerald-950/20 dark:text-emerald-200 dark:border-emerald-900/30" :
                  "bg-amber-100/90 text-amber-950 border-amber-300/60 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-900/30";

                // Generate slight rotation based on title chars to mimic realistic whiteboard paper pins
                const rot = (p.title.length % 5) - 2;

                return (
                  <div 
                    key={p.id}
                    className={`p-5 rounded-xl border shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:rotate-0 flex flex-col justify-between ${colorClasses}`}
                    style={{ transform: `rotate(${rot}deg)` }}
                  >
                    {/* Metal pin indicator */}
                    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-slate-400/50 shadow-inner flex items-center justify-center border border-white/20">
                      <span className="h-1 w-1 bg-slate-600 rounded-full" />
                    </div>
                    
                    <div className="flex justify-between items-start gap-2 pt-2">
                      <h3 className="font-bold text-xs tracking-tight">{p.title}</h3>
                      <button
                        onClick={() => handleDeletePostIt(p.id)}
                        className="opacity-40 hover:opacity-100 transition-opacity p-0.5 rounded text-inherit"
                        aria-label="Deletar nota"
                      >
                        <Trash size={12} />
                      </button>
                    </div>

                    <p className="text-[11px] mt-3 leading-relaxed whitespace-pre-wrap font-medium flex-1">
                      {p.content}
                    </p>

                    <div className="mt-4 pt-2 border-t border-current/10 flex justify-between items-center text-[9px] opacity-65 font-semibold">
                      <span>Quadro de Ideias</span>
                      <span className="font-mono">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}

              {postIts.length === 0 && (
                <div className="col-span-full py-12 text-center">
                  <p className="text-xs text-muted-foreground">O quadro de ideias está vazio. Adicione um post-it acima!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
