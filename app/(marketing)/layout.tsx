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

import WhatsAppFloat from "@/components/marketing/WhatsAppFloat";

export const metadata: Metadata = {
  title: {
    default: "GLTech3D — Impressão 3D e Peças Sob Demanda",
    template: "%s | GLTech3D",
  },
  description:
    "Manufatura aditiva, prototipagem técnica e produtos exclusivos em impressão 3D de alta qualidade com acabamento premium.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "GLTech3D — Impressão 3D e Peças Sob Demanda",
    description:
      "Produtos únicos de impressão 3D feitos sob demanda com acabamento premium. Entregamos em todo o Brasil.",
    url: "https://gltech3d.com.br",
    siteName: "GLTech3D",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "GLTech3D — Impressão 3D de Alta Qualidade",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GLTech3D — Impressão 3D e Peças Sob Demanda",
    description: "Manufatura aditiva e produtos exclusivos em impressão 3D de alta qualidade.",
    images: ["/og-image.jpg"],
  },
};

import { CustomCursor } from "@/components/marketing/CustomCursor";

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${inter.variable} ${sora.variable} marketing-root min-h-screen`}>
      <CustomCursor />
      {children}
      <WhatsAppFloat />
    </div>
  );
}
