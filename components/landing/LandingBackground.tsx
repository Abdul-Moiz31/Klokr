/**
 * Static ambient background shared across the entire landing page.
 * Particles / cursor effects stay hero-only; this keeps the rest consistent.
 */
export function LandingBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#0A0A0F]"
    >
      {/* Hero-zone glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(900px,100vw)] h-[520px] bg-violet-600/22 rounded-full blur-[120px]" />
      {/* Mid-page ambient */}
      <div className="absolute top-[35%] -left-48 w-[560px] h-[560px] bg-violet-700/12 rounded-full blur-[110px]" />
      <div className="absolute top-[55%] -right-40 w-[480px] h-[480px] bg-cyan-600/8 rounded-full blur-[100px]" />
      {/* Lower page warmth */}
      <div className="absolute bottom-0 left-1/3 w-[640px] h-[420px] bg-violet-900/15 rounded-full blur-[100px] translate-y-1/3" />
      {/* Soft vertical depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0A0F]/30 to-[#0A0A0F]/80" />
    </div>
  );
}
