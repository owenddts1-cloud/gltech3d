import { ModulePage } from "@/components/shell/module/ModulePage";
import { ClipboardText, Kanban, Clock, Users, Receipt, FileText } from "@/lib/ui/icons";

export const metadata = { title: "Ordens de Serviço" };

export default function ServiceOrdersPage() {
  return (
    <ModulePage
      icon={ClipboardText}
      title="Ordens de Serviço"
      subtitle="Do orçamento à entrega: post-its arrastáveis por status, ligados aos clientes e projetos."
      primaryLabel="Nova OS"
      kpis={[
        { label: "Orçamentos", hint: "Aguardando aprovação" },
        { label: "Em produção", hint: "Sendo impressas" },
        { label: "Concluídas (mês)", hint: "Entregues" },
        { label: "SLA em risco", hint: "Prazo estourando" },
      ]}
      features={[
        { icon: Kanban, title: "Board arrastável", desc: "Colunas Orçamento → Aprovado → Em produção → Concluído, arrastando os cards." },
        { icon: Users, title: "Ligada ao cliente", desc: "Cada OS referencia um contato do CRM e, opcionalmente, um projeto." },
        { icon: Clock, title: "Métricas de prazo (SLA)", desc: "Acompanhe prazos, quantidades de peças e alertas de vencimento." },
        { icon: FileText, title: "Notas de fatiamento", desc: "Altura de camada, preenchimento e suportes registrados por ordem." },
        { icon: Receipt, title: "Valor total", desc: "Orçamento e valor final por OS, alimentando o Dashboard e o financeiro." },
        { icon: ClipboardText, title: "Histórico completo", desc: "Linha do tempo de status e responsáveis por cada ordem." },
      ]}
    />
  );
}
