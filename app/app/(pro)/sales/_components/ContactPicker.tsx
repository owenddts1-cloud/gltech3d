"use client";

/**
 * Seletor de cliente para Vendas — combobox com busca sobre os contatos
 * cadastrados. Digitar um nome sem correspondência oferece "Outro cliente":
 * abre o NewContactDialog COMPLETO (nome/email/telefone/CPF, tudo opcional)
 * pré-preenchido com o nome digitado — não um quick-create de uma linha só.
 * Ao salvar, o contato entra selecionado na hora; useCreateContact já invalida
 * a query ["contacts"], então a aba Contatos atualiza sozinha.
 */

import { useCallback, useRef, useState } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { NewContactDialog } from "@/components/contacts/NewContactDialog";
import type { ContactOption } from "@/app/actions/contacts/actions";

interface Props {
  id?: string;
  contacts: ContactOption[];
  /** Id do contato selecionado ("" = nenhum). */
  value: string;
  onChange: (contactId: string, name: string) => void;
  className?: string;
}

export function ContactPicker({ id, contacts, value, onChange, className }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingName, setPendingName] = useState("");
  // Guarda o resolve() da Promise que o Combobox está aguardando enquanto o
  // NewContactDialog fica aberto (criação "instantânea" vira um fluxo completo).
  const resolveRef = useRef<((option: ComboboxOption | null) => void) | null>(null);

  const options: ComboboxOption[] = [
    { value: "", label: "— Sem cliente —" },
    ...contacts.map((c) => ({
      value: c.id,
      label: c.name,
      hint: c.isPending ? "Cadastro pendente" : undefined,
    })),
  ];

  const handleCreate = useCallback((name: string): Promise<ComboboxOption | null> => {
    setPendingName(name);
    setDialogOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  return (
    <>
      <Combobox
        id={id}
        className={className}
        value={value}
        onChange={(v, opt) => onChange(v, opt?.label ?? "")}
        options={options}
        placeholder="— Sem cliente —"
        searchPlaceholder="Buscar ou digitar novo cliente…"
        allowCreate={{
          label: (q) => `Adicionar "${q}" como novo cliente`,
          onCreate: handleCreate,
        }}
      />
      <NewContactDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) {
            // Fechou sem salvar (X/Esc) — destrava o combobox sem selecionar nada.
            resolveRef.current?.(null);
            resolveRef.current = null;
          }
        }}
        initialName={pendingName}
        onCreated={(contact) => {
          onChange(contact.id, contact.name);
          resolveRef.current?.({ value: contact.id, label: contact.name });
          resolveRef.current = null;
        }}
      />
    </>
  );
}
