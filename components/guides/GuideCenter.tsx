"use client";

import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Lightbulb, X } from "@/lib/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GUIDES, guideHref } from "@/lib/guides/registry";
import { GUIDE_GROUP_LABEL, GUIDE_GROUP_ORDER, type GuideEntry, type GuideGroup } from "@/lib/guides/types";

const EASE_OUT_FAST = [0.2, 0, 0, 1] as const;

export interface GuideCenterProps {
  open: boolean;
  onClose: () => void;
  seen: ReadonlySet<string>;
  onOpenGuide: (id: string) => void;
  /** Guide of the screen the user is on, highlighted in the list. */
  currentGuideId: string | null;
  /** Hides guides of screens the user's role cannot open (default: show all). */
  isVisible?: (guide: GuideEntry) => boolean;
}

/** Guides grouped in sidebar order. Computed once: the registry is static. */
const GROUPED: { group: GuideGroup; guides: GuideEntry[] }[] = GUIDE_GROUP_ORDER.map((group) => ({
  group,
  guides: GUIDES.filter((g) => g.group === group),
})).filter((g) => g.guides.length > 0);

/** Dialog listing every guide, with seen state, a link to the screen and "Abrir guia". */
export function GuideCenter({
  open,
  onClose,
  seen,
  onOpenGuide,
  currentGuideId,
  isVisible = () => true,
}: GuideCenterProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const visible = GUIDES.filter(isVisible);
  const grouped = GROUPED.map(({ group, guides }) => ({ group, guides: guides.filter(isVisible) })).filter(
    (g) => g.guides.length > 0,
  );
  const total = visible.length;
  const seenCount = visible.filter((g) => seen.has(g.id)).length;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                data-no-print
                className="fixed inset-0 z-50 bg-black/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT_FAST }}
              />
            </Dialog.Overlay>
            {/* Positioning wrapper: motion owns `transform` on the dialog itself. */}
            <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-4 pt-[8vh]">
              <Dialog.Content asChild forceMount aria-modal="true">
                <motion.div
                  data-no-print
                  className="pointer-events-auto flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface text-text shadow-xl outline-none"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: EASE_OUT_FAST }}
                >
                  <header className="flex items-start gap-3 border-b border-border px-5 py-4">
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
                    >
                      <Lightbulb size={20} weight="duotone" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Dialog.Title className="text-lg font-semibold leading-tight">Central de guias</Dialog.Title>
                      <Dialog.Description className="mt-0.5 text-sm text-text-muted">
                        Reveja a explicação de qualquer tela quando quiser.
                      </Dialog.Description>
                      <div className="mt-3 flex items-center gap-3">
                        <div
                          role="progressbar"
                          aria-label="Guias vistos"
                          aria-valuemin={0}
                          aria-valuemax={total}
                          aria-valuenow={seenCount}
                          className="h-1 w-32 overflow-hidden rounded-full bg-surface-elevated"
                        >
                          <div
                            className="h-full origin-left rounded-full bg-accent transition-transform duration-slow ease-out"
                            style={{ transform: `scaleX(${total ? seenCount / total : 0})` }}
                          />
                        </div>
                        <span className="text-xs text-text-subtle">
                          {seenCount} de {total} vistos
                        </span>
                      </div>
                    </div>
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        aria-label="Fechar central de guias"
                        className="rounded-md p-1.5 text-text-subtle transition-colors duration-fast ease-out hover:bg-surface-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                      >
                        <X size={16} aria-hidden />
                      </button>
                    </Dialog.Close>
                  </header>

                  <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
                    {grouped.map(({ group, guides }) => (
                      <section key={group} aria-labelledby={`guide-group-${group}`}>
                        <h3
                          id={`guide-group-${group}`}
                          className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-text-subtle"
                        >
                          {GUIDE_GROUP_LABEL[group]}
                        </h3>
                        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                          {guides.map((g) => {
                            const isSeen = seen.has(g.id);
                            const isHere = g.id === currentGuideId;
                            return (
                              <li
                                key={g.id}
                                className={cn("flex items-center gap-3 px-3.5 py-2.5", isHere && "bg-surface-elevated")}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium text-text">{g.title}</span>
                                    {isHere ? <span className="text-[11px] text-text-subtle">· tela atual</span> : null}
                                  </div>
                                  <p className="mt-0.5 truncate text-xs text-text-muted">{g.idea}</p>
                                </div>
                                <Badge variant={isSeen ? "success" : "neutral"} className="shrink-0">
                                  {isSeen ? "Visto" : "Novo"}
                                </Badge>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="shrink-0"
                                  onClick={() => onOpenGuide(g.id)}
                                  aria-label={`Abrir guia: ${g.title}`}
                                >
                                  Abrir guia
                                </Button>
                                <Link
                                  href={guideHref(g)}
                                  onClick={onClose}
                                  aria-label={`Ir para a tela ${g.title}`}
                                  title="Ir para a tela"
                                  className="shrink-0 rounded-md p-1.5 text-text-subtle transition-colors duration-fast ease-out hover:bg-surface-elevated hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                                >
                                  <ArrowUpRight size={16} aria-hidden />
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    ))}
                  </div>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
