import { ModulePage } from "@/components/shell/module/ModulePage";
import { CalendarBlank, ClipboardText, Clock, Printer, Ruler, ChartBar } from "@/lib/ui/icons";

export const metadata = { title: "Calendário" };

export default function CalendarPage() {
  return (
    <ModulePage
      icon={CalendarBlank}
      title="Calendário"
      subtitle="O cronograma da fábrica num só lugar: prazos de OS, manutenções das impressoras e marcos de projetos."
      primaryLabel="Novo evento"
      kpis={[
        { label: "Eventos (semana)", hint: "Agendados" },
        { label: "Entregas próximas", hint: "OS com prazo" },
        { label: "Manutenções", hint: "Preventivas" },
        { label: "Atrasados", hint: "Fora do prazo" },
      ]}
      features={[
        { icon: ClipboardText, title: "Prazos de OS", desc: "Cada ordem de serviço aparece na sua data de entrega prevista." },
        { icon: Printer, title: "Manutenção preventiva", desc: "Agende e visualize revisões das impressoras antes que quebrem." },
        { icon: Ruler, title: "Marcos de projeto", desc: "Datas-chave de desenvolvimento e prototipagem no mesmo calendário." },
        { icon: Clock, title: "Visões mês/semana", desc: "Alterne entre visão macro mensal e o detalhe da semana." },
        { icon: CalendarBlank, title: "Google Agenda (futuro)", desc: "Base pronta pra sincronizar com o Google Agenda na fase de integrações." },
        { icon: ChartBar, title: "Carga da fábrica", desc: "Enxergue gargalos de produção pela densidade de eventos no período." },
      ]}
    />
  );
}
