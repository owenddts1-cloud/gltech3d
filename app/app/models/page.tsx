import { ModulePage } from "@/components/shell/module/ModulePage";
import { Cube, FolderOpen, Eye, ImageIcon, ChartBar, Ruler } from "@/lib/ui/icons";

export const metadata = { title: "Modelagem" };

export default function ModelsPage() {
  return (
    <ModulePage
      icon={Cube}
      title="Modelagem"
      subtitle="Seu repositório de arquivos 3D: STL e 3MF organizados, com preview e acesso rápido ao Google Drive."
      primaryLabel="Adicionar arquivo"
      kpis={[
        { label: "Arquivos", hint: "STL + 3MF" },
        { label: "Pastas", hint: "Coleções" },
        { label: "Sincronizados", hint: "Com o Drive" },
        { label: "Espaço usado", hint: "Total" },
      ]}
      features={[
        { icon: FolderOpen, title: "Integração Google Drive", desc: "Acesse cada arquivo por um ícone clicável que abre direto no Drive." },
        { icon: Eye, title: "Visualizador 3D na web", desc: "Gire e inspecione peças STL/3MF direto no navegador (Three.js/WebGL)." },
        { icon: ImageIcon, title: "Thumbnails automáticas", desc: "Miniaturas renderizadas pra você reconhecer o arquivo num relance." },
        { icon: Ruler, title: "Ligação com Projetos", desc: "Conecte o modelo ao projeto e às peças produzidas a partir dele." },
        { icon: ChartBar, title: "Metadados", desc: "Dimensões, volume e propriedades extraídas de cada arquivo." },
        { icon: Cube, title: "Organização por coleção", desc: "Agrupe modelos por tema, cliente ou linha de produto." },
      ]}
    />
  );
}
