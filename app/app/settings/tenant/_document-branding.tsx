"use client";

/**
 * Bloco "Documentos impressos" do formulário da organização.
 *
 * É daqui que saem o logo, o endereço e os textos padrão que aparecem no
 * orçamento, na O.S. e no recibo. Sem isto, todo documento teria que ser
 * preenchido do zero — e antes desta feature o cabeçalho era literalmente
 * hardcoded no código.
 *
 * Persistido em `organizations.settings.documents`, com schema declarado em
 * `lib/schemas/settings.ts` — nenhuma leitura de path cru no jsonb.
 */

import { useRef, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/browser";
import { createMediaUploadUrl } from "@/app/actions/landing/media";
import { LANDING_MEDIA_ACCEPT, LANDING_MEDIA_BUCKET } from "@/lib/landing/media-config";
import { CircleNotch, Trash, UploadSimple } from "@/lib/ui/icons";
import type { DocumentBranding } from "@/lib/schemas/settings";

interface Props {
  value: DocumentBranding;
  onChange: (next: DocumentBranding) => void;
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  className,
  maxLength,
  type,
}: {
  id: string;
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  type?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function DocumentBrandingFields({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof DocumentBranding>(key: K, v: DocumentBranding[K]) {
    onChange({ ...value, [key]: v });
  }
  function setAddress(patch: Partial<DocumentBranding["address"]>) {
    onChange({ ...value, address: { ...value.address, ...patch } });
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const signed = await createMediaUploadUrl({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      if (!signed.ok) {
        toast.error(signed.error);
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(LANDING_MEDIA_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file);
      if (error) {
        toast.error(error.message);
        return;
      }
      set("logo_url", signed.publicUrl);
      toast.success("Logo enviada — salve para aplicar.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Documentos impressos</h2>
        <p className="text-xs text-muted-foreground">
          Aparece no orçamento, na ordem de serviço e no recibo emitidos a partir das O.S.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-elevated">
          {value.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.logo_url} alt="Logo da empresa" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted-foreground">Sem logo</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
          >
            {uploading ? (
              <CircleNotch size={13} className="animate-spin" />
            ) : (
              <UploadSimple size={13} />
            )}
            {uploading ? "Enviando…" : value.logo_url ? "Trocar logo" : "Enviar logo"}
          </button>
          {value.logo_url ? (
            <button
              type="button"
              onClick={() => set("logo_url", "")}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-error transition-colors hover:border-error/50"
            >
              <Trash size={13} /> Remover
            </button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={LANDING_MEDIA_ACCEPT}
          className="hidden"
          onChange={(e) => void uploadLogo(e.target.files?.[0])}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field id="doc_phone" label="Telefone" value={value.phone} onChange={(v) => set("phone", v)} placeholder="(31) 99999-0000" />
        <Field id="doc_email" label="E-mail" value={value.email} onChange={(v) => set("email", v)} />
        <Field id="doc_site" label="Site" value={value.site} onChange={(v) => set("site", v)} />
        <Field id="doc_instagram" label="Instagram" value={value.instagram} onChange={(v) => set("instagram", v)} placeholder="@suaempresa" />
      </div>

      <div className="grid grid-cols-6 gap-4">
        <Field id="doc_street" label="Endereço" value={value.address.street} onChange={(v) => setAddress({ street: v })} className="col-span-4" />
        <Field id="doc_number" label="Número" value={value.address.number} onChange={(v) => setAddress({ number: v })} className="col-span-2" />
        <Field id="doc_complement" label="Complemento" value={value.address.complement} onChange={(v) => setAddress({ complement: v })} className="col-span-3" />
        <Field id="doc_district" label="Bairro" value={value.address.district} onChange={(v) => setAddress({ district: v })} className="col-span-3" />
        <Field id="doc_city" label="Cidade" value={value.address.city} onChange={(v) => setAddress({ city: v })} className="col-span-3" />
        <Field id="doc_state" label="UF" value={value.address.state} onChange={(v) => setAddress({ state: v.toUpperCase().slice(0, 2) })} maxLength={2} className="col-span-1" />
        <Field id="doc_cep" label="CEP" value={value.address.cep} onChange={(v) => setAddress({ cep: v })} className="col-span-2" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          id="doc_validity"
          label="Validade padrão do orçamento (dias)"
          type="number"
          value={value.default_validity_days}
          onChange={(v) => set("default_validity_days", Math.min(365, Math.max(0, Number(v) || 0)))}
        />
        <Field
          id="doc_delivery"
          label="Prazo de entrega padrão"
          value={value.default_delivery_estimate}
          onChange={(v) => set("default_delivery_estimate", v)}
          placeholder="Ex.: 15 dias úteis após aprovação"
        />
        <Field id="doc_signer" label="Assinante (contratada)" value={value.signer_name} onChange={(v) => set("signer_name", v)} />
        <Field id="doc_signer_role" label="Cargo do assinante" value={value.signer_role} onChange={(v) => set("signer_role", v)} placeholder="Contratada" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="doc_payment_terms">Condições de pagamento padrão</Label>
        <Textarea
          id="doc_payment_terms"
          value={value.default_payment_terms}
          onChange={(e) => set("default_payment_terms", e.target.value)}
          placeholder="Ex.: 50% na aprovação e 50% na entrega, via Pix ou transferência."
          className="min-h-[64px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="doc_warranty">Garantia padrão (ordem de serviço)</Label>
        <Textarea
          id="doc_warranty"
          value={value.default_warranty}
          onChange={(e) => set("default_warranty", e.target.value)}
          placeholder="Ex.: garantia de 90 dias contra defeitos de fabricação."
          className="min-h-[64px]"
        />
      </div>

      <Field
        id="doc_footer"
        label="Nota de rodapé"
        value={value.footer_note}
        onChange={(v) => set("footer_note", v)}
        placeholder="Ex.: Transformando ideias em realidade."
      />
    </div>
  );
}
