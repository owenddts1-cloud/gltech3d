"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Handshake,
  Receipt,
  Package,
  Plus,
  Trash2,
  Globe,
  Phone,
  Star,
  AlertTriangle,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Coins
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell
} from "recharts";

interface Filament {
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

interface Supplier {
  id: string;
  name: string;
  category: "filament" | "printer" | "shipping" | "tools" | "other";
  contactPerson?: string;
  phone?: string;
  website?: string;
  rating: number; // 1-5
  avgDeliveryDays: number;
  reliabilityScore: number; // 0-100
}

interface PurchaseLog {
  id: string;
  supplierName: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  date: string;
}

interface Props {
  filaments: Filament[];
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
          background: `radial-gradient(350px circle at ${coords.x}px ${coords.y}px, rgba(255, 107, 0, 0.12), transparent 80%)`,
        }}
      />
      {children}
    </div>
  );
}

function ReliabilityGauge({ score }: { score: number }) {
  const radius = 22;
  const strokeWidth = 4.5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 90) return "stroke-emerald-500";
    if (s >= 70) return "stroke-amber-500";
    return "stroke-red-500";
  };

  return (
    <div className="relative flex items-center justify-center h-14 w-14 shrink-0">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="28"
          cy="28"
          r={radius}
          className="stroke-zinc-800/80 fill-transparent"
          strokeWidth={strokeWidth}
        />
        <circle
          cx="28"
          cy="28"
          r={radius}
          className={cn("fill-transparent transition-all duration-500", getColor(score))}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-black font-mono text-zinc-200">{score}%</span>
    </div>
  );
}

