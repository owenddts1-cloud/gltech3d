import { ModulePage } from "@/components/shell/module/ModulePage";
import { Gauge, ChartLineUp, ChartBar, ShoppingCart, Printer, Sparkle } from "@/lib/ui/icons";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <ModulePage
      icon={Gauge}
      title="Dashboard"
      subtitle="A central de comando da GLTech3D: faturamento, produção, estoque e o Health Score da operação num só lugar."
      primaryLabel="Novo widget"
      kpis={[
        { label: "Faturamento (mês)", hint: "Somado de todos os canais" },
        { label: "Pedidos pendentes", hint: "OS aguardando produção" },
        { label: "Impressoras ativas", hint: "Online agora" },
        { label: "Health Score", hint: "Eficiência da operação" },
      ]}
      features={[
        { icon: ChartLineUp, title: "Vendas ao longo do tempo", desc: "Gráfico de linha com evolução do faturamento e ticket médio por período." },
        { icon: ChartBar, title: "Faturamento por plataforma", desc: "Rosca comparando Shopee, Mercado Livre, Facebook e vendas orgânicas." },
        { icon: ShoppingCart, title: "Saldo a receber", desc: "Quanto já entrou vs. o que está retido pelas plataformas." },
        { icon: Printer, title: "Status da fazenda", desc: "Impressoras imprimindo, ociosas, em manutenção ou offline em tempo real." },
        { icon: Gauge, title: "Metas", desc: "Barras de progresso das metas de vendas e produção do mês." },
        { icon: Sparkle, title: "Health Score", desc: "Nota da operação com base em sucesso de impressão e tempo médio de envio." },
      ]}
    />
  );
}
