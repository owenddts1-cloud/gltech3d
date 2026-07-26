"use client";

import Link from "next/link";
import { APPS } from "@/lib/apps/registry";
import { ArrowRight, PlugsConnected, Sparkle } from "@/lib/ui/icons";

export default function AppSwitcherDashboard() {
  return (
    <div className="min-h-screen w-full bg-zinc-950 text-white flex flex-col justify-between p-6 md:p-12">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800/80 pb-6 max-w-6xl mx-auto w-full">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span className="bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent">
              GLTech3D
            </span>
            <span>Hub</span>
          </h1>
          <p className="text-xs text-zinc-400">Selecione uma aplicação interconectada para iniciar</p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full text-zinc-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Sessão Ativa</span>
        </div>
      </header>

      {/* Grid de 3 Apps */}
      <main className="max-w-6xl mx-auto w-full my-auto py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {APPS.map((app) => {
            const Icon = app.icon;
            return (
              <Link
                key={app.id}
                href={app.href}
                className="group relative flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition-all duration-300 hover:border-orange-500/50 hover:bg-zinc-900 hover:shadow-2xl hover:shadow-orange-500/10 hover:-translate-y-1"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 group-hover:bg-orange-500 group-hover:text-zinc-950 transition-colors">
                      <Icon size={24} weight="duotone" />
                    </div>
                    <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                      {app.status}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">
                      {app.label}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      {app.description}
                    </p>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-zinc-800/80 flex items-center justify-between text-xs font-semibold text-zinc-300 group-hover:text-orange-400">
                  <span>Acessar Workspace</span>
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full border-t border-zinc-800/80 pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
        <div className="flex items-center gap-2">
          <PlugsConnected size={16} className="text-orange-500" />
          <span>Cross-App Data Mesh Sincronizado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkle size={14} className="text-amber-400" />
          <span>GLTech3D Ecosystem v2.5 Modular</span>
        </div>
      </footer>
    </div>
  );
}
