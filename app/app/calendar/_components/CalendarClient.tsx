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
  AlertTriangle,
  ShoppingCart
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
import {
  createCalendarEvent,
  deleteCalendarEvent,
  type CalendarEventRow,
  type CalendarSaleRow,
} from "@/app/actions/calendar/actions";
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
  type: "os" | "maintenance" | "meeting" | "delivery" | "custom" | "sale";
  printerName?: string;
  contactName?: string;
  isCustom?: boolean;
}

interface Props {
  initialOrders: ServiceOrder[];
  initialEvents: CalendarEventRow[];
  initialSales?: CalendarSaleRow[];
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
        "relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-5 shadow-lg backdrop-blur-md transition-all duration-300",
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

export function CalendarClient({ initialOrders, initialEvents, initialSales = [] }: Props) {
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
    sale: true,
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

    // 2. Eventos personalizados vêm do banco (migration 0044), não mais do
    //    localStorage. `initialEvents` é carregado no server component.
    const customEvents: CalendarEvent[] = initialEvents.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description ?? undefined,
      date: e.date,
      type: e.type,
      printerName: e.printerName ?? undefined,
      contactName: e.contactName ?? undefined,
      isCustom: true,
    }));

    // 3. Datas de venda derivadas de marketplace_orders (não duplicadas no banco).
    const saleEvents: CalendarEvent[] = initialSales
      .filter((s) => s.date)
      .map((s) => ({
        id: `sale-${s.id}`,
        title: `Venda: ${s.customerName || s.platform || "Cliente"}`,
        description: `${s.platform || "Venda"} · R$ ${(s.totalCents / 100).toFixed(2)}`,
        date: s.date,
        type: "sale",
        contactName: s.customerName || undefined,
      }));

    setEvents([...osEvents, ...customEvents, ...saleEvents]);
  }, [initialOrders, initialEvents, initialSales]);

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
      sales: activeMonthEvents.filter((e) => e.type === "sale").length,
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
  const handleAddEvent = async () => {
    if (!newTitle.trim() || !selectedDay) return;

    const formattedDate = format(selectedDay, "yyyy-MM-dd");
    const res = await createCalendarEvent({
      title: newTitle,
      description: newDesc,
      date: formattedDate,
      type: newType,
      printerName: newType === "maintenance" ? newPrinter : "",
      contactName: newType === "meeting" ? newContact : "",
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    // Usa o id real que o banco devolveu (não um Math.random efêmero).
    setEvents((prev) => [
      ...prev,
      {
        id: res.event.id,
        title: res.event.title,
        description: res.event.description ?? undefined,
        date: res.event.date,
        type: res.event.type,
        printerName: res.event.printerName ?? undefined,
        contactName: res.event.contactName ?? undefined,
        isCustom: true,
      },
    ]);
    toast.success("Evento agendado com sucesso!");
    setIsAddOpen(false);
    resetForm();
  };

  // Delete event handler — otimista, com rollback se o servidor recusar.
  const handleDeleteEvent = async (id: string) => {
    const snapshot = events;
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setSelectedEvent(null);

    const res = await deleteCalendarEvent(id);
    if (!res.ok) {
      setEvents(snapshot); // desfaz
      toast.error(res.error);
      return;
    }
    toast.success("Evento removido.");
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
      case "sale":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
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
      case "sale":
        return <ShoppingCart size={12} />;
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
      <header className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-6 backdrop-blur-md">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-inner">
              <CalendarIcon size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Cronograma da Fábrica
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground font-medium">
                Monitore e agende prazos de OS, preventivas de hardware e reuniões de engenharia.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
            {/* View Mode Toggle Switch */}
            <div className="flex bg-background p-1 rounded-xl border border-border">
              {(["grid", "agenda"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "relative px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize",
                    viewMode === mode ? "text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
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
                className="h-9 w-9 rounded-lg border border-border bg-surface hover:bg-muted text-muted-foreground"
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm font-bold min-w-[120px] text-center capitalize text-foreground">
                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={nextMonth}
                className="h-9 w-9 rounded-lg border border-border bg-surface hover:bg-muted text-muted-foreground"
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
          <SpotlightCard className="p-4 rounded-2xl border border-border bg-surface-elevated">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Categorias de Eventos</h3>
            <div className="space-y-2">
              <button
                onClick={() => toggleFilter("os")}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02]",
                  activeFilters.os
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                    : "bg-surface-elevated border-border text-muted-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <ClipboardList size={14} /> Prazos de OS (SLA)
                </span>
                <span className="text-[10px] bg-surface px-2 py-0.5 rounded-full border border-border text-muted-foreground font-mono font-bold">{stats.os}</span>
              </button>

              <button
                onClick={() => toggleFilter("maintenance")}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02]",
                  activeFilters.maintenance
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "bg-surface-elevated border-border text-muted-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <Wrench size={14} /> Manutenção Preventiva
                </span>
                <span className="text-[10px] bg-surface px-2 py-0.5 rounded-full border border-border text-muted-foreground font-mono font-bold">{stats.maintenance}</span>
              </button>

              <button
                onClick={() => toggleFilter("meeting")}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02]",
                  activeFilters.meeting
                    ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                    : "bg-surface-elevated border-border text-muted-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <Users size={14} /> Reuniões & Clientes
                </span>
                <span className="text-[10px] bg-surface px-2 py-0.5 rounded-full border border-border text-muted-foreground font-mono font-bold">{stats.meetings}</span>
              </button>

              <button
                onClick={() => toggleFilter("delivery")}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02]",
                  activeFilters.delivery
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-surface-elevated border-border text-muted-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <Package size={14} /> Entregas de Insumos
                </span>
                <span className="text-[10px] bg-surface px-2 py-0.5 rounded-full border border-border text-muted-foreground font-mono font-bold">{stats.deliveries}</span>
              </button>

              <button
                onClick={() => toggleFilter("sale")}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02]",
                  activeFilters.sale
                    ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                    : "bg-surface-elevated border-border text-muted-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <ShoppingCart size={14} /> Vendas
                </span>
                <span className="text-[10px] bg-surface px-2 py-0.5 rounded-full border border-border text-muted-foreground font-mono font-bold">{stats.sales}</span>
              </button>

              <button
                onClick={() => toggleFilter("custom")}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02]",
                  activeFilters.custom
                    ? "bg-muted border-border-strong text-muted-foreground"
                    : "bg-surface-elevated border-border text-muted-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <CalendarIcon size={14} /> Tarefas Customizadas
                </span>
              </button>
            </div>
          </SpotlightCard>

          {/* Farm Workload Estimator */}
          <SpotlightCard className="p-4 rounded-2xl border border-border bg-surface-elevated">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Carga da Fábrica (Mês)</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-baseline text-xs">
                <span className="text-muted-foreground">Utilização Estimada</span>
                <span className="font-bold text-foreground tabular-nums">{factoryWorkload}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface overflow-hidden border border-border">
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
            <p className="text-[10px] text-muted-foreground leading-relaxed mt-2.5">
              Estimativa computada com base nas manutenções agendadas e prazos ativos de ordens de serviço.
            </p>
          </SpotlightCard>

          {/* Quick instructions */}
          <Card className="p-4 rounded-2xl border border-border bg-muted space-y-2">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-emerald-500" /> Agendamento Rápido
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
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
                <Card className="rounded-2xl border border-border overflow-hidden bg-surface-elevated backdrop-blur-md shadow-xl">
                  {/* Days of week header */}
                  <div className="grid grid-cols-7 border-b border-border bg-muted text-center text-xs font-semibold text-muted-foreground py-3">
                    <span>Dom</span>
                    <span>Seg</span>
                    <span>Ter</span>
                    <span>Qua</span>
                    <span>Qui</span>
                    <span>Sex</span>
                    <span>Sáb</span>
                  </div>

                  {/* Grid days */}
                  <div className="grid grid-cols-7 grid-flow-row auto-rows-[115px] divide-x divide-y divide-border">
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
                            "relative p-2.5 flex flex-col justify-between hover:bg-muted transition-colors cursor-pointer overflow-hidden group",
                            isCurrentMonth ? "text-foreground bg-muted" : "text-muted-foreground bg-muted opacity-40",
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
                                isToday(day) ? "bg-orange-600 text-white font-extrabold shadow-md border-orange-500" : "text-muted-foreground group-hover:border-border"
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
                              <div className="text-[8px] font-bold text-muted-foreground text-center py-0.5 bg-surface rounded-md border border-border">
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
                    <Card key={group.dateStr} className="p-4 border-border bg-surface-elevated backdrop-blur-md rounded-2xl flex flex-col md:flex-row gap-4 items-start shadow-md">
                      {/* Left: Date header */}
                      <div className="md:w-32 flex md:flex-col items-baseline md:items-center justify-between md:justify-center border-b md:border-b-0 md:border-r border-border pb-2 md:pb-0 md:pr-4 shrink-0 w-full">
                        <span className="text-2xl font-black font-mono text-foreground">{format(group.date, "dd")}</span>
                        <span className="text-xs text-muted-foreground capitalize font-medium">{format(group.date, "EEEE", { locale: ptBR })}</span>
                      </div>

                      {/* Right: Events stack */}
                      <div className="flex-1 w-full space-y-2">
                        {group.events.map((evt) => (
                          <div
                            key={evt.id}
                            onClick={() => setSelectedEvent(evt)}
                            className={cn(
                              "p-3 rounded-xl border flex items-center justify-between hover:bg-muted transition-all cursor-pointer",
                              getEventBadgeClass(evt.type)
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-surface border border-border">
                                {getEventIcon(evt.type)}
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-foreground">{evt.title}</h4>
                                {evt.description && <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[300px]">{evt.description}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {evt.printerName && <Badge variant="outline" className="text-[9px] border-border text-amber-500 font-semibold bg-background">{evt.printerName}</Badge>}
                              {evt.contactName && <Badge variant="outline" className="text-[9px] border-border text-purple-500 font-semibold bg-background">{evt.contactName}</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card className="p-12 text-center border-border bg-surface-elevated rounded-2xl flex flex-col items-center justify-center">
                    <AlertTriangle className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">Nenhum evento agendado para o mês ativo.</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Clique em qualquer dia do grid mensal para criar um novo registro.</p>
                  </Card>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Detail Dialog ─── */}
      <Dialog open={selectedEvent !== null} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-md rounded-2xl border border-border bg-background text-foreground">
          {selectedEvent && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`capitalize font-bold text-[10px] py-0.5 px-2.5 ${getEventBadgeClass(selectedEvent.type)}`}>
                    {selectedEvent.type === "os" ? "Ordem de Serviço" : selectedEvent.type}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono font-bold">
                    <Clock size={12} />
                    {format(parseISO(selectedEvent.date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <DialogTitle className="text-lg font-bold text-foreground mt-2">{selectedEvent.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-3 text-xs">
                {selectedEvent.description && (
                  <div className="rounded-xl bg-surface border border-border p-3">
                    <p className="text-[9px] text-muted-foreground uppercase font-black tracking-wider mb-1">Descrição</p>
                    <p className="text-muted-foreground leading-relaxed text-xs">{selectedEvent.description}</p>
                  </div>
                )}

                {selectedEvent.printerName && (
                  <div className="flex items-center gap-2 text-xs">
                    <Cpu className="text-amber-500" size={14} />
                    <span className="text-muted-foreground">Máquina relacionada:</span>
                    <strong className="text-foreground">{selectedEvent.printerName}</strong>
                  </div>
                )}

                {selectedEvent.contactName && (
                  <div className="flex items-center gap-2 text-xs">
                    <Users className="text-purple-500" size={14} />
                    <span className="text-muted-foreground">Cliente envolvido:</span>
                    <strong className="text-foreground">{selectedEvent.contactName}</strong>
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
                  <span className="text-[10px] text-muted-foreground italic">Este evento está sincronizado com a base de dados.</span>
                )}
                <Button variant="outline" size="sm" className="rounded-xl text-xs border-border hover:bg-muted" onClick={() => setSelectedEvent(null)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Add Custom Event Dialog ─── */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if(!open) resetForm(); }}>
        <DialogContent className="max-w-md rounded-2xl border border-border bg-background text-foreground text-xs">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Agendar Novo Evento</DialogTitle>
            {selectedDay && (
              <span className="text-xs text-muted-foreground font-medium">
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
                className="h-9 rounded-xl bg-surface border-border text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-type">Tipo de Evento</Label>
              <Select value={newType} onValueChange={(val: "maintenance" | "meeting" | "delivery" | "custom") => setNewType(val)}>
                <SelectTrigger id="event-type" className="h-9 rounded-xl bg-surface border-border text-foreground">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground">
                  <SelectItem value="maintenance" className="focus:bg-surface focus:text-foreground">Manutenção Preventiva</SelectItem>
                  <SelectItem value="meeting" className="focus:bg-surface focus:text-foreground">Reunião / Cliente</SelectItem>
                  <SelectItem value="delivery" className="focus:bg-surface focus:text-foreground">Entrega de Insumos</SelectItem>
                  <SelectItem value="custom" className="focus:bg-surface focus:text-foreground">Tarefa Customizada</SelectItem>
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
                  className="h-9 rounded-xl bg-surface border-border text-foreground"
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
                  className="h-9 rounded-xl bg-surface border-border text-foreground"
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
                className="rounded-xl bg-surface border-border text-foreground"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs border-border hover:bg-muted"
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
