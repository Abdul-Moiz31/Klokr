import dynamic from "next/dynamic";
import { LandingBackground } from "@/components/landing/LandingBackground";
import { LandingShell } from "@/components/landing/LandingShell";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FAQ_ITEMS } from "@/components/landing/faqData";

const softwareAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Klokrs",
  applicationCategory: "BrowserApplication",
  operatingSystem: "Chrome, Edge, Brave, Arc",
  description:
    "A silent tab tracker built for engineers who want honest data about their day. Install the extension, work normally, see everything.",
  url: "https://klokrs.com",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: {
      "@type": "Answer",
      text: a,
    },
  })),
};

const BenefitsClock = dynamic(() =>
  import("@/components/landing/BenefitsClock").then((m) => m.BenefitsClock)
);
const Features = dynamic(() =>
  import("@/components/landing/Features").then((m) => m.Features)
);
const Comparison = dynamic(() =>
  import("@/components/landing/Comparison").then((m) => m.Comparison)
);
const Pricing = dynamic(() =>
  import("@/components/landing/Pricing").then((m) => m.Pricing)
);
const FAQ = dynamic(() => import("@/components/landing/FAQ").then((m) => m.FAQ));
const Community = dynamic(() =>
  import("@/components/landing/Community").then((m) => m.Community)
);
const CTA = dynamic(() => import("@/components/landing/CTA").then((m) => m.CTA));
const Footer = dynamic(() =>
  import("@/components/landing/Footer").then((m) => m.Footer)
);

export default function LandingPage() {
  return (
    <LandingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
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
