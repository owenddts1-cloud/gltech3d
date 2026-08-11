'use client';

import { MessageCircle } from 'lucide-react';

import { track } from "@/lib/analytics/track";

export default function WhatsAppFloat() {
  const message = encodeURIComponent('Olá! Vim pelo site GLTech3D e gostaria de tirar uma dúvida sobre impressão 3D.');
  const whatsappUrl = `https://wa.me/5531999284834?text=${message}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      onClick={() => track("click_whatsapp", { origem: "botao_flutuante" })}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] hover:bg-[#1EBE5A] text-white px-4 py-3 rounded-full shadow-[0_8px_30px_rgb(37,211,102,0.35)] transition-all duration-300 hover:scale-110 group font-bold text-xs"
    >
      <MessageCircle className="w-5 h-5 fill-current" />
      <span className="hidden sm:inline">Atendimento WhatsApp</span>
    </a>
  );
}
