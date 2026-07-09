"use client";

import { useTheme, type Theme } from "@/lib/theme";
import { paletteMeta } from "@/lib/theme-vars";
import { Sun, Moon, MonitorPlay } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const MODES: { id: Theme; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Claro", Icon: Sun },
  { id: "dark", label: "Escuro", Icon: Moon },
  { id: "system", label: "Sistema", Icon: MonitorPlay },
];

/** Seletor de tema (claro/escuro/sistema) + paleta de cores (5 opções). */
export function PaletteSwitcher() {
  const { theme, setTheme, palette, setPalette } = useTheme();
  const palettes = paletteMeta();

  return (
    <div className="px-2 py-1.5">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Aparência</p>
      <div className="mb-3 grid grid-cols-3 gap-1">
        {MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            aria-pressed={theme === id}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] transition-colors",
              theme === id
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent/5 hover:text-foreground",
            )}
          >
            <Icon size={15} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Cor</p>
      <div className="flex flex-wrap gap-2">
        {palettes.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPalette(p.id)}
            title={`${p.name} — ${p.description}`}
            aria-label={`Paleta ${p.name}`}
            aria-pressed={palette === p.id}
            className={cn(
              "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
              palette === p.id ? "border-foreground scale-110" : "border-border",
            )}
            style={{ backgroundColor: p.swatch }}
          />
        ))}
      </div>
    </div>
  );
}
