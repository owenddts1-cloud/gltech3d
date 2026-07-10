import { ModulePage } from "@/components/shell/module/ModulePage";
import { ShoppingCart, ChartLineUp, Package, Receipt, ChartBar, Storefront } from "@/lib/ui/icons";

export const metadata = { title: "Vendas" };

export default function SalesPage() {
  return (
    <ModulePage
      icon={ShoppingCart}
      title="Vendas"
      subtitle="O hub de e-commerce multicanal: Shopee, Mercado Livre e Facebook num só painel, com saldo e financeiro."
      primaryLabel="Registrar venda"
      kpis={[
        { label: "Vendas (mês)", hint: "Todos os canais" },
        { label: "Saldo disponível", hint: "Já liberado" },
        { label: "A receber", hint: "Retido pelas plataformas" },
        { label: "Canceladas", hint: "No período" },
      ]}
      features={[
        { icon: Storefront, title: "Sub-abas por canal", desc: "Shopee, Mercado Livre e Facebook, cada um com sua visão dedicada." },
        { icon: Package, title: "Cadastro por marketplace", desc: "Formulário que adapta os campos ao SEO e atributos de cada plataforma." },
        { icon: Receipt, title: "Saldo vs. a receber", desc: "Veja claramente o que já entrou e o que ainda está retido." },
        { icon: ChartLineUp, title: "Linha do tempo", desc: "Vendas efetuadas, concluídas e canceladas em ordem cronológica." },
        { icon: ChartBar, title: "Faturamento por plataforma", desc: "Compare o desempenho de cada canal lado a lado." },
        { icon: ShoppingCart, title: "Baixa de estoque", desc: "Cada venda baixa o estoque do produto correspondente." },
      ]}
    />
  );
}
