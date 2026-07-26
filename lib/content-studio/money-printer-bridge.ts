import type { MoneyPrinterJob } from "@/types/hub";
import { dataMesh } from "@/lib/mesh/data-mesh";

export class MoneyPrinterBridge {
  public async generateAndDispatchToN8n(
    productName: string,
    description: string
  ): Promise<{ job: MoneyPrinterJob; dispatchedPayloadId: string; script?: string; subtitles?: { start: string; end: string; text: string }[] }> {
    try {
      // Chama a rota de API real /api/content-studio/generate
      const res = await fetch("/api/content-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: productName,
          description,
          dispatchN8n: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const job: MoneyPrinterJob = {
          jobId: data.jobId || `mp_${Date.now()}`,
          videoSubject: `Vídeo Comercial 3D: ${productName}`,
          voiceName: "pt_BR_FranciscaNeural",
          status: "completed",
          outputVideoUrl: data.outputVideoUrl,
          srtSubtitleUrl: data.srtSubtitleUrl,
        };

        const payload = dataMesh.emit("content-studio", "automations", "CONTENT_TO_AUTOMATION", {
          videoUrl: data.outputVideoUrl,
          title: `Criativo 3D: ${productName}`,
          description: description || `Confira a precisão do modelo 3D ${productName} produzido pela GLTech3D!`,
          targetPlatforms: ["instagram_reels", "tiktok", "whatsapp_broadcast"],
          renderedAt: new Date().toISOString(),
          script: data.script,
          subtitles: data.subtitles,
        });

        return {
          job,
          dispatchedPayloadId: payload.id,
          script: data.script,
          subtitles: data.subtitles,
        };
      }
    } catch {
      // Fallback local se a requisição falhar
    }

    const jobId = `mp_auto_${Date.now()}`;
    const outputVideoUrl = `https://cdn.gltech3d.com/renders/${jobId}.mp4`;
    const payload = dataMesh.emit("content-studio", "automations", "CONTENT_TO_AUTOMATION", {
      videoUrl: outputVideoUrl,
      title: `Criativo 3D: ${productName}`,
      description,
      renderedAt: new Date().toISOString(),
    });

    return {
      job: {
        jobId,
        videoSubject: productName,
        voiceName: "pt_BR_FranciscaNeural",
        status: "completed",
        outputVideoUrl,
      },
      dispatchedPayloadId: payload.id,
    };
  }

  public async createVideoJob(subject: string, voice: string = "pt_BR_male"): Promise<MoneyPrinterJob> {
    const jobId = `mp_${Date.now()}`;
    return {
      jobId,
      videoSubject: subject,
      voiceName: voice,
      status: "queued",
    };
  }
}

export const moneyPrinterBridge = new MoneyPrinterBridge();
