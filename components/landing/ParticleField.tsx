"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Particles({ count = 200 }: { count?: number }) {
  const mesh = useRef<THREE.Points>(null);

  const [positions, colors] = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;

      const isViolet = Math.random() > 0.4;
      if (isViolet) {
        colors[i * 3] = 0.49;
        colors[i * 3 + 1] = 0.23;
        colors[i * 3 + 2] = 0.93;
      } else {
        colors[i * 3] = 0.024;
        colors[i * 3 + 1] = 0.714;
        colors[i * 3 + 2] = 0.831;
      }
    }

    return [positions, colors];
  }, [count]);

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.x = state.clock.elapsedTime * 0.03;
      mesh.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
}

export function ParticleField() {
  return (
    <Canvas
      className="absolute inset-0"
      camera={{ position: [0, 0, 10], fov: 60 }}
      style={{ background: "transparent" }}
    >
      <Particles count={300} />
    </Canvas>
  );
}
