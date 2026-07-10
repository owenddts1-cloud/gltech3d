import { ModulePage } from "@/components/shell/module/ModulePage";
import { ChartLineUp, FileText, ChartBar, Printer, Receipt, Warning } from "@/lib/ui/icons";

export const metadata = { title: "Relatórios" };

export default function ReportsPage() {
  return (
    <ModulePage
      icon={ChartLineUp}
      title="Relatórios"
      subtitle="Business Intelligence sob demanda: financeiro, produção, falhas e desempenho de vendas por canal."
      primaryLabel="Gerar relatório"
      kpis={[
        { label: "Relatórios salvos", hint: "Modelos prontos" },
        { label: "Gerados (mês)", hint: "Exportações" },
        { label: "Canal top", hint: "Maior faturamento" },
        { label: "Taxa de falha", hint: "Peças perdidas" },
      ]}
      features={[
        { icon: Receipt, title: "Financeiro", desc: "Faturamento, custos, margem e saldo a receber consolidados." },
        { icon: ChartBar, title: "Produção", desc: "Volume de peças, tempo médio e ocupação das impressoras." },
        { icon: Warning, title: "Falhas", desc: "Peças perdidas, causas e impacto no custo por período." },
        { icon: ChartLineUp, title: "Vendas por canal", desc: "Desempenho comparado de Shopee, Mercado Livre e Facebook." },
        { icon: FileText, title: "Export premium", desc: "PDF, Word, CSV, Excel e TXT com cabeçalho profissional GLTECH." },
        { icon: Printer, title: "Impressão formatada", desc: "Layout limpo pronto pra imprimir e apresentar." },
      ]}
    />
  );
}
