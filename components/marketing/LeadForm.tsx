'use client';

import { track } from "@/lib/analytics/track";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { CheckCircle2, Send, Loader2 } from 'lucide-react';
import type { LandingSettings } from '@/lib/landing/types';

const schema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome'),
  email: z.string().trim().email('E-mail inválido'),
  phone: z.string().trim().min(8, 'Informe um telefone válido'),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'É preciso autorizar o contato' }),
  }),
});

type FormValues = z.infer<typeof schema>;

/** Light Brazilian phone mask: (31) 99999-9999. */
function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function LeadForm({ settings }: { settings?: LandingSettings }) {
  const copy = settings?.sections?.orcamento;
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    track('submit_orcamento', { origem: 'lead_form' });
    try {
      const res = await fetch('/api/v1/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'lead',
          name: values.name,
          email: values.email,
          phone: values.phone,
          consent: values.consent,
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setDone(true);
      toast.success('Recebemos seu contato! 🎉', {
        description: 'Nossa equipe vai falar com você em breve.',
      });
    } catch (err) {
      console.error('[lead-form] submit failed', err);
      toast.error('Não foi possível enviar agora', {
        description: 'Tente novamente ou fale com a gente no WhatsApp.',
      });
    }
  }

  const inputCls =
    'w-full rounded-xl border border-[#D1C7B7] bg-white px-4 py-3 text-sm text-[#2D241E] placeholder:text-[#A79A8C] outline-none focus:border-[#A6815C] focus:ring-2 focus:ring-[#A6815C]/20 transition';

  return (
    <section id="contato" className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E6D4D]">
            {copy?.eyebrow ?? 'Peça seu orçamento'}
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold font-sora mt-2 text-[#2D241E]">
            {copy?.title ?? 'Vamos tirar sua ideia do papel'}
          </h2>
          <p className="text-[#6B5E55] text-sm md:text-base mt-3 max-w-lg mx-auto">
            Deixe seu contato e nossa equipe responde rapidinho — por e-mail e WhatsApp.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl bg-white border border-[#E8E2D9] shadow-xl shadow-[#A6815C]/5 p-8 md:p-10"
        >
          {done ? (
            <div className="flex flex-col items-center text-center py-8">
              <CheckCircle2 className="w-14 h-14 text-[#5B8A5B] mb-4" />
              <h3 className="text-xl font-bold font-sora text-[#2D241E]">Contato recebido!</h3>
              <p className="text-sm text-[#6B5E55] mt-2 max-w-sm">
                Obrigado! Já estamos com seus dados e vamos falar com você em breve.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div>
                <label htmlFor="lead-name" className="block text-sm font-medium text-[#3F342C] mb-1.5">Nome</label>
                <input
                  id="lead-name"
                  className={inputCls}
                  placeholder="Seu nome"
                  type="text"
                  required
                  autoComplete="name"
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? 'lead-name-erro' : undefined}
                  {...register('name')}
                />
                {errors.name && <p id="lead-name-erro" className="mt-1 text-xs text-red-700">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="lead-email" className="block text-sm font-medium text-[#3F342C] mb-1.5">E-mail</label>
                  <input
                    id="lead-email"
                    className={inputCls}
                    placeholder="voce@email.com"
                    type="email"
                    inputMode="email"
                    required
                    autoComplete="email"
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? 'lead-email-erro' : undefined}
                    {...register('email')}
                  />
                  {errors.email && <p id="lead-email-erro" className="mt-1 text-xs text-red-700">{errors.email.message}</p>}
                </div>
                <div>
                  <label htmlFor="lead-phone" className="block text-sm font-medium text-[#3F342C] mb-1.5">Telefone</label>
                  <input
                    id="lead-phone"
                    className={inputCls}
                    placeholder="(31) 99999-9999"
                    type="tel"
                    inputMode="tel"
                    required
                    autoComplete="tel"
                    aria-invalid={errors.phone ? true : undefined}
                    aria-describedby={errors.phone ? 'lead-phone-erro' : undefined}
                    {...register('phone', {
                      onChange: (e) => setValue('phone', maskPhone(e.target.value)),
                    })}
                  />
                  {errors.phone && <p id="lead-phone-erro" className="mt-1 text-xs text-red-700">{errors.phone.message}</p>}
                </div>
              </div>

              <label className="flex items-start gap-3 text-sm text-[#6B5E55] cursor-pointer">
                <input
                  type="checkbox"
                  required
                  className="mt-0.5 h-4 w-4 rounded border-[#D1C7B7] accent-[#8E6D4D]"
                  {...register('consent')}
                />
                <span>Autorizo a GLTech3D a entrar em contato comigo, conforme a LGPD.</span>
              </label>
              {errors.consent && <p className="text-xs text-red-700">{errors.consent.message}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#8E6D4D] hover:bg-[#6F5439] disabled:opacity-60 transition-all text-white rounded-2xl font-bold shadow-lg shadow-[#8E6D4D]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F5439]"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Enviando…</>
                ) : (
                  <><Send className="w-5 h-5" /> Enviar contato</>
                )}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
