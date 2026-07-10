"use client";

import { useState, startTransition, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
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

export function DashboardClient({ initialData }: DashboardClientProps) {
  const [printers, setPrinters] = useState<PrinterItem[]>(initialData.printers);
  const [filaments, setFilaments] = useState<FilamentItem[]>(initialData.filaments);
  const [printJobs, setPrintJobs] = useState<PrintJobItem[]>(initialData.printJobs);
  const [kEnergy, setKEnergy] = useState<number>(initialData.kEnergy);
  const [isPending, startSaveTransition] = useTransition();

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
  const [simTime, setSimTime] = useState(7200); // 2 hours in seconds
  const [simFilename, setSimFilename] = useState("GL_Rocket_NoseCone.gcode");

  // Initializing mock data if DB settings are empty
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

  // Simulate print end (runs pricing engine and updates stock)
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

    // Deduct stock
    const updatedFilaments = filaments.map((f) => {
      if (f.id === filament.id) {
        return { ...f, weightGrams: Math.max(0, f.weightGrams - Number(simWeight)) };
      }
      return f;
    });

    // Complete job
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

    // Update printer state
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
      // Direct call to webhook route to test full backend telemetry integration
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
          toast.success(`Impressão simulada! Perda: ${simWeight}g. Custo: R$ ${costInfo.totalCost}`);
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
  const totalRevenue = printJobs.reduce((acc, job) => acc + (job.costs?.totalCost || 0) * 2.5, 0); // Simulated 150% mark-up pricing
  const totalCostAcc = printJobs.reduce((acc, job) => acc + (job.costs?.totalCost || 0), 0);

  // Health Score Calculation
  const errorPrinters = printers.filter((p) => p.status === "error").length;
  const healthScore = printers.length > 0 
    ? Math.round(100 - (errorPrinters / printers.length) * 40 - (lowStockFilaments / Math.max(1, filaments.length)) * 20)
    : 100;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Upper header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Dashboard de Telemetria & Produção</h1>
          <p className="text-sm text-text-muted">
            Monitore suas impressoras 3D, controle o estoque de filamento e gerencie os custos reais de operação.
          </p>
        </div>
        <div className="flex gap-2">
          {printers.length === 0 && (
            <Button onClick={initializeMockData} variant="outline" className="gap-2">
              <ArrowsClockwise className="h-4 w-4" />
              Carregar Demo Data
            </Button>
          )}
          <Button onClick={() => setShowAddPrinter(true)} className="gap-2 bg-accent hover:bg-accent-strong text-white">
            <Plus className="h-4 w-4" />
            Nova Máquina
          </Button>
          <Button onClick={() => setShowAddFilament(true)} variant="secondary" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Filamento
          </Button>
        </div>
      </header>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-surface-glass border-border/50 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Faturamento Produzido</p>
            <p className="text-2xl font-bold mt-1 text-text">R$ {totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-emerald-500 mt-0.5">Margem: R$ {(totalRevenue - totalCostAcc).toFixed(2)}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-500">
            <ChartLineUp size={24} weight="duotone" />
          </div>
        </Card>

        <Card className="p-4 bg-surface-glass border-border/50 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Máquinas Imprimindo</p>
            <p className="text-2xl font-bold mt-1 text-text">{printersOnline} / {printers.length}</p>
            <p className="text-xs text-text-muted mt-0.5">Status online via Klipper</p>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-full text-blue-500">
            <Printer size={24} weight="duotone" />
          </div>
        </Card>

        <Card className="p-4 bg-surface-glass border-border/50 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Estoques Críticos</p>
            <p className="text-2xl font-bold mt-1 text-text">{lowStockFilaments}</p>
            <p className="text-xs text-rose-500 mt-0.5">Carretéis abaixo do mínimo</p>
          </div>
          <div className="p-3 bg-rose-500/10 rounded-full text-rose-500">
            <Package size={24} weight="duotone" />
          </div>
        </Card>

        <Card className="p-4 bg-surface-glass border-border/50 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Health Score</p>
            <p className="text-2xl font-bold mt-1 text-text">{Math.max(0, Math.min(100, healthScore))}%</p>
            <p className="text-xs text-amber-500 mt-0.5">Eficiência operacional</p>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-full text-amber-500">
            <Gauge size={24} weight="duotone" />
          </div>
        </Card>
      </div>

      {/* Bento Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Farm Control Card (Double wide) */}
        <Card className="lg:col-span-2 p-6 border-border/60 bg-surface/50 backdrop-blur-md flex flex-col gap-4 shadow-sm">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-text flex items-center gap-2">
              <Printer className="text-accent" />
              Fazenda de Impressão 3D
            </h2>
            <Badge variant="secondary">Telemetria Klipper ativa</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            {printers.map((printer) => {
              const assignedFilament = filaments.find(
                (f) => f.id === printer.activeFilamentId
              );
              
              return (
                <Card 
                  key={printer.id} 
                  className={`p-4 border-border/40 relative overflow-hidden transition-all flex flex-col justify-between ${
                    printer.status === "printing"
                      ? "glow-producing"
                      : printer.status === "error"
                      ? "glow-alert"
                      : "bg-surface-muted/20"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-sm text-text">{printer.name}</h3>
                      <p className="text-xs text-text-muted">
                        Consumo: {printer.powerDraw}W | Depreciação: R$ {printer.depreciationPerHour}/h
                      </p>
                    </div>
                    <Badge 
                      className={
                        printer.status === "printing"
                          ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                          : printer.status === "error"
                          ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                          : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                      }
                    >
                      {printer.status === "printing" ? "Imprimindo" : printer.status === "error" ? "Falha" : "Ociosa"}
                    </Badge>
                  </div>

                  {printer.status === "printing" && printer.activePrintJob ? (
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-xs font-semibold text-text">
                        <span className="truncate max-w-[150px]">{printer.activePrintJob.filename}</span>
                        <span>{printer.activePrintJob.progress}%</span>
                      </div>
                      <div className="w-full bg-border/40 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-500 h-full transition-all duration-500" 
                          style={{ width: `${printer.activePrintJob.progress}%` }} 
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-text-muted">
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
                    <div className="mt-4 flex flex-col items-center justify-center p-4 bg-black/5 rounded-md border border-border/20 text-center">
                      {printer.status === "error" ? (
                        <>
                          <Warning className="text-rose-500 h-6 w-6 mb-1" />
                          <p className="text-xs font-semibold text-text">Filamento Emperrado</p>
                          <p className="text-[10px] text-text-muted">Bico obstruído / Erro de telemetria</p>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="text-emerald-500 h-6 w-6 mb-1" />
                          <p className="text-xs font-semibold text-text">Pronta para Produção</p>
                          <p className="text-[10px] text-text-muted">Aguardando arquivo GCode</p>
                        </>
                      )}
                    </div>
                  )}

                  <div className="mt-4 pt-2 border-t border-border/20 flex justify-between items-center text-[10px] text-text-muted">
                    <span>Nozzle: {printer.status === "printing" ? "215°C" : "25°C"}</span>
                    <span>Mesa: {printer.status === "printing" ? "60°C" : "25°C"}</span>
                    <button 
                      onClick={() => deletePrinter(printer.id)} 
                      className="text-rose-400 hover:text-rose-600 transition-colors p-1"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                </Card>
              );
            })}
            
            {printers.length === 0 && (
              <div className="col-span-2 flex flex-col items-center justify-center p-8 border border-dashed border-border/60 rounded-md text-center">
                <Printer className="h-10 w-10 text-text-muted mb-2" />
                <p className="text-sm font-semibold text-text">Nenhuma impressora cadastrada</p>
                <p className="text-xs text-text-muted">Clique em Nova Máquina para cadastrar.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Filament Stock Card */}
        <Card className="p-6 border-border/60 bg-surface/50 backdrop-blur-md flex flex-col gap-4 shadow-sm">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-text flex items-center gap-2">
              <Package className="text-accent" />
              Estoque de Filamento
            </h2>
            <Badge variant="outline">Grams residual</Badge>
          </div>

          <div className="space-y-4 overflow-y-auto max-h-[350px] pr-1 flex-1">
            {filaments.map((filament) => {
              const percentage = (filament.weightGrams / filament.initialWeightGrams) * 100;
              const isLow = filament.weightGrams < filament.minWeightAlert;

              return (
                <div key={filament.id} className="space-y-1.5 p-2 rounded-md hover:bg-surface-muted/10 transition-colors">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span 
                        className="h-3.5 w-3.5 rounded-full border border-border/60 shadow-xs" 
                        style={{ backgroundColor: filament.color }}
                      />
                      <div>
                        <p className="text-xs font-semibold text-text">{filament.name}</p>
                        <p className="text-[10px] text-text-muted">{filament.material} | R$ {filament.costPerGram}/g</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-text">{filament.weightGrams}g</p>
                      {isLow && (
                        <span className="text-[9px] font-bold text-rose-500 uppercase flex items-center gap-0.5 justify-end">
                          <Warning size={10} />
                          Baixo
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="w-full bg-border/40 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${isLow ? "bg-rose-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, percentage)}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center text-[9px] text-text-muted">
                    <span>Original: {filament.initialWeightGrams}g</span>
                    <button 
                      onClick={() => deleteFilament(filament.id)} 
                      className="hover:text-rose-500 transition-colors"
                    >
                      Remover spool
                    </button>
                  </div>
                </div>
              );
            })}

            {filaments.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border/60 rounded-md text-center">
                <Package className="h-10 w-10 text-text-muted mb-2" />
                <p className="text-sm font-semibold text-text">Estoque vazio</p>
                <p className="text-xs text-text-muted">Adicione rolos de filamento para rastrear spools.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Telemetry simulator panel */}
        <Card className="p-6 border-border/60 bg-surface/50 backdrop-blur-md flex flex-col gap-4 shadow-sm">
          <h2 className="text-lg font-bold text-text flex items-center gap-2">
            <Play className="text-emerald-500" />
            Simulador de Telemetria (Klipper Webhook)
          </h2>
          <p className="text-xs text-text-muted">
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
                  className="w-full text-xs p-2 rounded-md border border-border bg-surface text-text"
                  required
                >
                  <option value="">Selecione...</option>
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sim_filament">Filamento Alocado</Label>
                <select 
                  id="sim_filament"
                  value={simFilamentId} 
                  onChange={(e) => setSimFilamentId(e.target.value)}
                  className="w-full text-xs p-2 rounded-md border border-border bg-surface text-text"
                  required
                >
                  <option value="">Selecione...</option>
                  {filaments.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.weightGrams}g restantes)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sim_weight">Peso Peça (gramas)</Label>
                <Input 
                  id="sim_weight"
                  type="number" 
                  value={simWeight} 
                  onChange={(e) => setSimWeight(Number(e.target.value))}
                  min={1}
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
                required
              />
            </div>

            <Button type="submit" disabled={isPending} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold">
              {isPending ? "Concluindo trabalho..." : "Disparar Webhook & Deduzir Estoque"}
            </Button>
          </form>
        </Card>

        {/* Cost log and History feed */}
        <Card className="p-6 border-border/60 bg-surface/50 backdrop-blur-md flex flex-col gap-4 shadow-sm">
          <h2 className="text-lg font-bold text-text flex items-center gap-2">
            <ChartBar className="text-accent" />
            Histórico Recente e Engenharia de Custo Real
          </h2>
          
          <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1 flex-1">
            {printJobs.map((job) => (
              <Card key={job.id} className="p-3 bg-surface-muted/20 border-border/30 hover:border-border/60 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-xs text-text truncate max-w-[200px]">{job.filename}</h4>
                    <p className="text-[10px] text-text-muted">
                      Impressora: {job.printerName} | Filamento: {job.filamentName}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {new Date(job.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Badge>
                </div>

                {job.costs && (
                  <div className="mt-3 grid grid-cols-4 gap-2 pt-2 border-t border-border/20 text-[10px]">
                    <div>
                      <p className="text-text-muted">Material</p>
                      <p className="font-medium text-text">R$ {job.costs.materialCost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Energia</p>
                      <p className="font-medium text-text">R$ {job.costs.energyCost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Depreciação</p>
                      <p className="font-medium text-text">R$ {job.costs.depreciationCost.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-accent font-bold">Custo Total</p>
                      <p className="font-bold text-text">R$ {job.costs.totalCost.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </Card>
            ))}

            {printJobs.length === 0 && (
              <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border/60 rounded-md text-center">
                <Info className="h-8 w-8 text-text-muted mb-2" />
                <p className="text-xs text-text-muted">Nenhum trabalho finalizado no histórico.</p>
                <p className="text-[10px] text-text-muted">Dispare uma simulação acima para registrar custos.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Add Printer Modal */}
      {showAddPrinter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="max-w-md w-full p-6 space-y-4 bg-surface border-border">
            <h3 className="font-bold text-lg text-text">Adicionar Nova Impressora 3D</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="printer_name">Nome da Máquina</Label>
                <Input 
                  id="printer_name"
                  placeholder="ex: Ender 3 V3, Voron 2.4" 
                  value={newPrinter.name}
                  onChange={(e) => setNewPrinter({...newPrinter, name: e.target.value})}
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
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setShowAddPrinter(false)}>Cancelar</Button>
              <Button onClick={addPrinter} className="bg-accent text-white">Cadastrar Máquina</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Add Filament Modal */}
      {showAddFilament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="max-w-md w-full p-6 space-y-4 bg-surface border-border">
            <h3 className="font-bold text-lg text-text">Adicionar Carretel de Filamento</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fil_name">Nome do Insumo</Label>
                <Input 
                  id="fil_name"
                  placeholder="ex: PLA Premium Red" 
                  value={newFilament.name}
                  onChange={(e) => setNewFilament({...newFilament, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="fil_mat">Material</Label>
                  <select 
                    id="fil_mat"
                    value={newFilament.material}
                    onChange={(e) => setNewFilament({...newFilament, material: e.target.value})}
                    className="w-full text-xs p-2.5 rounded-md border border-border bg-surface text-text"
                  >
                    <option value="PLA">PLA</option>
                    <option value="ABS">ABS</option>
                    <option value="PETG">PETG</option>
                    <option value="FLEX">FLEX</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fil_color">Cor</Label>
                  <Input 
                    id="fil_color"
                    type="color" 
                    value={newFilament.color}
                    onChange={(e) => setNewFilament({...newFilament, color: e.target.value})}
                    className="h-10 p-1 cursor-pointer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fil_supplier">Fornecedor</Label>
                  <Input 
                    id="fil_supplier"
                    placeholder="GLTech"
                    value={newFilament.supplier}
                    onChange={(e) => setNewFilament({...newFilament, supplier: e.target.value})}
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fil_min">Alerta Estoque (g)</Label>
                  <Input 
                    id="fil_min"
                    type="number" 
                    value={newFilament.minWeightAlert}
                    onChange={(e) => setNewFilament({...newFilament, minWeightAlert: Number(e.target.value)})}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setShowAddFilament(false)}>Cancelar</Button>
              <Button onClick={addFilament} className="bg-accent text-white">Adicionar Insumo</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
