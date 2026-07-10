import { ModulePage } from "@/components/shell/module/ModulePage";
import { Package, Cube, ImageIcon, ChartBar, Receipt, ShoppingCart } from "@/lib/ui/icons";

export const metadata = { title: "Produtos" };

export default function ProductsPage() {
  return (
    <ModulePage
      icon={Package}
      title="Produtos"
      subtitle="Catálogo dos itens prontos pra venda, com engenharia de custo (BOM) e galeria de fotos pros anúncios."
      primaryLabel="Novo produto"
      kpis={[
        { label: "Produtos", hint: "No catálogo" },
        { label: "Custo médio", hint: "Por unidade" },
        { label: "Margem média", hint: "Lucro alvo" },
        { label: "Sem foto", hint: "Anúncio incompleto" },
      ]}
      features={[
        { icon: Cube, title: "Bill of Materials (BOM)", desc: "Custo calculado por gramas de filamento + parafusos + embalagem + tags." },
        { icon: ChartBar, title: "Preço sugerido", desc: "Custo vs. preço de mercado com a margem de lucro que você definir." },
        { icon: ImageIcon, title: "Galeria de fotos", desc: "Imagens prontas pra sincronizar com os anúncios dos marketplaces." },
        { icon: ShoppingCart, title: "Sincronização multicanal", desc: "Ligue o produto aos anúncios de Shopee, Mercado Livre e Facebook." },
        { icon: Receipt, title: "Histórico de custo", desc: "Como o custo do produto evoluiu conforme o preço dos insumos mudou." },
        { icon: Package, title: "Controle de estoque", desc: "Quantidade disponível, baixada automaticamente a cada venda." },
      ]}
    />
  );
}
