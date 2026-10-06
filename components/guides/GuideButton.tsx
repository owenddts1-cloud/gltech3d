"use client";

import { Lightbulb } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { useOptionalGuides } from "./GuideProvider";

/**
 * Top-bar button that opens the guide of the current screen.
 * Renders nothing outside the provider or on routes without a guide.
 */
export function GuideButton({ className }: { className?: string }) {
  const guides = useOptionalGuides();
  const guide = guides?.pathGuide ?? null;
  if (!guides || !guide) return null;

  const unseen = guides.ready && !guides.seen.has(guide.id);

  return (
    <button
      type="button"
      onClick={() => guides.openGuide(guide.id)}
      aria-label={unseen ? "Guia desta tela (ainda não visto)" : "Guia desta tela"}
      title={`Abrir o guia: ${guide.title}`}
      className={cn(
        "relative flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-text-muted",
        "transition-colors duration-fast ease-out hover:border-accent hover:text-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500",
        className,
      )}
    >
      <Lightbulb size={15} weight={unseen ? "fill" : "regular"} aria-hidden />
      <span className="hidden md:inline">Guia desta tela</span>
      {unseen ? (
        <span aria-hidden data-testid="guide-unseen-dot" className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
        </span>
      ) : null}
    </button>
  );
}
