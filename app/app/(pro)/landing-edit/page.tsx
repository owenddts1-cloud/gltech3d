import { fetchLandingEditData } from "@/app/actions/landing/actions";
import { listFilaments } from "@/app/actions/filament-catalog/actions";
import LandingEditClient from "./_components/LandingEditClient";

export const metadata = { title: "Landing Edit" };
export const dynamic = "force-dynamic";

import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default async function LandingEditPage() {
  const [r, fil] = await Promise.all([fetchLandingEditData(), listFilaments()]);

  if (!r.ok) {
    const isForbidden = r.error.includes("403");
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold font-sora text-brand-espresso mb-2">
          {isForbidden ? "Acesso Restrito à Diretoria" : "Landing Edit"}
        </h1>
        <p className="max-w-md text-sm text-neutral-600 mb-6">
          {r.error}
        </p>
        <Link
          href="/app/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-espresso hover:bg-brand-espresso/90 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Dashboard
        </Link>
      </div>
    );
  }

  return (
    <LandingEditClient
      orgMismatch={r.orgMismatch}
      landingOrgSlug={r.landingOrgSlug}
      initialProducts={r.products}
      initialSettings={r.settings}
      initialCommissions={r.commissions}
      initialFilaments={fil.ok ? fil.filaments : []}
    />
  );
}
