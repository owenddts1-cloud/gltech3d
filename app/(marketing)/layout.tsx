import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GLTech3D — Do arquivo 3D para a realidade",
  description:
    "Produtos únicos de impressão 3D feitos sob demanda com acabamento premium. Feito no Brasil.",
  robots: { index: true, follow: true },
};

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${inter.variable} ${sora.variable} marketing-root min-h-screen`}>
      {children}
    </div>
  );
}
