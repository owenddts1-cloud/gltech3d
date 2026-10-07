"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QuestionMark } from "@/lib/ui/icons";
import { HELP_DICTIONARY, type HelpTopic } from "@/lib/ui/help-dictionary";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  topicKey?: string;
  topic?: HelpTopic;
  className?: string;
}

export function HelpTooltip({ topicKey, topic: directTopic, className }: HelpTooltipProps) {
  const [open, setOpen] = React.useState(false);

  const topic = directTopic ?? (topicKey ? HELP_DICTIONARY[topicKey] : undefined);

  if (!topic) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted/60 text-[10px] font-bold text-muted-foreground transition-colors hover:bg-accent/20 hover:text-accent focus:outline-none focus:ring-1 focus:ring-accent ml-1 align-middle cursor-pointer",
            className
          )}
          aria-label={`Ajuda sobre ${topic.title}`}
        >
          <QuestionMark className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 p-4 bg-surface border-border shadow-xl rounded-xl text-xs text-foreground space-y-2.5 z-50"
      >
        <div className="font-bold text-sm text-foreground flex items-center gap-1.5 border-b border-border/60 pb-1.5">
          <span className="h-2 w-2 rounded-full bg-accent" />
          {topic.title}
        </div>

        <div>
          <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wider">O que faz</span>
          <p className="mt-0.5 text-foreground/90 leading-relaxed">{topic.operation}</p>
        </div>

        {topic.formula && (
          <div className="p-2 bg-muted/50 border border-border/40 rounded-md font-mono text-[11px] text-accent">
            <span className="font-sans font-semibold text-muted-foreground block text-[9px] uppercase tracking-wider mb-0.5">Fórmula</span>
            {topic.formula}
          </div>
        )}

        <div>
          <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wider">Impacto Operacional</span>
          <p className="mt-0.5 text-muted-foreground leading-relaxed">{topic.impact}</p>
        </div>

        <div className="pt-1 border-t border-border/40">
          <span className="font-semibold text-emerald-500 block text-[10px] uppercase tracking-wider">Valor Recomendado</span>
          <p className="mt-0.5 font-medium text-foreground">{topic.recommendedValue}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
