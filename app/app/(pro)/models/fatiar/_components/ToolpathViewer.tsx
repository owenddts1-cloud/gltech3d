"use client";

/**
 * Preview 3D do percurso — a peça inteira, colorida pelo tipo de trajeto.
 *
 * O que o preview 2D não mostra: como a peça FICA. Uma camada por vez responde
 * "a parede fechou?", mas não "a costura está toda de um lado?", "o suporte
 * encosta na face que eu queria lisa?", "onde é ponte?". Isso só se vê com as
 * camadas empilhadas.
 *
 * DESEMPENHO, que aqui é requisito e não detalhe: uma peça real passa de 700
 * camadas e centenas de milhares de segmentos. Por isso
 *
 *   - a geometria é montada UMA vez por tipo (`buildToolpathBuffers`), dentro do
 *     WORKER e transferida sem cópia — não um objeto por caminho;
 *   - mudar a faixa de camadas é `setDrawRange` — sem realocar, sem reenviar
 *     nada para a GPU;
 *   - ligar e desligar um tipo é `mesh.visible`, que não toca o buffer.
 *
 * O canvas 2D CONTINUA existindo, como aba. Para conferir se um contorno fechou,
 * a planta baixa de uma camada é melhor que qualquer vista 3D.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
  drawRangeFor,
  TOOLPATH_KINDS,
  TOOLPATH_LABELS,
  type ToolpathBuffers,
  type ToolpathKind,
} from "@/lib/slicer/toolpath-preview";

interface Props {
  /** Já vem empacotado do worker, transferido em vez de copiado. */
  buffers: ToolpathBuffers;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  /** Faixa de camadas visível, inclusiva nos dois extremos. */
  fromLayer: number;
  toLayer: number;
  visible: Record<ToolpathKind, boolean>;
}

export function ToolpathViewer({ buffers, bounds, fromLayer, toLayer, visible }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const meshesRef = useRef<Map<ToolpathKind, THREE.LineSegments>>(new Map());

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const cena = new THREE.Scene();
    cena.background = new THREE.Color(0x09090b);

    const largura = Math.max(host.clientWidth, 1);
    const altura = Math.max(host.clientHeight, 1);

    const camera = new THREE.PerspectiveCamera(45, largura / altura, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(largura, altura);
    host.appendChild(renderer.domElement);

    // Centro da peça. O percurso vem em coordenadas de MESA (o canto é 0,0), e
    // orbitar em torno da origem deixaria a peça girando fora da tela.
    const cx = (bounds.min[0] + bounds.max[0]) / 2;
    const cy = (bounds.min[1] + bounds.max[1]) / 2;
    const cz = (bounds.min[2] + bounds.max[2]) / 2;

    const raio = Math.max(
      bounds.max[0] - bounds.min[0],
      bounds.max[1] - bounds.min[1],
      bounds.max[2] - bounds.min[2],
      10,
    );

    const grupo = new THREE.Group();
    // Z é a altura na impressora, mas é a profundidade no three.js. Girar o
    // grupo −90° em X põe a peça em pé, como ela sai da máquina.
    grupo.rotation.x = -Math.PI / 2;
    cena.add(grupo);

    const meshes = new Map<ToolpathKind, THREE.LineSegments>();
    for (const kind of TOOLPATH_KINDS) {
      const buffer = buffers[kind];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(buffer.positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(TOOLPATH_LABELS[kind].color),
        transparent: true,
        opacity: kind === "externa" ? 1 : 0.75,
      });
      const linhas = new THREE.LineSegments(geo, mat);
      // Centraliza no eixo do orbit sem mexer nos dados: deslocar o objeto é de
      // graça, reescrever centenas de milhares de floats não é.
      linhas.position.set(-cx, -cy, -cz);
      grupo.add(linhas);
      meshes.set(kind, linhas);
    }
    meshesRef.current = meshes;

    camera.position.set(raio * 1.1, raio * 0.9, raio * 1.1);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    let vivo = true;
    const loop = () => {
      if (!vivo) return;
      controls.update();
      renderer.render(cena, camera);
      requestAnimationFrame(loop);
    };
    loop();

    const onResize = () => {
      const w = Math.max(host.clientWidth, 1);
      const h = Math.max(host.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(host);

    return () => {
      vivo = false;
      observer.disconnect();
      controls.dispose();
      // Sem liberar geometria e material, cada refatiamento deixa centenas de
      // milhares de vértices presos na GPU até a aba morrer.
      for (const m of meshes.values()) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      meshesRef.current = new Map();
    };
  }, [buffers, bounds]);

  // Faixa de camadas: só mexe no intervalo desenhado.
  useEffect(() => {
    for (const kind of TOOLPATH_KINDS) {
      const mesh = meshesRef.current.get(kind);
      if (!mesh) continue;
      const { start, count } = drawRangeFor(buffers[kind], fromLayer, toLayer);
      mesh.geometry.setDrawRange(start, count);
    }
  }, [buffers, fromLayer, toLayer]);

  // Ligar/desligar tipo: nem toca no buffer.
  useEffect(() => {
    for (const kind of TOOLPATH_KINDS) {
      const mesh = meshesRef.current.get(kind);
      if (mesh) mesh.visible = visible[kind];
    }
  }, [visible]);

  return (
    <div
      ref={hostRef}
      className="aspect-square w-full overflow-hidden rounded-lg border border-border bg-zinc-950"
      role="img"
      aria-label="Percurso de impressão em 3D"
    />
  );
}
