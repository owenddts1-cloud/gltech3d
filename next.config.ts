import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

/** Performance budget (EPIC-12 §S-12.05):
 *  - LCP < 2.5s p75
 *  - CLS < 0.1 p75
 *  - INP < 200ms p75
 *  - Initial bundle /app/inbox < 250KB gzipped
 */
const nextConfig: NextConfig = {
  // Self-host (HostGator): gera .next/standalone pro container Docker (node server.js).
  // Aditivo — não afeta o deploy Vercel.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Hide the on-screen dev indicator ("N" badge / build activity) in dev.
  devIndicators: false,
  // typedRoutes moved out of experimental in Next 15.5+
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react", "lucide-react", "date-fns"],
  },
  images: {
    // O app não usa next/image de fato (só <img> raw); desligar o otimizador
    // evita exigir o binário `sharp` no runtime do container.
    unoptimized: true,
    remotePatterns: [
      // Supabase Storage (assinado)
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      {
        // Tudo menos o preview: clickjacking segue barrado por completo.
        source: "/((?!landing-preview).*)",
        headers: [...base, { key: "X-Frame-Options", value: "DENY" }],
      },
      {
        // O Live Preview do Landing Edit é um iframe MESMA ORIGEM. Com o DENY
        // global o browser recusa o frame e a tela mostra o ícone de bloqueio.
        // `frame-ancestors 'self'` libera só o nosso próprio host — nenhum site
        // de terceiros consegue embutir esta rota.
        source: "/landing-preview",
        headers: [
          ...base,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "automatik-labs",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
