import type { Metadata } from "next";
import { OrcamentoClient } from "./_OrcamentoClient";

export const metadata: Metadata = {
  title: "Orçamento Instantâneo — GLTech3D",
  description:
    "Envie seu arquivo STL ou 3MF e receba uma estimativa de custo de impressão 3D em tempo real. Materiais PLA, PETG e ABS com acabamento premium.",
  robots: { index: true, follow: true },
};

export default function OrcamentoPage() {
  return <OrcamentoClient />;
}
