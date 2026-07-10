# Diretrizes Elite para Criação de Sistemas, Landing Pages e Animações Premium
### Guia de Instruções para Modelos de IA Subsequentes (Orçamento & Alta Conversão)

Este documento atua como um blueprint de engenharia para orientar modelos de linguagem menores (ex: Claude Haiku, GPT-4o-mini) a criar interfaces, sites, CRM, ERP, jogos ou sistemas de nível agência ($10k–$50k USD). Siga estas instruções estritamente para obter máxima performance e estética premium.

---

## 🎨 1. Diretrizes de Estética e Design Visual (Studio Aesthetics)

Para garantir que o design impressione o cliente à primeira vista, siga estes princípios fundamentais:

*   **Evite Cores Primárias Puras:** Nunca utilize `bg-red-500`, `bg-blue-600` ou `bg-green-500` brutos. Prefira paletas curadas de tons HSL ou escalas de cinzas de estúdio (ex: grafite `#2b2622`, cinza estúdio `#ececec`, bronze `#a6815c` ou `#8e6d4d`).
*   **Fontes Premium:** Evite fontes padrão do navegador. Sempre inicialize fontes modernas via Google Fonts ou Next.js Font (ex: **Sora** para títulos técnicos/modernos, **Inter** ou **Atkinson Hyperlegible** para leitura de alta densidade).
*   **Bento Grids & Layouts de Engenharia:** Use estruturas de grid irregulares (Bento Grids). Defina bordas muito arredondadas (`rounded-[2rem]` ou `rounded-[2.5rem]`).
*   **Glassmorphism e Glows:** Use fundos translúcidos com desfoque de fundo (`backdrop-blur-md bg-white/40 border border-white/20`) e efeitos de sombra flutuante (`shadow-[0_8px_30px_rgb(0,0,0,0.04)]`).
*   **Padrões Técnicos Subjacentes:** Empregue grades de engenharia sutis (blueprint grids) nos backgrounds usando linhas finas em gradiente radial para focar a atenção do usuário no centro.

---

## 🚀 2. Otimização de Scroll Scrubbing (Vídeos no Scroll)

A reprodução de vídeo vinculada ao scroll (scrubbing) frequentemente trava em navegadores se os updates de frame forem executados a 60fps de forma síncrona. Isso ocorre porque o decodificador do navegador entra em conflito.

### Template de Código Resiliente (Seek-Throttling no React):

Sempre use este padrão para gerenciar a propriedade `video.currentTime` durante o scroll:

```typescript
import { useEffect, useRef, useState } from 'react';

export function ScrollVideoScrub() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section) return;

    let raf = 0;
    let target = 0;
    let current = 0;
    let duration = 0;
    let pendingTime: number | null = null;
    const LERP = 0.08; // Interpolação suave

    // Aguarda metadados para saber a duração real
    const onMeta = () => {
      duration = video.duration || 0;
    };
    if (video.readyState >= 1) onMeta();
    video.addEventListener('loadedmetadata', onMeta);

    // ESCUDO DE DECODIFICAÇÃO: Executa o próximo seek APENAS após o anterior terminar
    const onSeeked = () => {
      if (pendingTime !== null && video.readyState >= 2) {
        video.currentTime = pendingTime;
        pendingTime = null;
      }
    };
    video.addEventListener('seeked', onSeeked);

    const tick = () => {
      const rect = section.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      target = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;

      // LERP para inércia
      current += (target - current) * LERP;
      if (Math.abs(target - current) < 0.0005) current = target;

      if (duration > 0 && video.readyState >= 2) {
        const t = current * (duration - 0.05);
        if (Math.abs(video.currentTime - t) > 0.001) {
          if (!video.seeking) {
            video.currentTime = t; // Seek livre
          } else {
            pendingTime = t; // Bufferiza enquanto busca o frame anterior
          }
        }
      }
      setProgress(current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('seeked', onSeeked);
    };
  }, []);

  return (
    <section ref={sectionRef} className="h-[400vh] relative">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <video ref={videoRef} src="/path-to-video.mp4" muted playsInline className="w-full h-full object-cover" />
      </div>
    </section>
  );
}
```

