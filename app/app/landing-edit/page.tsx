import { fetchLandingEditData } from "@/app/actions/landing/actions";
import LandingEditClient from "./_components/LandingEditClient";

export const metadata = { title: "Landing Edit" };
export const dynamic = "force-dynamic";

export default async function LandingEditPage() {
  const r = await fetchLandingEditData();

  if (!r.ok) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Landing Edit</h1>
        <p className="mt-2 text-sm text-error">{r.error}</p>
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
      filaments={r.filaments}
      printers={r.printers}
      kEnergy={r.kEnergy}
    />
  );
}
