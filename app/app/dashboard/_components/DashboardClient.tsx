"use client";

import { useState, startTransition, useTransition, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  Gauge,
  Printer,
  Package,
  ChartBar,
  ChartLineUp,
  Warning,
  Info,
  Clock,
  ArrowsClockwise,
  Plus,
  Play,
  Trash,
  CheckCircle,
  Gear
} from "@/lib/ui/icons";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { calculateRealCost } from "@/lib/pricing/engine";
import { savePrintersAndFilaments } from "@/app/actions/printers/actions";

interface PrinterItem {
  id: string;
  name: string;
  status: "idle" | "printing" | "error" | "offline";
  powerDraw: number;
  depreciationPerHour: number;
  activeFilamentId?: string | null;
  activePrintJob?: {
    filename: string;
    progress: number;
    timeElapsed: number;
    timeRemaining: number;
    filamentId: string;
    weightGrams: number;
  } | null;
}

interface FilamentItem {
  id: string;
  name: string;
  color: string;
  material: string;
  weightGrams: number;
  initialWeightGrams: number;
  costPerGram: number;
  minWeightAlert: number;
  supplier: string;
}

interface PrintJobItem {
  id: string;
  printerId: string;
  printerName: string;
  filename: string;
  weightGrams: number;
  printTimeSeconds: number;
  filamentId: string | null;
  filamentName: string;
  costs: {
    materialCost: number;
    energyCost: number;
    depreciationCost: number;
    totalCost: number;
  } | null;
  completedAt: string;
}

interface DashboardClientProps {
  initialData: {
    printers: PrinterItem[];
    filaments: FilamentItem[];
    printJobs: PrintJobItem[];
    kEnergy: number;
    orgId: string | null;
  };
}

function SpotlightCard({ children, className, ...props }: { children: React.ReactNode, className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isFocused, setIsFocused] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsFocused(true)}
      onMouseLeave={() => setIsFocused(false)}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-950/40 p-5 shadow-lg backdrop-blur-md transition-all duration-300",
        className
      )}
      {...props}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300"
        style={{
          opacity: isFocused ? 1 : 0,
          background: `radial-gradient(350px circle at ${coords.x}px ${coords.y}px, rgba(255, 107, 0, 0.15), transparent 80%)`,
        }}
      />
      {children}
    </div>
  );
}

// Utility classname merger
import { cn } from "@/lib/utils";

