import type { Metadata } from "next";
import { TecnologiasClient } from "./_TecnologiasClient";

export const metadata: Metadata = {
  // Raw title: the (marketing) layout template appends "| GLTech3D".
  title: "Tipos de Filamento 3D: Tabela Comparativa",
  description:
    "Tabela comparativa de materiais de impressão 3D (PLA, PETG, ABS, TPU): resistência mecânica, resistência térmica, acabamento e uso recomendado. Tolerância dimensional de ±0.1mm.",
  robots: { index: true, follow: true },
};

export default function TecnologiasPage() {
  return <TecnologiasClient />;
}
