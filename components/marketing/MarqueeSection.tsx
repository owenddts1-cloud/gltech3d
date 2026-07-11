'use client';

import { useEffect, useRef, useState } from 'react';

const IMAGES = [
  "https://motionsites.ai/assets/hero-space-voyage-preview-eECLH3Yc.gif",
  "https://motionsites.ai/assets/hero-codenest-preview-Cgppc2qV.gif",
  "https://motionsites.ai/assets/hero-vex-ventures-preview-BczMFIiw.gif",
  "https://motionsites.ai/assets/hero-stellar-ai-v2-preview-DjvxjG3C.gif",
  "https://motionsites.ai/assets/hero-asme-preview-B_nGDnTP.gif",
  "https://motionsites.ai/assets/hero-transform-data-preview-Cx5OU29N.gif",
  "https://motionsites.ai/assets/hero-vitara-preview-Cjz2QYyU.gif",
  "https://motionsites.ai/assets/hero-terra-preview-BFjrCr7T.gif",
  "https://motionsites.ai/assets/hero-skyelite-preview-DHaZIgUv.gif",
  "https://motionsites.ai/assets/hero-aethera-preview-DknSlcTa.gif",
  "https://motionsites.ai/assets/hero-designpro-preview-D8c5_een.gif",
  "https://motionsites.ai/assets/hero-stellar-ai-preview-D3HL6bw1.gif",
  "https://motionsites.ai/assets/hero-xportfolio-preview-D4A8maiC.gif",
  "https://motionsites.ai/assets/hero-orbit-web3-preview-BXt4OttD.gif",
  "https://motionsites.ai/assets/hero-nexora-preview-cx5HmUgo.gif",
  "https://motionsites.ai/assets/hero-evr-ventures-preview-DZxeVFEX.gif",
  "https://motionsites.ai/assets/hero-planet-orbit-preview-DWAP8Z1P.gif",
  "https://motionsites.ai/assets/hero-new-era-preview-CocuDUm9.gif",
  "https://motionsites.ai/assets/hero-wealth-preview-B70idl_u.gif",
  "https://motionsites.ai/assets/hero-luminex-preview-CxOP7ce6.gif",
  "https://motionsites.ai/assets/hero-celestia-preview-0yO3jXO8.gif"
];

export default function MarqueeSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const top = sectionRef.current.offsetTop;
      const offset = (window.scrollY - top + window.innerHeight) * 0.3;
      setScrollOffset(offset);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const row1 = [...IMAGES.slice(0, 11), ...IMAGES.slice(0, 11), ...IMAGES.slice(0, 11)];
  const row2 = [...IMAGES.slice(11), ...IMAGES.slice(11), ...IMAGES.slice(11)];

  return (
    <section ref={sectionRef} className="bg-[#0C0C0C] pt-24 sm:pt-32 md:pt-40 pb-10 overflow-hidden flex flex-col gap-3 w-full">
      {/* Linha 1 -> Desloca para a Direita */}
      <div 
        className="flex gap-3 clean-marquee" 
        style={{ 
          transform: `translate3d(${scrollOffset - 200}px, 0px, 0px)`,
          willChange: 'transform'
        }}
      >
        {row1.map((src, idx) => (
          <img key={`r1-${idx}`} src={src} loading="lazy" className="w-[340px] h-[220px] md:w-[420px] md:h-[270px] rounded-3xl object-cover flex-shrink-0" alt="Work structural asset" />
        ))}
      </div>

      {/* Linha 2 -> Desloca para a Esquerda */}
      <div 
        className="flex gap-3 clean-marquee" 
        style={{ 
          transform: `translate3d(${-scrollOffset}px, 0px, 0px)`,
          willChange: 'transform'
        }}
      >
        {row2.map((src, idx) => (
          <img key={`r2-${idx}`} src={src} loading="lazy" className="w-[340px] h-[220px] md:w-[420px] md:h-[270px] rounded-3xl object-cover flex-shrink-0" alt="Work design preview" />
        ))}
      </div>
    </section>
  );
}
