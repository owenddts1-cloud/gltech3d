import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Reveal, RevealStagger, RevealItem } from "@/components/ui/motion/Reveal";
import { ModuleToolbar } from "@/components/shell/module/ModuleToolbar";

export interface ModuleKpi {
  label: string;
  hint?: string;
}

export interface ModuleFeature {
  icon: PhosphorIcon;
  title: string;
  desc: string;
}

export interface ModulePageProps {
  icon: PhosphorIcon;
  title: string;
  subtitle: string;
  primaryLabel?: string;
  kpis?: ModuleKpi[];
  features: ModuleFeature[];
}

/**
 * Shell premium reutilizável para as abas do super app no milestone 1.
 * Header com ícone/gradiente + toolbar de ações + KPIs de prévia (skeleton) +
 * grid de features (o que o módulo fará). Navegável e bonito; dados reais
 * chegam no aprofundamento de cada módulo.
 */
export function ModulePage({
  icon: Icon,
  title,
  subtitle,
  primaryLabel = "Novo",
  kpis = [],
  features,
}: ModulePageProps) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* Header */}
      <Reveal>
        <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-6">
          <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-24" aria-hidden />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon size={26} weight="duotone" aria-hidden />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                    Prévia
                  </Badge>
                </div>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <ModuleToolbar primaryLabel={primaryLabel} moduleName={title} />
          </div>
        </div>
      </Reveal>

      {/* KPIs de prévia */}
      {kpis.length > 0 && (
        <RevealStagger className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {kpis.map((kpi) => (
            <RevealItem key={kpi.label}>
              <Card className="card-hover p-4">
                <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                <Skeleton className="mt-3 h-7 w-16" />
                {kpi.hint ? (
                  <p className="mt-2 text-[11px] text-muted-foreground/80">{kpi.hint}</p>
                ) : (
                  <Skeleton className="mt-2 h-3 w-24" />
                )}
              </Card>
            </RevealItem>
          ))}
        </RevealStagger>
      )}

      {/* Features do módulo */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          O que este módulo faz
        </h2>
        <RevealStagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const FIcon = f.icon;
            return (
              <RevealItem key={f.title}>
                <Card className="card-hover h-full p-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <FIcon size={18} weight="duotone" aria-hidden />
                  </div>
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </Card>
              </RevealItem>
            );
          })}
        </RevealStagger>
      </div>
    </div>
  );
}
