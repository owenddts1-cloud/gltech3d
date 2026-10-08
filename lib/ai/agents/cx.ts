/**
 * CXPumpAgent Tool Calling Module
 *
 * Generates technical proposals and dispatches transactional customer updates across key milestones:
 * 1. Print started / entered production
 * 2. 50% milestone / interim QC checkpoint
 * 3. Print finished on bed / finishing and post-curing
 * 4. Shipped with tracking code OR ready for local pickup
 */

export interface TechnicalProposalParams {
  order_id: string;
  customer_name: string;
  items: Array<{ title: string; polymer: string; mass_g: number; price_brl: number }>;
  total_price_brl: number;
  delivery_days: number;
  include_cost_breakdown?: boolean;
}

export function generateTechnicalProposal(params: TechnicalProposalParams) {
  const lines = [
    `PROPOSTA TÉCNICA DE IMPRESSÃO 3D (Ref: ${params.order_id.slice(0, 8)})`,
    `Cliente: ${params.customer_name}`,
    `Prazo de Entrega Estimado: ${params.delivery_days} dia(s) útil(is)`,
    "",
    "Itens do Projeto:",
    ...params.items.map(
      (i) => `• ${i.title} (${i.polymer}, ${i.mass_g}g) — R$ ${i.price_brl.toFixed(2)}`
    ),
    "",
    `Valor Total do Projeto: R$ ${params.total_price_brl.toFixed(2)}`,
    "",
    "Proposta válida por 7 dias.",
  ];

  return {
    proposal_text: lines.join("\n"),
    checkout_url: `https://app.gltech3d.com/checkout/${params.order_id}`,
  };
}

export type CXMilestoneEvent =
  | "quote_ready"
  | "production_started"
  | "print_started"
  | "progress_halfway"
  | "print_finished"
  | "qc_photos_available"
  | "shipped_tracking"
  | "ready_for_pickup";

export interface CustomerUpdateParams {
  order_id: string;
  event_type: CXMilestoneEvent;
  customer_name?: string;
  media_urls?: string[];
  tracking_code?: string;
  pickup_instructions?: string;
  progress_pct?: number;
}

export function dispatchCustomerUpdate(params: CustomerUpdateParams) {
  const shortId = params.order_id.slice(0, 8);
  const greeting = params.customer_name ? `Olá ${params.customer_name}! ` : "";
  let message = "";

  switch (params.event_type) {
    case "quote_ready":
      message = `${greeting}Seu orçamento para o pedido #${shortId} está pronto para aprovação! Acesse para conferir os detalhes técnicos.`;
      break;

    case "production_started":
    case "print_started":
      message = `${greeting}Boas notícias! A impressão da peça do seu pedido #${shortId} entrou em produção na oficina da GLTech3D!`;
      break;

    case "progress_halfway": {
      const pct = params.progress_pct ?? 50;
      message = `${greeting}Seu pedido #${shortId} atingiu ${pct}% de conclusão! Controle de qualidade intermediário aprovado com sucesso na farm.`;
      break;
    }

    case "print_finished":
      message = `${greeting}Peça do pedido #${shortId} finalizada na mesa com sucesso! O item avançou para a fase de acabamento e pós-cura na oficina.`;
      break;

    case "qc_photos_available":
      message = `${greeting}Seu pedido #${shortId} passou pelo controle de qualidade! Confira as fotos em alta resolução da peça aprovada.`;
      break;

    case "shipped_tracking":
      message = `${greeting}Seu pedido #${shortId} foi despachado via transportadora! Código de rastreio para acompanhamento: ${params.tracking_code || "disponível no app"}.`;
      break;

    case "ready_for_pickup":
      message = `${greeting}Seu pedido #${shortId} está pronto e disponível para retirada! Local: ${params.pickup_instructions || "Oficina GLTech3D"}.`;
      break;
  }

  return {
    ok: true as const,
    dispatched_message: message,
    media_count: params.media_urls?.length ?? 0,
    dispatched_at: new Date().toISOString(),
  };
}
