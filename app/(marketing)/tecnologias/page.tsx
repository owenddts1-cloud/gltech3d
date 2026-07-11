import type { Metadata } from "next";
import { TecnologiasClient } from "./_TecnologiasClient";

export const metadata: Metadata = {
  title: "Materiais & Hardware — GLTech3D",
  description:
    "Tabela comparativa de materiais de impressão 3D (PLA, PETG, ABS, TPU): resistência mecânica, resistência térmica, acabamento e uso recomendado. Tolerância dimensional de ±0.1mm.",
  robots: { index: true, follow: true },
};

export default function TecnologiasPage() {
  return <TecnologiasClient />;
}
