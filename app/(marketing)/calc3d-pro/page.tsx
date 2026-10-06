import type { Metadata } from 'next';
import { Calc3dProClient } from './_Calc3dProClient';

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

export default function Calc3dProPage() {
  return <Calc3dProClient />;
}
