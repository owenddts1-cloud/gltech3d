import type { MetadataRoute } from "next";

/**
 * Manifest do PWA.
 *
 * ANTES: `/manifest.json` respondia **307** (redirecionamento para o login),
 * porque não havia manifest nenhum e o middleware tratava a rota como página
 * protegida. Navegador que pede o manifest recebia uma tela de login em HTML, e
 * a instalação como app simplesmente não acontecia.
 *
 * O Next serve isto em `/manifest.webmanifest` — o caminho está liberado em
 * `lib/auth/public-paths.ts`, senão o middleware repetiria o mesmo 307.
 *
 * Só a landing é instalável: `start_url` aponta para a raiz pública, não para
 * `/app`. Instalar o CRM como app exigiria tratar sessão fora do navegador, que
 * é outro problema.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GLTech3D — Impressão 3D e Peças Sob Demanda",
    short_name: "GLTech3D",
    description:
      "Manufatura aditiva, prototipagem técnica e produtos exclusivos em impressão 3D de alta qualidade.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "pt-BR",
    dir: "ltr",
    // Mesma cor do tema claro em `app/layout.tsx`, para a barra do sistema não
    // brigar com o fundo da página no primeiro paint.
    background_color: "#faf9f6",
    theme_color: "#2D241E",
    categories: ["shopping", "business"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
