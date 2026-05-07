import { LandingShell } from "@/components/landing/LandingShell";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { PostHero } from "@/components/landing/PostHero";
import { Problem } from "@/components/landing/Problem";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { BenefitsClock } from "@/components/landing/BenefitsClock";
import { Features } from "@/components/landing/Features";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { Community } from "@/components/landing/Community";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <LandingShell>
      <main className="min-h-screen bg-[#0A0A0F] overflow-x-hidden">
        <Navbar />
        <Hero />
        <PostHero />
        <Problem />
        <HowItWorks />
        <BenefitsClock />
        <Features />
        <Pricing />
        <FAQ />
        <Community />
        <CTA />
        <Footer />
      </main>
    </LandingShell>
  );
}
