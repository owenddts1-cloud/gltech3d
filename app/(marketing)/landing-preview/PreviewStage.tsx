'use client';

import { useEffect, useState } from 'react';
import HomeClient from '@/app/(marketing)/_components/HomeClient';
import type { LandingCatalog } from '@/lib/landing/types';

/** Contrato do postMessage entre o editor (pai) e este iframe. */
export const PREVIEW_MESSAGE_TYPE = 'gltech3d:landing-preview';

interface PreviewMessage {
  type: typeof PREVIEW_MESSAGE_TYPE;
  catalog: LandingCatalog;
}

function isPreviewMessage(data: unknown): data is PreviewMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === PREVIEW_MESSAGE_TYPE &&
    typeof (data as { catalog?: unknown }).catalog === 'object'
  );
}

/**
 * Renderiza a landing INTEIRA — o mesmo `HomeClient` que serve o visitante —
 * com os dados de rascunho que o editor manda.
 *
 * Antes isto montava só Categories + ProductGrid, e o preview mentia por
 * omissão: você editava o texto do Hero e não via nada mudar. Reusar o
 * HomeClient garante que preview e site não divirjam.
 */
export default function PreviewStage({ published }: { published: LandingCatalog }) {
  const [catalog, setCatalog] = useState<LandingCatalog>(published);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Só aceita mensagem da própria origem: o pai é o editor no mesmo host.
      if (event.origin !== window.location.origin) return;
      if (!isPreviewMessage(event.data)) return;
      setCatalog(event.data.catalog);
    }
    window.addEventListener('message', onMessage);
    // Avisa o pai que o iframe montou e já pode receber o rascunho.
    window.parent?.postMessage({ type: `${PREVIEW_MESSAGE_TYPE}:ready` }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return <HomeClient catalog={catalog} />;
}
