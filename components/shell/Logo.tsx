"use client";

import { useState } from "react";
import Link from "next/link";

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  const [imgError, setImgError] = useState(false);

  // Fallback check order: custom upload -> local default placeholder
  const logoSrc = imgError ? "/logo.png" : "/images/Logo/logo.jpg";

  // O Logo vive na sidebar (escura nos DOIS temas): cores SÓLIDAS dos tokens
  // sidebar-* — nunca tokens da página (foreground/primary), que no tema claro
  // são escuros e somem sobre o fundo grafite.
  if (collapsed) {
    return (
      <Link
        href="/app/dashboard"
        className="flex items-center justify-center h-9 w-9 rounded-xl overflow-hidden bg-sidebar-elevated border border-sidebar-border hover:border-sidebar-accent/60 hover:scale-105 active:scale-95 transition-all duration-200"
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
          <span className="text-sm font-black tracking-tighter text-sidebar-accent">G</span>
        )}
      </Link>
    );
  }

  return (
    <Link
      href="/app/dashboard"
      className="flex items-center gap-3 group select-none cursor-pointer"
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-sidebar-elevated border border-sidebar-border group-hover:border-sidebar-accent/60 shadow-sm transition-all duration-300 group-hover:scale-105">
        <img
          src={logoSrc}
          alt="GLTech Logo"
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
      <div className="flex flex-col">
        <span className="text-base font-extrabold tracking-tight leading-none text-sidebar-accent">
          GLTECH
        </span>
        <span className="text-[10px] font-bold tracking-[0.18em] text-sidebar-text uppercase mt-1 group-hover:text-sidebar-text-active transition-colors duration-300">
          CRM SYSTEM
        </span>
      </div>
    </Link>
  );
}
