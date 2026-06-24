"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const essentialLinks = [
  { label: "Home", href: "/" },
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

const usefulLinks = [
  { label: "Compare", href: "#comparison" },
  { label: "FAQ", href: "#faq" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Chrome Extension", href: "https://chromewebstore.google.com/detail/klokrs-tab-time-tracker/blmfhmebeklbekobmamhidobkafpnnfg", external: true },
];

const socialLinks = [
  {
    label: "LinkedIn",
    href: "https://linkedin.com/company/klokrs",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/_klokrs/",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
      </svg>
    ),
  },
];

function KlokrsLogoIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="14" cy="14" r="13" stroke="url(#footerGrad)" strokeWidth="2" />
      <circle cx="14" cy="14" r="3" fill="url(#footerGrad)" />
      <line x1="14" y1="14" x2="14" y2="6" stroke="url(#footerGrad)" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="14" x2="19" y2="17" stroke="url(#footerGrad)" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="footerGrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <h3 className="text-white font-semibold text-sm mb-4">{title}</h3>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/45 text-sm hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className="text-white/45 text-sm hover:text-white transition-colors">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <footer ref={ref} className="relative border-t border-white/10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 pt-14">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Brand lockup — top left */}
          <Link href="/" className="inline-flex items-center gap-2.5 mb-8 group">
            <KlokrsLogoIcon size={28} />
            <span className="font-bold text-lg tracking-tight text-white group-hover:text-white/90 transition-colors">
              Klokrs
            </span>
          </Link>

          {/* Social row */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {socialLinks.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-white/5 text-white/50 hover:text-white hover:border-white/20 hover:bg-white/10 transition-all duration-300"
              >
                {s.icon}
              </a>
            ))}
          </div>

          <p className="text-white/40 text-sm max-w-md mb-12 leading-relaxed">
            Automatic tab tracking, daily planning, and AI insights — everything you need to know where your time actually goes.
          </p>

          {/* Link columns */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-10 md:gap-16 mb-12">
            <FooterColumn title="Essential" links={essentialLinks} />
            <FooterColumn title="Useful Links" links={usefulLinks} />
            <div className="col-span-2 md:col-span-1">
              <h3 className="text-white font-semibold text-sm mb-4">Contact</h3>
              <ul className="space-y-2.5 text-white/45 text-sm">
                <li>
                  <a href="mailto:abdulmoiz3140@gmail.com" className="hover:text-white transition-colors">
                    abdulmoiz3140@gmail.com
                  </a>
                </li>
                <li className="leading-relaxed">Built by DevWeekends</li>
              </ul>
            </div>
          </div>

          <p className="text-white/30 text-xs text-center pb-10">
            © {new Date().getFullYear()} Klokrs by DevWeekends. All rights reserved.
          </p>
        </motion.div>
      </div>

      {/* Large wordmark — Nexaro-style, centered, muted, cropped at bottom. No icon. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="relative border-t border-white/5 select-none pointer-events-none"
        aria-hidden
      >
        <div className="relative h-[clamp(72px,12vw,140px)] overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 flex justify-center">
            <span className="text-[clamp(5rem,20vw,13rem)] font-bold leading-none tracking-tight text-white/[0.06] translate-y-[38%] whitespace-nowrap">
              Klokrs
            </span>
          </div>
        </div>
      </motion.div>
    </footer>
  );
}
