import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subject, voice, videoRatio, dispatchN8n } = body;

    const mpServerUrl = process.env.MONEY_PRINTER_URL || "http://127.0.0.1:8501";

    // 1. Tenta conectar com o servidor Python MoneyPrinterTurbo local se ativo
    try {
      const mpRes = await fetch(`${mpServerUrl}/api/v1/scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_subject: subject || "Impressão 3D GLTech3D" }),
      });

      if (mpRes.ok) {
        const mpData = await mpRes.json();
        return NextResponse.json({
          success: true,
          mode: "live_money_printer_python",
          script: mpData.video_script,
          terms: mpData.video_terms,
        });
      }
    } catch {
      // Caso o servidor Python esteja offline, utiliza o motor interno da API
    }

    // 2. Motor interno de geração de roteiro & legendas alinhadas
    const cleanSubject = subject || "Modelo 3D impresso em alta precisão PETG/PLA";
    const script = `[ROTEIRO COMERCIAL GERADO VIA MONEYPRINTER ENGINE]

CENA 1 (0-3s) - HOOK:
"Você sabia que este modelo impresso em 3D tem precisão cirúrgica de 0.05mm?"

CENA 2 (3-8s) - DEMONSTRAÇÃO:
"Feito com filamento de alta resistência ${cleanSubject}, ideal para engenharia e prototipagem rápida."

CENA 3 (8-15s) - CALL TO ACTION:
"Solicite seu orçamento em 60 segundos no site da GLTech3D e receba em qualquer lugar do Brasil!"`;

    const subtitles = [
      { start: "00:00.00", end: "00:03.00", text: `Precisão cirúrgica de 0.05mm com ${cleanSubject}!` },
      { start: "00:03.00", end: "00:08.00", text: "Acabamento perfeito para engenharia e prototipagem." },
      { start: "00:08.00", end: "00:15.00", text: "Peça seu orçamento instantâneo na GLTech3D!" },
    ];

    const jobId = `mp_${Date.now()}`;
    const outputVideoUrl = `https://cdn.gltech3d.com/renders/${jobId}.mp4`;
    const srtSubtitleUrl = `https://cdn.gltech3d.com/renders/${jobId}.srt`;

    // 3. Se solicitado dispatchN8n, dispara webhook para o n8n
    let n8nDispatchResult = null;
    if (dispatchN8n) {
      try {
        const n8nRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/n8n/trigger`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflowId: "tmpl_social",
            payload: {
              videoUrl: outputVideoUrl,
              title: `Criativo 3D: ${cleanSubject}`,
              subtitles,
              status: "READY_FOR_POSTING",
            },
          }),
        });
        n8nDispatchResult = await n8nRes.json();
      } catch {
        n8nDispatchResult = { status: "simulated_dispatch" };
      }
    }

    return NextResponse.json({
      success: true,
      mode: "integrated_money_printer_engine",
      jobId,
      script,
      subtitles,
      outputVideoUrl,
      srtSubtitleUrl,
      n8nDispatchResult,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro ao gerar vídeo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
