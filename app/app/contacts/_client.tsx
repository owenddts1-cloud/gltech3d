"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, MagnifyingGlass, Users, X, CaretDown, AddressBook, Kanban } from "@/lib/ui/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useContactList } from "@/hooks/contacts/useContactList";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { ContactsFunnel } from "@/components/contacts/ContactsFunnel";
import { ContactDrawer } from "@/components/contacts/ContactDrawer";
import { NewContactDialog } from "@/components/contacts/NewContactDialog";
import { EmptyContacts } from "@/components/empty";
import type { Contact } from "@/lib/types/contacts";

type ContactsView = "lista" | "funil";
const VIEWS: { key: ContactsView; label: string; icon: typeof AddressBook }[] = [
  { key: "lista", label: "Lista", icon: AddressBook },
  { key: "funil", label: "Funil", icon: Kanban },
];

const SOURCE_OPTIONS = [
  { value: undefined, label: "Todas as origens" },
  { value: "manual", label: "Manual" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "nuvemshop", label: "Nuvemshop" },
  { value: "controle", label: "Controle" },
  { value: "pendente", label: "Cadastro pendente" },
];

export function ContactsListClient({ defaultPipelineId }: { defaultPipelineId: string | null }) {
  const [view, setView] = useState<ContactsView>("lista");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | undefined>(undefined);
  const [source, setSource] = useState<string | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Debounce search 250ms
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters = useMemo(() => ({ search, tag, source }), [search, tag, source]);
  const q = useContactList(filters);

  const allContacts = useMemo(
    () => q.data?.pages.flatMap((p) => p.data) ?? [],
    [q.data],
  );

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of allContacts) for (const t of c.tags) set.add(t);
    return Array.from(set).sort();
  }, [allContacts]);

  // Derive KPIs from loaded contacts
  const kpis = useMemo(() => {
    const total = allContacts.length;
    const newsletter = allContacts.filter((c) => c.tags.includes("newsletter")).length;
    const blocked = allContacts.filter((c) => c.is_blocked).length;
    const whatsapp = allContacts.filter((c) => c.source === "whatsapp").length;
    const recent = allContacts.filter((c) => {
      if (!c.created_at) return false;
      const d = new Date(c.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { total, newsletter, blocked, whatsapp, recent };
  }, [allContacts]);

  const activeFilters = [search, tag, source].filter(Boolean).length;

  return (
    <div className="space-y-5 p-6 mx-auto max-w-7xl">
      {/* ─── Premium Header ─── */}
      <header className="relative overflow-hidden rounded-xl border border-border bg-surface p-6">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-24" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <AddressBook size={26} weight="duotone" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Contatos</h1>
              <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                Customer 360 — base completa de leads, clientes e assinantes com rastreabilidade LGPD.
              </p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 font-semibold shadow-sm">
            <Plus size={16} weight="bold" aria-hidden />
            <span>Novo contato</span>
          </Button>
        </div>
      </header>

      {/* ─── KPI Summary Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 rounded-xl border border-border hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users size={14} weight="duotone" />
            </div>
          </div>
          {q.isLoading ? (
            <Skeleton className="mt-2 h-7 w-14" />
          ) : (
            <span className="mt-2 block text-2xl font-extrabold text-foreground tabular-nums">{kpis.total}</span>
          )}
          <span className="text-[10px] text-muted-foreground mt-0.5 block">contatos cadastrados</span>
        </Card>

        <Card className="p-4 rounded-xl border border-border hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Novos (mês)</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Plus size={14} weight="bold" />
            </div>
          </div>
          {q.isLoading ? (
            <Skeleton className="mt-2 h-7 w-10" />
          ) : (
            <span className="mt-2 block text-2xl font-extrabold text-foreground tabular-nums">{kpis.recent}</span>
          )}
          <span className="text-[10px] text-muted-foreground mt-0.5 block">capturas recentes</span>
        </Card>

        <Card className="p-4 rounded-xl border border-border hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Newsletter</span>
            <Badge variant="info" className="text-[9px] py-0 px-1.5">assinantes</Badge>
          </div>
          {q.isLoading ? (
            <Skeleton className="mt-2 h-7 w-10" />
          ) : (
            <span className="mt-2 block text-2xl font-extrabold text-foreground tabular-nums">{kpis.newsletter}</span>
          )}
          <span className="text-[10px] text-muted-foreground mt-0.5 block">inscritos ativos</span>
        </Card>

        <Card className="p-4 rounded-xl border border-border hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Bloqueados</span>
            <Badge variant={kpis.blocked > 0 ? "warning" : "neutral"} className="text-[9px] py-0 px-1.5">
              {kpis.blocked > 0 ? "atenção" : "ok"}
            </Badge>
          </div>
          {q.isLoading ? (
            <Skeleton className="mt-2 h-7 w-10" />
          ) : (
            <span className="mt-2 block text-2xl font-extrabold text-foreground tabular-nums">{kpis.blocked}</span>
          )}
          <span className="text-[10px] text-muted-foreground mt-0.5 block">precisam de revisão</span>
        </Card>
      </div>

      {/* ─── View switcher (Lista ↔ Funil) ─── */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 w-fit">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = view === v.key;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                active ? "text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="contacts-view-pill"
                  className="absolute inset-0 rounded-md bg-accent shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon size={14} weight={active ? "fill" : "regular"} className="relative z-10" />
              <span className="relative z-10">{v.label}</span>
            </button>
          );
        })}
      </div>

      {view === "funil" ? (
        <ContactsFunnel pipelineId={defaultPipelineId} />
      ) : (
        <>
          {/* ─── Filter Toolbar ─── */}
          <Card className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <MagnifyingGlass
                size={16}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                placeholder="Buscar por nome, email ou telefone…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-9 pl-8 rounded-lg text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={tagOptions.length === 0} className="h-8 rounded-lg gap-1.5 text-xs font-semibold">
                    {tag ? `Tag: ${tag}` : "Tag: todas"}
                    <CaretDown size={12} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Tag</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setTag(undefined)}>Todas</DropdownMenuItem>
                  {tagOptions.map((t) => (
                    <DropdownMenuItem key={t} onClick={() => setTag(t)}>
                      {t}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 rounded-lg gap-1.5 text-xs font-semibold">
                    {SOURCE_OPTIONS.find((s) => s.value === source)?.label ?? "Origem"}
                    <CaretDown size={12} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {SOURCE_OPTIONS.map((s) => (
                    <DropdownMenuItem key={s.label} onClick={() => setSource(s.value)}>
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>

          {/* ─── Chips de filtro ativos ─── */}
          <AnimatePresence initial={false}>
            {activeFilters > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap items-center gap-2 overflow-hidden"
              >
                <span className="text-[11px] font-medium text-muted-foreground">Filtros:</span>
                <AnimatePresence initial={false}>
                  {search && (
                    <FilterChip
                      key="chip-search"
                      label={`"${search}"`}
                      onRemove={() => {
                        setSearchInput("");
                        setSearch("");
                      }}
                    />
                  )}
                  {tag && (
                    <FilterChip key="chip-tag" label={`Tag: ${tag}`} onRemove={() => setTag(undefined)} />
                  )}
                  {source && (
                    <FilterChip
                      key="chip-source"
                      label={`Origem: ${SOURCE_OPTIONS.find((s) => s.value === source)?.label ?? source}`}
                      onRemove={() => setSource(undefined)}
                    />
                  )}
                </AnimatePresence>
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setTag(undefined);
                    setSource(undefined);
                  }}
                  className="text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Limpar tudo
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Data Table ─── */}
          {q.isLoading ? (
            <Card className="overflow-hidden rounded-xl">
              <div className="space-y-0">
                {/* Table header skeleton */}
                <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-accent/5">
                  {[200, 80, 120, 100, 80, 100].map((w, i) => (
                    <Skeleton key={i} className="h-3" style={{ width: w }} />
                  ))}
                </div>
                {/* Row skeletons */}
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border/40">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-2.5 w-48" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            </Card>
          ) : q.isError ? (
            <Card className="p-8 text-center rounded-xl">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-bg text-error-fg">
                  <X size={20} />
                </div>
                <p className="text-sm font-medium text-error-fg">Erro ao carregar contatos.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => q.refetch()}
                  className="rounded-lg"
                >
                  Tentar novamente
                </Button>
              </div>
            </Card>
          ) : allContacts.length === 0 ? (
            <Card className="p-6 text-center rounded-xl">
              <EmptyContacts />
            </Card>
          ) : (
            <Card className="overflow-hidden rounded-xl border border-border">
              <ContactsTable
                contacts={allContacts}
                hasNextPage={q.hasNextPage}
                isFetchingNextPage={q.isFetchingNextPage}
                fetchNextPage={q.fetchNextPage}
                onSelect={(c) => {
                  setSelectedContact(c);
                  setDrawerOpen(true);
                }}
              />
            </Card>
          )}
        </>
      )}

      <NewContactDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ContactDrawer contact={selectedContact} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.15 }}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent"
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover filtro ${label}`}
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-accent/70 transition-colors hover:bg-accent/20 hover:text-accent"
      >
        <X size={10} weight="bold" />
      </button>
    </motion.span>
  );
}
