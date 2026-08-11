"use client";

/**
 * Banner de consentimento + carregamento condicional de GA4 e Meta Pixel.
 *
 * Os dois scripts entram no DOM **somente depois do aceite** — não é o padrão
 * "carrega e depois desliga", que já teria gravado o cookie antes de perguntar.
 * Enquanto a escolha não existe, nada de terceiro é carregado.
 *
 * Vercel Analytics não passa por aqui: não usa cookie, mede sempre, e é o que
 * garante número mesmo com quem recusar.
 *
 * IDs vêm de `NEXT_PUBLIC_GA_ID` e `NEXT_PUBLIC_META_PIXEL_ID`. Ausentes, o
 * bloco simplesmente não é renderizado — dá para publicar o banner antes de ter
 * as contas, sem script quebrado no ar.
 */

import { useEffect, useState } from "react";
import Script from "next/script";

import { CONSENT_EVENT, readConsent, writeConsent, type ConsentState } from "@/lib/analytics/consent";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

export function ConsentBanner() {
  // Começa em `unset` no servidor e no primeiro paint do cliente: ler
  // `localStorage` durante o render causaria divergência de hidratação — o
  // erro #418/#419 que a auditoria viu no console do CRM.
  const [consent, setConsent] = useState<ConsentState>("unset");
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setMontado(true);

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ConsentState>).detail;
      if (detail) setConsent(detail);
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  const decidir = (state: "granted" | "denied") => {
    writeConsent(state);
    setConsent(state);
  };

  const carregarTerceiros = montado && consent === "granted";

  return (
    <>
      {carregarTerceiros && GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
              gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`}
          </Script>
        </>
      )}

      {carregarTerceiros && PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
            (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init','${PIXEL_ID}');fbq('track','PageView');`}
        </Script>
      )}

      {montado && consent === "unset" && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Preferências de cookies"
          className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-2xl rounded-2xl border border-[#E8E2D9] bg-white/95 p-4 shadow-xl backdrop-blur-md sm:inset-x-auto sm:right-4 sm:bottom-4 sm:p-5"
        >
          <p className="text-sm leading-snug text-[#3F342C]">
            Usamos cookies de medição para entender o que funciona no site. Você pode recusar —
            continuamos contando visitas de forma anônima, sem cookie.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => decidir("granted")}
              className="rounded-full bg-[#8E6D4D] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6F5439] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F5439]"
            >
              Aceitar
            </button>
            <button
              type="button"
              onClick={() => decidir("denied")}
              className="rounded-full border border-[#C8BEB2] px-4 py-2 text-sm font-semibold text-[#4F433A] transition hover:bg-[#F9F7F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F5439]"
            >
              Recusar
            </button>
            <a
              href="/privacidade"
              className="ml-auto text-xs font-medium text-[#6F5439] underline underline-offset-2"
            >
              Política de privacidade
            </a>
          </div>
        </div>
      )}
    </>
  );
}

export default ConsentBanner;
