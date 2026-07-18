"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Gauge,
  Printer,
  Package,
  ChartBar,
  Warning,
  Info,
  ArrowsClockwise,
  Plus,
  Play,
  Trash,
  CheckCircle,
  Wrench,
  WifiSlash,
} from "@/lib/ui/icons";
import { fetchPrinterLiveStatus } from "@/app/actions/printers/live-status";
import { pollPrinterFromBrowser } from "@/lib/printers/browser-poll";
import { liveStateToPrinterStatus, type LiveStatus } from "@/lib/printers/live-status";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { calculateRealCost } from "@/lib/pricing/engine";
import { savePrintersAndFilaments } from "@/app/actions/printers/actions";
import { PrintingDetails } from "@/app/app/printers/_components/PrintingDetails";

type PrinterStatus = "idle" | "printing" | "error" | "offline" | "maintenance";

interface PrinterItem {
  id: string;
  name: string;
  status: PrinterStatus;
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
    serviceOrderId?: string | null;
    serviceOrderTitle?: string | null;
  } | null;
  networkUrl?: string;
  apiKey?: string;
  pollMode?: "browser" | "server" | "off";
}

export interface ServiceOrderLite {
  id: string;
  title: string;
  contactName: string | null;
  status: string;
  priority: string;
  material: string | null;
  totalCents: number;
  slaDueAt: string | null;
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
  serviceOrderId: string | null;
  completedAt: string;
}

interface DashboardClientProps {
  initialData: {
    printers: PrinterItem[];
    filaments: FilamentItem[];
    printJobs: PrintJobItem[];
    serviceOrders: ServiceOrderLite[];
    kEnergy: number;
    orgId: string | null;
  };
}

