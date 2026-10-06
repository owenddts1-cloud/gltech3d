"use client";

import { useCallback, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  Info,
  Lightbulb,
  PlugsConnected,
  Sparkle,
  Warning,
  X,
} from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GUIDE_GROUP_LABEL,
  type GuideAction,
  type GuideEntry,
  type GuideNotice,
  type GuideNoticeKind,
} from "@/lib/guides/types";

/* Motion tokens of the design system (durations 120/200/320/420ms). */
const EASE_OUT_SLOW = [0.16, 1, 0.3, 1] as const;
const EASE_OUT_FAST = [0.2, 0, 0, 1] as const;

export interface GuidePanelProps {
  guide: GuideEntry | null;
  open: boolean;
  onClose: () => void;
  /** Called when the primary action is used (the link itself navigates). */
  onAction: (action: GuideAction) => void;
}

/**
 * Right-side sheet with the guide of a screen.
 *
 * Built on the Radix Dialog primitives (focus trap, Esc, outside click, title
 * and description wiring) with `forceMount` so `motion` can run the exit
 * animation — the shadcn `animate-in` classes do nothing in this project.
 */
export function GuidePanel({ guide, open, onClose, onAction }: GuidePanelProps) {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AnimatePresence>
        {open && guide ? (
          <Dialog.Portal forceMount key={guide.id}>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                data-no-print
                className="fixed inset-0 z-50 bg-black/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT_FAST }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-modal="true">
              <motion.aside
                data-no-print
                data-testid="guide-panel"
                className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-surface text-text shadow-xl outline-none sm:w-[420px]"
                initial={reduceMotion ? { opacity: 0 } : { x: "100%", opacity: 1 }}
                animate={reduceMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { x: "100%", opacity: 1 }}
                transition={
                  reduceMotion
                    ? { duration: 0.2, ease: EASE_OUT_FAST }
                    : { duration: 0.42, ease: EASE_OUT_SLOW }
                }
              >
                <GuideBody guide={guide} reduceMotion={reduceMotion} onClose={onClose} onAction={onAction} />
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function sectionVariants(reduceMotion: boolean): { list: Variants; item: Variants } {
  return {
    list: {
      hidden: {},
      show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } },
    },
    item: {
      hidden: { opacity: 0, y: reduceMotion ? 0 : 8 },
      show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT_SLOW } },
    },
  };
}

