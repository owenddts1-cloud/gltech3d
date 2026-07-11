"use client";

import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { MagnifyingGlass } from "@/lib/ui/icons";
import { motion } from "motion/react";

export function SearchTrigger() {
  const [isFocused, setIsFocused] = useState(false);

  useHotkeys("mod+k", () => {
    const el = document.getElementById("header-search-input");
    if (el) el.focus();
  }, { preventDefault: true });

  return (
    <motion.div 
      initial={false}
      animate={{ 
        width: isFocused ? "380px" : "280px",
        borderColor: isFocused ? "var(--color-accent)" : "var(--color-border)",
        boxShadow: isFocused 
          ? "0 0 14px 3px rgba(103, 136, 93, 0.16), 0 2px 4px rgba(0,0,0,0.02)" 
          : "0 1px 2px 0 rgba(0, 0, 0, 0.03)"
      }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      className="relative flex items-center h-9 rounded-full border bg-surface/70 hover:bg-surface px-3 gap-2 overflow-hidden cursor-text transition-colors duration-200"
      onClick={() => {
        const el = document.getElementById("header-search-input");
        if (el) el.focus();
      }}
    >
      <MagnifyingGlass 
        size={15} 
        className={isFocused ? "text-primary" : "text-muted-foreground"} 
      />
      <input
        id="header-search-input"
        type="text"
        placeholder="Buscar..."
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/70"
      />
      <kbd className="absolute right-3 hidden md:flex items-center gap-0.5 rounded border border-border/80 bg-muted px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground select-none pointer-events-none">
        <span>⌘</span>K
      </kbd>
    </motion.div>
  );
}
