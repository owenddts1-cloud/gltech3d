'use client';

import { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LandingCatalog } from '@/lib/landing/types';

const PREVIEW_MESSAGE_TYPE = 'gltech3d:landing-preview';
const DEVICES = {
  desktop: { label: 'Desktop', width: '100%', icon: Monitor },
  mobile: { label: 'Mobile', width: '390px', icon: Smartphone },
} as const;

type Device = keyof typeof DEVICES;

/**
 * Live Preview via iframe + postMessage.
 *
 * Iframe (e não um container escalado) porque media query responde ao viewport,
 * não à largura do elemento: dentro de uma <div> de 390px o Tailwind seguiria
 * aplicando `lg:` e o modo mobile seria falso. O iframe tem viewport próprio, e
 * o toggle é largura real — o que se vê é o que o cliente vê.
 */
export default function LivePreview({ catalog }: { catalog: LandingCatalog }) {
  const [device, setDevice] = useState<Device>('desktop');
  const [ready, setReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // O iframe avisa quando montou; antes disso o postMessage cairia no vazio.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string })?.type === `${PREVIEW_MESSAGE_TYPE}:ready`) {
        setReady(true);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Empurra o rascunho a cada mudança — é o "sem reload" do requisito.
  useEffect(() => {
    if (!ready) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: PREVIEW_MESSAGE_TYPE, catalog },
      window.location.origin,
    );
  }, [catalog, ready]);

  function reload() {
    setReady(false);
    if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
          {(Object.keys(DEVICES) as Device[]).map((key) => {
            const { label, icon: Icon } = DEVICES[key];
            const active = device === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDevice(key)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-surface text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <span className="mr-1 text-[11px] text-muted-foreground">
            {ready ? 'Preview ao vivo' : 'Carregando…'}
          </span>
          <Button variant="ghost" size="sm" onClick={reload} aria-label="Recarregar preview">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="/" target="_blank" rel="noreferrer" aria-label="Abrir a landing publicada">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 justify-center overflow-hidden bg-muted/40 p-4">
        <div
          className="h-full overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-[width] duration-300 ease-out"
          style={{ width: DEVICES[device].width, maxWidth: '100%' }}
        >
          <iframe
            ref={iframeRef}
            src="/landing-preview"
            title="Preview da landing"
            className="h-full w-full"
            // Mesma origem (precisa, pro postMessage), sem permitir navegação top-level.
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      </div>
    </div>
  );
}
