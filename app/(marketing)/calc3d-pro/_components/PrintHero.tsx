'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * A peça sendo impressa, camada por camada, dirigida pelo scroll.
 *
 * A escolha do que renderizar não é decorativa: um cubo girando não diz nada,
 * enquanto uma peça MATERIALIZANDO de baixo para cima diz "impressão 3D" sem
 * legenda. A parte já impressa é sólida; a que falta é wireframe — que é como o
 * fatiador do próprio produto mostra o percurso.
 *
 * Tudo procedural: zero asset, zero fetch, zero textura. O perfil do vaso são 12
 * pontos, e a grade da mesa vem do CSS atrás do canvas.
 *
 * O truque central é `clippingPlanes` com dois planos opostos sobre a MESMA
 * geometria — um corta a tampa do sólido, o outro corta a base do wireframe. Um
 * único valor (`progress`) move os dois e dirige o hero inteiro.
 */

/** Altura útil da peça, em unidades de cena. */
const PIECE_HEIGHT = 2.6;

/** Perfil do vaso: raio por altura. Poucos pontos, silhueta reconhecível. */
function buildProfile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const steps = 11;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * PIECE_HEIGHT;
    // Base larga, cintura, boca aberta — a forma clássica de peça torneada.
    const r = 0.55 + Math.sin(t * Math.PI * 1.15) * 0.42 - t * 0.12;
    pts.push(new THREE.Vector2(Math.max(0.14, r), y));
  }
  return pts;
}

export default function PrintHero({ progress }: { progress: React.RefObject<number> }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // Sem o teto, uma tela 3x renderiza 9x pixels — e o ventilador liga.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.localClippingEnabled = true;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(3.1, 2.3, 3.6);
    camera.lookAt(0, PIECE_HEIGHT * 0.46, 0);

    // Dois planos opostos sobre a mesma altura de corte: o sólido existe abaixo,
    // o wireframe acima. Mover `constant` nos dois move a "cabeça de impressão".
    const printedPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const pendingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    const geometry = new THREE.LatheGeometry(buildProfile(), 72);

    const printed = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: 0xa6815c,
        metalness: 0.12,
        roughness: 0.46,
        side: THREE.DoubleSide,
        clippingPlanes: [printedPlane],
        clipShadows: false,
      }),
    );
    scene.add(printed);

    const wireGeometry = new THREE.WireframeGeometry(geometry);
    const pending = new THREE.LineSegments(
      wireGeometry,
      new THREE.LineBasicMaterial({
        color: 0x8e6d4d,
        transparent: true,
        opacity: 0.26,
        clippingPlanes: [pendingPlane],
      }),
    );
    scene.add(pending);

    // Bico: o detalhe que faz a cena parecer impressão, e não "modelo aparecendo".
    const nozzle = new THREE.Mesh(
      new THREE.ConeGeometry(0.085, 0.26, 18),
      new THREE.MeshStandardMaterial({ color: 0x2d241e, metalness: 0.5, roughness: 0.35 }),
    );
    nozzle.rotation.x = Math.PI; // ponta para baixo
    scene.add(nozzle);

    const bed = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.MeshStandardMaterial({ color: 0xe8e2d9, roughness: 0.95, metalness: 0 }),
    );
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = -0.01;
    scene.add(bed);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(4, 6, 3);
    scene.add(key);

    function resize() {
      const w = host!.clientWidth;
      const h = host!.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    let running = false;
    let lastDrawn = -1;

    function frame(time: number) {
      const p = Math.min(1, Math.max(0, progress.current ?? 0));
      // A peça nunca fica 100% cortada: um fio de material sempre visível evita
      // o "sumiço" no topo do scroll.
      const h = 0.06 + p * PIECE_HEIGHT;
      printedPlane.constant = h;
      pendingPlane.constant = -h;

      // Bico acompanha a altura e oscila de lado, como num perímetro.
      const sway = Math.sin(time * 0.0016) * 0.55;
      nozzle.position.set(sway, h + 0.2, Math.cos(time * 0.0016) * 0.55);

      // Rotação lenta e contínua; o scroll comanda a altura, não o giro.
      printed.rotation.y = time * 0.00018;
      pending.rotation.y = printed.rotation.y;

      renderer.render(scene, camera);
      lastDrawn = p;
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    }

    // O loop só roda com a cena à vista e a aba ativa. Sem isto ele queima
    // bateria desenhando pixels que ninguém olha enquanto a pessoa usa a
    // calculadora mais abaixo na página.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(host);

    function onVisibility() {
      if (document.hidden) stop();
      else if (host && host.getBoundingClientRect().bottom > 0) start();
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      // Descarte completo e IDEMPOTENTE. O StrictMode roda este efeito duas
      // vezes em dev; cleanup incompleto deixa dois contextos e dois loops já na
      // máquina do desenvolvedor. Em produção o sintoma é pior e mais lento de
      // achar: o Chrome mata o contexto WebGL mais antigo ao chegar em ~16, e a
      // landing simplesmente "para de animar às vezes".
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
      running = false;
      document.removeEventListener('visibilitychange', onVisibility);

      scene.traverse((obj) => {
        const mesh = obj as Partial<THREE.Mesh> & { material?: THREE.Material | THREE.Material[] };
        mesh.geometry?.dispose?.();
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const m of mats) m.dispose();
      });
      wireGeometry.dispose();
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      void lastDrawn;
    };
  }, [progress]);

  return <div ref={hostRef} className="absolute inset-0" aria-hidden />;
}
