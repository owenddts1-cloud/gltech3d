import type { Metadata } from 'next';
import { Calc3dProClient } from './_Calc3dProClient';
import { getPlatformSettings } from '@/lib/pricing/settings';
import { toPublicProPricing } from '@/lib/pricing/settings-schema';
import { getProPixCheckout } from '@/lib/pix/qr';
import { getStoreWhatsapp } from '@/lib/landing/whatsapp';
import { getFilamentCatalog } from '@/lib/landing/repository';
import { lowestPricePerKgCents } from '@/lib/storefront/filaments';
import { logger } from '@/lib/logger';

/**
 * Título CRU de propósito. O layout do grupo (marketing) já aplica
 * `template: "%s | GLTech3D"`; repetir a marca aqui, como fazem /orcamento e
 * /tecnologias, produz "… — GLTech3D | GLTech3D" na aba.
 */
export const metadata: Metadata = {
  title: 'Calc3D PRO — Calculadora de Preço para Impressão 3D',
  description:
    'Calculadora gratuita de custo e preço de impressão 3D: filamento, energia, desgaste da máquina, mão de obra, risco de falha e margem. No PRO, o CRM completo — venda, produção, estoque e marketplaces.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/calc3d-pro' },
};

/**
 * Prices, trial length, benefits and calculator defaults come from
 * platform_settings (editable by the platform admin); the Pix code and QR are
 * generated on the server with the live price. The client receives them as
 * props — it never reads the table. Cached by tag; the admin PATCH revalidates.
 */
/** "a partir de R$ X/kg" of the filament cross-sell; null hides the price (never blocks the page). */
async function filamentFromCents(): Promise<number | null> {
  try {
    return lowestPricePerKgCents(await getFilamentCatalog());
  } catch (err) {
    logger.warn('calc3d_filament_price_failed', { details: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

export default async function Calc3dProPage() {
  const [settings, pix, storeWhatsapp, filamentPerKg] = await Promise.all([
    getPlatformSettings(),
    getProPixCheckout(),
    getStoreWhatsapp(),
    filamentFromCents(),
  ]);
  return (
    <Calc3dProClient
      pricing={toPublicProPricing(settings)}
      calculatorDefaults={settings.calculatorDefaults}
      pix={pix}
      storeWhatsapp={storeWhatsapp}
      filamentFromCentsPerKg={filamentPerKg}
    />
  );
}
