import type { Metadata } from 'next';
import { getLandingCatalog } from '@/lib/landing/repository';
import PreviewStage from './PreviewStage';

/**
 * Alvo do iframe do Live Preview (/app/landing-edit).
 *
 * Fica sob (marketing) de propósito: herda o layout com `.marketing-root`, as
 * fontes e o CSS da landing, então o preview renderiza pixel a pixel como o site
 * de verdade. Um iframe (e não um container escalado) porque media query lê o
 * viewport, não a largura do elemento — num container de 390px o Tailwind ainda
 * aplicaria `lg:`, e o "modo mobile" seria mentira.
 *
 * Exige sessão: não está em `PUBLIC_PATHS` (lib/auth/public-paths.ts), então o
 * middleware barra anônimo. É o que queremos — é uma tela interna. O iframe roda
 * na mesma origem e leva o cookie da sessão do CRM, então carrega normalmente.
 */
export const metadata: Metadata = {
  title: 'Preview da Landing',
  robots: { index: false, follow: false },
};

export default async function LandingPreviewPage() {
  const catalog = await getLandingCatalog();
  return <PreviewStage published={catalog} />;
}
