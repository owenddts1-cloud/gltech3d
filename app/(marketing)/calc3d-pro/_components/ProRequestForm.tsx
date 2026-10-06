'use client';

import { useRef, useState } from 'react';
import { Loader2, Check, Paperclip, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import {
  RECEIPT_MIME_TYPES,
  RECEIPT_MAX_BYTES,
  type ProSignupRequestInput,
} from '@/lib/schemas/pro-signup';
import { RECEIPT_BUCKET } from '@/lib/pro-signup/constants';

type Status = 'idle' | 'uploading' | 'sending' | 'done' | 'error';

function TextField(props: {
  name: string;
  label: string;
  hint?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-[#2D241E]">
        {props.label}
        {props.required ? <span className="ml-1 text-[#B4553F]">*</span> : null}
      </span>
      {props.hint ? <span className="mt-0.5 block text-xs text-[#6B5E55]">{props.hint}</span> : null}
      <input
        name={props.name}
        type={props.type ?? 'text'}
        required={props.required}
        placeholder={props.placeholder}
        className="mt-2 w-full rounded-xl border border-[#E8E2D9] bg-white px-3 py-2.5 text-sm text-[#2D241E] outline-none transition-colors focus:border-[#A6815C] focus:ring-2 focus:ring-[#A6815C]/25"
      />
    </label>
  );
}

export function ProRequestForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  // Tempo de preenchimento: parte do anti-spam, junto do honeypot.
  const mountedAt = useRef<number>(Date.now());
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Sobe o comprovante direto para o Storage com URL assinada emitida pelo
   * servidor. O arquivo não passa pela rota de intake — o limite de corpo do
   * Next reprovaria um PDF de comprovante, e o token da URL dispensa sessão.
   */
  async function uploadReceipt(file: File): Promise<string> {
    const res = await fetch('/api/v1/public/pro-signup/receipt-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size }),
    });
    const json: unknown = await res.json();
    if (!res.ok) {
      throw new Error(
        typeof json === 'object' && json !== null && 'error' in json
          ? String((json as { error: { message?: string } }).error?.message ?? 'falha no envio')
          : 'falha no envio',
      );
    }
    const slot = (json as { data: { path: string; token: string } }).data;
    const supabase = createClient();
    const { error } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .uploadToSignedUrl(slot.path, slot.token, file);
    if (error) throw new Error(error.message);
    return slot.path;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'uploading' || status === 'sending') return;
    setMessage(null);

    const form = new FormData(e.currentTarget);
    const file = fileRef.current?.files?.[0] ?? null;

    try {
      let receiptPath: string | undefined;
      if (file) {
        if (file.size > RECEIPT_MAX_BYTES) {
          setStatus('error');
          setMessage('O comprovante precisa ter no máximo 5 MB.');
          return;
        }
        setStatus('uploading');
        receiptPath = await uploadReceipt(file);
      }

      setStatus('sending');
      const payload: ProSignupRequestInput = {
        buyer_name: String(form.get('buyer_name') ?? ''),
        buyer_email: String(form.get('buyer_email') ?? ''),
        buyer_phone: String(form.get('buyer_phone') ?? ''),
        plan: 'pro',
        declared_paid: true,
        consent: true,
        elapsed_ms: Date.now() - mountedAt.current,
      };
      const company = String(form.get('company_name') ?? '').trim();
      if (company) payload.company_name = company;
      const txid = String(form.get('pix_txid') ?? '').trim();
      if (txid) payload.pix_txid = txid;
      if (receiptPath) payload.receipt_path = receiptPath;
      const honeypot = String(form.get('website') ?? '');
      if (honeypot) payload.website = honeypot;

      const res = await fetch('/api/v1/public/pro-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json: unknown = await res.json().catch(() => null);
        const code =
          typeof json === 'object' && json !== null && 'error' in json
            ? (json as { error: { code?: string } }).error?.code
            : undefined;
        setStatus('error');
        setMessage(
          code === 'rate_limited'
            ? 'Muitos envios deste dispositivo. Tente de novo mais tarde ou fale no WhatsApp.'
            : 'Não consegui registrar o pedido. Tente de novo ou fale no WhatsApp.',
        );
        return;
      }

      setStatus('done');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Falha inesperada no envio.');
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-2xl border border-[#6F7F52]/40 bg-[#6F7F52]/10 p-6">
        <div className="flex items-start gap-3">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#55663E]" />
          <div>
            <h3 className="font-sora text-lg font-black text-[#2D241E]">Pedido registrado.</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#4F433A]">
              Vou conferir o Pix e liberar seu acesso. Assim que aprovar, chega no seu e-mail um link
              para você criar a senha e entrar. Se precisar adiantar, chama no WhatsApp{' '}
              <a
                href="https://wa.me/5531999284834"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline"
              >
                (31) 99928-4834
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  const busy = status === 'uploading' || status === 'sending';

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Honeypot: invisível para gente, irresistível para bot. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Não preencha
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="buyer_name" label="Seu nome" required placeholder="Nome e sobrenome" />
        <TextField
          name="buyer_email"
          label="E-mail"
          type="email"
          required
          hint="É para onde vai o link de ativação."
          placeholder="voce@email.com"
        />
        <TextField name="buyer_phone" label="WhatsApp" required placeholder="(31) 99999-9999" />
        <TextField
          name="company_name"
          label="Nome da sua operação"
          hint="Vira o nome do seu espaço no CRM."
          placeholder="Minha Impressão 3D"
        />
      </div>

      <TextField
        name="pix_txid"
        label="Código da transação Pix"
        hint="Opcional. Ajuda a localizar seu pagamento mais rápido."
      />

      <div>
        <span className="text-sm font-bold text-[#2D241E]">Comprovante</span>
        <span className="mt-0.5 block text-xs text-[#6B5E55]">
          Opcional. PNG, JPG, WebP ou PDF, até 5 MB.
        </span>
        <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#E8E2D9] bg-white px-4 py-3 text-sm text-[#6B5E55] transition-colors hover:border-[#A6815C]">
          <Paperclip className="h-4 w-4" />
          {receiptName ?? 'Escolher arquivo'}
          <input
            ref={fileRef}
            type="file"
            accept={RECEIPT_MIME_TYPES.join(',')}
            className="sr-only"
            onChange={(ev) => setReceiptName(ev.target.files?.[0]?.name ?? null)}
          />
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-[#E8E2D9] bg-white p-4">
        <input type="checkbox" required className="mt-1 h-4 w-4 accent-[#8E6D4D]" />
        <span className="text-sm leading-relaxed text-[#4F433A]">
          Declaro que já fiz o Pix do valor acima e autorizo o uso destes dados para liberar meu
          acesso ao Calc3D PRO.
        </span>
      </label>

      {status === 'error' && message ? (
        <p className="flex items-start gap-2 rounded-xl border border-[#B4553F]/40 bg-[#B4553F]/10 px-4 py-3 text-sm text-[#8A3F2E]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8E6D4D] to-[#A6815C] px-5 py-3.5 text-sm font-bold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {status === 'uploading'
          ? 'Enviando comprovante…'
          : status === 'sending'
            ? 'Registrando pedido…'
            : 'Já paguei — liberar meu acesso'}
      </button>
    </form>
  );
}
