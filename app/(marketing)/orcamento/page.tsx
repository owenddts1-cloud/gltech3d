import type { Metadata } from "next";
import { OrcamentoClient } from "./_OrcamentoClient";
import { getStoreWhatsapp } from "@/lib/landing/whatsapp";

export const metadata: Metadata = {
  // Raw title: the (marketing) layout template appends "| GLTech3D".
  title: "Orçamento de Impressão 3D Online pelo STL",
  description:
    "Envie seu arquivo STL ou 3MF e receba uma estimativa de custo de impressão 3D em tempo real. Materiais PLA, PETG e ABS com acabamento premium.",
  robots: { index: true, follow: true },
};

export default async function OrcamentoPage() {
  return <OrcamentoClient storeWhatsapp={await getStoreWhatsapp()} />;
}
