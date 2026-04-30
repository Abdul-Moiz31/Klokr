"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader } from "@/components/ui/Loader";

type Props = {
  children: React.ReactNode;
};

/**
 * Shows the branded Klokrs loader fullscreen until the route has minimally loaded,
 * then fades it away so landing content underneath is uncovered.
 */
export function LandingShell({ children }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const minDisplay = new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ).then(() => new Promise<void>((resolve) => setTimeout(resolve, 520)));

    const loaded = new Promise<void>((resolve) => {
      if (document.readyState === "complete") resolve();
      else window.addEventListener("load", () => resolve(), { once: true });
    });

    void Promise.all([minDisplay, loaded]).then(() => setReady(true));
  }, []);

  return (
    <div className="relative min-h-screen bg-[#0A0A0F] overflow-x-hidden">
      {children}
      <AnimatePresence>
        {!ready && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0A0F]"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Loader variant="splash" clockSize={96} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
