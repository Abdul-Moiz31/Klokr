"use client";

import { Suspense, useMemo, useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Float, MeshDistortMaterial, Sphere, Sparkles } from "@react-three/drei";
import { AuthAmbientQuoteLayer, type AuthQuoteAnchor } from "./AuthAmbientQuoteLayer";

/** Klokrs UI base */
const BG = "#0A0A0F";

/** Brand — violet + cyan accent */
const VIOLET = "#7c3aed";
const CYAN_ELECTRIC = "#06b6d4";

function VioletCyanParticles({ count = 460 }: { count?: number }) {
  const mesh = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 26;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 26;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 12 - 4;
    }
    return arr;
  }, [count]);

  const colors = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const v = new THREE.Color(VIOLET);
    const vSoft = new THREE.Color("#c4b5fd");
    const c = new THREE.Color(CYAN_ELECTRIC);
    const cSoft = new THREE.Color("#a5f3fc");
    for (let i = 0; i < count; i++) {
      const pickViolet = Math.random() > 0.42;
      const deep = Math.random() > 0.55;
      const col = pickViolet ? (deep ? v : vSoft) : deep ? c : cSoft;
      arr[i * 3] = col.r;
      arr[i * 3 + 1] = col.g;
      arr[i * 3 + 2] = col.b;
    }
    return arr;
  }, [count]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!mesh.current) return;
    mesh.current.rotation.x = t * 0.024;
    mesh.current.rotation.y = t * 0.038;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.085}
        vertexColors
        transparent
        opacity={0.78}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function AnimatedBlobs() {
  return (
    <group>
      <Float speed={1.05} rotationIntensity={0.32} floatIntensity={0.48}>
        <Sphere args={[1.42, 56, 56]} position={[-3.1, 0.95, -4.8]}>
          <MeshDistortMaterial
            color={VIOLET}
            emissive="#4c1d95"
            emissiveIntensity={0.52}
            roughness={0.38}
            metalness={0.22}
            distort={0.36}
            speed={1.55}
          />
        </Sphere>
      </Float>
      <Float speed={1.25} rotationIntensity={0.42} floatIntensity={0.52}>
        <Sphere args={[1.08, 48, 48]} position={[2.85, -1.05, -5]}>
          <MeshDistortMaterial
            color={CYAN_ELECTRIC}
            emissive="#0e7490"
            emissiveIntensity={0.48}
            roughness={0.32}
            metalness={0.28}
            distort={0.28}
            speed={1.95}
          />
        </Sphere>
      </Float>
      <Float speed={0.75} rotationIntensity={0.2} floatIntensity={0.28}>
        <Sphere args={[0.72, 40, 40]} position={[0.15, 1.85, -6.8]}>
          <MeshDistortMaterial
            color="#a78bfa"
            emissive="#6d28d9"
            emissiveIntensity={0.35}
            roughness={0.45}
            metalness={0.15}
            distort={0.22}
            speed={1.1}
          />
        </Sphere>
      </Float>
    </group>
  );
}

function CameraDrift() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.08;
    camera.position.z = 8.2 + Math.sin(t * 0.72) * 0.42;
    camera.position.x = Math.sin(t * 0.61) * 0.52;
    camera.position.y = Math.cos(t * 0.53) * 0.38;
    camera.lookAt(0, 0, -3);
  });
  return null;
}

function Scene() {
  return (
    <>
      <color attach="background" args={[BG]} />
      <CameraDrift />

      <ambientLight intensity={0.28} />
      <directionalLight position={[8, 6, 10]} intensity={0.85} color="#f5f3ff" />
      <pointLight position={[7, 2, 3]} intensity={2.8} color="#ddd6fe" distance={42} decay={2} />
      <pointLight position={[-8, -3, 2]} intensity={2.4} color="#a5f3fc" distance={40} decay={2} />

      <VioletCyanParticles count={470} />

      <Sparkles
        count={100}
        scale={26}
        size={7}
        speed={0.32}
        opacity={0.5}
        color="#e9d5ff"
        position={[0, 0, -1]}
      />
      <Sparkles
        count={70}
        scale={20}
        size={5}
        speed={0.38}
        opacity={0.38}
        color="#cffafe"
        position={[2, -1.5, 0]}
      />

      <AnimatedBlobs />

      {/* subtle depth */}
      <fog attach="fog" args={[BG, 9.5, 28]} />
    </>
  );
}

export type { AuthQuoteAnchor };

interface AuthAmbientBackgroundProps {
  /** Quote pillar side — signup often `left`, login often `right` */
  quotesAnchor?: AuthQuoteAnchor;
}

/**
 * Full-viewport violet / cyan ambient 3D field for auth surfaces.
 */
export function AuthAmbientBackground({ quotesAnchor = "left" }: AuthAmbientBackgroundProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="pointer-events-none absolute inset-0 z-0 bg-[#0A0A0F]">
        <AuthAmbientQuoteLayer anchor={quotesAnchor} />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0 bg-[#0A0A0F] [&_canvas]:block [&_canvas]:size-full [&_canvas]:max-h-none">
      <Canvas
        camera={{ fov: 48, near: 0.1, far: 52, position: [0, 0, 8.2] }}
        gl={{
          alpha: false,
          antialias: true,
          powerPreference: "high-performance",
        }}
        dpr={[1, 1.85]}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      {/* Tint + vignette so the form stays readable */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_110%_90%_at_50%_45%,transparent_25%,rgba(10,10,15,0.72)_92%),radial-gradient(ellipse_55%_50%_at_0%_45%,rgba(124,58,237,0.22),transparent_72%),radial-gradient(ellipse_50%_48%_at_100%_38%,rgba(6,182,212,0.17),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-[#0A0A0F]/55 via-transparent to-[#0A0A0F]/90"
      />
      <AuthAmbientQuoteLayer anchor={quotesAnchor} />
    </div>
  );
}
