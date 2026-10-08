import type { Metadata } from "next";
import { SignupClient } from "./_client";
import { getTrialDaysLive } from "@/lib/pricing/settings";

/** Trial length from platform_settings (editable by the platform admin). */
export async function generateMetadata(): Promise<Metadata> {
  const trialDays = await getTrialDaysLive();
  return {
    title: `Criar conta — ${trialDays} dias grátis no Calc3D PRO`,
    description: `Crie sua conta e use o Calc3D PRO por ${trialDays} dias, sem cartão: vendas, produção, estoque, dinheiro e marketplaces no mesmo lugar.`,
    robots: { index: true, follow: true },
    alternates: { canonical: "/criar-conta" },
  };
}

export default async function CriarContaPage() {
  return <SignupClient trialDays={await getTrialDaysLive()} />;
}
