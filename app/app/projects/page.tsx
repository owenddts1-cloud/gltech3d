import { ModulePage } from "@/components/shell/module/ModulePage";
import { Ruler, Kanban, ChartLineUp, ImageIcon, Cube, FileText } from "@/lib/ui/icons";

export const metadata = { title: "Projetos" };

export default function ProjectsPage() {
  return (
    <ModulePage
      icon={Ruler}
      title="Projetos"
      subtitle="Desenvolvimento e engenharia das suas peças 3D: custo real, insumos, fotos e um quadro branco pra brainstorming."
      primaryLabel="Novo projeto"
      kpis={[
        { label: "Em andamento", hint: "Projetos ativos" },
        { label: "Concluídos (mês)", hint: "Finalizados" },
        { label: "Custo médio", hint: "Por peça" },
        { label: "Protótipos", hint: "Em prototipagem" },
      ]}
      features={[
        { icon: Ruler, title: "Custo real por projeto", desc: "Peso da peça × custo do grama + depreciação da máquina + energia." },
        { icon: ImageIcon, title: "Fotos de peça e insumos", desc: "Upload com preview da peça final e dos materiais utilizados." },
        { icon: ChartLineUp, title: "Evolução mensal", desc: "Gráfico de projetos criados vs. concluídos, atualizado a cada mês." },
        { icon: Kanban, title: "Quadro branco (whiteboard)", desc: "Post-its livres e fluxogramas rápidos pra brainstorming antes do Kanban." },
        { icon: Cube, title: "Ligação com Modelagem", desc: "Conecte o projeto ao arquivo STL/3MF de origem no repositório." },
        { icon: FileText, title: "Detalhes técnicos", desc: "Notas de fatiamento, materiais e histórico de revisões da peça." },
      ]}
    />
  );
}
