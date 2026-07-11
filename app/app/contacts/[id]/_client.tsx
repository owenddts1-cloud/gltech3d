"use client";
import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ShieldCheck, PencilSimple, CaretLeft, Phone, PaperPlaneTilt,
  Check, Clock, Tag, Eye, Users
} from "@/lib/ui/icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useContact } from "@/hooks/contacts/useContact";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { ROLE_RANK } from "@/lib/auth/types";
import { TimelineView } from "@/components/contacts/TimelineView";
import { EditContactDialog } from "@/components/contacts/EditContactDialog";
import { AnonymizeDialog } from "@/components/contacts/AnonymizeDialog";
import Link from "next/link";
import { toast } from "sonner";

interface Props {
  contactId: string;
}

function avatarBg(name: string | null): string {
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

function initials(name: string | null, email: string | null): string {
  const target = name?.trim() || email?.trim() || "C";
  return target.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function stageBadge(tags: string[], isBlocked: boolean, isAnonymized: boolean) {
  if (isBlocked) return <Badge variant="error">Bloqueado</Badge>;
  if (isAnonymized) return <Badge variant="neutral">Anonimizado</Badge>;
  if (tags.includes("cliente")) return <Badge variant="success">Cliente Ativo</Badge>;
  if (tags.includes("newsletter")) return <Badge variant="info">Assinante</Badge>;
  return <Badge variant="warning">Lead</Badge>;
}

function sourceBadge(source: string) {
  const s = source.toLowerCase();
  if (s === "whatsapp") return <Badge variant="success" className="bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400">WhatsApp</Badge>;
  if (s === "nuvemshop") return <Badge variant="info">Nuvemshop</Badge>;
  if (s === "manual") return <Badge variant="neutral">Manual</Badge>;
  return <Badge variant="default" className="bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400">Instagram</Badge>;
}

export function ContactDetailClient({ contactId }: Props) {
  const q = useContact(contactId);
  const { user, activeOrg } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [anonOpen, setAnonOpen] = useState(false);

  if (q.isLoading) {
    return (
      <div className="space-y-6 p-6 mx-auto max-w-5xl">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-6">
          <Skeleton className="h-24 w-24 rounded-full shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-20 rounded-full" /></div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="p-6 mx-auto max-w-5xl">
        <Card className="p-8 text-center rounded-xl">
          <p className="text-sm font-medium text-error-fg">Erro ao carregar contato.</p>
          <Button size="sm" variant="outline" className="mt-3 rounded-lg" onClick={() => q.refetch()}>
            Tentar novamente
          </Button>
        </Card>
      </div>
    );
  }

  const contact = q.data.data;
  const isAdmin =
    user.is_platform_admin ||
    (activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin);

  const displayName =
    contact.display_name?.trim() || contact.name?.trim() || "Sem nome";

  const daysSinceCreation = Math.ceil(
    (Date.now() - new Date(contact.created_at).getTime()) / 86_400_000
  );

  return (
    <div className="space-y-6 p-6 mx-auto max-w-5xl animate-in fade-in duration-300">
      {/* Back link */}
      <Link
        href="/app/contacts"
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <CaretLeft size={14} />
        Voltar para Contatos
      </Link>

      {/* LGPD Banner */}
      {contact.is_anonymized && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-error-fg/20 bg-error-bg p-4 text-sm text-error-fg shadow-sm"
        >
          <ShieldCheck size={20} weight="duotone" aria-hidden />
          <div>
            <span className="font-bold">Contato anonimizado (LGPD)</span>
            {contact.anonymized_at &&
              ` — ${format(new Date(contact.anonymized_at), "dd/MM/yyyy", { locale: ptBR })}`}
            <span className="block text-xs opacity-80 mt-0.5">Edição e exportação de dados bloqueadas.</span>
          </div>
        </div>
      )}

      {/* ─── Profile Header ─── */}
      <Card className="rounded-xl border border-border overflow-hidden">
        <div className="relative">
          {/* Gradient banner */}
          <div className={`h-20 bg-gradient-to-r ${avatarBg(contact.display_name || contact.name)} opacity-80`} />
          
          <div className="px-6 pb-5">
            {/* Avatar overlapping banner */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10">
              <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${avatarBg(contact.display_name || contact.name)} text-white text-2xl font-black shadow-lg ring-4 ring-surface`}>
                {initials(contact.display_name, contact.name)}
              </div>
              
              <div className="flex-1 pt-2 sm:pt-0 sm:pb-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold tracking-tight text-foreground truncate">{displayName}</h1>
                  {stageBadge(contact.tags, contact.is_blocked, contact.is_anonymized)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {contact.email && <span>{contact.email}</span>}
                  {contact.phone_number && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={13} weight="fill" aria-hidden /> {contact.phone_number}
                    </span>
                  )}
                  <span>·</span>
                  {sourceBadge(contact.source)}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {contact.phone_number && !contact.is_anonymized && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-lg text-xs font-semibold"
                    onClick={() => toast.success(`Chat WhatsApp para ${contact.phone_number} iniciado.`)}
                  >
                    <PaperPlaneTilt size={14} />
                    Mensagem
                  </Button>
                )}
                {!contact.is_anonymized && (
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs font-semibold" onClick={() => setEditOpen(true)}>
                    <PencilSimple size={14} />
                    Editar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ─── Quick Stats Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Na base há</span>
          </div>
          <span className="mt-1.5 block text-lg font-extrabold text-foreground tabular-nums">{daysSinceCreation} dias</span>
          <span className="text-[10px] text-muted-foreground">
            desde {format(new Date(contact.created_at), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        </Card>

        <Card className="p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Eye size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Última atividade</span>
          </div>
          <span className="mt-1.5 block text-lg font-extrabold text-foreground">
            {contact.last_activity_at
              ? formatDistanceToNow(new Date(contact.last_activity_at), { addSuffix: true, locale: ptBR })
              : "—"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {contact.last_activity_at
              ? format(new Date(contact.last_activity_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
              : "Nenhuma registrada"}
          </span>
        </Card>

        <Card className="p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Tag size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Tags</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {contact.tags.length === 0 ? (
              <span className="text-sm text-muted-foreground">Nenhuma</span>
            ) : (
              contact.tags.map((t) => (
                <Badge key={t} variant="neutral" className="text-[10px] py-0 px-2">{t}</Badge>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">LGPD</span>
          </div>
          <div className="mt-1.5">
            {contact.is_anonymized ? (
              <Badge variant="error" className="gap-1"><ShieldCheck size={11} />Dados removidos</Badge>
            ) : (
              <Badge variant="success" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <Check size={11} />Consentido
              </Badge>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">
            {contact.is_anonymized ? "Anonimização irreversível" : "Dados em conformidade"}
          </span>
        </Card>
      </div>

      {/* ─── Tabs ─── */}
      <Tabs defaultValue="overview">
        <TabsList className="rounded-lg">
          <TabsTrigger value="overview" className="rounded-md text-xs font-semibold">Visão Geral</TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-md text-xs font-semibold">Timeline</TabsTrigger>
          {isAdmin && <TabsTrigger value="lgpd" className="rounded-md text-xs font-semibold">LGPD</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Identity Card */}
            <Card className="p-5 rounded-xl border border-border">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Users size={13} />
                Dados de Identificação
              </h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between items-baseline">
                  <dt className="text-muted-foreground text-xs">Nome completo</dt>
                  <dd className="font-medium text-foreground text-right max-w-[60%] truncate">{contact.name ?? "—"}</dd>
                </div>
                <div className="border-t border-border/40" />
                <div className="flex justify-between items-baseline">
                  <dt className="text-muted-foreground text-xs">Nome de exibição</dt>
                  <dd className="font-medium text-foreground text-right max-w-[60%] truncate">{contact.display_name ?? "—"}</dd>
                </div>
                <div className="border-t border-border/40" />
                <div className="flex justify-between items-baseline">
                  <dt className="text-muted-foreground text-xs">Email</dt>
                  <dd className="font-medium text-foreground text-right max-w-[60%] truncate">{contact.email ?? "—"}</dd>
                </div>
                <div className="border-t border-border/40" />
                <div className="flex justify-between items-baseline">
                  <dt className="text-muted-foreground text-xs">Telefone</dt>
                  <dd className="font-medium text-foreground">{contact.phone_number ?? "—"}</dd>
                </div>
                <div className="border-t border-border/40" />
                <div className="flex justify-between items-baseline">
                  <dt className="text-muted-foreground text-xs">CPF (hash)</dt>
                  <dd className="font-mono text-[10px] text-muted-foreground max-w-[60%] truncate">{contact.cpf_hash ?? "—"}</dd>
                </div>
              </dl>
            </Card>

            {/* Metadata Card */}
            <Card className="p-5 rounded-xl border border-border">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Clock size={13} />
                Metadados & Rastreabilidade
              </h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between items-baseline">
                  <dt className="text-muted-foreground text-xs">Origem de captura</dt>
                  <dd>{sourceBadge(contact.source)}</dd>
                </div>
                <div className="border-t border-border/40" />
                <div className="flex justify-between items-baseline">
                  <dt className="text-muted-foreground text-xs">Data de cadastro</dt>
                  <dd className="font-medium text-foreground">
                    {format(new Date(contact.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </dd>
                </div>
                <div className="border-t border-border/40" />
                <div className="flex justify-between items-baseline">
                  <dt className="text-muted-foreground text-xs">Última atualização</dt>
                  <dd className="font-medium text-foreground">
                    {format(new Date(contact.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </dd>
                </div>
                <div className="border-t border-border/40" />
                <div className="flex justify-between items-baseline">
                  <dt className="text-muted-foreground text-xs">Birthdate</dt>
                  <dd className="font-medium text-foreground">
                    {contact.birthdate ? format(new Date(contact.birthdate), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                  </dd>
                </div>
                <div className="border-t border-border/40" />
                <div className="flex justify-between items-center">
                  <dt className="text-muted-foreground text-xs">Status ativo</dt>
                  <dd>
                    {contact.is_blocked ? (
                      <Badge variant="warning">Bloqueado</Badge>
                    ) : contact.is_anonymized ? (
                      <Badge variant="error">Anonimizado</Badge>
                    ) : (
                      <Badge variant="success" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                        <Check size={10} />Ativo
                      </Badge>
                    )}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <TimelineView contactId={contactId} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="lgpd" className="mt-4">
            <Card className="p-6 space-y-5 rounded-xl border border-border">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-error-bg text-error-fg">
                  <ShieldCheck size={20} weight="duotone" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Direito ao Esquecimento (LGPD)</h2>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    A anonimização é <strong>irreversível</strong>. Use somente após confirmação formal
                    do titular dos dados ou ordem judicial. Todos os dados pessoais serão permanentemente substituídos.
                  </p>
                </div>
              </div>

              {contact.is_anonymized ? (
                <div className="rounded-lg bg-muted/30 border border-border/50 p-4">
                  <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden />
                    <span>
                      Este contato foi anonimizado
                      {contact.anonymized_at &&
                        ` em ${format(new Date(contact.anonymized_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
                      . Não é possível reverter esta ação.
                    </span>
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                  <Button variant="destructive" size="sm" className="rounded-lg font-semibold" onClick={() => setAnonOpen(true)}>
                    Anonimizar contato
                  </Button>
                  <span className="text-[10px] text-muted-foreground">Esta ação não pode ser desfeita.</span>
                </div>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <EditContactDialog
        contact={contact}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <AnonymizeDialog
        contactId={contactId}
        open={anonOpen}
        onOpenChange={setAnonOpen}
      />
    </div>
  );
}