---

## 🎨 3. Cursor Customizado Springs (Framer Motion)

Cursores customizados dão o tom digital de agências de alta tecnologia. O cursor deve seguir o mouse de forma orgânica e se transformar de acordo com o elemento sobre o qual está pairando (hover states).

### Template de Cursor Reativo (Framer Motion):

```typescript
'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

export function CustomCursor() {
  const [cursorState, setCursorState] = useState<'default' | 'pointer' | 'view'>('default');
  const [text, setText] = useState('');
  const [visible, setVisible] = useState(false);
  const reducedMotion = useReducedMotion();

  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // Efeito elástico (Spring physics) para o anel seguidor
  const cX = useSpring(mouseX, { damping: 28, stiffness: 200, mass: 0.5 });
  const cY = useSpring(mouseY, { damping: 28, stiffness: 200, mass: 0.5 });

  useEffect(() => {
    // 1. Acessibilidade: Oculta em telas touch
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch || reducedMotion) return;

    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      if (!visible) setVisible(true);
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const trigger = target.closest('[data-cursor]');
      
      if (trigger) {
        setCursorState(trigger.getAttribute('data-cursor') as any || 'default');
        setText(trigger.getAttribute('data-cursor-text') || '');
      } else if (target.closest('a, button')) {
        setCursorState('pointer');
        setText('');
      } else {
        setCursorState('default');
        setText('');
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onMouseOver, { passive: true });
    document.addEventListener('mouseleave', () => setVisible(false));

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onMouseOver);
    };
  }, [mouseX, mouseY, visible, reducedMotion]);

  if (reducedMotion || !visible) return null;

  return (
    <>
      {/* Anel Externo Elástico */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999] rounded-full flex items-center justify-center text-[9px] font-bold text-white tracking-wider"
        style={{
          x: cX,
          y: cY,
          translateX: '-50%',
          translateY: '-50%',
          width: cursorState === 'view' ? 70 : cursorState === 'pointer' ? 44 : 20,
          height: cursorState === 'view' ? 70 : cursorState === 'pointer' ? 44 : 20,
          backgroundColor: cursorState === 'view' ? '#2b2622' : cursorState === 'pointer' ? 'white' : 'transparent',
          border: cursorState === 'default' ? '2px solid #a6815c' : 'none',
          mixBlendMode: cursorState === 'pointer' ? 'difference' : 'normal',
        }}
      >
        {cursorState === 'view' && <span>{text || 'VER'}</span>}
      </motion.div>

      {/* Ponto Fixo de Precisão */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[10000] w-1.5 h-1.5 bg-[#a6815c] rounded-full"
        style={{
          x: mouseX,
          y: mouseY,
          translateX: '-50%',
          translateY: '-50%',
          opacity: cursorState === 'default' ? 1 : 0,
        }}
      />
    </>
  );
}
```

---

## 🌀 4. Integração do Lenis (Smooth Scroll) no Next.js

Para coordenar animações de scroll de forma suave e cinematográfica, a inércia do scroll nativo precisa ser otimizada via biblioteca cliente (Lenis).

```typescript
'use client';

import { ReactNode, useEffect } from 'react';
import Lenis from 'lenis';

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Easing exponencial
      touchMultiplier: 2,
      infinite: false,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
```

---

## 🛡️ 5. Quality Checklist para Entregas Premium

Sempre valide estas 4 regras de ferro antes de concluir uma tarefa:
1.  **Sem Travamentos:** O scroll do vídeo não deve stuttering sob movimentos bruscos de mouse.
2.  **Redução de Movimento:** Se o sistema operacional do usuário tiver `prefers-reduced-motion: reduce` ativo, todos os efeitos 3D e cursores customizados devem se desligar automaticamente.
3.  **Toque Responsivo:** O cursor elástico deve desaparecer em smartphones e tablets, dando lugar ao toque nativo suave.
4.  **Monospace em Dados:** Números técnicos, preços e métricas cruciais devem usar fontes mono-espaçadas (`font-mono`) para garantir que os layouts permaneçam alinhados sem deslocamento lateral de caracteres.
