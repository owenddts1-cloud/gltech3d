"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
  materialPresetById,
  cameraPoseFor,
  framingRadius,
  type ViewMode,
  type MaterialPresetId,
  type StudioAngle,
} from "@/lib/models/viewer-presets";

/** O que o inspetor expõe para a tela poder tirar foto e trocar de ângulo. */
export interface ViewerApi {
  /** PNG do que está na tela. `scale` multiplica a resolução (1×/2×/4×). */
  capture: (opts?: { scale?: number; transparent?: boolean }) => Promise<Blob>;
  setAngle: (angle: StudioAngle) => void;
}

interface ThreeViewerProps {
  positions: Float32Array;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  viewMode?: ViewMode;
  materialPreset?: MaterialPresetId;
  /** Fundo branco + chão com sombra, para foto de produto. */
  studio?: boolean;
  autoRotate?: boolean;
  sliceHeightPercent?: number;
  dirLightIntensity?: number;
  ambientLightIntensity?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  /** Chamado quando a cena está pronta. Guarde num ref para tirar foto depois. */
  onApiReady?: (api: ViewerApi) => void;
}

/**
 * Matcap procedural: gradiente radial claro→escuro numa textura.
 *
 * Evita baixar uma imagem de matcap (que seria mais um asset e mais uma licença
 * a conferir) e já entrega o sombreamento de estúdio que ajuda a julgar a forma.
 */
function makeMatcapTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size * 0.35, size * 0.3, size * 0.05, size * 0.5, size * 0.5, size * 0.62);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.45, "#b9bec7");
    g.addColorStop(1, "#2b2f36");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function ThreeViewer({
  positions,
  boundingBox,
  viewMode = "solid",
  materialPreset = "filamento-fosco",
  studio = false,
  autoRotate = false,
  sliceHeightPercent = 100,
  dirLightIntensity = 0.8,
  ambientLightIntensity = 0.6,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  onApiReady,
}: ThreeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // A callback vive num ref para não entrar nas dependências do efeito — se
  // entrasse, um `onApiReady` inline remontaria a cena a cada render do pai.
  const onApiReadyRef = useRef(onApiReady);
  onApiReadyRef.current = onApiReady;

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(studio ? "#ffffff" : "#0c0a09");

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      // Sem isto, `toBlob` devolve imagem em branco na maioria dos navegadores:
      // o buffer é limpo logo após o desenho.
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // ── Luz ────────────────────────────────────────────────────────────────
    // No estúdio a luz é de três pontos e mais forte: fundo branco "come" a
    // iluminação e a peça sai cinzenta se mantiver os valores do modo escuro.
    const ambient = new THREE.AmbientLight(0xffffff, studio ? 0.75 : ambientLightIntensity);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, studio ? 1.6 : dirLightIntensity);
    key.position.set(100, 140, 90);
    key.castShadow = studio;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, studio ? 0.7 : dirLightIntensity * 0.4);
    fill.position.set(-120, 40, 60);
    scene.add(fill);

    if (studio) {
      const rim = new THREE.DirectionalLight(0xffffff, 0.5);
      rim.position.set(0, 60, -140);
      scene.add(rim);
    }

    // ── Geometria ──────────────────────────────────────────────────────────
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    geometry.center();
    geometry.computeBoundingBox();

    const bbox = geometry.boundingBox ?? new THREE.Box3();
    const modelHeight = bbox.max.y - bbox.min.y;
    const currentHeight = bbox.min.y + (modelHeight * sliceHeightPercent) / 100;
    const clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), currentHeight);

    const preset = materialPresetById(materialPreset);
    const disposables: Array<{ dispose: () => void }> = [geometry];

    let material: THREE.Material;
    if (viewMode === "normals") {
      // Normal invertida salta à vista: a face muda de cor por completo.
      material = new THREE.MeshNormalMaterial({
        side: THREE.DoubleSide,
        clippingPlanes: [clippingPlane],
      });
    } else if (viewMode === "matcap") {
      const matcap = makeMatcapTexture();
      disposables.push(matcap);
      material = new THREE.MeshMatcapMaterial({
        matcap,
        side: THREE.DoubleSide,
        clippingPlanes: [clippingPlane],
      });
    } else {
      const transparent = viewMode === "xray" || preset.opacity < 1;
      material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(viewMode === "xray" ? "#7dd3fc" : preset.color),
        roughness: viewMode === "xray" ? 0.2 : preset.roughness,
        metalness: viewMode === "xray" ? 0 : preset.metalness,
        clearcoat: preset.clearcoat,
        clearcoatRoughness: preset.clearcoatRoughness,
        transmission: viewMode === "xray" ? 0 : preset.transmission,
        transparent,
        opacity: viewMode === "xray" ? 0.28 : preset.opacity,
        // Raio-X mostra as paredes internas: desligar o descarte de face de trás
        // é o que revela o vazio da peça.
        side: THREE.DoubleSide,
        depthWrite: !transparent,
        wireframe: viewMode === "wireframe",
        clippingPlanes: [clippingPlane],
        clipShadows: true,
      });
    }
    disposables.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = studio;
    mesh.rotation.x = THREE.MathUtils.degToRad(rotateX);
    if (!autoRotate) mesh.rotation.y = THREE.MathUtils.degToRad(rotateY);
    mesh.rotation.z = THREE.MathUtils.degToRad(rotateZ);
    scene.add(mesh);

    // Arestas por cima do sólido: no wireframe puro a peça some contra o fundo.
    if (viewMode === "wireframe") {
      const edges = new THREE.EdgesGeometry(geometry, 25);
      const lineMaterial = new THREE.LineBasicMaterial({ color: studio ? 0x333333 : 0xfb923c });
      const lines = new THREE.LineSegments(edges, lineMaterial);
      lines.rotation.copy(mesh.rotation);
      scene.add(lines);
      disposables.push(edges, lineMaterial);
    }

    // ── Chão ───────────────────────────────────────────────────────────────
    const sizeX = boundingBox.max[0] - boundingBox.min[0];
    const sizeY = boundingBox.max[1] - boundingBox.min[1];
    const sizeZ = boundingBox.max[2] - boundingBox.min[2];
    const maxDim = Math.max(sizeX, sizeY, sizeZ, 1);

    if (studio) {
      // Sombra suave sobre branco. `ShadowMaterial` só desenha a sombra, então o
      // fundo continua branco puro — é o que serve de foto de produto.
      const floorGeo = new THREE.PlaneGeometry(maxDim * 8, maxDim * 8);
      const floorMat = new THREE.ShadowMaterial({ opacity: 0.18 });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -sizeY / 2 - 1;
      floor.receiveShadow = true;
      scene.add(floor);
      disposables.push(floorGeo, floorMat);

      key.shadow.mapSize.set(1024, 1024);
      const shadowCam = key.shadow.camera;
      shadowCam.near = 1;
      shadowCam.far = maxDim * 12;
      shadowCam.left = -maxDim * 2;
      shadowCam.right = maxDim * 2;
      shadowCam.top = maxDim * 2;
      shadowCam.bottom = -maxDim * 2;
      shadowCam.updateProjectionMatrix();
    } else {
      const grid = new THREE.GridHelper(maxDim * 2.5, 20, "#27272a", "#09090b");
      grid.position.y = -sizeY / 2 - 2;
      scene.add(grid);
      disposables.push(grid.geometry, grid.material as THREE.Material);
    }

    // ── Câmera ─────────────────────────────────────────────────────────────
    const radius = framingRadius(maxDim, 45, width / height);
    const initial = cameraPoseFor("iso", radius);
    camera.position.set(...initial.position);
    camera.up.set(...initial.up);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (autoRotate) mesh.rotation.y += 0.005;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ── API exposta ────────────────────────────────────────────────────────
    onApiReadyRef.current?.({
      setAngle: (angle) => {
        const pose = cameraPoseFor(angle, framingRadius(maxDim, 45, camera.aspect));
        camera.up.set(...pose.up);
        camera.position.set(...pose.position);
        controls.target.set(0, 0, 0);
        controls.update();
      },
      capture: ({ scale = 2, transparent = false } = {}) =>
        new Promise<Blob>((resolve, reject) => {
          const w = renderer.domElement.width;
          const h = renderer.domElement.height;
          const previousBackground = scene.background;
          // Renderiza uma vez no tamanho pedido, captura, e devolve tudo ao
          // estado anterior — a tela não pode "piscar" para o usuário.
          try {
            if (transparent) scene.background = null;
            renderer.setSize((w / renderer.getPixelRatio()) * scale, (h / renderer.getPixelRatio()) * scale, false);
            camera.updateProjectionMatrix();
            renderer.render(scene, camera);
            renderer.domElement.toBlob((blob) => {
              scene.background = previousBackground;
              renderer.setSize(w / renderer.getPixelRatio(), h / renderer.getPixelRatio(), false);
              handleResize();
              if (blob) resolve(blob);
              else reject(new Error("O navegador não devolveu a imagem."));
            }, "image/png");
          } catch (error) {
            scene.background = previousBackground;
            handleResize();
            reject(error instanceof Error ? error : new Error("Falha ao capturar a imagem."));
          }
        }),
    });

    const container = containerRef.current;
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      for (const d of disposables) d.dispose();
      renderer.dispose();
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [
    positions,
    boundingBox,
    viewMode,
    materialPreset,
    studio,
    autoRotate,
    sliceHeightPercent,
    dirLightIntensity,
    ambientLightIntensity,
    rotateX,
    rotateY,
    rotateZ,
  ]);

  return (
    <div
      ref={containerRef}
      className={`h-full min-h-[400px] w-full overflow-hidden rounded-lg border border-border ${
        studio ? "bg-white" : "bg-zinc-950/40"
      }`}
    />
  );
}
