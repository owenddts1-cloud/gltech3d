"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Wrench,
  Users,
  Package,
  Trash2,
  Clock,
  Cpu,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ServiceOrder {
  id: string;
  title: string;
  contactName: string | null;
  status: string;
  totalCents: number;
  qty: number;
  slaDueAt: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  type: "os" | "maintenance" | "meeting" | "delivery" | "custom";
  printerName?: string;
  contactName?: string;
  isCustom?: boolean;
}

interface Props {
  initialOrders: ServiceOrder[];
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

export function CalendarClient({ initialOrders }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "agenda">("grid");

  // Filter categories state
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({
    os: true,
    maintenance: true,
    meeting: true,
    delivery: true,
    custom: true,
  });

  // Modal forms state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"maintenance" | "meeting" | "delivery" | "custom">("custom");
  const [newPrinter, setNewPrinter] = useState("");
  const [newContact, setNewContact] = useState("");

  // Load and merge events
  useEffect(() => {
    // 1. Sync real Service Orders with SLA dates
    const osEvents: CalendarEvent[] = initialOrders
      .filter((os) => os.slaDueAt)
      .map((os) => {
        const d = parseISO(os.slaDueAt!);
        return {
          id: `os-${os.id}`,
          title: `OS: ${os.title}`,
          description: `Status: ${os.status.toUpperCase()} | Qtd: ${os.qty} | Valor: R$ ${(os.totalCents / 100).toFixed(2)}`,
          date: format(d, "yyyy-MM-dd"),
          type: "os",
          contactName: os.contactName || undefined,
        };
      });

    // 2. Pre-populate some realistic printer maintenance events if localStorage is empty
    const savedCustom = localStorage.getItem("gltech_calendar_events");
    let customEvents: CalendarEvent[] = [];

    if (savedCustom) {
      customEvents = JSON.parse(savedCustom);
    } else {
      // Seed initial dummy events
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = format(tomorrow, "yyyy-MM-dd");

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 2);
      const yesterdayStr = format(yesterday, "yyyy-MM-dd");

      customEvents = [
        {
          id: "maint-1",
          title: "Lubrificação de Eixos - Ender 3 S1",
          description: "Limpar eixos lineares e aplicar graxa branca de lítio.",
          date: todayStr,
          type: "maintenance",
          printerName: "Ender 3 S1 #01",
          isCustom: true,
        },
        {
          id: "maint-2",
          title: "Troca de Bico (Nozzle) - Bambu Lab X1C",
          description: "Substituir bico 0.4 de latão por bico de aço endurecido 0.6 para filamentos carregados (fibra de carbono).",
          date: tomorrowStr,
          type: "maintenance",
          printerName: "Bambu Lab X1C #02",
          isCustom: true,
        },
        {
          id: "meet-1",
          title: "Apresentação de Protótipo - AeroDesign",
          description: "Reunião presencial com a equipe de engenharia para avaliar estabilizadores traseiros impressos em PLA-CF.",
          date: tomorrowStr,
          type: "meeting",
          contactName: "Gabriel Siqueira",
          isCustom: true,
        },
        {
          id: "del-1",
          title: "Chegada de Lote de Filamento - eSun",
          description: "Entrega de 10 kg de filamento PETG (Cores Preto e Cinza) comprados na Shopee.",
          date: yesterdayStr,
          type: "delivery",
          isCustom: true,
        }
      ];
      localStorage.setItem("gltech_calendar_events", JSON.stringify(customEvents));
    }

    setEvents([...osEvents, ...customEvents]);
  }, [initialOrders]);

