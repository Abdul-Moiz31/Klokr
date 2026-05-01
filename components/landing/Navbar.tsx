"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: unknown } }) => {
      setIsLoggedIn(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: unknown) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-xl bg-[#0A0A0F]/80 border-b border-white/10"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="13" stroke="url(#grad)" strokeWidth="2" />
            <circle cx="14" cy="14" r="3" fill="url(#grad)" />
            <line x1="14" y1="14" x2="14" y2="6" stroke="url(#grad)" strokeWidth="2" strokeLinecap="round" />
            <line x1="14" y1="14" x2="19" y2="17" stroke="url(#grad)" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7C3AED" />
                <stop offset="1" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          </svg>
          <span className="font-bold text-lg tracking-tight">Klokrs</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
           <Link href="#how-it-works" className="text-white/60 hover:text-white text-sm transition-colors">
            How It Works
          </Link>
          <Link href="#benefits" className="text-white/60 hover:text-white text-sm transition-colors">
            Benefits
          </Link>
          <Link href="#features" className="text-white/60 hover:text-white text-sm transition-colors">
            Features
          </Link>
          {/* Pricing nav — ship later */}
          {/* <Link href="#pricing" className="text-white/60 hover:text-white text-sm transition-colors">
            Pricing
          </Link> */}
          <Link href="#faq" className="text-white/60 hover:text-white text-sm transition-colors">
            FAQ
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 cursor-pointer bg-violet-600 hover:bg-violet-500 text-white hover:shadow-[0_0_25px_rgba(124,58,237,0.6)] px-4 py-2 text-sm"
            >
              Dashboard →
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-white/70 hover:text-white text-sm transition-colors">
                Log In
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 cursor-pointer bg-violet-600 hover:bg-violet-500 text-white hover:shadow-[0_0_25px_rgba(124,58,237,0.6)] px-4 py-2 text-sm"
              >
                Sign Up Free
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
