'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Copy, Check, MessageCircle } from 'lucide-react';
import { formatBRL, proPlanWith } from '@/lib/pricing/pro-plans';
import type { PublicProPricing } from '@/lib/pricing/settings-schema';
import type { ProPixCheckout } from '@/lib/pix/qr';
import { storeWhatsappUrl } from '@/lib/landing/whatsapp-number';
import { ProRequestForm } from './ProRequestForm';

const STEPS = [
  'Escaneie o QR, use o copia e cola ou a chave Pix no app do seu banco.',
  'Preencha o formulário ao lado com os seus dados.',
  'Eu confiro o pagamento e libero o acesso manualmente.',
  'Você recebe um e-mail com o link para criar sua senha.',
];

/**
 * Pix data built on the SERVER (lib/pix/qr.ts): copia-e-cola and QR carry the
 * live price from platform_settings. This component only renders them.
 */
export function PixCheckoutBlock({
  pricing,
  pix,
  storeWhatsapp,
}: {
  pricing: PublicProPricing;
  pix: ProPixCheckout;
  storeWhatsapp: string;
}) {
  const plan = proPlanWith(pricing);
  const copiaECola = pix.copiaECola;
  const PIX_KEY = pix.key ?? '';
  const PIX_RECEIVER = pix.receiverName;
  const qrImage = pix.qrDataUrl ?? pix.qrSrc;
  const WHATSAPP_URL = storeWhatsappUrl(storeWhatsapp);
  // Qual dos dois foi copiado por último — o feedback aparece só no botão certo.
  const [copied, setCopied] = useState<'key' | 'code' | null>(null);
  // O QR é um arquivo que o dono precisa colocar em public/pix/. Enquanto não
  // existir, some em vez de deixar ícone de imagem quebrada ao lado da chave —
  // a chave copiável já basta para pagar.
  const [qrAvailable, setQrAvailable] = useState(true);

  const copy = async (text: string, which: 'key' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 2500);
    } catch {
      // Clipboard bloqueado (contexto inseguro ou permissão negada). O texto
      // continua visível na tela para seleção manual — nada a fazer aqui.
    }
  };

  return (
    <section id="comprar" className="px-6 py-16 md:py-24">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mx-auto mb-12 max-w-2xl text-center">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A6815C]">
            Pagamento
          </span>
          <h2 className="mt-2 font-sora text-3xl font-black tracking-tight text-[#2D241E] md:text-4xl">
            Pague o Pix e peça a liberação.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#6B5E55]">
            A liberação é feita por mim, à mão, depois de conferir o pagamento. Não é instantânea —
            normalmente sai no mesmo dia útil.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Dados do Pix */}
          <div className="rounded-3xl border border-[#E8E2D9] bg-white p-7">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h3 className="font-sora text-lg font-black text-[#2D241E]">{plan.label}</h3>
                <p className="mt-1 text-xs text-[#6B5E55]">{plan.tagline}</p>
              </div>
              <p className="font-sora text-3xl font-black text-[#2D241E]">
                {formatBRL(plan.amountCents)}
              </p>
            </div>

            {PIX_KEY ? (
              <>
                {/*
                  QR gerado no servidor com o preço vigente (ou, sem chave, o estático de
                  public/pix/ — só se o valor bater). Some sozinho se o arquivo
                  não existir — a chave e o copia-e-cola bastam para pagar.
                */}
                {qrImage && qrAvailable ? (
                  <div className="mt-6 flex flex-col items-center gap-2">
                    <Image
                      src={qrImage}
                      unoptimized={qrImage.startsWith('data:')}
                      alt="QR Code do Pix para o Calc3D PRO"
                      width={200}
                      height={200}
                      onError={() => setQrAvailable(false)}
                      className="rounded-2xl ring-1 ring-[#E8E2D9]"
                    />
                    <span className="text-xs text-[#6B5E55]">Escaneie no app do seu banco</span>
                  </div>
                ) : null}

                {/*
                  Só aparece quando o código é íntegro E o valor dele bate com o
                  preço do plano (lib/pix/config.ts). Código com valor velho seria
                  pior que nenhum — a chave abaixo continua servindo.
                */}
                {copiaECola ? (
                  <div className="mt-5 rounded-2xl bg-[#FDFCFA] p-5 ring-1 ring-[#E8E2D9]">
                    <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A6815C]">
                      Pix copia e cola · {formatBRL(plan.amountCents)}
                    </span>
                    <p className="mt-2 max-h-24 overflow-y-auto break-all rounded-lg bg-white p-3 font-mono text-[11px] leading-relaxed text-[#2D241E] ring-1 ring-[#E8E2D9]">
                      {copiaECola}
                    </p>
                    <button
                      type="button"
                      onClick={() => void copy(copiaECola, 'code')}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#7A5C3E] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#6F5439]"
                    >
                      {copied === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied === 'code' ? 'Código copiado' : 'Copiar código Pix'}
                    </button>
                    <p className="mt-2 text-xs text-[#6B5E55]">
                      No app do banco: Pix → Pix copia e cola → cole o código. O valor já vem preenchido.
                    </p>
                  </div>
                ) : null}

                <div className="mt-5 rounded-2xl bg-[#FDFCFA] p-5 ring-1 ring-[#E8E2D9]">
                  <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A6815C]">
                    Ou pela chave Pix
                  </span>
                  <p className="mt-2 break-all font-mono text-sm font-bold text-[#2D241E]">{PIX_KEY}</p>
                  {PIX_RECEIVER ? (
                    <p className="mt-2 text-xs text-[#6B5E55]">
                      Recebedor: <strong className="text-[#2D241E]">{PIX_RECEIVER}</strong> — confira
                      antes de concluir.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void copy(PIX_KEY, 'key')}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#7A5C3E] px-4 py-2.5 text-sm font-bold text-[#7A5C3E] transition-colors hover:bg-[#7A5C3E] hover:text-white"
                  >
                    {copied === 'key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied === 'key' ? 'Chave copiada' : 'Copiar chave Pix'}
                  </button>
                  <p className="mt-2 text-xs text-[#6B5E55]">
                    Pela chave, digite o valor de {formatBRL(plan.amountCents)} à mão.
                  </p>
                </div>
              </>
            ) : (
              <p className="mt-6 rounded-2xl border border-[#B4553F]/40 bg-[#B4553F]/10 px-4 py-3 text-sm text-[#8A3F2E]">
                A chave Pix ainda não foi configurada neste ambiente. Fale comigo no WhatsApp para
                fechar a assinatura.
              </p>
            )}

            <ol className="mt-7 space-y-3">
              {STEPS.map((step, i) => (
                <li key={step} className="flex items-start gap-3 text-sm text-[#4F433A]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#A6815C]/15 text-xs font-black text-[#7A5C3E]">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#7A5C3E] underline underline-offset-4 hover:text-[#2D241E]"
            >
              <MessageCircle className="h-4 w-4" />
              Prefiro combinar no WhatsApp
            </a>
          </div>

          {/* Formulário */}
          <div className="rounded-3xl border border-[#E8E2D9] bg-[#FDFCFA] p-7">
            <h3 className="font-sora text-lg font-black text-[#2D241E]">Confirmar pagamento</h3>
            <p className="mt-1 mb-6 text-xs text-[#6B5E55]">
              Preencha depois de pagar. Seus dados servem só para criar e liberar o seu acesso.
            </p>
            <ProRequestForm storeWhatsapp={storeWhatsapp} />
          </div>
        </div>
      </div>
    </section>
  );
}
