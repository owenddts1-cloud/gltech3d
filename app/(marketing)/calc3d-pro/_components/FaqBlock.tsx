'use client';

import { Plus } from 'lucide-react';
import { formatBRL, periodSuffix } from '@/lib/pricing/pro-plans';
import type { PublicProPricing } from '@/lib/pricing/settings-schema';

/** Price and trial length come from platform_settings via the page (props). */
function buildFaq(pricing: PublicProPricing): ReadonlyArray<{ q: string; a: string }> {
  const price = formatBRL(pricing.amountCents);
  const per = periodSuffix(pricing.periodDays);
  return [
  {
    q: 'Preciso de cartão para testar?',
    a: `Não. O teste de ${pricing.trialDays} dias pede só e-mail e senha. Não existe cobrança automática: se você não pagar, nada é debitado — os módulos apenas pausam.`,
  },
  {
    q: `O que acontece no ${pricing.trialDays + 1}º dia?`,
    a: 'Os módulos PRO ficam com cadeado e seus dados continuam guardados, intactos. A calculadora e o painel seguem abertos. Pagar o Pix destrava tudo de volta, exatamente como estava.',
  },
  {
    q: 'A calculadora continua grátis depois?',
    a: 'Sempre. Ela roda inteira no seu navegador, não pede cadastro e não tem limite de uso — com ou sem plano. Seus valores ficam salvos neste navegador quando você clica em "Salvar meus valores".',
  },
  {
    q: 'Por que pagar por ano e não por mês?',
    a: `O pagamento é por Pix, conferido e liberado à mão. Cobrar mensalidade assim significaria eu mandar cobrança e você pagar todo mês — inviável para os dois. Por isso é um Pix de ${price} por ${per}, sem renovação automática e sem cartão.`,
  },
  {
    q: 'Quanto tempo leva para liberar meu acesso?',
    a: 'Assim que eu conferir o Pix. Normalmente no mesmo dia útil. Você recebe um e-mail com um link para criar sua senha — a liberação não é automática justamente porque o pagamento é manual.',
  },
  {
    q: 'Os meus dados ficam separados dos de outros clientes?',
    a: 'Sim. Cada assinante recebe o próprio espaço no sistema, e o banco isola as linhas por organização (RLS no Postgres). Você não vê dados de ninguém e ninguém vê os seus.',
  },
  {
    q: 'O que acontece se eu não renovar?',
    a: 'Seus dados continuam no sistema. Fale comigo antes do vencimento se quiser exportar ou pausar — nada é apagado por falta de renovação sem aviso.',
  },
  {
    q: 'O WhatsApp já vem funcionando?',
    a: 'A caixa de entrada vem pronta, mas o número é seu: você conecta a sua linha ao sistema. Não fornecemos número nem a infraestrutura de envio em massa.',
  },
  {
    q: 'O Mercado Livre e a Shopee são automáticos?',
    a: 'O Mercado Livre entra com lançamento de pedidos e conferência de estoque no painel. A Shopee hoje funciona em modo manual — a integração automática depende de credencial de parceiro que ainda não está ligada.',
  },
  {
    q: 'Posso testar antes de pagar?',
    a: 'A calculadora desta página é exatamente o motor de custo que o sistema usa por dentro — ela já mostra a qualidade da conta. Para ver o CRM por dentro antes de assinar, chama no WhatsApp que eu mostro.',
  },
  ];
}

export function FaqBlock({ pricing }: { pricing: PublicProPricing }) {
  const faq = buildFaq(pricing);
  return (
    <section
      id="faq"
      className="border-t border-[#E8E2D9] bg-[#FDFCFA] px-6 py-16 md:py-24"
    >
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-10 text-center">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A6815C]">
            FAQ
          </span>
          <h2 className="mt-2 font-sora text-3xl font-black tracking-tight text-[#2D241E] md:text-4xl">
            Dúvidas comuns
          </h2>
        </header>

        <div className="divide-y divide-[#E8E2D9] overflow-hidden rounded-3xl border border-[#E8E2D9] bg-white">
          {faq.map((item) => (
            <details key={item.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-start justify-between gap-4 text-sm font-bold text-[#2D241E]">
                {item.q}
                <Plus className="mt-0.5 h-4 w-4 shrink-0 text-[#A6815C] transition-transform group-open:rotate-45" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[#6B5E55]">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
