"use client";

import confetti from "canvas-confetti";
import { useCallback } from "react";

export interface SparkleOrigin {
  /** Viewport x coordinate (e.g. from getBoundingClientRect) */
  x: number;
  /** Viewport y coordinate */
  y: number;
}

interface UseSparkleReturn {
  /** Call this with the element's bounding rect center to fire a burst */
  fire: (origin: SparkleOrigin) => void;
}

/** Hook — use when you need to fire programmatically */
export function useSparkle(): UseSparkleReturn {
  const fire = useCallback(({ x, y }: SparkleOrigin) => {
    void confetti({
      particleCount: 40,
      spread: 60,
      startVelocity: 20,
      ticks: 60,
      decay: 0.88,
      gravity: 0.6,
      origin: { x: x / window.innerWidth, y: y / window.innerHeight },
      colors: ["#a78bfa", "#c4b5fd", "#7c3aed", "#fbbf24", "#f9fafb", "#e9d5ff"],
      shapes: ["star", "square"],
      scalar: 0.7,
    });
  }, []);

  return { fire };
}
