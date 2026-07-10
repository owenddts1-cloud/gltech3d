import { ModulePage } from "@/components/shell/module/ModulePage";
import { Printer, Cube, Warning, WifiHigh, Package, ChartBar } from "@/lib/ui/icons";

export const metadata = { title: "Impressoras & Filamentos" };

export default function PrintersPage() {
  return (
    <ModulePage
      icon={Printer}
      title="Impressoras & Filamentos"
      subtitle="Cadastre suas máquinas e carretéis, monitore status pela rede e acompanhe o consumo de material."
      primaryLabel="Nova impressora"
      kpis={[
        { label: "Impressoras", hint: "Cadastradas" },
        { label: "Imprimindo agora", hint: "Status ao vivo" },
        { label: "Filamentos", hint: "Carretéis em estoque" },
        { label: "Estoque baixo", hint: "Abaixo do mínimo" },
      ]}
      features={[
        { icon: Printer, title: "Cadastro via popup", desc: "Adicione impressoras e filamentos em modais elegantes, sem sair da tela." },
        { icon: WifiHigh, title: "Monitoramento na rede", desc: "Integração com Klipper/Mainsail/OctoPrint: status, temperatura do bico/mesa e progresso." },
        { icon: Cube, title: "Link máquina ↔ carretel", desc: "Vincule o filamento em uso à impressora ativa e rastreie o consumo real." },
        { icon: Package, title: "Peso restante automático", desc: "Peso inicial menos as gramas gastas em cada impressão, calculado sozinho." },
        { icon: Warning, title: "Alerta de estoque baixo", desc: "Aviso visual quando um material passa do limite mínimo definido." },
        { icon: ChartBar, title: "Consumo por material", desc: "Quanto de PLA/ABS/PETG você gasta por período e por projeto." },
      ]}
    />
  );
}
