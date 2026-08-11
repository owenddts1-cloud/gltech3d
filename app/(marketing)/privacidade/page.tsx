import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, FileText, UserCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidade | GLTech3D',
  description: 'Política de Privacidade e Proteção de Dados Pessoais da GLTech3D em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).',
};

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-[#F9F7F2] text-[#2D241E] py-16 px-6 md:px-12 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 md:p-12 border border-[#E8E2D9] shadow-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#A6815C] hover:text-[#8E6D4D] mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o Início
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#A6815C]/10 flex items-center justify-center text-[#A6815C]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black font-sora tracking-tight text-[#2D241E]">Política de Privacidade</h1>
            <p className="text-xs text-[#6B5E55] mt-1">Conformidade com a LGPD (Lei nº 13.709/2018) • Atualizado em Agosto de 2026</p>
          </div>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-[#4A3E35]">
          <section className="space-y-3">
            <h2 className="text-lg font-bold font-sora text-[#2D241E] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#A6815C]" />
              1. Coleta de Dados Pessoais
            </h2>
            <p>
              A <strong>GLTech3D</strong> coleta dados estritamente necessários para a cotação, produção, emissão de documentos fiscais e entrega de serviços de impressão 3D e modelagem técnica. Os dados coletados incluem:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[#6B5E55]">
              <li>Nome completo / Razão Social</li>
              <li>E-mail de contato e número de WhatsApp</li>
              <li>Endereço para entrega e faturamento (CEP, Cidade, Estado)</li>
              <li>Arquivos 3D (STL, 3MF, STEP) e especificações técnicas do projeto</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold font-sora text-[#2D241E] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#A6815C]" />
              2. Finalidade do Tratamento de Dados
            </h2>
            <p>Seus dados são utilizados exclusivamente para:</p>
            <ul className="list-disc pl-5 space-y-1 text-[#6B5E55]">
              <li>Elaborar orçamentos de engenharia e estimativas de impressão 3D;</li>
              <li>Atualizar o status de produção e rastreamento de entregas via WhatsApp e e-mail;</li>
              <li>Cumprimento de obrigações legais e fiscais relacionadas às vendas;</li>
              <li>Melhoria contínua dos produtos e suporte ao cliente no pós-venda.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold font-sora text-[#2D241E] flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#A6815C]" />
              3. Seus Direitos (LGPD) e Anonimização
            </h2>
            <p>
              Em conformidade com a LGPD, você tem direito a solicitar o acesso, correção, exportação ou exclusão/anonimização dos seus dados pessoais cadastrados em nossa base a qualquer momento.
            </p>
            <p className="text-[#6B5E55]">
              Para exercer seus direitos ou tirar dúvidas sobre o tratamento de dados, entre em contato através do nosso canal oficial de atendimento via WhatsApp ou e-mail: <strong className="text-[#2D241E]">contato@gltech3d.com.br</strong>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
