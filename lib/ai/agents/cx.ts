/**
 * CXPumpAgent Tool Calling Module
 *
 * Generates technical proposals and dispatches transactional updates to customers.
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

export interface CustomerUpdateParams {
  order_id: string;
  event_type: "quote_ready" | "production_started" | "qc_photos_available" | "shipped_tracking";
  media_urls?: string[];
  tracking_code?: string;
}

export function dispatchCustomerUpdate(params: CustomerUpdateParams) {
  let message = "";
  switch (params.event_type) {
    case "quote_ready":
      message = `Seu orçamento para o pedido #${params.order_id.slice(0, 8)} está pronto para aprovação!`;
      break;
    case "production_started":
      message = `Boas notícias! Seu pedido #${params.order_id.slice(0, 8)} entrou na fila de impressão 3D!`;
      break;
    case "qc_photos_available":
      message = `Seu pedido #${params.order_id.slice(0, 8)} passou pelo controle de qualidade! Confira as fotos da peça.`;
      break;
    case "shipped_tracking":
      message = `Seu pedido #${params.order_id.slice(0, 8)} foi enviado! Rastreio: ${params.tracking_code || "disponível no app"}.`;
      break;
  }

  return {
    ok: true as const,
    dispatched_message: message,
    media_count: params.media_urls?.length ?? 0,
    dispatched_at: new Date().toISOString(),
  };
}
