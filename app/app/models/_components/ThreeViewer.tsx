"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface ThreeViewerProps {
  positions: Float32Array;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  color?: string;
  wireframe?: boolean;
  autoRotate?: boolean;
}

export default function ThreeViewer({
  positions,
  boundingBox,
  color = "#3b82f6",
  wireframe = false,
  autoRotate = false,
}: ThreeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Dimensions
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 400;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c0f17");

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(100, 100, 50);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-100, -100, -50);
    scene.add(dirLight2);

    // 4. Geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    // Center the geometry
    geometry.center();

    // 5. Material & Mesh
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.3,
      metalness: 0.8,
      wireframe: wireframe,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 6. Grid Helper
    // Estimate size
    const sizeX = boundingBox.max[0] - boundingBox.min[0];
    const sizeY = boundingBox.max[1] - boundingBox.min[1];
    const sizeZ = boundingBox.max[2] - boundingBox.min[2];
    const maxDim = Math.max(sizeX, sizeY, sizeZ);
    
    const gridHelper = new THREE.GridHelper(maxDim * 2.5, 20, "#1e293b", "#0f172a");
    gridHelper.position.y = -sizeY / 2 - 2;
    scene.add(gridHelper);

    // 7. Adjust camera position based on bounding box
    camera.position.set(maxDim * 1.5, maxDim * 1.2, maxDim * 1.5);
    camera.lookAt(0, 0, 0);

    // 8. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // Don't go below floor

    // Handle Resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 9. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      if (autoRotate) {
        mesh.rotation.y += 0.005;
      }
      
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    const container = containerRef.current;
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [positions, boundingBox, color, wireframe, autoRotate]);

  return <div ref={containerRef} className="w-full h-full min-h-[400px] rounded-lg overflow-hidden border border-border/30 bg-black/30" />;
}