export function DashboardClient({ initialData }: DashboardClientProps) {
  const [printers, setPrinters] = useState<PrinterItem[]>(initialData.printers);
  const [filaments, setFilaments] = useState<FilamentItem[]>(initialData.filaments);
  const [printJobs, setPrintJobs] = useState<PrintJobItem[]>(initialData.printJobs);
  const [kEnergy, setKEnergy] = useState<number>(initialData.kEnergy);
  const [isPending, startSaveTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Modal / Form states
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [showAddFilament, setShowAddFilament] = useState(false);

  // New printer state
  const [newPrinter, setNewPrinter] = useState({
    name: "",
    status: "idle" as "idle" | "printing" | "error" | "offline",
    powerDraw: 200,
    depreciationPerHour: 0.40
  });

  // New filament state
  const [newFilament, setNewFilament] = useState({
    name: "",
    color: "#ff0000",
    material: "PLA",
    weightGrams: 1000,
    initialWeightGrams: 1000,
    costPerGram: 0.12,
    minWeightAlert: 150,
    supplier: ""
  });

  // Simulation form states
  const [simPrinterId, setSimPrinterId] = useState("");
  const [simFilamentId, setSimFilamentId] = useState("");
  const [simWeight, setSimWeight] = useState(45);
  const [simTime, setSimTime] = useState(7200);
  const [simFilename, setSimFilename] = useState("GL_Rocket_NoseCone.gcode");

  const initializeMockData = async () => {
    const demoFilaments: FilamentItem[] = [
      {
        id: "fil_1",
        name: "PLA Premium - GL Rocket Red",
        color: "#EF4444",
        material: "PLA",
        weightGrams: 850,
        initialWeightGrams: 1000,
        costPerGram: 0.11,
        minWeightAlert: 200,
        supplier: "GLTech Insumos"
      },
      {
        id: "fil_2",
        name: "ABS Carbon - Deep Space Black",
        color: "#1F2937",
        material: "ABS",
        weightGrams: 120,
        initialWeightGrams: 1000,
        costPerGram: 0.16,
        minWeightAlert: 200,
        supplier: "3DLab Brasil"
      },
      {
        id: "fil_3",
        name: "PETG Tough - Translucent Blue",
        color: "#3B82F6",
        material: "PETG",
        weightGrams: 980,
        initialWeightGrams: 1000,
        costPerGram: 0.13,
        minWeightAlert: 150,
        supplier: "eSun Filaments"
      }
    ];

    const demoPrinters: PrinterItem[] = [
      {
        id: "prn_1",
        name: "Vortigon Core 300 - High Speed",
        status: "printing",
        powerDraw: 220,
        depreciationPerHour: 0.50,
        activeFilamentId: "fil_1",
        activePrintJob: {
          filename: "GL_Rocket_Body_v2.gcode",
          progress: 42,
          timeElapsed: 3600,
          timeRemaining: 4900,
          filamentId: "fil_1",
          weightGrams: 64
        }
      },
      {
        id: "prn_2",
        name: "Creality K1 Max",
        status: "idle",
        powerDraw: 200,
        depreciationPerHour: 0.40,
        activeFilamentId: "fil_3",
        activePrintJob: null
      },
      {
        id: "prn_3",
        name: "GL Rocket-1 CoreXY",
        status: "error",
        powerDraw: 250,
        depreciationPerHour: 0.60,
        activeFilamentId: "fil_2",
        activePrintJob: null
      }
    ];

    setFilaments(demoFilaments);
    setPrinters(demoPrinters);

    startSaveTransition(async () => {
      const res = await savePrintersAndFilaments(demoPrinters, demoFilaments, kEnergy);
      if (res.ok) {
        toast.success("Dados demonstrativos inicializados!");
      } else {
        toast.error(`Erro ao salvar: ${res.error}`);
      }
    });
  };

  const handleSave = (updatedPrinters: PrinterItem[], updatedFilaments: FilamentItem[]) => {
    startSaveTransition(async () => {
      const res = await savePrintersAndFilaments(updatedPrinters, updatedFilaments, kEnergy);
      if (res.ok) {
        toast.success("Configuração salva no banco de dados.");
      } else {
        toast.error(`Erro ao salvar: ${res.error}`);
      }
    });
  };

  const addPrinter = () => {
    if (!newPrinter.name) return toast.error("Insira o nome da máquina.");
    const printer = {
      ...newPrinter,
      id: "prn_" + Math.random().toString(36).substr(2, 9),
      activePrintJob: null
    };
    const updated = [...printers, printer];
    setPrinters(updated);
    setShowAddPrinter(false);
    setNewPrinter({ name: "", status: "idle", powerDraw: 200, depreciationPerHour: 0.40 });
    handleSave(updated, filaments);
  };

  const addFilament = () => {
    if (!newFilament.name) return toast.error("Insira o nome do filamento.");
    const filament = {
      ...newFilament,
      id: "fil_" + Math.random().toString(36).substr(2, 9),
      weightGrams: Number(newFilament.weightGrams)
    };
    const updated = [...filaments, filament];
    setFilaments(updated);
    setShowAddFilament(false);
    setNewFilament({
      name: "",
      color: "#ff0000",
      material: "PLA",
      weightGrams: 1000,
      initialWeightGrams: 1000,
      costPerGram: 0.12,
      minWeightAlert: 150,
      supplier: ""
    });
    handleSave(printers, updated);
  };

  const deletePrinter = (id: string) => {
    const updated = printers.filter((p) => p.id !== id);
    setPrinters(updated);
    handleSave(updated, filaments);
  };

  const deleteFilament = (id: string) => {
    const updated = filaments.filter((f) => f.id !== id);
    setFilaments(updated);
    handleSave(printers, updated);
  };

  const triggerSimulatePrint = async (e: React.FormEvent) => {
    e.preventDefault();
    const printer = printers.find((p) => p.id === simPrinterId);
    const filament = filaments.find((f) => f.id === simFilamentId);

    if (!printer || !filament) {
      toast.error("Selecione uma impressora e filamento válidos.");
      return;
    }

    const costInfo = calculateRealCost({
      m_piece: Number(simWeight),
      c_gram: filament.costPerGram,
      t_print: Number(simTime),
      k_energy: kEnergy,
      power_draw: printer.powerDraw,
      d_machine: printer.depreciationPerHour
    });

    const updatedFilaments = filaments.map((f) => {
      if (f.id === filament.id) {
        return { ...f, weightGrams: Math.max(0, f.weightGrams - Number(simWeight)) };
      }
      return f;
    });

    const newJob: PrintJobItem = {
      id: "job_" + Math.random().toString(36).substr(2, 9),
      printerId: printer.id,
      printerName: printer.name,
      filename: simFilename,
      weightGrams: Number(simWeight),
      printTimeSeconds: Number(simTime),
      filamentId: filament.id,
      filamentName: filament.name,
      costs: costInfo,
      completedAt: new Date().toISOString()
    };

    const updatedPrinters = printers.map((p) => {
      if (p.id === printer.id) {
        return { ...p, status: "idle" as const, activePrintJob: null };
      }
      return p;
    });

    setFilaments(updatedFilaments);
    setPrinters(updatedPrinters);
    setPrintJobs((prev) => [newJob, ...prev]);

    startSaveTransition(async () => {
      try {
        const response = await fetch(`/api/v1/webhooks/printers${initialData.orgId ? `?orgId=${initialData.orgId}` : ""}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: "print_done",
            printer_id: printer.id,
            filename: simFilename,
            weight_grams: Number(simWeight),
            print_time_seconds: Number(simTime),
            filament_id: filament.id
          })
        });
        const resJson = await response.json();
        if (resJson.ok) {
          toast.success(`Impressão simulada! Custo Real: R$ ${costInfo.totalCost.toFixed(2)}`);
        } else {
          toast.error(`Erro no webhook: ${resJson.error}`);
        }
      } catch (err: unknown) {
        toast.error("Falha ao se comunicar com o webhook local.");
      }
    });
  };

  // KPIs
  const printersOnline = printers.filter((p) => p.status === "printing").length;
  const lowStockFilaments = filaments.filter((f) => f.weightGrams < f.minWeightAlert).length;
  const totalRevenue = printJobs.reduce((acc, job) => acc + (job.costs?.totalCost || 0) * 2.5, 0);
  const totalCostAcc = printJobs.reduce((acc, job) => acc + (job.costs?.totalCost || 0), 0);

  const errorPrinters = printers.filter((p) => p.status === "error").length;
  const healthScore = printers.length > 0 
    ? Math.round(100 - (errorPrinters / printers.length) * 40 - (lowStockFilaments / Math.max(1, filaments.length)) * 20)
    : 100;

  // Chart Data preparation
  const revenueHistory = [
    { date: "Seg", revenue: totalRevenue * 0.15 + 80 },
    { date: "Ter", revenue: totalRevenue * 0.32 + 150 },
    { date: "Qua", revenue: totalRevenue * 0.45 + 110 },
    { date: "Qui", revenue: totalRevenue * 0.60 + 220 },
    { date: "Sex", revenue: totalRevenue * 0.78 + 310 },
    { date: "Sáb", revenue: totalRevenue * 0.90 + 260 },
    { date: "Dom", revenue: totalRevenue },
  ];

  const filamentChartData = filaments.map((f) => ({
    name: f.name.replace("PLA Premium - ", "").replace("PETG Tough - ", "").replace("ABS Carbon - ", "").split(" - ")[0],
    quantity: f.weightGrams,
    color: f.color,
  }));

  interface ChartTooltipProps {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
    if (active && payload && payload.length && payload[0]) {
      return (
        <div className="bg-zinc-950/90 backdrop-blur-md border border-zinc-800/80 p-3 rounded-lg shadow-xl text-xs space-y-1">
          <p className="text-zinc-400 font-semibold">{label}</p>
          <p className="text-orange-500 font-bold text-sm">
            R$ {Number(payload[0].value).toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomBarTooltip = ({ active, payload, label }: ChartTooltipProps) => {
    if (active && payload && payload.length && payload[0]) {
      return (
        <div className="bg-zinc-950/90 backdrop-blur-md border border-zinc-800/80 p-3 rounded-lg shadow-xl text-xs space-y-1">
          <p className="text-zinc-400 font-semibold">{label}</p>
          <p className="text-emerald-500 font-bold text-sm">
            {Number(payload[0].value).toFixed(0)}g
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Upper header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Gauge className="text-orange-500" />
            Dashboard de Telemetria & Produção
          </h1>
          <p className="text-sm text-zinc-400">
            Monitore suas impressoras 3D, controle o estoque de filamento e gerencie os custos reais de operação.
          </p>
        </div>
        <div className="flex gap-2">
          {printers.length === 0 && (
            <Button onClick={initializeMockData} variant="outline" className="gap-2 border-zinc-850 hover:bg-zinc-900">
              <ArrowsClockwise className="h-4 w-4" />
              Carregar Demo Data
            </Button>
          )}
          <Button onClick={() => setShowAddPrinter(true)} className="gap-2 bg-orange-600 hover:bg-orange-700 text-white font-medium">
            <Plus className="h-4 w-4" />
            Nova Máquina
          </Button>
          <Button onClick={() => setShowAddFilament(true)} variant="outline" className="gap-2 border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300">
            <Plus className="h-4 w-4" />
            Novo Filamento
          </Button>
        </div>
      </header>

      {/* KPI Section with Mouse Glow Overlay */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SpotlightCard>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Faturamento Mensal</p>
              <p className="text-2xl font-bold mt-1 text-zinc-100">R$ {totalRevenue.toFixed(2)}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                  +12.4%
                </span>
                <span className="text-[10px] text-zinc-500">vs mês anterior</span>
              </div>
            </div>
            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500 border border-orange-500/20 shadow-inner">
              <ChartLineUp size={20} />
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Ordens de Serviço</p>
              <p className="text-2xl font-bold mt-1 text-zinc-100">{printersOnline} Ativas</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                  +{printers.length} total
                </span>
                <span className="text-[10px] text-zinc-500">Klipper Farm active</span>
              </div>
            </div>
            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500 border border-orange-500/20 shadow-inner">
              <Printer size={20} />
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Conversão WhatsApp</p>
              <p className="text-2xl font-bold mt-1 text-zinc-100">68.2%</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.2 rounded font-bold uppercase tracking-wider text-xs">
                  WAHA API
                </span>
                <span className="text-[10px] text-zinc-500">142 chats integrados</span>
              </div>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 shadow-inner">
              <Plus size={20} />
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Status do Hardware</p>
              <p className="text-2xl font-bold mt-1 text-zinc-100">{Math.max(0, Math.min(100, healthScore))}%</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                  {errorPrinters === 0 ? "100% Saudável" : `${errorPrinters} Erros`}
                </span>
                <span className="text-[10px] text-zinc-500">Farm telemetria</span>
              </div>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/20 shadow-inner">
              <Gauge size={20} />
            </div>
          </div>
        </SpotlightCard>
      </div>

      {/* Advanced Charting Layout */}
      {mounted && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Area Chart */}
          <Card className="lg:col-span-2 p-6 border-zinc-800/60 bg-zinc-950/40 backdrop-blur-md flex flex-col gap-4 shadow-xl rounded-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                  <ChartLineUp className="text-orange-500" />
                  Métricas de Faturamento Real
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">Visão detalhada do faturamento acumulado por dia da semana</p>
              </div>
              <Badge variant="outline" className="border-orange-500/20 text-orange-400 bg-orange-500/5">Período de 7 Dias</Badge>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff6b00" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ff6b00" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#ff6b00"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    activeDot={{ r: 6, stroke: "#ff6b00", strokeWidth: 2, fill: "#09090b", className: "animate-pulse" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Filament Stock Bar Chart */}
          <Card className="p-6 border-zinc-800/60 bg-zinc-950/40 backdrop-blur-md flex flex-col gap-4 shadow-xl rounded-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                  <Package className="text-orange-500" />
                  Nível de Insumos
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">Peso residual em gramas do estoque de filamentos</p>
              </div>
              <Badge variant="outline" className="border-emerald-500/20 text-emerald-400 bg-emerald-500/5 font-semibold">Estoque (g)</Badge>
            </div>
            
            <div className="h-64 w-full flex items-end justify-center">
              {filamentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filamentChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                    <RechartsTooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="quantity" radius={[4, 4, 0, 0]} maxBarSize={30}>
                      {filamentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || "#ff6b00"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-zinc-500 text-xs py-10">Nenhum filamento disponível</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Bento Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Farm Control Card (Double wide) */}
        <Card className="lg:col-span-2 p-6 border-zinc-800/60 bg-zinc-950/40 backdrop-blur-md flex flex-col gap-4 shadow-sm rounded-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Printer className="text-orange-500" />
              Fazenda de Impressão 3D
            </h2>
            <Badge variant="secondary" className="bg-zinc-900 border-zinc-800 text-zinc-300">Telemetria Klipper ativa</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            {printers.map((printer) => {
              const assignedFilament = filaments.find(
                (f) => f.id === printer.activeFilamentId
              );
              
              return (
                <Card 
                  key={printer.id} 
                  className={`p-4 border-zinc-800/60 relative overflow-hidden transition-all flex flex-col justify-between rounded-xl bg-zinc-950/20 ${
                    printer.status === "printing"
                      ? "border-l-4 border-l-orange-500"
                      : printer.status === "error"
                      ? "border-l-4 border-l-red-500"
                      : "border-l-4 border-l-emerald-500"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-sm text-zinc-100">{printer.name}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Consumo: {printer.powerDraw}W | Depreciação: R$ {printer.depreciationPerHour}/h
                      </p>
                    </div>
                    <Badge 
                      className={
                        printer.status === "printing"
                          ? "bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/10"
                          : printer.status === "error"
                          ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/10"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10"
                      }
                    >
                      {printer.status === "printing" ? "Imprimindo" : printer.status === "error" ? "Falha" : "Ociosa"}
                    </Badge>
                  </div>

                  {printer.status === "printing" && printer.activePrintJob ? (
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-xs font-semibold text-zinc-200">
                        <span className="truncate max-w-[150px]">{printer.activePrintJob.filename}</span>
                        <span>{printer.activePrintJob.progress}%</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-orange-500 h-full transition-all duration-500" 
                          style={{ width: `${printer.activePrintJob.progress}%` }} 
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          Restam: {Math.round(printer.activePrintJob.timeRemaining / 60)} min
                        </span>
                        {assignedFilament && (
                          <span className="flex items-center gap-1">
                            <span 
                              className="h-2.5 w-2.5 rounded-full border border-white/20 inline-block"
                              style={{ backgroundColor: assignedFilament.color }}
                            />
                            {assignedFilament.name}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-col items-center justify-center p-4 bg-zinc-900/30 rounded-md border border-zinc-800/40 text-center">
                      {printer.status === "error" ? (
                        <>
                          <Warning className="text-red-500 h-6 w-6 mb-1" />
                          <p className="text-xs font-semibold text-zinc-200">Filamento Emperrado</p>
                          <p className="text-[10px] text-zinc-400">Bico obstruído / Erro de telemetria</p>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="text-emerald-500 h-6 w-6 mb-1" />
                          <p className="text-xs font-semibold text-zinc-200">Pronta para Produção</p>
                          <p className="text-[10px] text-zinc-400">Aguardando arquivo GCode</p>
                        </>
                      )}
                    </div>
                  )}

                  <div className="mt-4 pt-2 border-t border-zinc-800/40 flex justify-between items-center text-[10px] text-zinc-400">
                    <span>Nozzle: {printer.status === "printing" ? "215°C" : "25°C"}</span>
                    <span>Mesa: {printer.status === "printing" ? "60°C" : "25°C"}</span>
                    <button 
                      onClick={() => deletePrinter(printer.id)} 
                      className="text-red-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                </Card>
              );
            })}
            
            {printers.length === 0 && (
              <div className="col-span-2 flex flex-col items-center justify-center p-8 border border-dashed border-zinc-800 rounded-xl text-center">
                <Printer className="h-10 w-10 text-zinc-500 mb-2" />
                <p className="text-sm font-semibold text-zinc-200">Nenhuma impressora cadastrada</p>
                <p className="text-xs text-zinc-400">Clique em Nova Máquina para cadastrar.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Dynamic List fallback for stock management */}
        <Card className="p-6 border-zinc-800/60 bg-zinc-950/40 backdrop-blur-md flex flex-col gap-4 shadow-sm rounded-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Package className="text-orange-500" />
              Rendimento Insumos
            </h2>
            <Badge variant="outline" className="border-zinc-800 text-zinc-300">Resíduos</Badge>
          </div>

          <div className="space-y-4 overflow-y-auto max-h-[350px] pr-1 flex-1 scrollbar-none">
            {filaments.map((filament) => {
              const percentage = (filament.weightGrams / filament.initialWeightGrams) * 100;
              const isLow = filament.weightGrams < filament.minWeightAlert;

              return (
                <div key={filament.id} className="space-y-1.5 p-2 rounded-xl hover:bg-zinc-900/35 border border-transparent hover:border-zinc-800/30 transition-all">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span 
                        className="h-3.5 w-3.5 rounded-full border border-zinc-800 shadow-xs" 
                        style={{ backgroundColor: filament.color }}
                      />
                      <div>
                        <p className="text-xs font-semibold text-zinc-100">{filament.name}</p>
                        <p className="text-[10px] text-zinc-400">{filament.material} | R$ {filament.costPerGram}/g</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-zinc-100">{filament.weightGrams}g</p>
                      {isLow && (
                        <span className="text-[9px] font-bold text-red-500 uppercase flex items-center gap-0.5 justify-end">
                          <Warning size={10} />
                          Baixo
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${isLow ? "bg-red-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, percentage)}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center text-[9px] text-zinc-400">
                    <span>Original: {filament.initialWeightGrams}g</span>
                    <button 
                      onClick={() => deleteFilament(filament.id)} 
                      className="hover:text-red-500 transition-colors"
                    >
                      Remover spool
                    </button>
                  </div>
                </div>
              );
            })}

            {filaments.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 border border-dashed border-zinc-800 rounded-xl text-center">
                <Package className="h-10 w-10 text-zinc-500 mb-2" />
                <p className="text-sm font-semibold text-zinc-200">Estoque vazio</p>
                <p className="text-xs text-zinc-400">Adicione rolos de filamento para começar.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Telemetry simulator panel */}
        <Card className="p-6 border-zinc-800/60 bg-zinc-950/40 backdrop-blur-md flex flex-col gap-4 shadow-sm rounded-2xl">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Play className="text-emerald-500" />
            Simulador de Telemetria (Klipper Webhook)
          </h2>
          <p className="text-xs text-zinc-400">
            Simule um evento de fim de impressão disparando o webhook de telemetria diretamente para o backend. 
            O robô calcula custos reais e deduz o estoque automaticamente.
          </p>

          <form onSubmit={triggerSimulatePrint} className="space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sim_printer">Selecione a Impressora</Label>
                <select 
                  id="sim_printer"
                  value={simPrinterId} 
                  onChange={(e) => setSimPrinterId(e.target.value)}
                  className="w-full text-xs p-2 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  required
                >
                  <option value="" className="bg-zinc-950">Selecione...</option>
                  {printers.map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-950">{p.name} ({p.status})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sim_filament">Filamento Alocado</Label>
                <select 
                  id="sim_filament"
                  value={simFilamentId} 
                  onChange={(e) => setSimFilamentId(e.target.value)}
                  className="w-full text-xs p-2 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  required
                >
                  <option value="" className="bg-zinc-950">Selecione...</option>
                  {filaments.map((f) => (
                    <option key={f.id} value={f.id} className="bg-zinc-950">{f.name} ({f.weightGrams}g)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sim_weight">Peso Peça (g)</Label>
                <Input 
                  id="sim_weight"
                  type="number" 
                  value={simWeight} 
                  onChange={(e) => setSimWeight(Number(e.target.value))}
                  min={1}
                  className="bg-zinc-900 border-zinc-800 text-zinc-200 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sim_time">Tempo Impressão (seg)</Label>
                <Input 
                  id="sim_time"
                  type="number" 
                  value={simTime} 
                  onChange={(e) => setSimTime(Number(e.target.value))}
                  min={1}
                  className="bg-zinc-900 border-zinc-800 text-zinc-200 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="k_energy_val">Tarifa Energia (R$/kWh)</Label>
                <Input 
                  id="k_energy_val"
                  type="number" 
                  step="0.01" 
                  value={kEnergy} 
                  onChange={(e) => setKEnergy(Number(e.target.value))}
                  min={0.01}
                  className="bg-zinc-900 border-zinc-800 text-zinc-200 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sim_file">Nome do Arquivo Gcode</Label>
              <Input 
                id="sim_file"
                type="text" 
                value={simFilename} 
                onChange={(e) => setSimFilename(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-zinc-200 focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>

            <Button type="submit" disabled={isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl">
              {isPending ? "Concluindo trabalho..." : "Disparar Webhook & Deduzir Estoque"}
            </Button>
          </form>
        </Card>

        {/* Cost log and History feed */}
        <Card className="p-6 border-zinc-800/60 bg-zinc-950/40 backdrop-blur-md flex flex-col gap-4 shadow-sm rounded-2xl">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <ChartBar className="text-orange-500" />
            Histórico Recente e Custo Real
          </h2>
          
          <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1 flex-1 scrollbar-none">
            {printJobs.map((job) => (
              <Card key={job.id} className="p-3 bg-zinc-900/10 border-zinc-800/40 hover:border-zinc-800 transition-colors rounded-xl">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-xs text-zinc-100 truncate max-w-[200px]">{job.filename}</h4>
                    <p className="text-[10px] text-zinc-450 mt-0.5">
                      Impressora: {job.printerName} | Filamento: {job.filamentName}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-zinc-850 text-zinc-400 bg-zinc-900/50">
                    {new Date(job.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Badge>
                </div>

                {job.costs && (
                  <div className="mt-3 grid grid-cols-4 gap-2 pt-2 border-t border-zinc-850 text-[10px]">
                    <div>
                      <p className="text-zinc-450">Material</p>
                      <p className="font-medium text-zinc-200">R$ {job.costs.materialCost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-450">Energia</p>
                      <p className="font-medium text-zinc-200">R$ {job.costs.energyCost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-450">Depreciação</p>
                      <p className="font-medium text-zinc-200">R$ {job.costs.depreciationCost.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-orange-500 font-bold">Total</p>
                      <p className="font-bold text-zinc-100">R$ {job.costs.totalCost.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </Card>
            ))}

            {printJobs.length === 0 && (
              <div className="flex flex-col items-center justify-center p-12 border border-dashed border-zinc-800 rounded-xl text-center">
                <Info className="h-8 w-8 text-zinc-500 mb-2" />
                <p className="text-xs text-zinc-400">Nenhum trabalho finalizado no histórico.</p>
                <p className="text-[10px] text-zinc-500">Dispare uma simulação ao lado para registrar custos.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Add Printer Modal */}
      {showAddPrinter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="max-w-md w-full p-6 space-y-4 bg-zinc-950 border border-zinc-800 shadow-2xl rounded-2xl">
            <h3 className="font-bold text-lg text-zinc-100">Adicionar Nova Impressora 3D</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="printer_name">Nome da Máquina</Label>
                <Input 
                  id="printer_name"
                  placeholder="ex: Ender 3 V3, Voron 2.4" 
                  value={newPrinter.name}
                  onChange={(e) => setNewPrinter({...newPrinter, name: e.target.value})}
                  className="bg-zinc-900 border-zinc-800 text-zinc-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="printer_power">Consumo (W)</Label>
                  <Input 
                    id="printer_power"
                    type="number" 
                    value={newPrinter.powerDraw}
                    onChange={(e) => setNewPrinter({...newPrinter, powerDraw: Number(e.target.value)})}
                    className="bg-zinc-900 border-zinc-800 text-zinc-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="printer_depr">Depreciação (R$/h)</Label>
                  <Input 
                    id="printer_depr"
                    type="number" 
                    step="0.05"
                    value={newPrinter.depreciationPerHour}
                    onChange={(e) => setNewPrinter({...newPrinter, depreciationPerHour: Number(e.target.value)})}
                    className="bg-zinc-900 border-zinc-800 text-zinc-200"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setShowAddPrinter(false)} className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900">Cancelar</Button>
              <Button onClick={addPrinter} className="bg-orange-600 hover:bg-orange-700 text-white">Cadastrar Máquina</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Add Filament Modal */}
      {showAddFilament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="max-w-md w-full p-6 space-y-4 bg-zinc-950 border border-zinc-800 shadow-2xl rounded-2xl">
            <h3 className="font-bold text-lg text-zinc-100">Adicionar Carretel de Filamento</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fil_name">Nome do Insumo</Label>
                <Input 
                  id="fil_name"
                  placeholder="ex: PLA Premium Red" 
                  value={newFilament.name}
                  onChange={(e) => setNewFilament({...newFilament, name: e.target.value})}
                  className="bg-zinc-900 border-zinc-800 text-zinc-200"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="fil_mat">Material</Label>
                  <select 
                    id="fil_mat"
                    value={newFilament.material}
                    onChange={(e) => setNewFilament({...newFilament, material: e.target.value})}
                    className="w-full text-xs p-2.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    <option value="PLA" className="bg-zinc-950">PLA</option>
                    <option value="ABS" className="bg-zinc-950">ABS</option>
                    <option value="PETG" className="bg-zinc-950">PETG</option>
                    <option value="FLEX" className="bg-zinc-950">FLEX</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fil_color">Cor</Label>
                  <Input 
                    id="fil_color"
                    type="color" 
                    value={newFilament.color}
                    onChange={(e) => setNewFilament({...newFilament, color: e.target.value})}
                    className="h-10 p-1 cursor-pointer bg-zinc-900 border-zinc-800"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fil_supplier">Fornecedor</Label>
                  <Input 
                    id="fil_supplier"
                    placeholder="GLTech"
                    value={newFilament.supplier}
                    onChange={(e) => setNewFilament({...newFilament, supplier: e.target.value})}
                    className="bg-zinc-900 border-zinc-800 text-zinc-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="fil_weight">Peso Inicial (g)</Label>
                  <Input 
                    id="fil_weight"
                    type="number" 
                    value={newFilament.initialWeightGrams}
                    onChange={(e) => setNewFilament({...newFilament, initialWeightGrams: Number(e.target.value), weightGrams: Number(e.target.value)})}
                    className="bg-zinc-900 border-zinc-800 text-zinc-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fil_cost">Preço (R$/g)</Label>
                  <Input 
                    id="fil_cost"
                    type="number" 
                    step="0.01"
                    value={newFilament.costPerGram}
                    onChange={(e) => setNewFilament({...newFilament, costPerGram: Number(e.target.value)})}
                    className="bg-zinc-900 border-zinc-800 text-zinc-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fil_min">Alerta Estoque (g)</Label>
                  <Input 
                    id="fil_min"
                    type="number" 
                    value={newFilament.minWeightAlert}
                    onChange={(e) => setNewFilament({...newFilament, minWeightAlert: Number(e.target.value)})}
                    className="bg-zinc-900 border-zinc-800 text-zinc-200"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setShowAddFilament(false)} className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900">Cancelar</Button>
              <Button onClick={addFilament} className="bg-orange-600 hover:bg-orange-700 text-white">Adicionar Insumo</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
