import Link from "next/link";
import { getAppById } from "@/lib/apps/registry";
import { ImageIcon, VideoCamera, Sparkle, ArrowRight, Play } from "@/lib/ui/icons";
import { Card } from "@/components/ui/card";
import { DemoBanner } from "@/components/app/DemoBanner";

export const metadata = { title: "AI Content Studio — GLTech3D" };

const FEATURES = [
  { icon: VideoCamera, label: "Timeline & Edição de Vídeo", desc: "Edição programática, legendas automáticas com Whisper e exportação SRT." },
  { icon: Sparkle, label: "MoneyPrinterTurbo Integration", desc: "Geração 100% automatizada de roteiro, narração TTS e vídeos Shorts/Reels." },
  { icon: ImageIcon, label: "Conectores MCP Criativos", desc: "Integração nativa com Higgsfield, Flux, ComfyUI e Google AI Studio." },
];

export default function ContentStudioPage() {
  const app = getAppById("content-studio")!;
  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 py-12 text-center">
      <DemoBanner title="Modo demonstração —" className="w-full text-left">
        nada é publicado nem exportado ainda. O editor abaixo é uma prévia da interface, e as
        integrações listadas estão planejadas, não ativas.
      </DemoBanner>

      <div className="flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
          <app.icon size={36} weight="duotone" aria-hidden />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">{app.label}</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          {app.description}
        </p>

        <Link
          href="/content-studio/timeline"
          className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/20 hover:opacity-90 transition-all hover:scale-105"
        >
          <Play size={18} weight="bold" />
          <span>Ver demonstração do editor</span>
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mt-4 text-left">
        {FEATURES.map((f) => (
          <Card key={f.label} className="flex flex-col gap-2 p-5 border border-border bg-card hover:border-amber-500/40 transition-colors">
            <f.icon size={24} className="text-amber-400" aria-hidden />
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-foreground">{f.label}</h3>
              <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Planejado
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
