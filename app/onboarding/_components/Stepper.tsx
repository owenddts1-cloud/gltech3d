import { cn } from "@/lib/utils";

interface StepDef {
  key: string;
  label: string;
}

const STEPS: StepDef[] = [
  { key: "welcome", label: "Boas-vindas" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "nuvemshop", label: "Loja" },
  { key: "ai", label: "IA" },
  { key: "team", label: "Time" },
  { key: "done", label: "Concluído" },
];

export function Stepper({ current }: { current: string }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol
      aria-label="onboarding steps"
      className="flex w-full items-center justify-between gap-2 px-2 py-3"
    >
      {STEPS.map((s, i) => {
        const isActive = i === idx;
        const isDone = i < idx;
        return (
          <li
            key={s.key}
            aria-current={isActive ? "step" : undefined}
            className="flex flex-1 flex-col items-center text-xs"
          >
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-medium",
                isActive && "border-primary bg-primary text-primary-foreground",
                isDone && "border-primary/40 bg-primary/10 text-primary",
                !isActive && !isDone && "border-muted-foreground/20 text-muted-foreground",
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                "mt-1 truncate",
                isActive ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
