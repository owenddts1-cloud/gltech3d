'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle, Check, ArrowRight } from 'lucide-react';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password';
import { PRO_MODULES } from '@/lib/plan/modules';

type Status = 'idle' | 'sending' | 'error';

/** Mostrados na coluna de apoio — os primeiros da mesma lista que o gate usa. */
const DESTAQUES = PRO_MODULES.slice(0, 8);

/** `trialDays` comes from platform_settings via the server page. */
export function SignupClient({ trialDays }: { trialDays: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [emailEmUso, setEmailEmUso] = useState(false);
  // Parte do anti-spam, junto do honeypot: robô preenche instantaneamente.
  const mountedAt = useRef<number>(Date.now());

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;
    setMessage(null);
    setEmailEmUso(false);
    setStatus('sending');

    const form = new FormData(e.currentTarget);
    const payload = {
      display_name: String(form.get('display_name') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? ''),
      accept_terms: true as const,
      elapsed_ms: Date.now() - mountedAt.current,
      ...(String(form.get('website') ?? '') ? { website: String(form.get('website')) } : {}),
    };

    try {
      const res = await fetch('/api/v1/public/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        const code =
          typeof json === 'object' && json !== null && 'error' in json
            ? (json as { error: { code?: string } }).error?.code
            : undefined;
        setStatus('error');
        if (code === 'email_in_use') {
          setEmailEmUso(true);
          setMessage('Este e-mail já tem conta.');
        } else if (code === 'rate_limited') {
          setMessage('Muitas tentativas deste dispositivo. Tente de novo mais tarde.');
        } else if (code === 'validation_error') {
          setMessage(`Confira os campos. A senha precisa de ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
        } else {
          setMessage('Não consegui criar sua conta agora. Tente de novo em instantes.');
        }
        return;
      }

      const to =
        typeof json === 'object' && json !== null && 'data' in json
          ? ((json as { data: { redirect_to?: string } }).data.redirect_to ?? '/app/dashboard')
          : '/app/dashboard';

      // `refresh` é necessário para os layouts server relerem o cookie de sessão
      // recém-criado; sem ele o push cairia num shell ainda deslogado.
      router.push(to);
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('Falha de rede. Verifique sua conexão e tente de novo.');
    }
  }

  const busy = status === 'sending';

  return (
    <main className="min-h-screen bg-[#F9F7F2] text-[#2B2622] pt-24">
      <Navbar />

      <section className="px-6 py-12 md:py-20">
        <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          {/* Formulário */}
          <div className="rounded-3xl border border-[#E8E2D9] bg-white p-7 md:p-9">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A6815C]">
              {trialDays} dias grátis
            </span>
            <h1 className="mt-2 font-sora text-3xl font-black tracking-tight text-[#2D241E]">
              Criar minha conta
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#6B5E55]">
              Sem cartão. No {trialDays + 1}º dia os módulos PRO pausam e seus dados ficam guardados.
            </p>

            <form onSubmit={onSubmit} className="mt-7 space-y-5">
              {/* Honeypot: invisível para gente, irresistível para bot. */}
              <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                <label>
                  Não preencha
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-bold text-[#2D241E]">
                  Nome da sua operação <span className="text-[#B4553F]">*</span>
                </span>
                <span className="mt-0.5 block text-xs text-[#6B5E55]">
                  É como o seu espaço vai se chamar no sistema.
                </span>
                <input
                  name="display_name"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Minha Impressão 3D"
                  className="mt-2 w-full rounded-xl border border-[#E8E2D9] bg-white px-3 py-2.5 text-sm text-[#2D241E] outline-none transition-colors focus:border-[#A6815C] focus:ring-2 focus:ring-[#A6815C]/25"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-[#2D241E]">
                  E-mail <span className="text-[#B4553F]">*</span>
                </span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="voce@email.com"
                  className="mt-2 w-full rounded-xl border border-[#E8E2D9] bg-white px-3 py-2.5 text-sm text-[#2D241E] outline-none transition-colors focus:border-[#A6815C] focus:ring-2 focus:ring-[#A6815C]/25"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-[#2D241E]">
                  Senha <span className="text-[#B4553F]">*</span>
                </span>
                <span className="mt-0.5 block text-xs text-[#6B5E55]">
                  Mínimo de {MIN_PASSWORD_LENGTH} caracteres.
                </span>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  className="mt-2 w-full rounded-xl border border-[#E8E2D9] bg-white px-3 py-2.5 text-sm text-[#2D241E] outline-none transition-colors focus:border-[#A6815C] focus:ring-2 focus:ring-[#A6815C]/25"
                />
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-[#E8E2D9] bg-[#FDFCFA] p-4">
                <input type="checkbox" required className="mt-1 h-4 w-4 accent-[#8E6D4D]" />
                <span className="text-sm leading-relaxed text-[#4F433A]">
                  Li e aceito os{' '}
                  <Link href="/termos" className="font-bold underline">Termos</Link> e a{' '}
                  <Link href="/privacidade" className="font-bold underline">Política de Privacidade</Link>.
                </span>
              </label>

              {status === 'error' && message ? (
                <p className="flex items-start gap-2 rounded-xl border border-[#B4553F]/40 bg-[#B4553F]/10 px-4 py-3 text-sm text-[#8A3F2E]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {message}
                    {emailEmUso ? (
                      <>
                        {' '}
                        <Link href="/login" className="font-bold underline">Entrar com ele</Link>.
                      </>
                    ) : null}
                  </span>
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8E6D4D] to-[#A6815C] px-5 py-3.5 text-sm font-bold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? 'Criando seu espaço…' : `Começar os ${trialDays} dias grátis`}
                {!busy ? <ArrowRight className="h-4 w-4" /> : null}
              </button>

              <p className="text-center text-xs text-[#6B5E55]">
                Já tem conta?{' '}
                <Link href="/login" className="font-bold text-[#7A5C3E] underline">Entrar</Link>
              </p>
            </form>
          </div>

          {/* O que entra no trial */}
          <aside className="rounded-3xl bg-[#2D241E] p-7 text-white md:p-9">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A6815C]">
              Liberado nos {trialDays} dias
            </span>
            <h2 className="mt-2 font-sora text-xl font-black">O CRM inteiro, sem trava.</h2>
            <ul className="mt-6 space-y-3">
              {DESTAQUES.map((m) => (
                <li key={m.routePrefix} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#A6815C]" />
                  <span className="text-[#F9F7F2]">{m.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-xl border border-[#A6815C]/40 bg-[#A6815C]/15 px-4 py-3 text-xs leading-relaxed text-[#F9F7F2]">
              Quando os {trialDays} dias acabam, a calculadora continua grátis e nada é apagado —
              os módulos acima só ficam travados até você assinar.
            </p>
          </aside>
        </div>
      </section>

      <Footer />
    </main>
  );
}
