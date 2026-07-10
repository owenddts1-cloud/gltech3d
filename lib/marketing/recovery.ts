import { createAdminClient } from "@/lib/supabase/admin";
import { getWahaClient } from "@/lib/waha/client";
import { randomUUID } from "node:crypto";
import { audit } from "@/lib/audit";

interface RecoveryTriggerInput {
  organizationId: string;
  customerName: string;
  phone: string;       // e.g., "5511999999999"
  email?: string;
  totalValueCents?: number; // value in cents
  cartUrl?: string;
  messageBody?: string;
}

/**
 * Main recovery hook to process abandoned carts or high-intent marketplace messages.
 */
export async function triggerLeadRecovery(
  input: RecoveryTriggerInput,
  type: "abandoned_cart" | "high_intent_message"
): Promise<{ ok: boolean; leadId?: string; messageId?: unknown; error?: string }> {
  const requestId = randomUUID();
  const supabase = createAdminClient();

  try {
    // 1. Find or create the contact in the database
    let contactId = null;
    const cleanPhone = input.phone.replace(/\D/g, "");
    
    // Find contact by phone
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      // Create new contact
      const { data: newContact, error: contactErr } = await supabase
        .from("contacts")
        .insert({
          organization_id: input.organizationId,
          name: input.customerName,
          phone: cleanPhone,
          email: input.email || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (contactErr) throw new Error(`Contact creation failed: ${contactErr.message}`);
      contactId = newContact.id;
    }

    // 2. Resolve default pipeline and first stage of that pipeline
    const { data: defaultPipeline, error: pipErr } = await supabase
      .from("crm_pipelines")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("is_default", true)
      .maybeSingle();

    let targetPipelineId = defaultPipeline?.id;

    if (pipErr || !targetPipelineId) {
      // Fallback: get first available pipeline
      const { data: anyPipeline } = await supabase
        .from("crm_pipelines")
        .select("id")
        .eq("organization_id", input.organizationId)
        .limit(1)
        .maybeSingle();
      
      targetPipelineId = anyPipeline?.id;
    }

    if (!targetPipelineId) {
      throw new Error("No pipeline found for organization to assign lead recovery.");
    }

    // Resolve first stage in target pipeline
    const { data: stages, error: stgErr } = await supabase
      .from("crm_stages")
      .select("id")
      .eq("pipeline_id", targetPipelineId)
      .order("position", { ascending: true })
      .limit(1);

    if (stgErr || !stages || stages.length === 0) {
      throw new Error("No stages found for the resolved pipeline.");
    }
    const targetStageId = stages[0]!.id;

    // Calculate lead title and description
    const title = type === "abandoned_cart" 
      ? `Carrinho Abandonado: ${input.customerName}`
      : `Lead Quente (Alta Intenção): ${input.customerName}`;

    const description = type === "abandoned_cart"
      ? `Cliente abandonou carrinho no valor de R$ ${((input.totalValueCents || 0) / 100).toFixed(2)}. Link: ${input.cartUrl || "Não informado"}`
      : `Mensagem enviada pelo cliente: "${input.messageBody || ""}"`;

    // 3. Create the Lead in the Kanban Board
    // Fetch max position for ordering
    const { data: maxRow } = await supabase
      .from("crm_leads")
      .select("position_in_stage")
      .eq("stage_id", targetStageId)
      .order("position_in_stage", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPos = maxRow?.position_in_stage ? Number(maxRow.position_in_stage) + 1000 : 1000;

    const { data: lead, error: leadErr } = await supabase
      .from("crm_leads")
      .insert({
        organization_id: input.organizationId,
        pipeline_id: targetPipelineId,
        stage_id: targetStageId,
        contact_id: contactId,
        title,
        description,
        status: "open",
        position_in_stage: nextPos,
        value_cents: input.totalValueCents || 0,
        currency: "BRL",
        source: type === "abandoned_cart" ? "Cart Abandonment" : "Marketplace Message",
        source_metadata: {
          type,
          cart_url: input.cartUrl || null,
          original_message: input.messageBody || null,
        },
        tags: ["automacao", type],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (leadErr || !lead) {
      throw new Error(`Lead creation failed: ${leadErr?.message}`);
    }

    // 4. Send automated recovery message via WAHA WhatsApp
    const waha = getWahaClient();
    let messageResult = null;
    let wahaSent = false;

    // Build friendly message body
    const formattedValue = input.totalValueCents 
      ? `R$ ${(input.totalValueCents / 100).toFixed(2)}` 
      : "";
    
    const messageText = type === "abandoned_cart"
      ? `Olá, ${input.customerName}! Tudo bem?\n\nPercebemos que você adicionou itens ao seu carrinho na GLTech3D ${formattedValue ? `no valor de ${formattedValue} ` : ""}mas não concluiu a compra.\n\nQueremos te ajudar a tirar seu projeto 3D do papel! Para recuperar seus itens, acesse este link exclusivo com frete grátis: ${input.cartUrl || "gltech3d.com.br/checkout"}`
      : `Olá, ${input.customerName}! Recebemos sua mensagem sobre nossos serviços de impressão 3D e prototipagem rápida.\n\nUm engenheiro da nossa equipe já foi notificado e entrará em contato com você em instantes. Obrigado pelo interesse!`;

    if (waha) {
      try {
        const chatId = `${cleanPhone}@c.us`;
        // WAHA uses session named "default" by convention
        messageResult = await waha.sendMessage("default", chatId, messageText);
        wahaSent = true;
      } catch (err: unknown) {
        console.error("WAHA Send failed:", err instanceof Error ? err.message : String(err));
      }
    }

    // Log audit event
    await audit({
      action: "marketing.lead_recovery_triggered",
      actorUserId: null, // automated
      organizationId: input.organizationId,
      resourceType: "crm_lead",
      resourceId: lead.id,
      requestId,
      metadata: {
        type,
        waha_sent: wahaSent,
        phone: cleanPhone,
      },
    });

    return {
      ok: true,
      leadId: lead.id,
      messageId: messageResult,
    };

  } catch (err: unknown) {
    console.error("Lead recovery failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error during lead recovery",
    };
  }
}
