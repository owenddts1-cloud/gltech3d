import { ModulePage } from "@/components/shell/module/ModulePage";
import { Storefront, ChartLineUp, Package, Receipt, ShoppingCart, ChartBar } from "@/lib/ui/icons";

export const metadata = { title: "Mercado Livre" };

export default function MercadoLivrePage() {
  return (
    <ModulePage
      icon={Storefront}
      title="Mercado Livre"
      subtitle="Suas vendas no Mercado Livre: pedidos, reputação, saldo e anúncios no padrão do marketplace."
      primaryLabel="Conectar Mercado Livre"
      kpis={[
        { label: "Vendas (mês)", hint: "No Mercado Livre" },
        { label: "A receber", hint: "Retido pela plataforma" },
        { label: "Anúncios ativos", hint: "Publicados" },
        { label: "Reputação", hint: "Termômetro" },
      ]}
      features={[
        { icon: ShoppingCart, title: "Pedidos → OS", desc: "Pedidos do Mercado Livre entram como ordens de serviço." },
        { icon: Package, title: "Anúncios padronizados", desc: "Ficha técnica e atributos no formato exigido pelo marketplace." },
        { icon: Receipt, title: "Tarifas e saldo", desc: "Comissões, Mercado Envios e valores a liberar." },
        { icon: ChartLineUp, title: "Desempenho", desc: "Vendas, visitas e conversão dos seus anúncios." },
        { icon: ChartBar, title: "Comparativo", desc: "Mercado Livre vs. os demais canais de venda." },
        { icon: Storefront, title: "Integração via API", desc: "Conexão OAuth para sincronizar pedidos, perguntas e estoque." },
      ]}
    />
  );
}