function GuideBody({
  guide,
  reduceMotion,
  onClose,
  onAction,
}: {
  guide: GuideEntry;
  reduceMotion: boolean;
  onClose: () => void;
  onAction: (action: GuideAction) => void;
}) {
  const variants = sectionVariants(reduceMotion);
  const action = guide.primaryAction;
  const [stepIndex, setStepIndex] = useState(0);
  const lastStep = guide.steps.length - 1;
  const goToStep = useCallback(
    (next: number) => setStepIndex(Math.max(0, Math.min(lastStep, next))),
    [lastStep],
  );

  // Left/Right walk the steps wherever focus is inside the panel. Up/Down are
  // left alone so the keyboard can still scroll the panel.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goToStep(stepIndex + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goToStep(stepIndex - 1);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col" onKeyDown={onKeyDown}>
      <header className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
        >
          <Lightbulb size={20} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-text-subtle">
            Guia · {GUIDE_GROUP_LABEL[guide.group]}
          </p>
          <Dialog.Title className="mt-0.5 text-lg font-semibold leading-tight text-text">
            {guide.title}
          </Dialog.Title>
        </div>
        <Dialog.Close asChild>
          <button
            type="button"
            aria-label="Fechar guia"
            className="rounded-md p-1.5 text-text-subtle transition-colors duration-fast ease-out hover:bg-surface-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <X size={16} aria-hidden />
          </button>
        </Dialog.Close>
      </header>

      <motion.div
        className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5"
        variants={variants.list}
        initial="hidden"
        animate="show"
      >
        {guide.notice ? (
          <motion.div variants={variants.item}>
            <NoticeBanner notice={guide.notice} />
          </motion.div>
        ) : null}

        <motion.section variants={variants.item} aria-label="A ideia">
          <SectionTitle>A ideia</SectionTitle>
          <Dialog.Description asChild>
            <p className="rounded-lg border-l-[3px] border-accent bg-surface-elevated px-4 py-3 text-[15px] font-medium leading-relaxed text-text">
              {guide.idea}
            </p>
          </Dialog.Description>
        </motion.section>

        <motion.section variants={variants.item} aria-label="Para que serve">
          <SectionTitle>Para que serve</SectionTitle>
          <ul className="space-y-2">
            {guide.purpose.map((p) => (
              <li key={p} className="flex gap-2.5 text-sm leading-relaxed text-text-muted">
                <CheckCircle size={18} weight="fill" aria-hidden className="mt-px shrink-0 text-accent" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section variants={variants.item} aria-label="Como usar">
          <SectionTitle>Como usar</SectionTitle>
          <StepWalker steps={guide.steps} index={stepIndex} onGo={goToStep} reduceMotion={reduceMotion} />
        </motion.section>

        {guide.tabs && guide.tabs.length > 0 ? (
          <motion.section variants={variants.item} aria-label={guide.tabsTitle ?? "Abas desta tela"}>
            <SectionTitle>{guide.tabsTitle ?? "Abas desta tela"}</SectionTitle>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {guide.tabs.map((t) => (
                <li key={t.name} className="px-3.5 py-2.5">
                  <span className="block text-sm font-medium text-text">{t.name}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-text-muted">{t.detail}</span>
                </li>
              ))}
            </ul>
          </motion.section>
        ) : null}

        {guide.tip ? (
          <motion.aside
            variants={variants.item}
            aria-label="Dica"
            className="flex gap-3 rounded-lg border border-dashed border-border-strong px-4 py-3"
          >
            <Sparkle size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
            <p className="text-sm leading-relaxed text-text-muted">
              <strong className="font-semibold text-text">Dica: </strong>
              {guide.tip}
            </p>
          </motion.aside>
        ) : null}
      </motion.div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3">
        <Button type="button" variant="ghost" onClick={onClose}>
          Entendi
        </Button>
        {action ? (
          action.href ? (
            <Button asChild>
              <Link href={action.href} onClick={() => onAction(action)}>
                Começar: {action.label}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button type="button" onClick={() => onAction(action)}>
              Começar: {action.label}
              <ArrowRight aria-hidden />
            </Button>
          )
        ) : null}
      </footer>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-text-subtle">{children}</h3>
  );
}

const NOTICE_STYLE: Record<GuideNoticeKind, { label: string; icon: PhosphorIcon; className: string }> = {
  demo: {
    label: "Demonstração",
    icon: Warning,
    className: "bg-warning-bg text-warning-fg",
  },
  integration: {
    label: "Requer integração",
    icon: PlugsConnected,
    className: "bg-info-bg text-info-fg",
  },
  info: {
    label: "Bom saber",
    icon: Info,
    className: "bg-surface-elevated text-text-muted",
  },
};

function NoticeBanner({ notice }: { notice: GuideNotice }) {
  const style = NOTICE_STYLE[notice.kind];
  const Icon = style.icon;
  return (
    <div role="note" data-kind={notice.kind} className={cn("flex gap-3 rounded-lg px-4 py-3", style.className)}>
      <Icon size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0" />
      <p className="text-sm leading-relaxed">
        <strong className="font-semibold">{style.label}. </strong>
        {notice.text}
      </p>
    </div>
  );
}

/**
 * Vertical stepper. The current step is highlighted and the others dimmed; the
 * user moves with "Anterior"/"Próximo", the arrow keys or by clicking a step.
 */
function StepWalker({
  steps,
  index,
  onGo: go,
  reduceMotion,
}: {
  steps: GuideEntry["steps"];
  index: number;
  onGo: (next: number) => void;
  reduceMotion: boolean;
}) {
  const progressId = useId();
  const total = steps.length;
  const last = total - 1;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span id={progressId} className="font-medium text-text-muted" aria-live="polite">
          Passo {index + 1} de {total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={progressId}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
        className="h-1 overflow-hidden rounded-full bg-surface-elevated"
      >
        <motion.div
          className="h-full origin-left rounded-full bg-accent"
          initial={false}
          animate={{ scaleX: (index + 1) / total }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: EASE_OUT_SLOW }}
        />
      </div>

      <ol className="mt-4">
        {steps.map((step, i) => {
          const state = i < index ? "done" : i === index ? "current" : "todo";
          return (
            <li key={step.title} className="relative pb-2 last:pb-0">
              {i < last ? (
                <span aria-hidden className="absolute bottom-0 left-[21px] top-9 w-px bg-border" />
              ) : null}
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex w-full gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-base ease-out",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500",
                  state === "current" ? "bg-surface-elevated" : "hover:bg-surface-elevated",
                )}
              >
                <span
                  className={cn(
                    "relative z-[1] grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors duration-base ease-out",
                    state === "current" && "border-accent bg-accent text-accent-foreground",
                    state === "done" && "border-accent bg-surface text-accent",
                    state === "todo" && "border-border bg-surface text-text-subtle",
                  )}
                >
                  {state === "done" ? <Check size={14} weight="bold" aria-hidden /> : i + 1}
                </span>
                <span
                  className={cn(
                    "min-w-0 pt-0.5 transition-opacity duration-base ease-out",
                    state === "current" ? "opacity-100" : "opacity-60",
                  )}
                >
                  <span className="block text-sm font-semibold text-text">{step.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-text-muted">{step.detail}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex items-center justify-between gap-2">
        {/* `aria-disabled`, not `disabled`: a focused button that becomes
            disabled drops focus to <body>, outside the dialog. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => go(index - 1)}
          aria-disabled={index === 0}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          <ArrowLeft aria-hidden />
          Anterior
        </Button>
        <span className="hidden text-[11px] text-text-subtle sm:inline">Dica: use ← → do teclado</span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => go(index + 1)}
          aria-disabled={index === last}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          Próximo
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
