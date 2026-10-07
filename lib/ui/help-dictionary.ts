/**
 * Dicionário Centralizado de Ajuda Contextual e Popovers (Help Dictionary)
 *
 * Contém os textos de apoio, fórmulas matemáticas, impactos operacionais
 * e exemplos de calibração real para o Super Admin e o Assinante PRO.
 */

export interface HelpTopic {
  title: string;
  operation: string;
  formula?: string;
  impact: string;
  recommendedValue: string;
}

export const HELP_DICTIONARY: Record<string, HelpTopic> = {
  // --- SUPER ADMIN / PLATFORM DICTIONARY ---
  polymer_risk_factor: {
    title: "Fator de Risco por Polímero (k_mat)",
    operation:
      "Penalidade percentual aplicada sobre o custo fabril direto para absorver estatisticamente perdas por warping, retração térmico-mecânica e descolamento de mesa.",
    formula: "F_risk = 1 + (k_mat + k_geom + k_time)",
    impact:
      "Aumentar este valor encarece orçamentos com materiais técnicos (ABS, PA-CF), protegendo a margem contra refações. Diminuir reduz o preço para o cliente final mas aumenta a vulnerabilidade financeira.",
    recommendedValue: "PLA: 2% (0.02) | PETG: 4% (0.04) | ABS/ASA: 10% (0.10) | TPU: 8% (0.08) | PA-CF: 15% (0.15)",
  },
  machine_depreciation_hourly: {
    title: "Depreciação Horária da Impressora (D_mach)",
    operation:
      "Custo fixo imputado por hora de funcionamento para amortizar o valor de aquisição da máquina ao longo de sua vida útil operacional.",
    formula: "D_mach = (Valor_Aquisiçao - Valor_Residual) / Vida_Útil_Horas",
    impact:
      "Garante que o fundo de reposição de maquinário seja abastecido a cada pedido impresso. Valores baixos demais amortizam a impressora sem gerar capital para troca.",
    recommendedValue: "R$ 0,40/h (Ex: R$ 5.000,00 aquisição, R$ 1.000,00 residual, 10.000 horas úteis)",
  },
  platform_take_rate: {
    title: "Split / Comissão da Plataforma (Take Rate)",
    operation:
      "Percentual descontado automaticamente pela plataforma sobre o valor transacionado em cada pedido fechado via checkout.",
    formula: "Taxa_Plataforma = Valor_Bruto * (Take_Rate_Pct / 100)",
    impact:
      "Define a receita direta da plataforma SaaS sobre o volume transacionado (GMV) do assinante.",
    recommendedValue: "Plano PRO: 2.5% a 5.0% por transação concluída",
  },
  spool_critical_residue: {
    title: "Limiar de Ruptura de Estoque (Spool Critical Residue)",
    operation:
      "Quantidade mínima de massa restante em um carretel físico que dispara o alerta de resíduo crítico ou bloqueia alocação automática.",
    formula: "Massa_Restante <= Limiar_Crítico (g)",
    impact:
      "Evita que ordens de serviço fiquem incompletas no meio da impressão por falta de filamento na máquina.",
    recommendedValue: "< 50g para alerta de troca imediata | < 200g para reabastecimento de estoque",
  },
  simples_nacional_tax: {
    title: "Alíquota de Imposto / Simples Nacional (T_tax)",
    operation:
      "Porcentagem de tributação direta descontada do faturamento bruto do pedido de faturamento da empresa.",
    formula: "PV = (C_fab + C_fixo) / [1 - (MC + T_tax)]",
    impact:
      "Preserva a margem líquida real de contribuição ao precificar considerando a fatia recolhida pela nota fiscal.",
    recommendedValue: "Simples Nacional Anexo III: 6.0% a 11.2% (média inicial 8.0%)",
  },

  // --- TENANT PRO / OFICINA DICTIONARY ---
  kwh_energy_rate: {
    title: "Tarifa Real de Energia (R$/kWh)",
    operation:
      "Custo por quilowatt-hora cobrado pela concessionária local de energia elétrica na fatura da oficina.",
    formula: "C_energia = (Potencia_Media_Watts / 1000) * Horas * Tarifa_kWh",
    impact:
      "Permite calcular o consumo térmico estacionário exato da mesa aquecida e hotend da impressora.",
    recommendedValue: "Brasil (Média): R$ 0,85/kWh (variação de R$ 0,65 no PR/SC até R$ 1,20 no RJ/BA com bandeiras)",
  },
  spool_cost_per_kg: {
    title: "Custo de Compra do Carretel (R$/kg)",
    operation:
      "Preço efetivo pago por quilograma de filamento bruto, incluindo frete proporcional de entrega.",
    formula: "C_mat = [Massa_Total_g * (1 + Fator_Perda)] * (Custo_kg / 1000)",
    impact:
      "Multiplica diretamente a massa em gramas da peça fatiada e torres de purga multi-material.",
    recommendedValue: "PLA Standard: R$ 85–110/kg | PETG: R$ 90–120/kg | ABS: R$ 80–110/kg | PA-CF: R$ 380–550/kg",
  },
  labor_hourly_rate: {
    title: "Taxa da Hora-Homem de Bancada (R$/h)",
    operation:
      "Custo da hora de trabalho manual do operador para fatiar, destacar suporte, instalar inserts e inspecionar.",
    formula: "C_labor = (Minutos_Bancada / 60) * Taxa_Hora",
    impact:
      "Remunera o tempo humano empregado no pós-processamento de peças complexas.",
    recommendedValue: "R$ 30,00 a R$ 60,00 por hora de bancada operacional",
  },
};
