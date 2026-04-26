"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

export function Community() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-r from-violet-950/20 via-transparent to-cyan-950/10" />

      <div ref={ref} className="relative max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="backdrop-blur-md bg-white/5 border border-white/10 rounded-3xl p-16"
        >
          <div className="flex justify-center gap-1 mb-6">
            {[...Array(5)].map((_, i) => (
              <svg key={i} width="20" height="20" viewBox="0 0 20 20" fill="#7C3AED">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-7xl font-black bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-4"
          >
            20,000+
          </motion.div>

          <h3 className="text-2xl font-bold text-white mb-4">
            Engineers in our community
          </h3>
          <p className="text-white/50 text-lg leading-relaxed">
            Built for the DevWeekends community and every engineer who wants to
            own their time. Join thousands of developers who are finally getting
            honest data about their workday.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
