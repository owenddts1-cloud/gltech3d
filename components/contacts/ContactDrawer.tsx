"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaperPlaneTilt, PencilSimple, ClipboardText, Eye } from "@/lib/ui/icons";
import { TimelineView } from "@/components/contacts/TimelineView";
import { EditContactDialog } from "@/components/contacts/EditContactDialog";
import type { Contact } from "@/lib/types/contacts";
import { toast } from "sonner";

function initials(name: string | null, email: string | null): string {
  const target = name?.trim() || email?.trim() || "C";
  return target.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function avatarGradient(name: string | null): string {
  const chars = name || "C";
  const code = chars.charCodeAt(0) + (chars.charCodeAt(1) || 0);
  const gradients = [
    "from-emerald-400 to-teal-500",
    "from-blue-400 to-indigo-500",
    "from-violet-400 to-purple-500",
    "from-pink-400 to-rose-500",
    "from-amber-400 to-orange-500",
    "from-cyan-400 to-sky-500",
  ];
  return gradients[code % gradients.length] ?? "from-emerald-400 to-teal-500";
}

function stageBadge(c: Contact) {
  if (c.is_blocked) return <Badge variant="error">Bloqueado</Badge>;
  if (c.is_anonymized) return <Badge variant="neutral">Anonimizado</Badge>;
  if (c.tags.includes("cliente")) return <Badge variant="success">Cliente Ativo</Badge>;
  if (c.tags.includes("newsletter")) return <Badge variant="info">Assinante</Badge>;
  return <Badge variant="warning">Lead</Badge>;
}

/** Só dígitos, para montar o link wa.me. */
function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

interface Props {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDrawer({ contact, open, onOpenChange }: Props) {
  const [editOpen, setEditOpen] = useState(false);

  const displayName = contact?.display_name?.trim() || contact?.name?.trim() || "Sem nome";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md">
          {contact && (
            <div className="flex flex-col">
              {/* ── Header ── */}
              <SheetHeader className="space-y-0 border-b border-border p-6 text-left">
                <div className="flex items-start gap-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${avatarGradient(contact.display_name || contact.name)} text-lg font-black text-white shadow-md`}>
                    {initials(contact.display_name, contact.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="truncate text-lg">{displayName}</SheetTitle>
                    <SheetDescription className="truncate">
                      {contact.email ?? contact.phone_number ?? "Sem contato"}
                    </SheetDescription>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {stageBadge(contact)}
                      <Badge variant="neutral" className="text-[10px] capitalize">{contact.source}</Badge>
                    </div>
                  </div>
                </div>

                {/* ── Ações rápidas ── */}
                <div className="flex flex-wrap gap-2 pt-4">
                  {contact.phone_number && !contact.is_anonymized ? (
                    <Button asChild size="sm" className="gap-1.5 rounded-lg text-xs font-semibold">
                      <a href={waLink(contact.phone_number)} target="_blank" rel="noopener noreferrer">
                        <PaperPlaneTilt size={14} weight="fill" /> WhatsApp
                      </a>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-lg text-xs font-semibold"
                      onClick={() => toast.error("Contato sem telefone cadastrado.")}
                    >
                      <PaperPlaneTilt size={14} weight="fill" /> WhatsApp
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline" className="gap-1.5 rounded-lg text-xs font-semibold">
                    <Link href="/app/service-orders">
                      <ClipboardText size={14} /> Gerar OS
                    </Link>
                  </Button>
                  {!contact.is_anonymized && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 rounded-lg text-xs font-semibold"
                      onClick={() => setEditOpen(true)}
                    >
                      <PencilSimple size={14} /> Editar
                    </Button>
                  )}
                </div>
              </SheetHeader>

              {/* ── Dados cadastrais ── */}
              <div className="space-y-3 border-b border-border p-6">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Dados cadastrais
                </h3>
                <dl className="space-y-2.5 text-sm">
                  <Row label="Nome completo" value={contact.name} />
                  <Row label="Email" value={contact.email} />
                  <Row label="Telefone" value={contact.phone_number} />
                  <Row
                    label="Cadastrado em"
                    value={format(new Date(contact.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-xs text-muted-foreground">Tags</dt>
                    <dd className="flex flex-wrap justify-end gap-1">
                      {contact.tags.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        contact.tags.map((t) => (
                          <Badge key={t} variant="neutral" className="px-2 py-0 text-[10px]">{t}</Badge>
                        ))
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* ── Histórico / Timeline ── */}
              <div className="p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Histórico
                  </h3>
                  <Link
                    href={`/app/contacts/${contact.id}`}
                    className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <Eye size={12} /> Perfil completo
                  </Link>
                </div>
                <TimelineView contactId={contact.id} />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {contact && (
        <EditContactDialog contact={contact} open={editOpen} onOpenChange={setEditOpen} />
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="max-w-[65%] truncate text-right font-medium text-foreground">{value ?? "—"}</dd>
    </div>
  );
}
