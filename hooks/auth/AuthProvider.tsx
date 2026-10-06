"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/browser";
import type { AuthUser, ActiveOrg } from "@/lib/auth/types";
import { roleCan } from "@/lib/auth/permissions";
import type { PlanState } from "@/lib/plan/types";

interface AuthCtx {
  user: AuthUser;
  activeOrg: ActiveOrg | null;
  /**
   * Plano da org ativa, resolvido no servidor por `loadAppShellContext()`.
   *
   * `null` significa "nao resolvido" (sem org, ou falha de leitura) e a UI trata
   * isso como NAO DECORAR: sem selo, sem cadeado. E fail-open COSMETICO, e de
   * proposito — o cliente nunca e a autoridade. Quem decide acesso de verdade e
   * `requirePro()` no servidor, que trata `null` como sem acesso.
   */
  plan: PlanState | null;
  isAuthenticated: true;
  refreshing: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({
  user,
  activeOrg,
  plan = null,
  children,
}: {
  user: AuthUser;
  activeOrg: ActiveOrg | null;
  plan?: PlanState | null;
  children: ReactNode;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const supabaseRef = useRef(createClient());

  // Refresh session every 40 minutes (JWT default 1h, with margin).
  useEffect(() => {
    const interval = setInterval(
      async () => {
        setRefreshing(true);
        try {
          await supabaseRef.current.auth.refreshSession();
        } finally {
          setRefreshing(false);
        }
      },
      40 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      activeOrg,
      plan,
      isAuthenticated: true,
      refreshing,
      signOut: async () => {
        const { signOut } = await import("@/app/actions/auth/signOut");
        await signOut();
      },
    }),
    [user, activeOrg, plan, refreshing],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function useUser(): AuthUser {
  return useAuth().user;
}

export function useActiveOrg(): ActiveOrg | null {
  return useAuth().activeOrg;
}

/**
 * Like `useActiveOrg`, but returns null instead of throwing outside an
 * <AuthProvider> — for shared hooks (realtime) that may also render in
 * surfaces without a tenant context.
 */
export function useOptionalActiveOrg(): ActiveOrg | null {
  return useContext(Ctx)?.activeOrg ?? null;
}

/**
 * Plano da org ativa. `null` = nao resolvido: a UI nao decora (sem selo, sem
 * cadeado) em vez de chutar. Ver o comentario em `AuthCtx.plan`.
 */
export function usePlan(): PlanState | null {
  return useAuth().plan;
}

/**
 * Permission gate based on role rank. The action -> role map lives in
 * `lib/auth/permissions.ts` (pure, testable); unknown actions are denied.
 */
export function usePermission(action: string): boolean {
  const { user, activeOrg } = useAuth();
  return roleCan(activeOrg?.role, action, { isPlatformAdmin: user.is_platform_admin });
}
