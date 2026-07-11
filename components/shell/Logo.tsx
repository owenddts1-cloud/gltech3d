"use client";

import { useState } from "react";
import Link from "next/link";

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  const [imgError, setImgError] = useState(false);

  // Fallback check order: custom upload -> local default placeholder
  const logoSrc = imgError ? "/logo.png" : "/images/Logo/logo.jpg";

  if (collapsed) {
    return (
      <Link
        href="/app/dashboard"
        className="flex items-center justify-center h-9 w-9 rounded-xl overflow-hidden bg-accent/5 border border-border/80 hover:border-primary/50 hover:scale-105 active:scale-95 transition-all duration-200"
        title="GLTech CRM Dashboard"
      >
        {!imgError ? (
          <img
            src={logoSrc}
            alt="G"
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-sm font-black tracking-tighter bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            G
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      href="/app/dashboard"
      className="flex items-center gap-3 group select-none cursor-pointer"
    >
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-accent/5 border border-border/80 group-hover:border-primary/50 shadow-sm transition-all duration-300 group-hover:rotate-6 group-hover:scale-105">
        <img
          src={logoSrc}
          alt="GLTech Logo"
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-extrabold tracking-tight leading-none bg-gradient-to-r from-foreground via-primary to-accent-600 bg-[length:200%_auto] bg-clip-text text-transparent animate-text-gradient group-hover:via-accent group-hover:to-primary">
          GLTECH
        </span>
        <span className="text-[9px] font-bold tracking-wider text-muted-foreground/75 uppercase mt-0.5 group-hover:text-primary transition-colors duration-300">
          CRM SYSTEM
        </span>
      </div>
    </Link>
  );
}
