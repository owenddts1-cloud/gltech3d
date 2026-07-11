'use client';

import { useEffect, useRef, useState } from 'react';

const MEUS_PRODUTOS = [
  { nome: "Charizard Articulável", cat: "Action Figure", img: "https://images.unsplash.com/photo-1608889174637-3c44f6326f2a?w=500&auto=format&fit=crop&q=60" },
  { nome: "Batman Gotham Night", cat: "Action Figure", img: "https://images.unsplash.com/photo-1531259683007-016a7b628fc3?w=500&auto=format&fit=crop&q=60" },
  { nome: "Luminária Lua Cheia", cat: "Luminárias", img: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&auto=format&fit=crop&q=60" },
  { nome: "Base Apple Watch", cat: "Protótipos", img: "https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=500&auto=format&fit=crop&q=60" },
  { nome: "Banguela Fúria da Noite", cat: "Chaveiros", img: "https://images.unsplash.com/photo-1560169897-fc0cdbdfa4d5?w=500&auto=format&fit=crop&q=60" },
  { nome: "Kit Vasos Modernos", cat: "Decoração", img: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=500&auto=format&fit=crop&q=60" },
  { nome: "Chibi Naruto", cat: "Anime", img: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=60" }
];

export default function MarqueeSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const top = sectionRef.current.offsetTop;
      const offset = (window.scrollY - top + window.innerHeight) * 0.25;
      setScrollOffset(offset);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const linha1 = [...MEUS_PRODUTOS, ...MEUS_PRODUTOS, ...MEUS_PRODUTOS];
  const linha2 = [...MEUS_PRODUTOS].reverse().concat([...MEUS_PRODUTOS].reverse());

  return (
    <section id="portfolio-marquee" ref={sectionRef} className="bg-[#F4F1EB] py-16 overflow-hidden flex flex-col gap-6 w-full border-t border-gray-200/50">
      
      {/* Linha 1 -> Avança para a direita baseado no scroll */}
      <div 
        className="flex gap-4" 
        style={{ transform: `translate3d(${scrollOffset - 200}px, 0px, 0px)`, willChange: 'transform' }}
      >
        {linha1.map((prod, idx) => (
          <div key={`l1-${idx}`} className="w-[280px] h-[340px] bg-white rounded-3xl p-3 flex flex-col justify-between border border-gray-200/60 shadow-sm flex-shrink-0">
            <div className="w-full h-[70%] bg-gray-50 rounded-2xl overflow-hidden relative">
              <div className="absolute top-2 left-2 bg-[#A88060] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">{prod.cat}</div>
              <div className="w-full h-full flex items-center justify-center font-bold text-gray-300 text-sm bg-stone-200">Foto do Produto</div>
            </div>
            <div className="p-2">
              <h4 className="text-sm font-bold uppercase tracking-tight text-gray-800">{prod.nome}</h4>
              <span className="text-xs text-[#A88060] font-medium">Coleção GLTech3D</span>
            </div>
          </div>
        ))}
      </div>

      {/* Linha 2 -> Recua para a esquerda baseado no scroll */}
      <div 
        className="flex gap-4" 
        style={{ transform: `translate3d(${-scrollOffset}px, 0px, 0px)`, willChange: 'transform' }}
      >
        {linha2.map((prod, idx) => (
          <div key={`l2-${idx}`} className="w-[280px] h-[340px] bg-white rounded-3xl p-3 flex flex-col justify-between border border-gray-200/60 shadow-sm flex-shrink-0">
            <div className="w-full h-[70%] bg-gray-50 rounded-2xl overflow-hidden relative">
              <div className="absolute top-2 left-2 bg-[#2D2A26] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">{prod.cat}</div>
              <div className="w-full h-full flex items-center justify-center font-bold text-gray-300 text-sm bg-stone-200">Foto do Produto</div>
            </div>
            <div className="p-2">
              <h4 className="text-sm font-bold uppercase tracking-tight text-gray-800">{prod.nome}</h4>
              <span className="text-xs text-gray-500 font-medium">Alta Resolução 3D</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
