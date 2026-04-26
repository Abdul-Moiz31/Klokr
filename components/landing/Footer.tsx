"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <svg
              width="24"
              height="24"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="14" cy="14" r="13" stroke="url(#grad2)" strokeWidth="2" />
              <circle cx="14" cy="14" r="3" fill="url(#grad2)" />
              <line
                x1="14"
                y1="14"
                x2="14"
                y2="6"
                stroke="url(#grad2)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="14"
                y1="14"
                x2="19"
                y2="17"
                stroke="url(#grad2)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient
                  id="grad2"
                  x1="0"
                  y1="0"
                  x2="28"
                  y2="28"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#7C3AED" />
                  <stop offset="1" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
            </svg>
            <span className="font-bold text-white">Tably</span>
            <span className="text-white/30 text-sm ml-2">by DevWeekends</span>
          </div>

          <div className="flex items-center gap-8 text-white/50 text-sm">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link
              href="mailto:hello@devweekends.com"
              className="hover:text-white transition-colors"
            >
              Contact
            </Link>
          </div>

          <p className="text-white/30 text-sm">
            © 2025 DevWeekends. Built with ♥ for engineers.
          </p>
        </div>
      </div>
    </footer>
  );
}
