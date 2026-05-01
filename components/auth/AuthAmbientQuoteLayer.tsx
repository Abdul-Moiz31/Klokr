"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { PRODUCT_QUOTES } from "@/lib/productQuotes";

const ROTATE_MS = 5_600;

/** Deterministic shuffle offset from route so login vs signup rarely open on the same line */
function quoteIndexSeed(pathname: string, len: number): number {
  let h = 0;
  for (let i = 0; i < pathname.length; i++) {
    h = (h + pathname.charCodeAt(i) * (i + 17)) >>> 0;
  }
  return len ? h % len : 0;
}

export type AuthQuoteAnchor = "left" | "right";

interface Props {
  anchor: AuthQuoteAnchor;
}

/**
 * Single animated quote — cycles through PRODUCT_QUOTES; sits beside the centered auth card on large screens,
 * condensed along the bottom on small screens.
 */
export function AuthAmbientQuoteLayer({ anchor }: Props) {
  const pathname = usePathname();
  const quotes = PRODUCT_QUOTES;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(quoteIndexSeed(pathname, quotes.length));
  }, [pathname, quotes.length]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((k) => (k + 1) % quotes.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [quotes.length]);

  const slideX = anchor === "left" ? -28 : 28;

  const desktopPosition =
    anchor === "left"
      ? "left-6 md:left-10 lg:left-14 xl:left-16 items-start text-left"
      : "right-6 md:right-10 lg:right-14 xl:right-16 items-end text-right";

  const barSide = anchor === "left" ? "mr-5 border-l border-violet-500/35 pl-5" : "ml-5 border-r border-cyan-500/35 pr-5";

  return (
    <>
      {/* Desktop / tablet pillar */}
      <div
        className={`pointer-events-none absolute inset-y-0 z-[2] hidden min-[920px]:flex ${desktopPosition} w-[min(100%,340px)] max-w-[32vw]`}
      >
        <div className="flex max-h-[min(70vh,520px)] flex-col justify-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: slideX, filter: "blur(12px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -slideX, filter: "blur(10px)" }}
              transition={{ duration: 0.62, ease: [0.25, 0.46, 0.45, 1] }}
              className={`relative flex flex-col ${anchor === "left" ? "items-start" : "items-end"} ${barSide}`}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
              >
                <span
                  aria-hidden
                  className={`mb-2 block font-serif text-5xl/none tracking-tighter text-transparent bg-gradient-to-br from-violet-300/65 via-violet-200/45 to-cyan-300/55 bg-clip-text ${anchor === "right" ? "self-end" : ""}`}
                >
                  &ldquo;
                </span>
                <blockquote
                  className={`text-[15px] leading-relaxed text-white/[0.42] sm:text-base ${anchor === "right" ? "text-right" : "text-left"}`}
                >
                  <span className="bg-gradient-to-r from-white/[0.78] via-white/[0.55] to-white/[0.78] bg-clip-text text-transparent">
                    {quotes[idx]}
                  </span>
                </blockquote>
                <div
                  aria-hidden
                  className={`mt-4 h-px w-16 ${
                    anchor === "left"
                      ? "bg-gradient-to-r from-violet-500/50 to-cyan-500/40"
                      : "ml-auto bg-gradient-to-l from-violet-500/50 to-cyan-500/40"
                  }`}
                />
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile — single line area; soft cross-fade */}
      <div className="pointer-events-none absolute bottom-7 left-0 right-0 z-[2] px-6 min-[920px]:hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 1] }}
            className="mx-auto max-w-md text-center"
          >
            <motion.p
              animate={{ opacity: [0.38, 0.52, 0.38] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
              className="text-xs italic leading-relaxed text-white/45"
            >
              &ldquo;{quotes[idx]}&rdquo;
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
