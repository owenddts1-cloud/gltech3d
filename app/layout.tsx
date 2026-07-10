import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/lib/theme";
import { Providers } from "./providers";
import { PublicEnvScript } from "./public-env-script";
import { allPaletteVars, DEFAULT_PALETTE } from "@/lib/theme-vars";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-atkinson",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "GLTECH CRM — Super App 3D",
    template: "%s · GLTECH CRM",
  },
  description:
    "O super app da GLTech3D: fazenda de impressão, projetos, produtos, ordens de serviço, vendas multicanal, atendimento e IA — tudo num só painel. Multi-tenant, LGPD-nativo.",
  applicationName: "GLTECH CRM",
  authors: [{ name: "GLTech3D" }],
  keywords: [
    "impressão 3D",
    "print farm",
    "CRM",
    "ERP",
    "e-commerce",
    "marketplace",
    "IA",
    "LGPD",
  ],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#161510" },
  ],
};

// Inline FOUC-prevention. Conteúdo derivado de constantes estáticas (zero input
// do usuário), portanto seguro. Lê localStorage + prefers-color-scheme e aplica
// tema (light/dark) E paleta (CSS vars) ANTES do primeiro paint — sem flash de cor.
const PALETTE_MAP_JSON = JSON.stringify(allPaletteVars());
const THEME_INIT_SCRIPT = `(function(){try{
var s=localStorage.getItem('deskcomm-theme');
var d=window.matchMedia('(prefers-color-scheme: dark)').matches;
var r=(s==='dark'||s==='light')?s:((s==='system'||!s)&&d?'dark':'light');
document.documentElement.setAttribute('data-theme',r);
var p=localStorage.getItem('gltech-palette')||'${DEFAULT_PALETTE}';
var M=${PALETTE_MAP_JSON};
var v=(M[p]&&M[p][r])||M['${DEFAULT_PALETTE}'][r];
if(v){var st=document.documentElement.style;for(var k in v){st.setProperty(k,v[k]);}}
document.documentElement.setAttribute('data-palette',p);
}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      data-theme="light"
      suppressHydrationWarning
      className={`${atkinson.variable} ${plexMono.variable}`}
    >
      <head>
        {/* Config pública do Supabase em runtime (imagem genérica self-host). */}
        <PublicEnvScript />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-bg font-sans text-text antialiased">
        <Providers>
          <ThemeProvider>{children}</ThemeProvider>
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={4000}
          />
        </Providers>
      </body>
    </html>
  );
}
