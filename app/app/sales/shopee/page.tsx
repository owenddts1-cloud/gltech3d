import { ModulePage } from "@/components/shell/module/ModulePage";
import { Storefront, ChartLineUp, Package, Receipt, ShoppingCart, ChartBar } from "@/lib/ui/icons";

export const metadata = { title: "Shopee" };

export default function ShopeePage() {
  return (
    <ModulePage
      icon={Storefront}
      title="Shopee"
      subtitle="Suas vendas na Shopee: pedidos, saldo, taxas e anúncios sincronizados com o catálogo."
      primaryLabel="Conectar Shopee"
      kpis={[
        { label: "Vendas (mês)", hint: "Na Shopee" },
        { label: "A receber", hint: "Retido pela Shopee" },
        { label: "Anúncios ativos", hint: "Publicados" },
        { label: "Ticket médio", hint: "Por pedido" },
      ]}
      features={[
        { icon: ShoppingCart, title: "Pedidos → OS", desc: "Cada pedido da Shopee vira uma ordem de serviço no seu fluxo." },
        { icon: Package, title: "Anúncios do catálogo", desc: "Publique produtos com atributos e SEO no padrão da Shopee." },
        { icon: Receipt, title: "Taxas e saldo", desc: "Comissões, frete e o que já foi liberado pra saque." },
        { icon: ChartLineUp, title: "Desempenho", desc: "Evolução das vendas e conversão dos anúncios." },
        { icon: ChartBar, title: "Comparativo", desc: "Como a Shopee se compara aos outros canais." },
        { icon: Storefront, title: "Integração via API", desc: "Conexão OAuth segura para sincronizar pedidos e estoque." },
      ]}
    />
  );
}
