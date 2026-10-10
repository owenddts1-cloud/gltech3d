import Link from "next/link";
import { getAppById } from "@/lib/apps/registry";
import { Robot, Play, ArrowRight, Sparkle, DownloadSimple } from "@/lib/ui/icons";
import { Card } from "@/components/ui/card";
import { DemoBanner } from "@/components/app/DemoBanner";

export const metadata = { title: "Automações n8n — GLTech3D" };

const FEATURES = [
  {
    icon: Robot,
    label: "Workflows & Webhook Playground",
    desc: "Gestão nativa de fluxos n8n, acionadores manuais e simulação de payloads JSON.",
  },
  {
    icon: Sparkle,
    label: "Auto-Healing & Logs IA",
    desc: "Diagnóstico automático de causa-raiz para erros com sugestão de correção via IA.",
  },
  {
    icon: DownloadSimple,
    label: "Biblioteca de Templates ZIP",
    desc: "Modelos de automação pré-configurados do pacote awesome-n8n-templates.",
  },
];

export default function AutomationsLandingPage() {
  const app = getAppById("automations")!;
  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 py-12 text-center">
      <DemoBanner title="Modo demonstração —" className="w-full text-left">
        a integração com o n8n ainda está em construção. A demonstração usa workflows e
        execuções de exemplo; nada é disparado de verdade.
      </DemoBanner>

      <div className="flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
          <app.icon size={36} weight="duotone" aria-hidden />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">{app.label}</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          {app.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://n8n-636f.onrender.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-cyan-500/20 hover:opacity-90 transition-all hover:scale-105"
          >
            <span>🚀 Abrir n8n Web (Render)</span>
            <ArrowRight size={16} />
          </a>

          <Link
            href="/app/automations"
            className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-sm font-bold text-cyan-300 hover:bg-cyan-500/20 transition-all"
          >
            <Play size={16} weight="bold" />
            <span>Workspace & Templates</span>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mt-4 text-left">
        {FEATURES.map((f) => (
          <Card key={f.label} className="flex flex-col gap-2 p-5 border border-border bg-card hover:border-cyan-500/40 transition-colors">
            <f.icon size={24} className="text-cyan-400" aria-hidden />
            <h3 className="text-sm font-bold text-foreground">{f.label}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
