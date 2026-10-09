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
import { ConsentBanner } from "@/components/marketing/ConsentBanner";
import { Analytics } from "@vercel/analytics/next";
import { siteUrl } from "@/lib/marketing/site-url";
import { getStoreWhatsapp } from "@/lib/landing/whatsapp";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    // `absolute` e não `default`: com `default`, o Next aplica por cima o
    // template do layout RAIZ (`%s · GLTECH CRM`), e a home publicada saía como
    // "GLTech3D — Impressão 3D e Peças Sob Demanda · GLTECH CRM" — jargão de
    // sistema interno no título que o cliente e o Google veem.
    absolute: "GLTech3D — Impressão 3D e Peças Sob Demanda",
    template: "%s | GLTech3D",
  },
  description:
    "Manufatura aditiva, prototipagem técnica e produtos exclusivos em impressão 3D de alta qualidade com acabamento premium.",
  keywords: [
    "impressão 3d",
    "manufatura aditiva",
    "peças sob demanda",
    "filamentos 3d",
    "prototipagem 3d rápida",
    "impressão 3d brasil",
    "GLTech3D",
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: "GLTech3D — Impressão 3D e Peças Sob Demanda",
    description:
      "Produtos únicos de impressão 3D feitos sob demanda com acabamento premium. Entregamos em todo o Brasil.",
    url: siteUrl(),
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
import { CartProvider } from "@/components/marketing/cart/CartProvider";
import CartDrawer from "@/components/marketing/cart/CartDrawer";

export default async function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${inter.variable} ${sora.variable} marketing-root min-h-screen`}>
      <CustomCursor />
      {/* Filament cart: one provider for every marketing page, so it survives navigation. */}
      <CartProvider>
        {children}
        <CartDrawer />
      </CartProvider>
      <WhatsAppFloat phone={await getStoreWhatsapp()} />
      <ConsentBanner />
      {/* Sem cookie: mede mesmo para quem recusa os de terceiro. */}
      <Analytics />
    </div>
  );
}
