import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Scale, Truck, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termos de Uso e Condições | GLTech3D',
  description: 'Termos de Uso, condições de fornecimento, prazos de garantia e política de envios da GLTech3D.',
};

export default function TermosPage() {
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
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black font-sora tracking-tight text-[#2D241E]">Termos de Uso e Condições</h1>
            <p className="text-xs text-[#6B5E55] mt-1">Condições Gerais de Serviço e Venda • Atualizado em Agosto de 2026</p>
          </div>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-[#4A3E35]">
          <section className="space-y-3">
            <h2 className="text-lg font-bold font-sora text-[#2D241E] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#A6815C]" />
              1. Fabricação sob Demanda e Impressão 3D
            </h2>
            <p>
              Os produtos e peças customizadas comercializados pela <strong>GLTech3D</strong> são fabricados sob demanda utilizando tecnologias de manufatura aditiva (FDM/SLA). Devido à natureza da tecnologia de impressão 3D, linhas de camadas horizontais leves e variações sutis de acabamento são características inerentes do processo.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold font-sora text-[#2D241E] flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#A6815C]" />
              2. Prazos de Produção e Envios
            </h2>
            <p>
              O prazo final de entrega compreende o <strong>tempo de produção e pós-processamento</strong> informado na cotação/produto somado ao <strong>tempo de transporte</strong> selecionado no momento da compra (Correios, transportadora ou marketplaces parceiros como Shopee e Mercado Livre).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold font-sora text-[#2D241E] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#A6815C]" />
              3. Propriedade Intelectual e Arquivos
            </h2>
            <p>
              O cliente declara possuir os direitos autorais ou licença de uso comercial dos arquivos 3D enviados para orçamento e fabricação sob medida. A GLTech3D reserva-se o direito de recusar a fabricação de modelos que violem patentes ou marcas registradas.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
