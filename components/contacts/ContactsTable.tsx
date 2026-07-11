"use client";

import Link from "next/link";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DotsThree, Eye, PaperPlaneTilt, ShieldCheck, Check
} from "@/lib/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Contact } from "@/lib/types/contacts";
import { toast } from "sonner";

interface Props {
  contacts: Contact[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
  /** Ao clicar no nome, abre o drawer lateral em vez de navegar. */
  onSelect?: (contact: Contact) => void;
}

function displayName(c: Contact): string {
  return c.display_name?.trim() || c.name?.trim() || "—";
}

function initials(name: string | null, email: string | null): string {
  const target = name?.trim() || email?.trim() || "C";
  return target.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function avatarBg(name: string | null): string {
  const chars = name || "C";
  const charCode = chars.charCodeAt(0) + (chars.charCodeAt(1) || 0);
  const colors = [
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30",
    "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300 border-blue-100 dark:border-blue-900/30",
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/30",
    "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-300 border-purple-100 dark:border-purple-900/30",
    "bg-pink-50 text-pink-700 dark:bg-pink-950/20 dark:text-pink-300 border-pink-100 dark:border-pink-900/30",
    "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 border-amber-100 dark:border-amber-900/30",
  ];
  return colors[charCode % colors.length] || "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30";
}

function renderStageBadge(c: Contact) {
  if (c.is_blocked) {
    return <Badge variant="error">Bloqueado</Badge>;
  }
  if (c.is_anonymized) {
    return <Badge variant="neutral">Anonimizado</Badge>;
  }
  if (c.tags.includes("cliente")) {
    return <Badge variant="success">Cliente</Badge>;
  }
  if (c.tags.includes("newsletter")) {
    return <Badge variant="info">Assinante</Badge>;
  }
  return <Badge variant="warning">Lead</Badge>;
}

function renderSourceBadge(source: string) {
  const s = source.toLowerCase();
  if (s === "whatsapp") {
    return (
      <Badge variant="success" className="gap-1 bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400">
        WhatsApp
      </Badge>
    );
  }
  if (s === "nuvemshop") {
    return (
      <Badge variant="info" className="gap-1">
        Nuvemshop
      </Badge>
    );
  }
  if (s === "manual") {
    return (
      <Badge variant="neutral" className="gap-1">
        Manual
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400">
      Instagram
    </Badge>
  );
}

export function ContactsTable({ contacts, hasNextPage, isFetchingNextPage, fetchNextPage, onSelect }: Props) {
  
  const handleQuickMsg = (phone: string | null) => {
    if (!phone) return toast.error("Contato não possui número de telefone cadastrado.");
    toast.success(`Abrindo chat do WhatsApp para o número ${phone}...`);
  };

  return (
    <div className="flex flex-col">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[280px]">Contato</TableHead>
            <TableHead>Estágio</TableHead>
            <TableHead>Telefone / Origem</TableHead>
            <TableHead>LGPD Consentimento</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Última Atividade</TableHead>
            <TableHead className="w-[80px] text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((c) => (
            <TableRow key={c.id} className="group hover:bg-accent/10 transition-colors">
              {/* Contato (Avatar + Nome/Email) */}
              <TableCell className="py-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${avatarBg(c.display_name || c.name)} shadow-sm transition-transform duration-200 group-hover:scale-105`}>
                    {initials(c.display_name, c.name)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    {onSelect ? (
                      <button
                        type="button"
                        onClick={() => onSelect(c)}
                        className="truncate text-left text-sm font-semibold text-foreground hover:underline"
                      >
                        {displayName(c)}
                      </button>
                    ) : (
                      <Link href={`/app/contacts/${c.id}`} className="font-semibold text-sm text-foreground hover:underline truncate">
                        {displayName(c)}
                      </Link>
                    )}
                    <span className="text-xs text-muted-foreground truncate">{c.email ?? "—"}</span>
                  </div>
                </div>
              </TableCell>

              {/* Estágio do Funil */}
              <TableCell>
                {renderStageBadge(c)}
              </TableCell>

              {/* Telefone & Origem */}
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-foreground font-medium">{c.phone_number ?? "—"}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {renderSourceBadge(c.source)}
                  </div>
                </div>
              </TableCell>

              {/* LGPD Consentimento */}
              <TableCell>
                {c.is_anonymized ? (
                  <Badge variant="neutral" className="gap-1">
                    <ShieldCheck size={12} />
                    Revogado
                  </Badge>
                ) : (
                  <Badge variant="success" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                    <Check size={12} />
                    Autorizado
                  </Badge>
                )}
              </TableCell>

              {/* Tags */}
              <TableCell>
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {c.tags.length === 0 ? (
                    <span className="text-muted-foreground text-xs">—</span>
                  ) : (
                    c.tags.map((t) => (
                      <Badge key={t} variant="neutral" className="text-[10px] py-0 px-2 font-medium">
                        {t}
                      </Badge>
                    ))
                  )}
                </div>
              </TableCell>

              {/* Última Atividade */}
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {c.last_activity_at ? (
                  <span className="capitalize">
                    {formatRelative(new Date(c.last_activity_at), new Date(), { locale: ptBR })}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>

              {/* Ações */}
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-accent/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DotsThree size={20} className="text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[160px]">
                    <DropdownMenuLabel>Ações rápidas</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/app/contacts/${c.id}`} className="flex items-center gap-2">
                        <Eye size={14} />
                        <span>Ver Perfil</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleQuickMsg(c.phone_number)}
                      className="flex items-center gap-2"
                    >
                      <PaperPlaneTilt size={14} />
                      <span>Mensagem</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-accent/5">
        <span className="text-xs text-muted-foreground">
          Mostrando <span className="font-semibold text-foreground">{contacts.length}</span> contatos cadastrados
        </span>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs rounded-lg" 
            disabled
          >
            Anterior
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs rounded-lg" 
            disabled={!hasNextPage || isFetchingNextPage}
            onClick={fetchNextPage}
          >
            {isFetchingNextPage ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      </div>
    </div>
  );
}