/** Aparência por status da impressora (ícone, cores, borda). */
const PRINTER_STATUS_META: Record<PrinterStatus, { label: string; badge: string; border: string; Icon: typeof Printer; icon: string }> = {
  printing:    { label: "Imprimindo",    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",   border: "border-l-orange-500",  Icon: Printer,     icon: "text-orange-400" },
  idle:        { label: "Ociosa",        badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", border: "border-l-emerald-500", Icon: CheckCircle, icon: "text-emerald-400" },
  maintenance: { label: "Em manutenção", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",       border: "border-l-amber-500",   Icon: Wrench,      icon: "text-amber-400" },
  error:       { label: "Erro",          badge: "bg-red-500/10 text-red-400 border-red-500/20",             border: "border-l-red-500",     Icon: Warning,     icon: "text-red-400" },
  offline:     { label: "Offline",       badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",          border: "border-l-zinc-600",    Icon: WifiSlash,   icon: "text-zinc-400" },
};
const PRINTER_STATUS_ORDER: PrinterStatus[] = ["printing", "idle", "maintenance", "error", "offline"];

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
  const serviceOrders = initialData.serviceOrders;
  const [kEnergy, setKEnergy] = useState<number>(initialData.kEnergy);
  const [isPending, startSaveTransition] = useTransition();

  // Modal / Form states
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [showAddFilament, setShowAddFilament] = useState(false);

  // Live status por IP (client) + qual impressora está sendo lida.
  const [liveStatus, setLiveStatus] = useState<Record<string, LiveStatus>>({});
  const [pollingId, setPollingId] = useState<string | null>(null);

  // New printer state
  const [newPrinter, setNewPrinter] = useState({
    name: "",
    status: "idle" as PrinterStatus,
    powerDraw: 200,
    depreciationPerHour: 0.40,
    networkUrl: "",
    apiKey: "",
    pollMode: "browser" as "browser" | "server" | "off",
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
  const [simServiceOrderId, setSimServiceOrderId] = useState("");

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

  // Vincula/desvincula uma OS ao job ativo da impressora (grava no active_print_job).
  const assignOsToActiveJob = (printerId: string, osId: string | null) => {
    const os = osId ? serviceOrders.find((s) => s.id === osId) ?? null : null;
    const updated = printers.map((p) => {
      if (p.id !== printerId || !p.activePrintJob) return p;
      return {
        ...p,
        activePrintJob: { ...p.activePrintJob, serviceOrderId: os?.id ?? null, serviceOrderTitle: os?.title ?? null },
      };
    });
    setPrinters(updated);
    handleSave(updated, filaments);
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
    setNewPrinter({ name: "", status: "idle", powerDraw: 200, depreciationPerHour: 0.40, networkUrl: "", apiKey: "", pollMode: "browser" });
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

  // Muda o status de uma impressora à mão (Operando/Manutenção/Ociosa/Erro/Offline).
  const updatePrinterStatus = (id: string, status: PrinterStatus) => {
    const updated = printers.map((p) => (p.id === id ? { ...p, status } : p));
    setPrinters(updated);
    handleSave(updated, filaments);
  };

  // Lê o status ao vivo por IP (navegador na LAN OU servidor p/ IP público).
  const refreshLive = async (printer: PrinterItem) => {
    if (!printer.networkUrl) return toast.error("Cadastre o IP/URL da impressora primeiro (editar a máquina).");
    if (printer.pollMode === "off") return toast.error("Leitura por IP desligada nesta máquina.");
    setPollingId(printer.id);
    try {
      const live =
        printer.pollMode === "server"
          ? await fetchPrinterLiveStatus({ url: printer.networkUrl, apiKey: printer.apiKey }).then((r) => (r.ok ? r.status : null))
          : await pollPrinterFromBrowser(printer.networkUrl, printer.apiKey);
      if (!live) return toast.error("Falha ao ler a impressora.");
      setLiveStatus((prev) => ({ ...prev, [printer.id]: live }));
      if (!live.reachable) return toast.error(`${printer.name}: inalcançável (verifique IP/CORS/rede).`);
      // Reflete a telemetria no status persistido — mas nunca sobrescreve "manutenção" manual.
      if (printer.status !== "maintenance") {
        const mapped = liveStateToPrinterStatus(live.state);
        if (mapped !== printer.status) updatePrinterStatus(printer.id, mapped);
      }
      toast.success(`${printer.name}: ${live.state}${live.nozzleTemp != null ? ` · bico ${live.nozzleTemp}°C` : ""}`);
    } finally {
      setPollingId(null);
    }
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
      serviceOrderId: simServiceOrderId || null,
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
            filament_id: filament.id,
            service_order_id: simServiceOrderId || null
          })
        });
        const resJson = await response.json();
        if (resJson.ok) {
          toast.success(`Impressão simulada! Custo Real: R$ ${costInfo.totalCost.toFixed(2)}`);
        } else {
          toast.error(`Erro no webhook: ${resJson.error}`);
        }
      } catch {
        toast.error("Falha ao se comunicar com o webhook local.");
      }
    });
  };

  // ── KPIs reais (impressoras + filamentos + jobs concluídos) ──
  const printingCount = printers.filter((p) => p.status === "printing").length;
  const maintenanceCount = printers.filter((p) => p.status === "maintenance").length;
  const errorPrinters = printers.filter((p) => p.status === "error").length;
  const lowStockFilaments = filaments.filter((f) => f.weightGrams < f.minWeightAlert).length;
  const filamentTotalGrams = filaments.reduce((s, f) => s + f.weightGrams, 0);
  const realCostAcc = printJobs.reduce((acc, job) => acc + (job.costs?.totalCost || 0), 0);
  const healthScore = printers.length > 0
    ? Math.round(100 - (errorPrinters / printers.length) * 40 - (lowStockFilaments / Math.max(1, filaments.length)) * 20)
    : 100;

  // Estoque agregado por material (rodapé do painel de filamentos): { PLA: 3200, PETG: 1000, ... }
  const stockByMaterial = filaments.reduce<Record<string, number>>((acc, f) => {
    const key = (f.material || "Outro").toUpperCase();
    acc[key] = (acc[key] ?? 0) + f.weightGrams;
    return acc;
  }, {});

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
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Máquinas</p>
              <p className="text-2xl font-bold mt-1 text-zinc-100">{printers.length}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                  {printingCount} imprimindo
                </span>
                <span className="text-[10px] text-zinc-500">{maintenanceCount} em manutenção</span>
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
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Estoque de Filamento</p>
              <p className="text-2xl font-bold mt-1 text-zinc-100">{(filamentTotalGrams / 1000).toFixed(1)} kg</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                  {filaments.length} bobinas
                </span>
                <span className="text-[10px] text-zinc-500">{lowStockFilaments > 0 ? `${lowStockFilaments} abaixo do mínimo` : "estoque ok"}</span>
              </div>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 shadow-inner">
              <Package size={20} />
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Jobs Concluídos</p>
              <p className="text-2xl font-bold mt-1 text-zinc-100">{printJobs.length}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                  R$ {realCostAcc.toFixed(2)}
                </span>
                <span className="text-[10px] text-zinc-500">custo real produzido</span>
              </div>
            </div>
            <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20 shadow-inner">
              <CheckCircle size={20} />
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
              
              const meta = PRINTER_STATUS_META[printer.status];
              const live = liveStatus[printer.id];
              const StatusIcon = meta.Icon;
              return (
                <Card
                  key={printer.id}
                  className={`p-4 border-zinc-800/60 relative overflow-hidden transition-all flex flex-col justify-between rounded-xl bg-zinc-950/20 border-l-4 ${meta.border}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-1.5">
                        <StatusIcon size={14} className={meta.icon} /> {printer.name}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Consumo: {printer.powerDraw}W · Depreciação: R$ {printer.depreciationPerHour}/h
                      </p>
                      {printer.networkUrl && (
                        <p className="text-[10px] text-zinc-500 mt-0.5 truncate" title={printer.networkUrl}>IP: {printer.networkUrl}</p>
                      )}
                    </div>
                    {/* Definir status à mão (Operando/Manutenção/…). */}
                    <select
                      value={printer.status}
                      onChange={(e) => updatePrinterStatus(printer.id, e.target.value as PrinterStatus)}
                      title="Definir status da máquina"
                      className={`shrink-0 cursor-pointer rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider outline-none ${meta.badge}`}
                    >
                      {PRINTER_STATUS_ORDER.map((s) => (
                        <option key={s} value={s} className="bg-zinc-900 text-zinc-100">{PRINTER_STATUS_META[s].label}</option>
                      ))}
                    </select>
                  </div>

                  {printer.status === "printing" && printer.activePrintJob ? (
                    <PrintingDetails
                      filename={printer.activePrintJob.filename}
                      progress={printer.activePrintJob.progress}
                      timeRemaining={printer.activePrintJob.timeRemaining}
                      filament={assignedFilament ? { name: assignedFilament.name, color: assignedFilament.color } : null}
                      serviceOrders={serviceOrders}
                      linkedOs={serviceOrders.find((s) => s.id === printer.activePrintJob?.serviceOrderId) ?? null}
                      onAssign={(osId) => assignOsToActiveJob(printer.id, osId)}
                    />
                  ) : (
                    <div className="mt-4 flex flex-col items-center justify-center p-4 bg-zinc-900/30 rounded-md border border-zinc-800/40 text-center">
                      <StatusIcon className={`${meta.icon} h-6 w-6 mb-1`} />
                      <p className="text-xs font-semibold text-zinc-200">
                        {printer.status === "maintenance" ? "Em manutenção"
                          : printer.status === "error" ? "Falha na impressora"
                          : printer.status === "offline" ? "Offline"
                          : "Pronta para produção"}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {printer.status === "maintenance" ? "Fora de operação para manutenção"
                          : printer.status === "error" ? "Verifique bico / telemetria"
                          : printer.status === "offline" ? "Sem comunicação com a máquina"
                          : "Aguardando arquivo GCode"}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 pt-2 border-t border-zinc-800/40 flex items-center justify-between text-[10px] text-zinc-400">
                    <span>Bico: {live?.nozzleTemp != null ? `${live.nozzleTemp}°C` : "—"}</span>
                    <span>Mesa: {live?.bedTemp != null ? `${live.bedTemp}°C` : "—"}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => refreshLive(printer)}
                        disabled={pollingId === printer.id}
                        title={`Atualizar status por IP (modo: ${printer.pollMode ?? "browser"})`}
                        className="text-zinc-400 hover:text-orange-400 transition-colors p-1 disabled:opacity-40"
                      >
                        <ArrowsClockwise size={12} className={pollingId === printer.id ? "animate-spin" : ""} />
                      </button>
                      <button
                        onClick={() => deletePrinter(printer.id)}
                        className="text-red-400 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash size={12} />
                      </button>
                    </div>
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

        {/* Estoque de filamentos — por marca, com quantidade e soma por material */}
        <Card className="p-6 border-zinc-800/60 bg-zinc-950/40 backdrop-blur-md flex flex-col gap-4 shadow-sm rounded-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Package className="text-orange-500" />
              Estoque de Filamentos
            </h2>
            <Badge variant="outline" className="border-emerald-500/20 text-emerald-400 bg-emerald-500/5 font-semibold">{(filamentTotalGrams / 1000).toFixed(1)} kg</Badge>
          </div>

          {filaments.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-zinc-800 rounded-xl text-center">
              <Package className="h-10 w-10 text-zinc-500 mb-2" />
              <p className="text-sm font-semibold text-zinc-200">Estoque vazio</p>
              <p className="text-xs text-zinc-400">Adicione rolos de filamento para começar.</p>
            </div>
          ) : (
            <>
              <div className="max-h-[340px] overflow-y-auto overflow-x-auto scrollbar-none">
                <table className="w-full text-left text-[11px]">
                  <thead className="text-zinc-500 uppercase tracking-wider text-[9px]">
                    <tr className="border-b border-zinc-800/60">
                      <th className="py-2 pr-2">Marca</th>
                      <th className="py-2 px-2">Material</th>
                      <th className="py-2 px-2 text-right">Quantidade</th>
                      <th className="py-2 px-2 text-right">Custo/g</th>
                      <th className="py-2 pl-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filaments.map((f) => {
                      const pct = f.initialWeightGrams > 0 ? (f.weightGrams / f.initialWeightGrams) * 100 : 0;
                      const isLow = f.weightGrams < f.minWeightAlert;
                      return (
                        <tr key={f.id} className="border-b border-zinc-800/30 hover:bg-zinc-900/35 transition-colors">
                          <td className="py-2 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 shrink-0 rounded-full border border-zinc-800" style={{ backgroundColor: f.color }} />
                              <span className="font-semibold text-zinc-100 truncate max-w-[130px]" title={f.name}>{f.name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-zinc-400">{f.material || "—"}</td>
                          <td className="py-2 px-2 text-right">
                            <div className={`font-bold tabular-nums ${isLow ? "text-red-400" : "text-zinc-100"}`}>{f.weightGrams} g</div>
                            <div className="ml-auto mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-zinc-900">
                              <div className={`h-full ${isLow ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right text-zinc-400 tabular-nums">R$ {f.costPerGram}</td>
                          <td className="py-2 pl-2 text-right whitespace-nowrap">
                            {isLow && <span className="mr-1 inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-red-500"><Warning size={9} />Baixo</span>}
                            <button onClick={() => deleteFilament(f.id)} className="text-zinc-500 hover:text-red-500 transition-colors" title="Remover filamento"><Trash size={11} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Soma por material (total PLA, PETG, ...) */}
              <div className="flex flex-wrap gap-2 border-t border-zinc-800/40 pt-3">
                {Object.entries(stockByMaterial).sort((a, b) => b[1] - a[1]).map(([mat, g]) => (
                  <span key={mat} className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1 text-[10px] text-zinc-300">
                    <span className="font-bold text-zinc-100">{mat}</span> · {(g / 1000).toFixed(g >= 1000 ? 1 : 2)} kg
                  </span>
                ))}
              </div>
            </>
          )}
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

            <div className="space-y-2">
              <Label htmlFor="sim_os">Ordem de Serviço (opcional)</Label>
              <select
                id="sim_os"
                value={simServiceOrderId}
                onChange={(e) => setSimServiceOrderId(e.target.value)}
                className="w-full text-xs p-2 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="" className="bg-zinc-950">Sem OS vinculada</option>
                {serviceOrders.map((so) => (
                  <option key={so.id} value={so.id} className="bg-zinc-950">
                    {so.title}{so.contactName ? ` — ${so.contactName}` : ""}
                  </option>
                ))}
              </select>
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

              {/* Telemetria por IP (Moonraker/OctoPrint) */}
              <div className="space-y-2">
                <Label htmlFor="printer_url">IP / URL da impressora</Label>
                <Input
                  id="printer_url"
                  placeholder="ex: http://192.168.0.50:7125 (Moonraker) ou http://192.168.0.50 (OctoPrint)"
                  value={newPrinter.networkUrl}
                  onChange={(e) => setNewPrinter({ ...newPrinter, networkUrl: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 text-zinc-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="printer_pollmode">Leitura de status</Label>
                  <select
                    id="printer_pollmode"
                    value={newPrinter.pollMode}
                    onChange={(e) => setNewPrinter({ ...newPrinter, pollMode: e.target.value as "browser" | "server" | "off" })}
                    className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none"
                  >
                    <option value="browser">Navegador (LAN)</option>
                    <option value="server">Servidor (IP público)</option>
                    <option value="off">Desligada</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="printer_apikey">API key (OctoPrint)</Label>
                  <Input
                    id="printer_apikey"
                    placeholder="só p/ OctoPrint"
                    value={newPrinter.apiKey}
                    onChange={(e) => setNewPrinter({ ...newPrinter, apiKey: e.target.value })}
                    className="bg-zinc-900 border-zinc-800 text-zinc-200"
                  />
                </div>
              </div>
              <p className="text-[10px] text-zinc-500">
                Moonraker não precisa de key. Na LAN, use &quot;Navegador&quot; e habilite CORS no Moonraker (cors_domains). Detalhes em docs/printer-telemetry.md.
              </p>
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
