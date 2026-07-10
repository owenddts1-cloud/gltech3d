'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Mail, Loader2 } from 'lucide-react';

export default function NewsletterBar() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error('Informe um e-mail válido');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/v1/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'newsletter', email: value }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setDone(true);
      toast.success('Inscrição confirmada! 📬');
    } catch (err) {
      console.error('[newsletter] submit failed', err);
      toast.error('Não foi possível inscrever agora', {
        description: 'Tente novamente em instantes.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="pb-16">
      {/* Faixa marrom animada (rola da direita para a esquerda) */}
      <div className="marquee-mask bg-[#A6815C] text-white py-3 mb-10 select-none">
        <div className="marquee">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="mx-8 flex items-center gap-8 text-sm font-extrabold uppercase tracking-[0.2em] whitespace-nowrap"
            >
              <span>Impressão 3D sob demanda</span><span className="text-white/50">✦</span>
              <span>Feito no Brasil</span><span className="text-white/50">✦</span>
              <span>Entrega para todo o país</span><span className="text-white/50">✦</span>
            </span>
          ))}
        </div>
      </div>

      <div className="px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden max-w-5xl mx-auto rounded-3xl bg-[#2D241E] text-white px-8 py-10 md:px-12 md:flex md:items-center md:justify-between gap-8"
      >
        {/* Glows decorativos animados */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute -top-16 -right-10 h-52 w-52 rounded-full bg-[#A6815C]/30 blur-3xl"
            animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.15, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-[#8E6D4D]/25 blur-3xl"
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
        </div>

        <div className="relative z-10 mb-6 md:mb-0">
          <h3 className="text-2xl font-extrabold font-sora">Novidades da GLTech3D</h3>
          <p className="text-sm text-white/70 mt-2 max-w-md">
            Lançamentos, promoções e peças novas direto no seu e-mail. Sem spam.
          </p>
        </div>
        {done ? (
          <div className="relative z-10 flex items-center gap-2 text-[#E8D9C6] font-medium">
            <Mail className="w-5 h-5" /> Você está na lista. Obrigado!
          </div>
        ) : (
          <form onSubmit={onSubmit} className="relative z-10 flex w-full md:w-auto flex-col sm:flex-row gap-3">
            <div className="relative flex-1 sm:w-72">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-xl bg-white/10 border border-white/15 pl-10 pr-4 py-3 text-sm placeholder:text-white/40 outline-none focus:border-[#A6815C] focus:ring-2 focus:ring-[#A6815C]/30 transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#A6815C] hover:bg-[#8E6D4D] disabled:opacity-60 transition text-white rounded-xl font-bold whitespace-nowrap"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Inscrever
            </button>
          </form>
        )}
      </motion.div>
      </div>
    </section>
  );
}
