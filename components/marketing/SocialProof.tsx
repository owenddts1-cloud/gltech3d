'use client';

import { motion } from 'motion/react';
import { Star, ShoppingBag, Package, Facebook, Instagram, MessageCircle } from 'lucide-react';

// Marcas / onde a GLTech3D vende (marquee).
const brands = [
  { icon: ShoppingBag, label: 'Shopee' },
  { icon: Package, label: 'Mercado Livre' },
  { icon: Facebook, label: 'Facebook' },
  { icon: Instagram, label: 'Instagram' },
  { icon: MessageCircle, label: 'WhatsApp' },
];

// Depoimentos — EXEMPLOS. Substitua por avaliações reais dos seus clientes.
const testimonials = [
  {
    quote: 'Peça impecável e chegou rapidíssimo. A Luminária Lua ficou linda na estante!',
    name: 'Marina S.',
    city: 'Belo Horizonte · MG',
  },
  {
    quote: 'Encomendei um action figure personalizado e superou a expectativa. Acabamento premium.',
    name: 'Rafael T.',
    city: 'São Paulo · SP',
  },
  {
    quote: 'Atendimento nota 10 e o protótipo saiu exatamente como pedi. Recomendo demais.',
    name: 'Juliana M.',
    city: 'Contagem · MG',
  },
];

export default function SocialProof() {
  return (
    <section className="py-20 px-6 bg-[#F0EEE9]/50 border-y border-[#E8E2D9]">
      <div className="max-w-7xl mx-auto">
        {/* Faixa de marcas (marquee) */}
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.25em] text-[#8E6D4D] mb-6">
          Onde você encontra a GLTech3D
        </p>
        <div className="marquee-mask mb-16">
          <div className="marquee">
            {[...brands, ...brands, ...brands, ...brands].map((b, i) => {
              const Icon = b.icon;
              return (
                <span
                  key={i}
                  className="mx-3 inline-flex items-center gap-2 rounded-full border border-[#E8E2D9] bg-white px-5 py-2.5 text-sm font-bold text-[#2B2622] whitespace-nowrap"
                >
                  <Icon className="h-4 w-4 text-[#A6815C]" />
                  {b.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Depoimentos */}
        <div className="text-center mb-10">
          <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E6D4D]">Depoimentos</span>
          <h2 className="text-3xl md:text-4xl font-extrabold font-sora mt-2 text-[#2B2622]">
            Quem imprime com a gente
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.blockquote
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-2xl bg-white border border-[#E8E2D9] p-7 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#A6815C]/10 transition-all"
            >
              <div className="mb-4 flex gap-0.5 text-[#A6815C]">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="text-[15px] leading-relaxed text-[#3F342C]">“{t.quote}”</p>
              <footer className="mt-5 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#A6815C] text-sm font-bold text-white">
                  {t.name.charAt(0)}
                </span>
                <span className="text-sm">
                  <span className="block font-bold text-[#2B2622]">{t.name}</span>
                  <span className="block text-xs text-[#6B5E55]">{t.city}</span>
                </span>
              </footer>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
