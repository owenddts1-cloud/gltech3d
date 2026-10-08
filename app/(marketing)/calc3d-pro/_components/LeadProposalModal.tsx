'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, CheckCircle2, MessageCircle, ArrowRight } from 'lucide-react';
import { formatBRL } from '@/lib/pricing/pro-plans';
import { toast } from 'sonner';

interface LeadProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  pesoPeca: number;
  tempoImpressao: number;
  precoSugerido: number;
  quantidade: number;
}

export function LeadProposalModal({
  isOpen,
  onClose,
  pesoPeca,
  tempoImpressao,
  precoSugerido,
  quantidade,
}: LeadProposalModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const totalValue = precoSugerido * Math.max(1, quantidade);

  const handleWhatsAppSend = () => {
    if (!name.trim()) {
      toast.error('Por favor, informe seu nome.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(
      `Olá GLTech3D! Gostaria de uma proposta para impressão 3D:\n\n` +
      `👤 Nome: ${name}\n` +
      `⚖️ Peso estimado: ${pesoPeca}g\n` +
      `⏱️ Tempo estimado: ${tempoImpressao}h\n` +
      `📦 Quantidade: ${quantidade} un\n` +
      `💰 Preço estimado: ${formatBRL(Math.round(totalValue * 100))}\n\n` +
      `Podem me atender?`
    );

    const waUrl = cleanPhone.length >= 10
      ? `https://wa.me/55${cleanPhone}?text=${message}`
      : `https://wa.me/5511999999999?text=${message}`;

    window.open(waUrl, '_blank');
    setSubmitted(true);
    toast.success('Proposta enviada!');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-[#A27953]/30 bg-[#241F1C] p-6 text-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#C89666]">
                  Proposta Rápida
                </span>
                <h3 className="font-sora text-lg font-bold text-white">
                  Transformar Orçamento em Venda
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1 text-[#D5CBBF] hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Resumo da Peça */}
            <div className="my-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-baseline justify-between text-xs text-[#D5CBBF]">
                <span>Peça estimada ({quantidade} un)</span>
                <span className="font-sora text-base font-black text-[#C89666]">
                  {formatBRL(Math.round(totalValue * 100))}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#A8A29E]">
                {pesoPeca}g de filamento · {tempoImpressao}h de impressão
              </p>
            </div>

            {/* Formulário */}
            {submitted ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-[#16A34A]" />
                <h4 className="mt-3 font-sora text-base font-bold text-white">
                  Proposta Iniciada!
                </h4>
                <p className="mt-1 text-xs text-[#D5CBBF]">
                  Sua conversa foi aberta. No plano PRO, orçamentos viram ordens de serviço em 1 clique.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-5 w-full rounded-xl bg-[#A27953] py-2.5 text-xs font-bold text-white hover:bg-[#8E6642] transition-colors"
                >
                  Concluir
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#D5CBBF] mb-1">
                    Seu Nome ou Empresa
                  </label>
                  <input
                    type="text"
                    placeholder="ex: João Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#C89666] focus:ring-1 focus:ring-[#C89666]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#D5CBBF] mb-1">
                    WhatsApp para Envio
                  </label>
                  <input
                    type="tel"
                    placeholder="ex: (11) 98765-4321"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#C89666] focus:ring-1 focus:ring-[#C89666]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#D5CBBF] mb-1">
                    E-mail (opcional)
                  </label>
                  <input
                    type="email"
                    placeholder="joao@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#C89666] focus:ring-1 focus:ring-[#C89666]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleWhatsAppSend}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-xs font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Enviar Proposta via WhatsApp
                  </button>
                  <p className="mt-2 text-center text-[10px] text-[#A8A29E]">
                    No CRM da GLTech3D, propostas viram clientes e ordens de serviço automáticas.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
