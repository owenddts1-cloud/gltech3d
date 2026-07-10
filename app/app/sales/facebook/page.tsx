import { ModulePage } from "@/components/shell/module/ModulePage";
import { Storefront, ChartLineUp, Package, Receipt, ShoppingCart, ChartBar } from "@/lib/ui/icons";

export const metadata = { title: "Facebook" };

export default function FacebookPage() {
  return (
    <ModulePage
      icon={Storefront}
      title="Facebook"
      subtitle="Vendas e anúncios no Facebook Marketplace, integrados ao seu catálogo e ao fluxo de atendimento."
      primaryLabel="Conectar Facebook"
      kpis={[
        { label: "Vendas (mês)", hint: "No Facebook" },
        { label: "Leads", hint: "Contatos gerados" },
        { label: "Anúncios ativos", hint: "Publicados" },
        { label: "Ticket médio", hint: "Por pedido" },
      ]}
      features={[
        { icon: ShoppingCart, title: "Pedidos → OS", desc: "Negócios fechados no Facebook viram ordens de serviço." },
        { icon: Package, title: "Anúncios do catálogo", desc: "Publique produtos direto do seu catálogo no Marketplace." },
        { icon: Receipt, title: "Financeiro", desc: "Registro de vendas e valores a receber do canal." },
        { icon: ChartLineUp, title: "Desempenho", desc: "Alcance e conversão dos anúncios ao longo do tempo." },
        { icon: ChartBar, title: "Comparativo", desc: "Facebook vs. Shopee e Mercado Livre." },
        { icon: Storefront, title: "Ponte com atendimento", desc: "Mensagens do Marketplace conversam com a Inbox do CRM." },
      ]}
    />
  );
}
