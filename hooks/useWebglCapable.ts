"use client";
import { useEffect, useState } from "react";

/**
 * Este aparelho merece a cena WebGL?
 *
 * POR QUE ISTO EXISTE, e por que `next/dynamic` sozinho não bastava: `dynamic`
 * com `ssr: false` tira o `three` do bundle inicial, mas **baixa o chunk mesmo
 * assim** assim que o componente monta. Num celular isso são ~150 KB gastos para
 * renderizar uma cena que o aparelho vai engasgar. Montar o componente pesado só
 * depois deste gate é o que de fato protege o orçamento de peso.
 *
 * Roda num efeito, nunca no render: `matchMedia` e `navigator` não existem no
 * servidor, e lê-los durante o render faria o HTML do servidor discordar da
 * primeira pintura do cliente.
 *
 * Começa em `false` de propósito — o fallback estático aparece primeiro e só é
 * substituído se o aparelho passar. O contrário causaria um flash da cena
 * pesada em quem pediu menos movimento.
 */
export function useWebglCapable(): boolean {
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    // Quem pediu menos movimento recebe menos movimento, não "movimento suave".
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Toque = celular/tablet na prática. O custo térmico e de bateria de um loop
    // WebGL contínuo não se paga numa landing.
    if (window.matchMedia("(pointer: coarse)").matches) return;

    // Heurística grosseira de CPU, mas é a única disponível sem medir frames.
    const cores = navigator.hardwareConcurrency;
    if (typeof cores === "number" && cores <= 4) return;

    // Último teste: o contexto existe mesmo? (WebGL desabilitado, driver na
    // blocklist, navegador antigo.)
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      if (!gl) return;
      // Libera o contexto de teste na hora: o navegador limita quantos existem
      // ao mesmo tempo, e vazar este deixaria um a menos para a cena real.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      return;
    }

    setCapable(true);
  }, []);

  return capable;
}
