"use client";

import { useState, useEffect } from "react";
import {
  VideoCamera,
  Play,
  Pause,
  Sparkle,
  ImageIcon,
  MusicNote,
  FileText,
  DownloadSimple,
  PlugsConnected,
  Lightning,
  ArrowsClockwise,
  CheckCircle,
} from "@/lib/ui/icons";
import { moneyPrinterBridge } from "@/lib/content-studio/money-printer-bridge";
import { creativeMcpClient } from "@/lib/mcp/creative-client";
import { dataMesh } from "@/lib/mesh/data-mesh";

export default function ContentStudioTimelinePage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [prompt, setPrompt] = useState("Criativo em vídeo mostrando o filamento PETG GLTech3D impresso em alta resolução.");
  const [generatedScript, setGeneratedScript] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [importedBadge, setImportedBadge] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState([
    { start: "00:00.00", end: "00:03.00", text: "Procurando peças em 3D de alta resistência?" },
    { start: "00:03.00", end: "00:08.00", text: "Conheça o acabamento cirúrgico da GLTech3D." },
    { start: "00:08.00", end: "00:15.00", text: "Faça seu orçamento online agora mesmo!" },
  ]);

  useEffect(() => {
    // Escuta eventos em tempo real do Cross-App Data Mesh
    const unsubscribe = dataMesh.subscribe((payload) => {
      if (payload.payloadType === "CRM_TO_CONTENT" && payload.data) {
        const data = payload.data as { productName?: string; category?: string; material?: string; price?: number };
        if (data.productName) {
          const newPrompt = `Vídeo comercial do produto 3D '${data.productName}'${data.material ? ` produzido em filamento ${data.material}` : ""}. Preço especial de lançamento: R$ ${data.price || "sob consulta"}.`;
          setPrompt(newPrompt);
          setImportedBadge(`Dados de '${data.productName}' importados do CRM!`);
          setSubtitles([
            { start: "00:00.00", end: "00:03.00", text: `Conheça o novo ${data.productName}!` },
            { start: "00:03.00", end: "00:08.00", text: `Qualidade cirúrgica impressa em ${data.material || "PETG/PLA"}.` },
            { start: "00:08.00", end: "00:15.00", text: `Garanta o seu por apenas R$ ${data.price || "sob consulta"}!` },
          ]);
        }
      }
    });

    // Também verifica histórico recente
    const history = dataMesh.getHistory();
    const lastCrmEvent = history.find((h) => h.payloadType === "CRM_TO_CONTENT");
    if (lastCrmEvent && lastCrmEvent.data) {
      const data = lastCrmEvent.data as { productName?: string; material?: string; price?: number };
      if (data.productName) {
        setImportedBadge(`Dados de '${data.productName}' importados do CRM!`);
      }
    }

    return () => unsubscribe();
  }, []);

  const handleGenerateContent = async () => {
    setIsGenerating(true);
    const script = await creativeMcpClient.generateScriptWithLLM(prompt);
    setGeneratedScript(script);
    setIsGenerating(false);
  };

  const handleMoneyPrinterSubmit = async () => {
    const job = await moneyPrinterBridge.createVideoJob(prompt);
    alert(`Job MoneyPrinterTurbo submetido! ID: ${job.jobId}. O vídeo final será renderizado em MP4 em background.`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <VideoCamera className="text-amber-500" size={24} />
            <span>AI Content Studio & Timeline Editor</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Estúdio de edição programática com Remotion, transcrição Whisper, MoneyPrinterTurbo e conectores MCP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const res = await moneyPrinterBridge.generateAndDispatchToN8n(prompt, prompt);
              alert(`🎉 Vídeo gerado pelo MoneyPrinterTurbo! ID: ${res.job.jobId}.\n\nTransmitido via Data Mesh para o workflow n8n (Instagram/TikTok/WhatsApp) com o ID ${res.dispatchedPayloadId}!`);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:opacity-90 transition-opacity shadow-lg shadow-orange-500/20"
          >
            <Lightning size={15} weight="fill" />
            <span>Gerar Vídeo & Auto-Postar via n8n</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Prompt & Script Generator */}
        <div className="space-y-4 rounded-xl bg-card border border-border p-5 shadow-sm">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkle size={16} className="text-amber-400" />
            <span>Gerador de Roteiro & MCP Prompt</span>
          </h2>

          {importedBadge && (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg animate-pulse">
              <CheckCircle size={16} />
              <span>{importedBadge}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Tema / Briefing do Vídeo:</label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 p-3 text-xs text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <button
            onClick={handleGenerateContent}
            disabled={isGenerating}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/20"
          >
            <span>{isGenerating ? "Gerando Roteiro via LLM..." : "Gerar Roteiro com IA"}</span>
          </button>

          {generatedScript && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Roteiro Estruturado (MCP Output):</label>
              <pre className="w-full rounded-xl bg-zinc-950 p-3 text-xs text-emerald-400 border border-border whitespace-pre-wrap font-sans">
                {generatedScript}
              </pre>
            </div>
          )}
        </div>

        {/* Right Col: Video Viewport & Timeline Editor */}
        <div className="lg:col-span-2 space-y-4">
          {/* Viewport */}
          <div className="relative aspect-video w-full rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden shadow-2xl">
            <div className="text-center space-y-2">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <VideoCamera size={32} />
              </div>
              <p className="text-xs text-zinc-400">Preview do Vídeo (Remotion / FFmpeg WASM Canvas)</p>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                1080x1920 (9:16 Shorts/Reels)
              </span>
            </div>

            {/* Play Controls Overlay */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="absolute bottom-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-zinc-950 shadow-lg hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause size={18} weight="bold" /> : <Play size={18} weight="bold" className="ml-0.5" />}
            </button>
          </div>

          {/* Subtitle / Timeline Track Editor */}
          <div className="rounded-xl bg-card border border-border p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileText size={15} className="text-amber-400" />
                <span>Legendas Automáticas & Sincronismo (Whisper SRT)</span>
              </h3>
              <button
                onClick={() => alert("Exportando arquivo de legendas .SRT / .VTT")}
                className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:underline"
              >
                <DownloadSimple size={12} />
                <span>Exportar SRT</span>
              </button>
            </div>

            <div className="space-y-2">
              {subtitles.map((sub, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-950 border border-border text-xs">
                  <span className="font-mono text-zinc-500 text-[10px] w-24 shrink-0">{sub.start} ➔ {sub.end}</span>
                  <input
                    type="text"
                    value={sub.text}
                    onChange={(e) => {
                      const updated = [...subtitles];
                      updated[idx]!.text = e.target.value;
                      setSubtitles(updated);
                    }}
                    className="flex-1 bg-transparent text-foreground focus:outline-none focus:border-b focus:border-amber-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
