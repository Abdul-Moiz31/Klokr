"use client";

import { useRef } from "react";
import { motion, useInView, type Variants } from "framer-motion";

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.08 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const cards = [
  {
    size: "large",
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="16" cy="16" r="14" />
        <path d="M16 8v8l5 3" />
      </svg>
    ),
    title: "Tab Time Tracker",
    description:
      "Automatically tracks every domain you visit, cumulative time spent, number of visits, and page titles. Idle detection ensures you only track real work time.",
    tags: ["Auto-track", "Idle Detection", "Domain Grouping"],
    gradient: "from-violet-600/20 to-purple-600/10",
    color: "text-violet-400",
  },
  {
    size: "medium",
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 20l6-8 4 5 4-6 6 9" />
        <rect x="4" y="4" width="20" height="18" rx="2" />
      </svg>
    ),
    title: "Smart Dashboard",
    description:
      "Daily overview, top sites ranked by time, visual bar charts, domain-by-domain breakdown. Everything you need to understand your day.",
    tags: ["Visual Charts", "Daily View"],
    gradient: "from-cyan-600/20 to-blue-600/10",
    color: "text-cyan-400",
  },
  {
    size: "medium",
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="14" cy="14" r="12" />
        <path d="M14 8v6l4 4" />
        <path d="M6 4l2 2M22 4l-2 2" />
      </svg>
    ),
    title: "Idle Detection",
    description:
      "If you step away, Klokrs knows. Tracking automatically pauses after a few minutes of inactivity — adjustable in settings — and resumes the moment you return.",
    tags: ["Smart Pause", "Auto Resume"],
    gradient: "from-violet-600/20 to-pink-600/10",
    color: "text-violet-400",
  },
  {
    size: "small",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: "Always in Sync",
    description:
      "Extension and dashboard stay perfectly synchronized through Supabase. Your data is always current.",
    tags: [] as string[],
    gradient: "from-cyan-600/15 to-teal-600/10",
    color: "text-cyan-400",
  },
  {
    size: "small",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    title: "Daily Reports",
    description: "Domain breakdown per day. Export coming soon.",
    tags: [] as string[],
    gradient: "from-purple-600/15 to-violet-600/10",
    color: "text-violet-400",
  },
] as const;

function FeatureText({
  title,
  description,
  tags,
  titleSize,
}: {
  title: string;
  description: string;
  tags: readonly string[] | string[];
  titleSize: string;
}) {
  return (
    <>
      <h3 className={`text-white font-bold ${titleSize} mb-3`}>{title}</h3>
      <p className="text-white/50 text-sm leading-relaxed mb-5">{description}</p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full text-violet-400 text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

export function Features() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="features" className="py-24">
      <div ref={ref} className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.span
            className="text-violet-400 font-semibold text-sm tracking-widest uppercase mb-4 block"
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0, duration: 0.4 }}
          >
            Features
          </motion.span>
          <h2 className="text-4xl lg:text-5xl font-bold">
            <motion.span
              className="inline-block"
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1, duration: 0.45 }}
            >
              Everything you need to{" "}
            </motion.span>
            <motion.span
              className="inline-block bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              own your time
            </motion.span>
          </h2>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "show" : "hidden"}
        >
          <motion.div
            variants={cardVariants}
            className={`md:col-span-2 backdrop-blur-md bg-gradient-to-br ${cards[0].gradient} bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-white/20 transition-all duration-300 group overflow-hidden`}
          >
            <motion.div
              className={`mb-5 ${cards[0].color} group-hover:scale-110 transition-transform duration-300`}
            >
              {cards[0].icon}
            </motion.div>
            <FeatureText
              title={cards[0].title}
              description={cards[0].description}
              tags={cards[0].tags}
              titleSize="text-2xl"
            />
          </motion.div>

          <motion.div
            variants={cardVariants}
            className={`backdrop-blur-md bg-gradient-to-br ${cards[1].gradient} bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-white/20 transition-all duration-300 group overflow-hidden`}
          >
            <div
              className={`mb-5 ${cards[1].color} group-hover:scale-110 transition-transform duration-300`}
            >
              {cards[1].icon}
            </div>
            <FeatureText
              title={cards[1].title}
              description={cards[1].description}
              tags={cards[1].tags}
              titleSize="text-xl"
            />
          </motion.div>

          <motion.div
            variants={cardVariants}
            className={`backdrop-blur-md bg-gradient-to-br ${cards[2].gradient} bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-white/20 transition-all duration-300 group overflow-hidden`}
          >
            <div
              className={`mb-5 ${cards[2].color} group-hover:scale-110 transition-transform duration-300`}
            >
              {cards[2].icon}
            </div>
            <FeatureText
              title={cards[2].title}
              description={cards[2].description}
              tags={cards[2].tags}
              titleSize="text-xl"
            />
          </motion.div>

          {[cards[3], cards[4]].map((card) => (
            <motion.div
              key={card.title}
              variants={cardVariants}
              className={`backdrop-blur-md bg-gradient-to-br ${card.gradient} bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 group overflow-hidden`}
            >
              <div
                className={`mb-4 ${card.color} group-hover:scale-110 transition-transform duration-300`}
              >
                {card.icon}
              </div>
              <FeatureText
                title={card.title}
                description={card.description}
                tags={card.tags}
                titleSize="text-lg"
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
