import { ModulePage } from "@/components/shell/module/ModulePage";
import { Package, Storefront, ImageIcon, ChartBar, FileText, Cube } from "@/lib/ui/icons";

export const metadata = { title: "Cadastro de produto" };

export default function NewProductChannelPage() {
  return (
    <ModulePage
      icon={Package}
      title="Cadastro de produto"
      subtitle="Um formulário inteligente que adapta os campos às diretrizes de SEO e atributos de cada marketplace."
      primaryLabel="Novo anúncio"
      kpis={[
        { label: "Rascunhos", hint: "Não publicados" },
        { label: "Publicados", hint: "Em algum canal" },
        { label: "Canais", hint: "Destinos ativos" },
        { label: "Sem foto", hint: "Anúncio incompleto" },
      ]}
      features={[
        { icon: Storefront, title: "Campos por canal", desc: "O formulário muda conforme Shopee, Mercado Livre ou Facebook." },
        { icon: FileText, title: "SEO e atributos", desc: "Título, ficha técnica e categorias no padrão de cada plataforma." },
        { icon: ImageIcon, title: "Galeria sincronizada", desc: "Fotos do produto reaproveitadas de Produtos e Modelagem." },
        { icon: Cube, title: "Origem 3D", desc: "Ligue o anúncio ao produto e ao arquivo STL que o gerou." },
        { icon: ChartBar, title: "Preço sugerido", desc: "Puxa o custo (BOM) e sugere preço com sua margem alvo." },
        { icon: Package, title: "Publicação multicanal", desc: "Envie o mesmo produto pra vários marketplaces de uma vez." },
      ]}
    />
  );
}