export function SuppliersClient({ filaments }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseLogs, setPurchaseLogs] = useState<PurchaseLog[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);

  // Form states - Add Supplier
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"filament" | "printer" | "shipping" | "tools" | "other">("filament");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [rating, setRating] = useState(5);
  const [avgDeliveryDays, setAvgDeliveryDays] = useState(5);

  // Form states - Log Purchase
  const [logSupplier, setLogSupplier] = useState("");
  const [logItem, setLogItem] = useState("");
  const [logQty, setLogQty] = useState(1);
  const [logPrice, setLogPrice] = useState(0);

  // Filter and Sorting states for Purchase Logs Table
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"date" | "total" | "qty">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Load state
  useEffect(() => {
    // 1. Load suppliers
    const savedSuppliers = localStorage.getItem("gltech_suppliers");
    if (savedSuppliers) {
      setSuppliers(JSON.parse(savedSuppliers));
    } else {
      const defaultSuppliers: Supplier[] = [
        {
          id: "sup-1",
          name: "Filamentos 3D Brasil",
          category: "filament",
          contactPerson: "Carlos M.",
          phone: "11988887777",
          website: "https://www.filamentos3dbrasil.com.br",
          rating: 5,
          avgDeliveryDays: 3,
          reliabilityScore: 98,
        },
        {
          id: "sup-2",
          name: "3D Lab",
          category: "filament",
          contactPerson: "Ana Júlia",
          phone: "31977776666",
          website: "https://3dlab.com.br",
          rating: 4,
          avgDeliveryDays: 4,
          reliabilityScore: 92,
        },
        {
          id: "sup-3",
          name: "eSun Shopee",
          category: "filament",
          phone: "11966665555",
          website: "https://shopee.com.br/esun.br",
          rating: 4,
          avgDeliveryDays: 12,
          reliabilityScore: 95,
        },
        {
          id: "sup-4",
          name: "Voolt3D",
          category: "filament",
          contactPerson: "Eduardo F.",
          phone: "11955554444",
          website: "https://www.voolt3d.com.br",
          rating: 3,
          avgDeliveryDays: 5,
          reliabilityScore: 85,
        },
      ];
      localStorage.setItem("gltech_suppliers", JSON.stringify(defaultSuppliers));
      setSuppliers(defaultSuppliers);
    }

    // 2. Load purchase history
    const savedLogs = localStorage.getItem("gltech_purchases");
    if (savedLogs) {
      setPurchaseLogs(JSON.parse(savedLogs));
    } else {
      const defaultLogs: PurchaseLog[] = [
        {
          id: "p-1",
          supplierName: "Filamentos 3D Brasil",
          itemName: "PLA Premium Preto 1kg",
          qty: 5,
          unitPrice: 89.9,
          date: "2026-07-01",
        },
        {
          id: "p-2",
          supplierName: "3D Lab",
          itemName: "PETG Cinza Espacial 1kg",
          qty: 3,
          unitPrice: 95.0,
          date: "2026-07-05",
        },
        {
          id: "p-3",
          supplierName: "eSun Shopee",
          itemName: "PLA-CF Fibra de Carbono 1kg",
          qty: 2,
          unitPrice: 189.0,
          date: "2026-06-25",
        },
      ];
      localStorage.setItem("gltech_purchases", JSON.stringify(defaultLogs));
      setPurchaseLogs(defaultLogs);
    }
  }, []);

  // Sync database suppliers name with our local filaments list
  const suppliersStats = useMemo(() => {
    return suppliers.map((sup) => {
      // Find all filaments loaded from db associated with this supplier name
      const associatedFilaments = filaments.filter(
        (f) => f.supplier?.toLowerCase().trim() === sup.name.toLowerCase().trim()
      );
      
      const totalSpend = purchaseLogs
        .filter((log) => log.supplierName === sup.name)
        .reduce((sum, log) => sum + log.qty * log.unitPrice, 0);

      return {
        ...sup,
        materialsCount: associatedFilaments.length,
        materialsList: associatedFilaments,
        totalSpend,
      };
    });
  }, [suppliers, filaments, purchaseLogs]);

  // Overall calculations
  const summary = useMemo(() => {
    const totalSuppliers = suppliers.length;
    const totalMonthSpend = purchaseLogs.reduce((sum, log) => sum + log.qty * log.unitPrice, 0);
    const avgDelivery =
      suppliers.reduce((sum, s) => sum + s.avgDeliveryDays, 0) / (totalSuppliers || 1);

    // Identify filaments with high cost alert (benchmark R$ 0.12 per gram)
    const highCostAlerts = filaments.filter((f) => f.costPerGram > 0.12).length;

    return { totalSuppliers, totalMonthSpend, avgDelivery: avgDelivery.toFixed(1), highCostAlerts };
  }, [suppliers, purchaseLogs, filaments]);

  // Add Supplier Handler
  const handleAddSupplier = () => {
    if (!name.trim()) return;

    const newSup: Supplier = {
      id: `sup-${Math.random().toString(36).substring(2, 9)}`,
      name,
      category,
      contactPerson: contactPerson || undefined,
      phone: phone || undefined,
      website: website || undefined,
      rating,
      avgDeliveryDays,
      reliabilityScore: 90, // initial default
    };

    const updated = [...suppliers, newSup];
    localStorage.setItem("gltech_suppliers", JSON.stringify(updated));
    setSuppliers(updated);

    toast.success(`Fornecedor "${name}" cadastrado!`);
    setIsAddOpen(false);
    resetSupplierForm();
  };

  const resetSupplierForm = () => {
    setName("");
    setCategory("filament");
    setContactPerson("");
    setPhone("");
    setWebsite("");
    setRating(5);
    setAvgDeliveryDays(5);
  };

  // Log Purchase Handler
  const handleLogPurchase = () => {
    if (!logSupplier || !logItem.trim() || logPrice <= 0) return;

    const newLog: PurchaseLog = {
      id: `p-${Math.random().toString(36).substring(2, 9)}`,
      supplierName: logSupplier,
      itemName: logItem,
      qty: logQty,
      unitPrice: logPrice,
      date: new Date().toISOString().split("T")[0]!,
    };

    const updated = [...purchaseLogs, newLog];
    localStorage.setItem("gltech_purchases", JSON.stringify(updated));
    setPurchaseLogs(updated);

    toast.success(`Compra registrada com sucesso!`);
    setIsLogOpen(false);
    resetLogForm();
  };

  const resetLogForm = () => {
    setLogSupplier("");
    setLogItem("");
    setLogQty(1);
    setLogPrice(0);
  };

  // Delete Supplier
  const handleDeleteSupplier = (id: string) => {
    const updated = suppliers.filter((s) => s.id !== id);
    localStorage.setItem("gltech_suppliers", JSON.stringify(updated));
    setSuppliers(updated);
    toast.success("Fornecedor removido.");
  };

  // Sorting / Filtering of Purchase logs
  const handleSort = (field: "date" | "total" | "qty") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const filteredLogs = useMemo(() => {
    const result = purchaseLogs.filter((log) => {
      const q = searchQuery.toLowerCase();
      return (
        log.itemName.toLowerCase().includes(q) ||
        log.supplierName.toLowerCase().includes(q)
      );
    });

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "date") {
        comparison = a.date.localeCompare(b.date);
      } else if (sortField === "qty") {
        comparison = a.qty - b.qty;
      } else if (sortField === "total") {
        comparison = a.qty * a.unitPrice - b.qty * b.unitPrice;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [purchaseLogs, searchQuery, sortField, sortOrder]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  // Filament pricing matrix chart helper
  const chartData = useMemo(() => {
    return filaments.map((f) => ({
      name: f.name.length > 15 ? f.name.substring(0, 15) + "..." : f.name,
      fullName: f.name,
      "Custo/g": f.costPerGram,
    }));
  }, [filaments]);

  return (
    <div className="space-y-6 p-6 mx-auto max-w-7xl">
      {/* ─── Premium Header ─── */}
      <header className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 backdrop-blur-md">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-inner">
              <Handshake size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Gestão de Fornecedores</h1>
              <p className="mt-0.5 text-sm text-zinc-400 font-medium">
                Monitore a confiabilidade de parceiros de insumos e compare preços de filamentos e fretes.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-9 gap-1.5 font-semibold text-xs border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300"
              onClick={() => setIsLogOpen(true)}
            >
              <Receipt size={14} />
              Registrar Compra
            </Button>
            <Button
              size="sm"
              className="rounded-xl h-9 gap-1.5 font-semibold text-xs bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => setIsAddOpen(true)}
            >
              <Plus size={14} />
              Novo Fornecedor
            </Button>
          </div>
        </div>
      </header>

      {/* ─── KPIs Spotlight Grid ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SpotlightCard className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-950/40">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Parceiros</span>
            <Handshake size={14} />
          </div>
          <span className="mt-2 block text-2xl font-black text-zinc-100 font-mono tabular-nums">{summary.totalSuppliers}</span>
          <span className="text-[10px] text-zinc-450 block mt-0.5 font-medium">fornecedores cadastrados</span>
        </SpotlightCard>

        <SpotlightCard className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-950/40">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Gasto Acumulado</span>
            <Coins size={14} className="text-emerald-500" />
          </div>
          <span className="mt-2 block text-2xl font-black text-zinc-100 font-mono tabular-nums">
            R$ {summary.totalMonthSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-zinc-450 block mt-0.5 font-medium">histórico acumulado</span>
        </SpotlightCard>

        <SpotlightCard className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-950/40">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Prazo Médio</span>
            <Package size={14} />
          </div>
          <span className="mt-2 block text-2xl font-black text-zinc-100 font-mono tabular-nums">{summary.avgDelivery} dias</span>
          <span className="text-[10px] text-zinc-450 block mt-0.5 font-medium">tempo médio de entrega</span>
        </SpotlightCard>

        <SpotlightCard className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-950/40">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Alertas de Inflação</span>
            <AlertTriangle size={14} className={summary.highCostAlerts > 0 ? "text-amber-500 animate-pulse" : ""} />
          </div>
          <span className="mt-2 block text-2xl font-black text-zinc-100 font-mono tabular-nums">{summary.highCostAlerts}</span>
          <span className="text-[10px] text-zinc-450 block mt-0.5 font-medium">insumos acima do ideal</span>
        </SpotlightCard>
      </div>

      {/* ─── Main split layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left and Middle: Suppliers directory */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Diretório de Fornecedores</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suppliersStats.map((sup) => (
              <SpotlightCard key={sup.id} className="p-5 rounded-2xl border border-zinc-800/60 bg-zinc-950/40 flex flex-col justify-between hover:shadow-lg transition-all relative overflow-hidden">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-zinc-150 truncate">{sup.name}</h3>
                      <span className="text-[10px] text-zinc-450 mt-0.5 block font-bold capitalize">
                        {sup.category === "filament" ? "Insumos & Filamentos" : sup.category}
                      </span>
                    </div>

                    {/* Reliability circle gauge */}
                    <div className="flex items-center gap-1">
                      <ReliabilityGauge score={sup.reliabilityScore} />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400 font-medium">Contato:</span>
                      <span className="font-semibold text-zinc-200">{sup.contactPerson || "Não informado"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 font-medium">Prazo médio:</span>
                      <span className="font-semibold text-zinc-200">{sup.avgDeliveryDays} dias</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 font-medium">Classificação:</span>
                      <div className="flex items-center gap-0.5 text-orange-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={11}
                            className={cn(i < sup.rating ? "fill-orange-500 text-orange-500" : "text-zinc-800")}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 font-medium">Materiais:</span>
                      <span className="font-semibold text-zinc-200">{sup.materialsCount} vinculados</span>
                    </div>
                    <div className="flex justify-between border-t border-zinc-900 pt-2 mt-1">
                      <span className="text-zinc-400 font-bold">Investido Acumulado:</span>
                      <span className="font-black text-zinc-100 font-mono">
                        R$ {sup.totalSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between">
                  <div className="flex gap-2">
                    {sup.website && (
                      <a href={sup.website} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 hover:text-zinc-100 text-zinc-400" title="Visitar Site">
                          <Globe size={13} />
                        </Button>
                      </a>
                    )}
                    {sup.phone && (
                      <a href={`https://wa.me/${sup.phone}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 hover:text-emerald-500 text-emerald-600" title="Contato WhatsApp">
                          <Phone size={13} />
                        </Button>
                      </a>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    className="h-7 w-7 p-0 border-red-500/20 hover:bg-red-500/10 text-red-500 rounded-lg"
                    onClick={() => handleDeleteSupplier(sup.id)}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </SpotlightCard>
            ))}
          </div>
        </div>

        {/* Right side: Recharts comparison chart & purchases list */}
        <div className="space-y-6">
          {/* Filament price comparison Recharts bar chart */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-orange-500" />
              Matriz Comparativa de Custo/g
            </h2>
            <Card className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/40">
              <div className="h-56 w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: -15, right: 10, top: 5, bottom: 5 }}>
                      <XAxis type="number" stroke="#52525b" fontSize={9} tickFormatter={(val) => `R$${val.toFixed(2)}`} />
                      <YAxis type="category" dataKey="name" stroke="#52525b" fontSize={9} />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0]!.payload;
                            const cost = payload[0]!.value as number;
                            return (
                              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 shadow-xl backdrop-blur-md text-[10px] space-y-1">
                                <p className="font-bold text-zinc-200">{data.fullName}</p>
                                <p className="text-orange-400 font-bold">Custo por Grama: R$ {cost.toFixed(3)}</p>
                                <p className="text-zinc-500">Benchmark ideal: R$ 0.12</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="Custo/g" radius={[0, 4, 4, 0]} barSize={10}>
                        {chartData.map((entry, idx) => {
                          const val = entry["Custo/g"];
                          // Green if <= 0.09, Amber if <= 0.12, Red if > 0.12
                          const color = val <= 0.09 ? "#10b981" : val <= 0.12 ? "#f59e0b" : "#ef4444";
                          return <Cell key={`cell-${idx}`} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-zinc-500">Sem dados comparativos.</div>
                )}
              </div>
              <div className="flex items-center justify-between text-[8px] font-black uppercase text-zinc-500 pt-2 border-t border-zinc-900">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 block" /> Ideal (≤R$0.09)</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 block" /> Aceitável</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 block" /> Inflacionado</span>
              </div>
            </Card>
          </div>

          {/* Advanced purchases logs feed */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Histórico de Compras</h2>
            <Card className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 space-y-3">
              {/* Search & Sort Controls */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <Input
                    placeholder="Buscar compra..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-8 h-8 rounded-lg text-xs bg-zinc-900 border-zinc-850"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleSort("total")}
                  className="h-8 w-8 rounded-lg border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  title="Ordenar por Valor"
                >
                  <ArrowUpDown className="h-3 w-3" />
                </Button>
              </div>

              {/* Table List */}
              <div className="divide-y divide-zinc-900 max-h-[260px] overflow-y-auto scrollbar-thin space-y-1">
                {paginatedLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-200 truncate">{log.itemName}</p>
                      <span className="text-[10px] text-zinc-450 block font-medium">
                        {log.supplierName} · {log.qty} un
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-zinc-150 font-mono">
                        R$ {(log.qty * log.unitPrice).toFixed(2)}
                      </span>
                      <span className="block text-[9px] text-zinc-500 font-bold font-mono mt-0.5">{log.date}</span>
                    </div>
                  </div>
                ))}
                {filteredLogs.length === 0 && (
                  <p className="text-xs text-zinc-550 text-center py-6">Nenhum registro encontrado.</p>
                )}
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center pt-2 border-t border-zinc-900 text-[10px]">
                  <span className="text-zinc-500 font-bold">
                    Página {currentPage} de {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                      className="h-6 w-6 rounded-md border-zinc-800 disabled:opacity-30"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                      className="h-6 w-6 rounded-md border-zinc-800 disabled:opacity-30"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* ─── Add Supplier Dialog ─── */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if(!open) resetSupplierForm(); }}>
        <DialogContent className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 text-xs">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-zinc-100">Cadastrar Fornecedor</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="sup-name">Nome da Empresa</Label>
              <Input
                id="sup-name"
                placeholder="Ex: eSun Distribuidora"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sup-category">Categoria</Label>
                <Select value={category} onValueChange={(val: "filament" | "printer" | "shipping" | "tools" | "other") => setCategory(val)}>
                  <SelectTrigger id="sup-category" className="h-9 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-805 text-zinc-100">
                    <SelectItem value="filament" className="focus:bg-zinc-900 focus:text-zinc-100">Filamentos / Insumos</SelectItem>
                    <SelectItem value="printer" className="focus:bg-zinc-900 focus:text-zinc-100">Impressoras / Peças</SelectItem>
                    <SelectItem value="shipping" className="focus:bg-zinc-900 focus:text-zinc-100">Logística / Frete</SelectItem>
                    <SelectItem value="tools" className="focus:bg-zinc-900 focus:text-zinc-100">Bancada / Ferramentas</SelectItem>
                    <SelectItem value="other" className="focus:bg-zinc-900 focus:text-zinc-100">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sup-delivery">Tempo de Entrega (dias)</Label>
                <Input
                  id="sup-delivery"
                  type="number"
                  value={avgDeliveryDays}
                  onChange={(e) => setAvgDeliveryDays(Number(e.target.value))}
                  className="h-9 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sup-contact">Pessoa de Contato</Label>
              <Input
                id="sup-contact"
                placeholder="Ex: Carlos Mota"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="h-9 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sup-phone">WhatsApp/Telefone (DDD + Número)</Label>
                <Input
                  id="sup-phone"
                  placeholder="Ex: 11988887777"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-9 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sup-web">Website URL</Label>
                <Input
                  id="sup-web"
                  placeholder="https://exemplo.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="h-9 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sup-rating">Avaliação Inicial</Label>
              <Select value={String(rating)} onValueChange={(val) => setRating(Number(val))}>
                <SelectTrigger id="sup-rating" className="h-9 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-805 text-zinc-100">
                  <SelectItem value="5" className="focus:bg-zinc-900 focus:text-zinc-100">Excelentíssimo</SelectItem>
                  <SelectItem value="4" className="focus:bg-zinc-900 focus:text-zinc-100">Muito Bom</SelectItem>
                  <SelectItem value="3" className="focus:bg-zinc-900 focus:text-zinc-100">Regular</SelectItem>
                  <SelectItem value="2" className="focus:bg-zinc-900 focus:text-zinc-100">Instável</SelectItem>
                  <SelectItem value="1" className="focus:bg-zinc-900 focus:text-zinc-100">Crítico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs border-zinc-800 hover:bg-zinc-900"
              onClick={() => {
                setIsAddOpen(false);
                resetSupplierForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="rounded-xl text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleAddSupplier}
              disabled={!name.trim()}
            >
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Log Purchase Dialog ─── */}
      <Dialog open={isLogOpen} onOpenChange={(open) => { setIsLogOpen(open); if(!open) resetLogForm(); }}>
        <DialogContent className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 text-xs">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-zinc-100">Registrar Compra de Insumos</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="log-supplier">Selecione o Fornecedor</Label>
              <Select value={logSupplier} onValueChange={(val) => setLogSupplier(val)}>
                <SelectTrigger id="log-supplier" className="h-9 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200">
                  <SelectValue placeholder="Selecione o fornecedor" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-805 text-zinc-100">
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.name} className="focus:bg-zinc-900 focus:text-zinc-100">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="log-item">Nome do Item comprado</Label>
              <Input
                id="log-item"
                placeholder="Ex: PLA Premium Cinza 1kg"
                value={logItem}
                onChange={(e) => setLogItem(e.target.value)}
                className="h-9 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="log-qty">Quantidade</Label>
                <Input
                  id="log-qty"
                  type="number"
                  min="1"
                  value={logQty}
                  onChange={(e) => setLogQty(Number(e.target.value))}
                  className="h-9 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="log-price">Preço Unitário (R$)</Label>
                <Input
                  id="log-price"
                  type="number"
                  step="0.01"
                  value={logPrice}
                  onChange={(e) => setLogPrice(Number(e.target.value))}
                  className="h-9 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs border-zinc-800 hover:bg-zinc-900"
              onClick={() => {
                setIsLogOpen(false);
                resetLogForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="rounded-xl text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleLogPurchase}
              disabled={!logSupplier || !logItem.trim() || logPrice <= 0}
            >
              Registrar Compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
