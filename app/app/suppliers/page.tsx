import { ModulePage } from "@/components/shell/module/ModulePage";
import { Handshake, ChartLineUp, Receipt, Package, ShoppingCart, Warning } from "@/lib/ui/icons";

export const metadata = { title: "Fornecedores" };

export default function SuppliersPage() {
  return (
    <ModulePage
      icon={Handshake}
      title="Fornecedores"
      subtitle="Quem te abastece: lojas oficiais, indústrias de filamento e fretes, com histórico de preços por insumo."
      primaryLabel="Novo fornecedor"
      kpis={[
        { label: "Fornecedores", hint: "Cadastrados" },
        { label: "Compras (mês)", hint: "Pedidos feitos" },
        { label: "Gasto (mês)", hint: "Total em insumos" },
        { label: "Alta de preço", hint: "Insumos que subiram" },
      ]}
      features={[
        { icon: ShoppingCart, title: "Perfil do fornecedor", desc: "Lojas oficiais na Shopee, indústrias de filamento e fornecedores de frete." },
        { icon: Receipt, title: "Últimos preços pagos", desc: "Registre quanto pagou em cada insumo na última compra." },
        { icon: ChartLineUp, title: "Evolução de custo", desc: "Gráfico dos preços por insumo pra detectar inflação de custos." },
        { icon: Package, title: "Ligação com insumos", desc: "Conecte cada fornecedor aos filamentos e materiais que ele vende." },
        { icon: Warning, title: "Alerta de inflação", desc: "Aviso quando o preço de um insumo sobe acima do esperado." },
        { icon: Handshake, title: "Histórico de compras", desc: "Tabela evolutiva de tudo que você já comprou de cada um." },
      ]}
    />
  );
}
