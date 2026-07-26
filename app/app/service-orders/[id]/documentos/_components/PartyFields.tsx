"use client";

/**
 * Dados do cliente no documento.
 *
 * Dois caminhos, ambos necessários: "Puxar do cadastro" traz o que já existe em
 * `contacts`, e "Salvar no cadastro" devolve o que foi digitado aqui — assim o
 * endereço só precisa ser digitado uma vez na vida do cliente. Os campos ficam
 * sempre editáveis: a edição vale só para este documento até que se peça para
 * gravar.
 */

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateContactAddress } from "@/app/actions/service-orders/documents";
import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";
import type { DraftContact } from "@/app/app/service-orders/_lib/document-draft";

type Customer = DocumentSnapshot["customer"];

interface Props {
  customer: Customer;
  contact: DraftContact | null;
  onChange: (next: Customer) => void;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
}) {
  const id = `doc-cust-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg text-xs"
      />
    </div>
  );
}

export function PartyFields({ customer, contact, onChange }: Props) {
  const [saving, startSaving] = useTransition();

  function set(patch: Partial<Customer>) {
    onChange({ ...customer, ...patch });
  }
  function setAddress(patch: Partial<Customer["address"]>) {
    onChange({ ...customer, address: { ...customer.address, ...patch } });
  }

  function pullFromContact() {
    if (!contact) return;
    onChange({
      ...customer,
      contactId: contact.id,
      name: contact.name,
      documentNumber: contact.documentNumber,
      email: contact.email,
      phone: contact.phone,
      address: {
        street: contact.address,
        number: contact.addressNumber,
        complement: contact.addressComplement,
        district: contact.district,
        city: contact.city,
        state: contact.state,
        cep: contact.cep,
      },
    });
    toast.success("Dados do cliente carregados");
  }

  function saveToContact() {
    if (!customer.contactId) {
      toast.error("Esta O.S. não está vinculada a um cliente cadastrado.");
      return;
    }
    startSaving(async () => {
      const res = await updateContactAddress(customer.contactId!, {
        document_number: customer.documentNumber,
        address: customer.address.street,
        address_number: customer.address.number,
        address_complement: customer.address.complement,
        district: customer.address.district,
        city: customer.address.city,
        state: customer.address.state,
        cep: customer.address.cep,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Endereço salvo no cadastro do cliente");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-lg text-xs"
          onClick={pullFromContact}
          disabled={!contact}
        >
          Puxar do cadastro
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-lg text-xs"
          onClick={saveToContact}
          disabled={!customer.contactId || saving}
        >
          {saving ? "Salvando…" : "Salvar no cadastro"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome / Razão social" value={customer.name} onChange={(v) => set({ name: v })} />
        <Field
          label="A/C (pessoa de contato)"
          value={customer.contactPerson}
          onChange={(v) => set({ contactPerson: v })}
        />
        <Field
          label="CPF / CNPJ"
          value={customer.documentNumber}
          onChange={(v) => set({ documentNumber: v })}
          placeholder="00.000.000/0001-00"
        />
        <Field label="Telefone" value={customer.phone} onChange={(v) => set({ phone: v })} />
        <Field
          label="E-mail"
          value={customer.email}
          onChange={(v) => set({ email: v })}
          className="col-span-2"
        />
      </div>

      <div className="grid grid-cols-6 gap-3">
        <Field
          label="Endereço"
          value={customer.address.street}
          onChange={(v) => setAddress({ street: v })}
          className="col-span-4"
        />
        <Field
          label="Número"
          value={customer.address.number}
          onChange={(v) => setAddress({ number: v })}
          className="col-span-2"
        />
        <Field
          label="Complemento"
          value={customer.address.complement}
          onChange={(v) => setAddress({ complement: v })}
          className="col-span-3"
        />
        <Field
          label="Bairro"
          value={customer.address.district}
          onChange={(v) => setAddress({ district: v })}
          className="col-span-3"
        />
        <Field
          label="Cidade"
          value={customer.address.city}
          onChange={(v) => setAddress({ city: v })}
          className="col-span-3"
        />
        <Field
          label="UF"
          value={customer.address.state}
          onChange={(v) => setAddress({ state: v.toUpperCase().slice(0, 2) })}
          maxLength={2}
          className="col-span-1"
        />
        <Field
          label="CEP"
          value={customer.address.cep}
          onChange={(v) => setAddress({ cep: v })}
          className="col-span-2"
        />
      </div>
    </div>
  );
}