  // Calendar dates generation
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const dateInterval = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get leading empty days to align calendar grid (Sunday = 0, Monday = 1, etc.)
  const startDayOfWeek = monthStart.getDay();
  const leadingDays = Array.from({ length: startDayOfWeek }).map((_, i) => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - (startDayOfWeek - i));
    return d;
  });

  const calendarDays = [...leadingDays, ...dateInterval];

  // Filtering logic
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => activeFilters[evt.type]);
  }, [events, activeFilters]);

  // Statistics
  const stats = useMemo(() => {
    const activeMonthEvents = events.filter((evt) => {
      const d = parseISO(evt.date + "T00:00:00");
      return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
    });

    return {
      total: activeMonthEvents.length,
      os: activeMonthEvents.filter((e) => e.type === "os").length,
      maintenance: activeMonthEvents.filter((e) => e.type === "maintenance").length,
      meetings: activeMonthEvents.filter((e) => e.type === "meeting").length,
      deliveries: activeMonthEvents.filter((e) => e.type === "delivery").length,
    };
  }, [events, currentDate]);

  // Workload estimator per day
  const getDayWorkload = (dayStr: string) => {
    const dayEvts = filteredEvents.filter((e) => e.date === dayStr);
    let load = 0;
    dayEvts.forEach((evt) => {
      if (evt.type === "os") load += 35;
      else if (evt.type === "maintenance") load += 40;
      else if (evt.type === "meeting") load += 15;
      else load += 10;
    });
    return Math.min(load, 100);
  };

  // Month navigation
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // Add event handler
  const handleAddEvent = () => {
    if (!newTitle.trim() || !selectedDay) return;

    const formattedDate = format(selectedDay, "yyyy-MM-dd");
    const newEvent: CalendarEvent = {
      id: `custom-${Math.random().toString(36).substring(2, 9)}`,
      title: newTitle,
      description: newDesc,
      date: formattedDate,
      type: newType,
      printerName: newType === "maintenance" ? newPrinter : undefined,
      contactName: newType === "meeting" ? newContact : undefined,
      isCustom: true,
    };

    const savedCustom = localStorage.getItem("gltech_calendar_events");
    const customEvents = savedCustom ? JSON.parse(savedCustom) : [];
    const updated = [...customEvents, newEvent];

    localStorage.setItem("gltech_calendar_events", JSON.stringify(updated));
    setEvents((prev) => [...prev, newEvent]);

    toast.success("Evento agendado com sucesso!");
    setIsAddOpen(false);
    resetForm();
  };

  // Delete event handler
  const handleDeleteEvent = (id: string) => {
    const savedCustom = localStorage.getItem("gltech_calendar_events");
    const customEvents = savedCustom ? JSON.parse(savedCustom) : [];
    const updated = customEvents.filter((e: CalendarEvent) => e.id !== id);

    localStorage.setItem("gltech_calendar_events", JSON.stringify(updated));
    setEvents((prev) => prev.filter((e) => e.id !== id));

    toast.success("Evento removido.");
    setSelectedEvent(null);
  };

  const resetForm = () => {
    setNewTitle("");
    setNewDesc("");
    setNewType("custom");
    setNewPrinter("");
    setNewContact("");
  };

  const toggleFilter = (type: string) => {
    setActiveFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case "os":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "maintenance":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "meeting":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "delivery":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "os":
        return <ClipboardList size={12} />;
      case "maintenance":
        return <Wrench size={12} />;
      case "meeting":
        return <Users size={12} />;
      case "delivery":
        return <Package size={12} />;
      default:
        return <CalendarIcon size={12} />;
    }
  };

  // Factory workload estimation (high-fidelity indicator)
  const factoryWorkload = useMemo(() => {
    const activeJobsCount = stats.maintenance + stats.os * 2;
    const pct = Math.min(Math.round((activeJobsCount / 12) * 100), 100);
    return pct;
  }, [stats]);

  // Group events for agenda view
  const agendaGroups = useMemo(() => {
    const currentMonthStr = format(currentDate, "yyyy-MM");
    const monthEvents = filteredEvents.filter((e) => e.date.startsWith(currentMonthStr));
    
    // Sort chronologically
    monthEvents.sort((a, b) => a.date.localeCompare(b.date));

    // Group by day string
    const groups: Record<string, CalendarEvent[]> = {};
    monthEvents.forEach((evt) => {
      if (!groups[evt.date]) groups[evt.date] = [];
      groups[evt.date]!.push(evt);
    });

    return Object.entries(groups).map(([dateStr, list]) => ({
      date: parseISO(dateStr + "T00:00:00"),
      dateStr,
      events: list,
    }));
  }, [filteredEvents, currentDate]);

  return (
    <div className="space-y-6 p-6 mx-auto max-w-7xl">
      {/* ─── Premium Header ─── */}
      <header className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 backdrop-blur-md">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-inner">
              <CalendarIcon size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
                Cronograma da Fábrica
              </h1>
              <p className="mt-0.5 text-sm text-zinc-400 font-medium">
                Monitore e agende prazos de OS, preventivas de hardware e reuniões de engenharia.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
            {/* View Mode Toggle Switch */}
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800/80">
              {(["grid", "agenda"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "relative px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize",
                    viewMode === mode ? "text-zinc-100 font-bold" : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {viewMode === mode && (
                    <motion.div
                      layoutId="calendar-view-pill"
                      className="absolute inset-0 bg-orange-600 rounded-lg -z-0"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{mode === "grid" ? "Visualização Mês" : "Agenda Linear"}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={prevMonth}
                className="h-9 w-9 rounded-lg border border-zinc-850 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300"
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm font-bold min-w-[120px] text-center capitalize text-zinc-200">
                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={nextMonth}
                className="h-9 w-9 rounded-lg border border-zinc-850 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Workspace Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Side: Controls & Analytics */}
        <div className="space-y-6">
          {/* Quick Filters */}
          <SpotlightCard className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-950/40">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Categorias de Eventos</h3>
            <div className="space-y-2">
              <button
                onClick={() => toggleFilter("os")}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02]",
                  activeFilters.os
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                    : "bg-zinc-950/30 border-zinc-900 text-zinc-500"
                )}
              >
                <span className="flex items-center gap-2">
                  <ClipboardList size={14} /> Prazos de OS (SLA)
                </span>
                <span className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800 text-zinc-400 font-mono font-bold">{stats.os}</span>
              </button>

              <button
                onClick={() => toggleFilter("maintenance")}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02]",
                  activeFilters.maintenance
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "bg-zinc-950/30 border-zinc-900 text-zinc-500"
                )}
              >
                <span className="flex items-center gap-2">
                  <Wrench size={14} /> Manutenção Preventiva
                </span>
                <span className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800 text-zinc-400 font-mono font-bold">{stats.maintenance}</span>
              </button>

              <button
                onClick={() => toggleFilter("meeting")}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02]",
                  activeFilters.meeting
                    ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                    : "bg-zinc-950/30 border-zinc-900 text-zinc-500"
                )}
              >
                <span className="flex items-center gap-2">
                  <Users size={14} /> Reuniões & Clientes
                </span>
                <span className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800 text-zinc-400 font-mono font-bold">{stats.meetings}</span>
              </button>

              <button
                onClick={() => toggleFilter("delivery")}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02]",
                  activeFilters.delivery
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-zinc-950/30 border-zinc-900 text-zinc-500"
                )}
              >
                <span className="flex items-center gap-2">
                  <Package size={14} /> Entregas de Insumos
                </span>
                <span className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800 text-zinc-400 font-mono font-bold">{stats.deliveries}</span>
              </button>

              <button
                onClick={() => toggleFilter("custom")}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02]",
                  activeFilters.custom
                    ? "bg-zinc-500/10 border-zinc-500/30 text-zinc-300"
                    : "bg-zinc-950/30 border-zinc-900 text-zinc-500"
                )}
              >
                <span className="flex items-center gap-2">
                  <CalendarIcon size={14} /> Tarefas Customizadas
                </span>
              </button>
            </div>
          </SpotlightCard>

          {/* Farm Workload Estimator */}
          <SpotlightCard className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-950/40">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Carga da Fábrica (Mês)</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-baseline text-xs">
                <span className="text-zinc-400">Utilização Estimada</span>
                <span className="font-bold text-zinc-150 tabular-nums">{factoryWorkload}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-900 overflow-hidden border border-zinc-800/50">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    factoryWorkload > 80
                      ? "bg-red-500 animate-pulse"
                      : factoryWorkload > 50
                      ? "bg-orange-500"
                      : "bg-emerald-500"
                  )}
                  style={{ width: `${factoryWorkload}%` }}
                />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed mt-2.5">
              Estimativa computada com base nas manutenções agendadas e prazos ativos de ordens de serviço.
            </p>
          </SpotlightCard>

          {/* Quick instructions */}
          <Card className="p-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/10 space-y-2">
            <h3 className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-emerald-500" /> Agendamento Rápido
            </h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Clique em qualquer dia do grid do calendário para agendar uma manutenção, reunião ou entrega de filamentos de forma simples.
            </p>
          </Card>
        </div>

        {/* Right Side: Interactive Calendar Views */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {viewMode === "grid" ? (
              <motion.div
                key="grid-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                <Card className="rounded-2xl border border-zinc-800 overflow-hidden bg-zinc-950/40 backdrop-blur-md shadow-xl">
                  {/* Days of week header */}
                  <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-900/30 text-center text-xs font-semibold text-zinc-400 py-3">
                    <span>Dom</span>
                    <span>Seg</span>
                    <span>Ter</span>
                    <span>Qua</span>
                    <span>Qui</span>
                    <span>Sex</span>
                    <span>Sáb</span>
                  </div>

                  {/* Grid days */}
                  <div className="grid grid-cols-7 grid-flow-row auto-rows-[115px] divide-x divide-y divide-zinc-850">
                    {calendarDays.map((day, idx) => {
                      const dayStr = format(day, "yyyy-MM-dd");
                      const dayEvents = filteredEvents.filter((e) => e.date === dayStr);
                      const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                      const workload = getDayWorkload(dayStr);

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedDay(day);
                            setIsAddOpen(true);
                          }}
                          className={cn(
                            "relative p-2.5 flex flex-col justify-between hover:bg-zinc-900/30 transition-colors cursor-pointer overflow-hidden group",
                            isCurrentMonth ? "text-zinc-200 bg-zinc-950/10" : "text-zinc-500 bg-zinc-900/5 opacity-40",
                            isToday(day) ? "ring-1 ring-orange-500/50 z-10" : ""
                          )}
                        >
                          {/* Workload Indicator line at top */}
                          {workload > 0 && (
                            <div 
                              className={cn(
                                "absolute top-0 left-0 right-0 h-[3px] transition-all",
                                workload > 75
                                  ? "bg-gradient-to-r from-red-500 to-orange-500 animate-pulse"
                                  : workload > 40
                                  ? "bg-gradient-to-r from-orange-500 to-amber-500"
                                  : "bg-gradient-to-r from-emerald-500 to-teal-500"
                              )}
                              title={`Carga de trabalho: ${workload}%`}
                            />
                          )}

                          {/* Day Number */}
                          <div className="flex justify-between items-center z-10">
                            <span
                              className={cn(
                                "text-xs font-bold font-mono rounded-md h-6.5 w-6.5 flex items-center justify-center border border-transparent transition-all",
                                isToday(day) ? "bg-orange-600 text-white font-extrabold shadow-md border-orange-500" : "text-zinc-300 group-hover:border-zinc-800"
                              )}
                            >
                              {format(day, "d")}
                            </span>
                            {isToday(day) && (
                              <span className="text-[8px] uppercase tracking-wider text-orange-400 font-extrabold animate-pulse">Hoje</span>
                            )}
                          </div>

                          {/* Day Events Stack */}
                          <div className="mt-2 flex-1 flex flex-col gap-1 overflow-y-auto scrollbar-none z-10">
                            {dayEvents.slice(0, 3).map((evt) => (
                              <div
                                key={evt.id}
                                onClick={(e) => {
                                  e.stopPropagation(); // Avoid triggering open add dialog
                                  setSelectedEvent(evt);
                                }}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-lg px-2 py-0.8 text-[9px] font-bold border truncate transition-all hover:scale-[1.03] shadow-inner",
                                  getEventBadgeClass(evt.type)
                                )}
                                title={evt.title}
                              >
                                {getEventIcon(evt.type)}
                                <span className="truncate flex-1">{evt.title}</span>
                              </div>
                            ))}
                            {dayEvents.length > 3 && (
                              <div className="text-[8px] font-bold text-zinc-500 text-center py-0.5 bg-zinc-900/50 rounded-md border border-zinc-800">
                                +{dayEvents.length - 3} itens
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="agenda-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="space-y-4"
              >
                {agendaGroups.length > 0 ? (
                  agendaGroups.map((group) => (
                    <Card key={group.dateStr} className="p-4 border-zinc-800/80 bg-zinc-950/40 backdrop-blur-md rounded-2xl flex flex-col md:flex-row gap-4 items-start shadow-md">
                      {/* Left: Date header */}
                      <div className="md:w-32 flex md:flex-col items-baseline md:items-center justify-between md:justify-center border-b md:border-b-0 md:border-r border-zinc-800 pb-2 md:pb-0 md:pr-4 shrink-0 w-full">
                        <span className="text-2xl font-black font-mono text-zinc-100">{format(group.date, "dd")}</span>
                        <span className="text-xs text-zinc-400 capitalize font-medium">{format(group.date, "EEEE", { locale: ptBR })}</span>
                      </div>

                      {/* Right: Events stack */}
                      <div className="flex-1 w-full space-y-2">
                        {group.events.map((evt) => (
                          <div
                            key={evt.id}
                            onClick={() => setSelectedEvent(evt)}
                            className={cn(
                              "p-3 rounded-xl border flex items-center justify-between hover:bg-zinc-900/20 transition-all cursor-pointer",
                              getEventBadgeClass(evt.type)
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-zinc-900/50 border border-zinc-800/80">
                                {getEventIcon(evt.type)}
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-zinc-150">{evt.title}</h4>
                                {evt.description && <p className="text-[10px] text-zinc-450 mt-0.5 truncate max-w-[300px]">{evt.description}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {evt.printerName && <Badge variant="outline" className="text-[9px] border-zinc-800 text-amber-500 font-semibold bg-zinc-950">{evt.printerName}</Badge>}
                              {evt.contactName && <Badge variant="outline" className="text-[9px] border-zinc-800 text-purple-500 font-semibold bg-zinc-950">{evt.contactName}</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card className="p-12 text-center border-zinc-800 bg-zinc-950/40 rounded-2xl flex flex-col items-center justify-center">
                    <AlertTriangle className="h-10 w-10 text-zinc-550 mb-2" />
                    <p className="text-xs text-zinc-400">Nenhum evento agendado para o mês ativo.</p>
                    <p className="text-[10px] text-zinc-500 mt-1">Clique em qualquer dia do grid mensal para criar um novo registro.</p>
                  </Card>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Detail Dialog ─── */}
      <Dialog open={selectedEvent !== null} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100">
          {selectedEvent && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`capitalize font-bold text-[10px] py-0.5 px-2.5 ${getEventBadgeClass(selectedEvent.type)}`}>
                    {selectedEvent.type === "os" ? "Ordem de Serviço" : selectedEvent.type}
                  </Badge>
                  <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono font-bold">
                    <Clock size={12} />
                    {format(parseISO(selectedEvent.date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <DialogTitle className="text-lg font-bold text-zinc-100 mt-2">{selectedEvent.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-3 text-xs">
                {selectedEvent.description && (
                  <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/80 p-3">
                    <p className="text-[9px] text-zinc-450 uppercase font-black tracking-wider mb-1">Descrição</p>
                    <p className="text-zinc-350 leading-relaxed text-xs">{selectedEvent.description}</p>
                  </div>
                )}

                {selectedEvent.printerName && (
                  <div className="flex items-center gap-2 text-xs">
                    <Cpu className="text-amber-500" size={14} />
                    <span className="text-zinc-400">Máquina relacionada:</span>
                    <strong className="text-zinc-200">{selectedEvent.printerName}</strong>
                  </div>
                )}

                {selectedEvent.contactName && (
                  <div className="flex items-center gap-2 text-xs">
                    <Users className="text-purple-500" size={14} />
                    <span className="text-zinc-400">Cliente envolvido:</span>
                    <strong className="text-zinc-200">{selectedEvent.contactName}</strong>
                  </div>
                )}
              </div>

              <DialogFooter className="flex gap-2 sm:justify-between items-center">
                {selectedEvent.isCustom ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5 rounded-xl text-xs font-semibold"
                    onClick={() => handleDeleteEvent(selectedEvent.id)}
                  >
                    <Trash2 size={14} />
                    Remover Evento
                  </Button>
                ) : (
                  <span className="text-[10px] text-zinc-500 italic">Este evento está sincronizado com a base de dados.</span>
                )}
                <Button variant="outline" size="sm" className="rounded-xl text-xs border-zinc-800 hover:bg-zinc-900" onClick={() => setSelectedEvent(null)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Add Custom Event Dialog ─── */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if(!open) resetForm(); }}>
        <DialogContent className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 text-xs">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-zinc-100">Agendar Novo Evento</DialogTitle>
            {selectedDay && (
              <span className="text-xs text-zinc-450 font-medium">
                Data selecionada: {format(selectedDay, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="event-title">Título do Evento</Label>
              <Input
                id="event-title"
                placeholder="Ex: Revisão preventiva Ender 3 S1"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="h-9 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-type">Tipo de Evento</Label>
              <Select value={newType} onValueChange={(val: "maintenance" | "meeting" | "delivery" | "custom") => setNewType(val)}>
                <SelectTrigger id="event-type" className="h-9 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-805 text-zinc-100">
                  <SelectItem value="maintenance" className="focus:bg-zinc-900 focus:text-zinc-100">Manutenção Preventiva</SelectItem>
                  <SelectItem value="meeting" className="focus:bg-zinc-900 focus:text-zinc-100">Reunião / Cliente</SelectItem>
                  <SelectItem value="delivery" className="focus:bg-zinc-900 focus:text-zinc-100">Entrega de Insumos</SelectItem>
                  <SelectItem value="custom" className="focus:bg-zinc-900 focus:text-zinc-100">Tarefa Customizada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newType === "maintenance" && (
              <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                <Label htmlFor="event-printer">Impressora</Label>
                <Input
                  id="event-printer"
                  placeholder="Ex: Ender 3 S1 #01"
                  value={newPrinter}
                  onChange={(e) => setNewPrinter(e.target.value)}
                  className="h-9 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200"
                />
              </div>
            )}

            {newType === "meeting" && (
              <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                <Label htmlFor="event-contact">Cliente / Contato</Label>
                <Input
                  id="event-contact"
                  placeholder="Ex: Gabriel Siqueira"
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  className="h-9 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="event-desc">Descrição / Anotações</Label>
              <Textarea
                id="event-desc"
                placeholder="Detalhes sobre o evento..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={3}
                className="rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs border-zinc-800 hover:bg-zinc-900"
              onClick={() => {
                setIsAddOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="rounded-xl text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleAddEvent}
              disabled={!newTitle.trim()}
            >
              Agendar Evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
