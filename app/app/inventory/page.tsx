import { ModulePage } from "@/components/shell/module/ModulePage";
import { Toolbox, Printer, Package, ChartBar, Receipt, Warning } from "@/lib/ui/icons";

export const metadata = { title: "Inventário" };

export default function InventoryPage() {
  return (
    <ModulePage
      icon={Toolbox}
      title="Inventário"
      subtitle="Os ativos fixos da oficina: impressoras, estufas, caixas organizadoras, bancadas e computadores, com valor patrimonial."
      primaryLabel="Novo ativo"
      kpis={[
        { label: "Ativos", hint: "Itens cadastrados" },
        { label: "Valor patrimonial", hint: "Total investido" },
        { label: "Impressoras", hint: "Como ativo" },
        { label: "Em manutenção", hint: "Fora de operação" },
      ]}
      features={[
        { icon: Printer, title: "Impressoras como ativo", desc: "Cada máquina entra também aqui como patrimônio depreciável." },
        { icon: Package, title: "Ferramentas e móveis", desc: "Estufas, caixas organizadoras, bancadas, computadores e mais." },
        { icon: ChartBar, title: "Depreciação", desc: "Valor atual calculado a partir da compra e do tempo de uso." },
        { icon: Receipt, title: "Valor e quantidade", desc: "Quanto vale cada item e quantas unidades você tem." },
        { icon: Warning, title: "Alertas de manutenção", desc: "Sinalização de ativos que precisam de revisão." },
        { icon: Toolbox, title: "Patrimônio total", desc: "Soma do valor investido em toda a estrutura da GLTech3D." },
      ]}
    />
  );
}
