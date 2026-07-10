import { ModulePage } from "@/components/shell/module/ModulePage";
import { Sparkle, Brain, FileText, Robot, ChartLineUp, Cube } from "@/lib/ui/icons";

export const metadata = { title: "Assistente IA" };

export default function AssistantPage() {
  return (
    <ModulePage
      icon={Sparkle}
      title="Assistente IA"
      subtitle="Uma IA nativa no seu software: agnóstica de modelo (Claude, GPT, Gemini), com análise de arquivos e consultoria 3D."
      primaryLabel="Nova conversa"
      kpis={[
        { label: "Conversas", hint: "Este mês" },
        { label: "Arquivos analisados", hint: "PDF, planilha, STL" },
        { label: "Modelo ativo", hint: "Provedor selecionado" },
        { label: "Tokens usados", hint: "Consumo do mês" },
      ]}
      features={[
        { icon: Brain, title: "Multi-modelo", desc: "Alterne ou rode em paralelo Anthropic Claude, OpenAI e Google Gemini via API." },
        { icon: FileText, title: "Análise de arquivos", desc: "Anexe PDFs de especificação, planilhas financeiras e configs de fatiador." },
        { icon: Cube, title: "Metadados de STL/3MF", desc: "Leia dimensões e propriedades dos seus modelos direto no chat." },
        { icon: ChartLineUp, title: "Insights de vendas", desc: "Perguntas em linguagem natural sobre os dados do seu banco." },
        { icon: Robot, title: "Consultoria 3D", desc: "Tire dúvidas de parâmetros (stringing, warping, adesão) e processos." },
        { icon: Sparkle, title: "Sugestões de melhoria", desc: "Recomendações de otimização de fluxo dentro do próprio GLTECH CRM." },
      ]}
    />
  );
}
