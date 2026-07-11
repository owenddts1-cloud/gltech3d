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
  sliceHeightPercent?: number; // 0 to 100
  dirLightIntensity?: number;
  ambientLightIntensity?: number;
  rotateX?: number; // degrees
  rotateY?: number; // degrees
  rotateZ?: number; // degrees
}

export default function ThreeViewer({
  positions,
  boundingBox,
  color = "#3b82f6",
  wireframe = false,
  autoRotate = false,
  sliceHeightPercent = 100,
  dirLightIntensity = 0.8,
  ambientLightIntensity = 0.6,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
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
    scene.background = new THREE.Color("#0c0a09"); // absolute dark matching system background

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

    // 2. Renderer with clipping enabled
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.localClippingEnabled = true; // MUST enable for local clipping planes
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Lights with custom intensity props
    const ambientLight = new THREE.AmbientLight(0xffffff, ambientLightIntensity);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, dirLightIntensity);
    dirLight1.position.set(100, 100, 50);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, dirLightIntensity * 0.4);
    dirLight2.position.set(-100, -100, -50);
    scene.add(dirLight2);

    // 4. Geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    // Center the geometry
    geometry.center();

    // Compute bounding box of centered geometry
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox || new THREE.Box3();
    const minY = bbox.min.y;
    const maxY = bbox.max.y;
    const modelHeight = maxY - minY;

    // 5. Clipping Plane (Slicer simulation)
    // We keep everything BELOW the current height (normal points UP)
    const currentHeight = minY + (modelHeight * sliceHeightPercent) / 100;
    const clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), currentHeight);

    // 6. Material & Mesh
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.35,
      metalness: 0.75,
      wireframe: wireframe,
      side: THREE.DoubleSide,
      clippingPlanes: [clippingPlane],
      clipShadows: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    
    // Apply manual rotations
    mesh.rotation.x = THREE.MathUtils.degToRad(rotateX);
    if (!autoRotate) {
      mesh.rotation.y = THREE.MathUtils.degToRad(rotateY);
    }
    mesh.rotation.z = THREE.MathUtils.degToRad(rotateZ);
    
    scene.add(mesh);

    // 7. Grid Helper
    const sizeX = boundingBox.max[0] - boundingBox.min[0];
    const sizeY = boundingBox.max[1] - boundingBox.min[1];
    const sizeZ = boundingBox.max[2] - boundingBox.min[2];
    const maxDim = Math.max(sizeX, sizeY, sizeZ);
    
    const gridHelper = new THREE.GridHelper(maxDim * 2.5, 20, "#27272a", "#09090b");
    gridHelper.position.y = -sizeY / 2 - 2;
    scene.add(gridHelper);

    // 8. Adjust camera position based on bounding box
    camera.position.set(maxDim * 1.5, maxDim * 1.2, maxDim * 1.5);
    camera.lookAt(0, 0, 0);

    // 9. Orbit Controls
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

    // 10. Animation Loop
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
  }, [
    positions,
    boundingBox,
    color,
    wireframe,
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
      className="w-full h-full min-h-[400px] rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950/40"
    />
  );
}
