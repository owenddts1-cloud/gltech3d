"use client";

import { useState } from "react";
import { Bell, CheckCircle, Warning, Info, Trash, Check } from "@/lib/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "success" | "warning" | "info";
  read: boolean;
}

export function NotificationMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "1",
      title: "Impressão Concluída",
      description: "A impressora Vortigon Core 300 concluiu o arquivo 'GL_Rocket_Body_v2.gcode' com sucesso!",
      time: "3 min atrás",
      type: "success",
      read: false,
    },
    {
      id: "2",
      title: "Alerta de Filamento Baixo",
      description: "Estoque crítico: O filamento 'ABS Carbon' atingiu 120g (limite mínimo: 200g).",
      time: "1 hora atrás",
      type: "warning",
      read: false,
    },
    {
      id: "3",
      title: "Novo Lead via Instagram",
      description: "Contato tagged como 'newsletter' foi capturado e adicionado automaticamente.",
      time: "4 horas atrás",
      type: "info",
      read: true,
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("Todas as notificações marcadas como lidas.");
  };

  const toggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.info("Notificação excluída.");
  };

  const viewAll = () => {
    setIsOpen(false);
    toast.info("Carregando painel completo de auditoria e eventos...");
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full hover:bg-accent/40 text-foreground transition-colors duration-200"
          aria-label="Notificações"
        >
          <Bell size={20} weight="regular" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground"
              >
                {unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 overflow-hidden rounded-xl border border-border shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 bg-accent/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notificações</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px]">
                {unreadCount} novas
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-primary font-medium hover:underline hover:text-primary-hover transition-colors"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[320px] overflow-y-auto divide-y divide-border/60">
          <AnimatePresence initial={false}>
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                    "group relative flex items-start gap-3 p-4 hover:bg-accent/10 transition-colors duration-150",
                    !n.read && "bg-accent/5"
                  )}
                >
                  {/* Icon indicator */}
                  <div className="mt-0.5 shrink-0">
                    {n.type === "success" && <CheckCircle size={16} className="text-success" />}
                    {n.type === "warning" && <Warning size={16} className="text-warning" />}
                    {n.type === "info" && <Info size={16} className="text-info" />}
                  </div>

                  {/* Body */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-xs font-semibold", !n.read ? "text-foreground" : "text-muted-foreground")}>
                        {n.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{n.time}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-text-muted">{n.description}</p>
                  </div>

                  {/* Hover Actions */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 ml-1 transition-opacity duration-150">
                    <button
                      onClick={() => toggleRead(n.id)}
                      title={n.read ? "Marcar como não lida" : "Marcar como lida"}
                      className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Check size={12} className={cn(n.read && "text-primary")} />
                    </button>
                    <button
                      onClick={() => removeNotification(n.id)}
                      title="Excluir"
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Bell size={32} className="text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">Nenhuma notificação por aqui.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="border-t border-border/80 p-2 bg-accent/5">
          <Button
            variant="ghost"
            onClick={viewAll}
            className="w-full text-xs text-primary font-medium hover:text-primary-hover hover:bg-primary/5 h-8 justify-center rounded-lg"
          >
            Ver todas notificações
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
