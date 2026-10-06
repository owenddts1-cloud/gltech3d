import type { Metadata } from "next";
import { SignupClient } from "./_client";

export const metadata: Metadata = {
  title: "Criar conta — 7 dias grátis no Calc3D PRO",
  description:
    "Crie sua conta e use o Calc3D PRO por 7 dias, sem cartão: vendas, produção, estoque, dinheiro e marketplaces no mesmo lugar.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/criar-conta" },
};

export default function CriarContaPage() {
  return <SignupClient />;
}
