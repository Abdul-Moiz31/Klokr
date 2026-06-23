import { LandingBackground } from "@/components/landing/LandingBackground";
import { LandingShell } from "@/components/landing/LandingShell";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { BenefitsClock } from "@/components/landing/BenefitsClock";
import { Features } from "@/components/landing/Features";
import { Comparison } from "@/components/landing/Comparison";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { Community } from "@/components/landing/Community";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <LandingShell>
      <LandingBackground />
      <main className="relative min-h-screen overflow-x-hidden">
        <Navbar />
        <Hero />
        <Problem />
        <HowItWorks />
        <BenefitsClock />
        <Features />
        <Comparison />
        <Pricing />
        <FAQ />
        <Community />
        <CTA />
        <Footer />
      </main>
    </LandingShell>
  );
}
