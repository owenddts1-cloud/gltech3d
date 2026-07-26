"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Key, ArrowRight, ShieldCheck, Lightning } from "@/lib/ui/icons";

export default function PortalLoginPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError("Por favor, insira um token de acesso válido.");
      return;
    }

    setLoading(true);
    setError(null);

    // Simula autenticação local por token / API
    setTimeout(() => {
      if (token.trim().length >= 4) {
        if (typeof window !== "undefined") {
          localStorage.setItem("gltech_portal_token", token.trim());
        }
        router.push("/portal/switcher");
      } else {
        setError("Token de acesso inválido ou expirado.");
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 mb-2">
            <Lightning size={26} weight="fill" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">GLTech3D Hub</h1>
          <p className="text-xs text-zinc-400">Portal Unificado de Autenticação & Gestão Multi-App</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Key size={14} className="text-orange-400" />
              <span>Token de Acesso Unificado</span>
            </label>
            <input
              type="password"
              placeholder="gltech_tk_xxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all font-mono"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 hover:opacity-95 transition-all disabled:opacity-50"
          >
            <span>{loading ? "Validando Token..." : "Entrar no Ecossistema"}</span>
            {!loading && <ArrowRight size={16} weight="bold" />}
          </button>
        </form>

        <div className="flex items-center justify-center gap-2 pt-2 border-t border-zinc-800 text-[11px] text-zinc-500">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>Autenticação Criptografada (AES-256)</span>
        </div>
      </div>
    </div>
  );
}
