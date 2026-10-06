'use client';

import Link from 'next/link';
import { Check, X, ArrowRight } from 'lucide-react';
import { TRIAL_DAYS } from '@/lib/tenants/trial';
import { PRO_PLANS, formatBRL, monthlyEquivalentCents } from '@/lib/pricing/pro-plans';

/**
 * Funcionalidades conferidas contra o código antes de entrar na lista. O que
 * depende de credencial que ainda não existe (Shopee automática, Nuvemshop) ou
 * de infra do próprio usuário (número de WhatsApp) vem qualificado, não como
 * promessa seca.
 */
const PRO_FEATURES: ReadonlyArray<{ title: string; detail: string }> = [
  { title: 'Vendas e funil', detail: 'Pedido do orçamento ao pago, em quadro Kanban com histórico.' },
  { title: 'Produção e ordens de serviço', detail: 'Fila de impressão, projetos e OS com documento para o cliente.' },
  { title: 'Impressoras e filamentos', detail: 'Cadastro de máquinas e estoque de material puxado direto para o custo.' },
  { title: 'Produtos com custo real', detail: 'Ficha do produto calculada pelo mesmo motor desta calculadora.' },
  { title: 'Dinheiro a receber e a pagar', detail: 'Lançamentos, despesas e relatório do mês.' },
  { title: 'Marketplaces', detail: 'Lançamento de pedidos de Mercado Livre, Shopee e Facebook num painel só.' },
  { title: 'Inbox de WhatsApp e Instagram', detail: 'Atendimento unificado — você conecta o seu número.' },
  { title: 'PDF com a sua marca', detail: 'Orçamento e ordem de serviço com logo e dados da sua empresa.' },
  { title: 'Modelos 3D e fatiador', detail: 'Repositório de peças, estimativa de peso e tempo a partir do STL/3MF.' },
  { title: 'Estoque e fornecedores', detail: 'Insumos, consumíveis e compras.' },
  { title: 'Vitrine pública editável', detail: 'Sua própria landing de catálogo, editada no painel.' },
  { title: 'Equipe, auditoria e LGPD', detail: 'Convite por papel, trilha de auditoria e pedidos de titular.' },
];

const FREE_FEATURES: ReadonlyArray<{ title: string; included: boolean }> = [
  { title: 'Calculadora de custo completa, sem limite de uso', included: true },
  { title: 'Todos os presets e a anatomia do custo', included: true },
  { title: 'Valores salvos no seu navegador', included: true },
  { title: 'Sem cadastro e sem cartão', included: true },
  { title: 'Registrar venda, cliente e pedido', included: false },
  { title: 'Produção, estoque e financeiro', included: false },
  { title: 'PDF com a sua marca', included: false },
  { title: 'Marketplaces e WhatsApp', included: false },
];

export function PlansBlock() {
  const plan = PRO_PLANS.pro;

  return (
    <section id="planos" className="border-y border-[#E8E2D9] bg-[#FDFCFA] px-6 py-16 md:py-24">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mx-auto mb-12 max-w-2xl text-center">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A6815C]">
            Planos
          </span>
          <h2 className="mt-2 font-sora text-3xl font-black tracking-tight text-[#2D241E] md:text-4xl">
            Calcule de graça. Opere o negócio no PRO.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#6B5E55]">
            A calculadora acima é gratuita para sempre e não pede conta. O PRO é o CRM inteiro:
            venda, produção, estoque, dinheiro e marketplaces no mesmo lugar.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
          {/* Grátis */}
          <div className="rounded-3xl border border-[#E8E2D9] bg-white p-7">
            <h3 className="font-sora text-xl font-black text-[#2D241E]">Grátis</h3>
            <p className="mt-1 text-sm text-[#6B5E55]">A calculadora desta página. Nada a instalar.</p>
            <p className="mt-5 font-sora text-4xl font-black text-[#2D241E]">R$ 0</p>
            <ul className="mt-6 space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-2.5 text-sm">
                  {f.included ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6F7F52]" />
                  ) : (
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-[#C8BEB2]" />
                  )}
                  <span className={f.included ? 'text-[#2D241E]' : 'text-[#C8BEB2] line-through'}>
                    {f.title}
                  </span>
                </li>
              ))}
            </ul>
            <a
              href="#calculadora"
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-[#E8E2D9] px-5 py-3 text-sm font-bold text-[#2D241E] transition-colors hover:bg-[#E8E2D9]/60"
            >
              Usar a calculadora
            </a>
          </div>

          {/* PRO */}
          <div className="relative overflow-hidden rounded-3xl bg-[#2D241E] p-7 text-white shadow-[0_24px_60px_-20px_rgba(43,38,34,0.55)]">
            <span className="inline-block rounded-full bg-[#A6815C]/25 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#D9C7A8]">
              Pagamento anual por Pix
            </span>
            <h3 className="mt-4 font-sora text-xl font-black">{plan.label}</h3>
            <p className="mt-1 text-sm text-[#D5CBBF]">{plan.tagline}</p>

            <div className="mt-5 flex items-end gap-3">
              <p className="font-sora text-5xl font-black leading-none">{formatBRL(plan.amountCents)}</p>
              <span className="pb-1 text-sm text-[#D5CBBF]">/ano</span>
            </div>
            <p className="mt-1 text-xs text-[#A6815C]">
              Equivale a {formatBRL(monthlyEquivalentCents(plan))} por mês.
            </p>

            <ul className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {PRO_FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#A6815C]" />
                  <span className="text-sm">
                    <span className="block font-semibold text-[#F9F7F2]">{f.title}</span>
                    <span className="block text-xs leading-relaxed text-[#D5CBBF]">{f.detail}</span>
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href="/criar-conta"
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8E6D4D] to-[#A6815C] px-5 py-3.5 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
            >
              Começar {TRIAL_DAYS} dias grátis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#comprar"
              className="mt-3 block text-center text-xs font-bold text-[#D9C7A8] underline underline-offset-4 hover:text-white"
            >
              Ou pagar agora por Pix
            </a>
            <p className="mt-3 text-center text-[11px] text-[#D5CBBF]">
              Sem cartão no teste. Pagando, a liberação é manual — eu confiro o Pix e destravo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
