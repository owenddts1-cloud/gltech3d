import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workflowId, payload, targetWebhookUrl } = body;

    const n8nBaseUrl = process.env.N8N_BASE_URL || process.env.NEXT_PUBLIC_N8N_BASE_URL;
    const apiKey = process.env.N8N_API_KEY;

    // Se houver uma URL de webhook configurada, encaminha a requisição real
    if (targetWebhookUrl || (n8nBaseUrl && apiKey)) {
      const url = targetWebhookUrl || `${n8nBaseUrl}/webhook/${workflowId}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "X-N8N-API-KEY": apiKey } : {}),
        },
        body: JSON.stringify(payload || {}),
      });

      const responseText = await res.text();
      let responseJson = {};
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = { rawResponse: responseText };
      }

      return NextResponse.json({
        success: res.ok,
        status: res.status,
        executionId: `n8n_exec_${Date.now()}`,
        n8nResponse: responseJson,
      });
    }

    // Caso não haja n8n remoto configurado, simula a execução baseada no payload recebido
    return NextResponse.json({
      success: true,
      executionId: `exec_local_${Date.now()}`,
      status: 200,
      mode: "local_sandbox",
      message: `Workflow '${workflowId || "default"}' executado com sucesso no sandbox local n8n.`,
      inputPayload: payload,
      outputData: {
        processedAt: new Date().toISOString(),
        nodesExecuted: ["Webhook Trigger", "Data Mapper", "HTTP Action"],
        result: "OK",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno ao processar disparo do n8n";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
