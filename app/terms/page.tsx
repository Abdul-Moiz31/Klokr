import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Klokr",
  description: "Terms of service for Klokr, the tab time tracking app.",
};

const LAST_UPDATED = "April 27, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-lg font-semibold text-white/90">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-white/55">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        {/* Header */}
        <div className="mb-12">
          <div className="mb-4 h-px w-full bg-gradient-to-r from-violet-500/20 via-white/[0.06] to-transparent" />
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-400/80">
            Legal
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white/95 sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-white/35">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        {/* Intro */}
        <p className="mb-10 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-sm leading-relaxed text-white/55">
          Please read these Terms of Service carefully before using Klokr. By
          accessing or using the service you agree to be bound by these terms.
          If you do not agree, do not use Klokr.
        </p>

        <Section title="1. Acceptance of Terms">
          <p>
            By creating an account or using the Klokr browser extension or web
            application (collectively, the &ldquo;Service&rdquo;), you agree to
            these Terms of Service and our{" "}
            <Link
              href="/privacy"
              className="text-violet-400 underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>
            . These terms constitute a legally binding agreement between you and
            Klokr (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;).
          </p>
          <p>
            We reserve the right to update these terms at any time. Continued
            use of the Service after changes constitutes acceptance of the
            revised terms.
          </p>
        </Section>

        <Section title="2. Description of Service">
          <p>
            Klokr is a productivity tool that tracks time spent on browser tabs,
            provides analytics dashboards, and offers planning features including
            a daily planner, routine templates, and a Pomodoro timer.
          </p>
          <p>
            The Service consists of a Chrome browser extension that records
            browsing activity, a web application that displays reports and
            analytics, and a backend API that stores and processes your data.
          </p>
        </Section>

        <Section title="3. Account Registration">
          <p>
            You must create an account to use Klokr. You agree to provide
            accurate, complete information and to keep your login credentials
            secure. You are solely responsible for all activity that occurs
            under your account.
          </p>
          <p>
            You must be at least 13 years old to use the Service. By registering,
            you confirm that you meet this age requirement.
          </p>
          <p>
            We reserve the right to suspend or terminate accounts that violate
            these terms or that have been inactive for an extended period.
          </p>
        </Section>

        <Section title="4. Data Collection and Use">
          <p>
            The Klokr extension collects data about the domains and page titles
            you visit in your browser. This data is transmitted to our servers
            and associated with your account to generate analytics and reports.
          </p>
          <p>
            You acknowledge that the extension operates by monitoring your active
            browser tab. You can pause or disable tracking at any time from the
            extension popup or dashboard settings.
          </p>
          <p>
            We do not sell your browsing data to third parties. See our{" "}
            <Link
              href="/privacy"
              className="text-violet-400 underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>{" "}
            for full details on how data is handled.
          </p>
        </Section>

        <Section title="5. Acceptable Use">
          <p>You agree not to:</p>
          <ul className="ml-5 list-disc space-y-2">
            <li>Use the Service for any unlawful purpose or in violation of any regulations</li>
            <li>Attempt to reverse-engineer, decompile, or extract source code from the Service</li>
            <li>Use automated tools to scrape, overload, or disrupt the Service</li>
            <li>Share your account credentials with others or create accounts on behalf of others without their consent</li>
            <li>Attempt to access data belonging to other users</li>
            <li>Introduce malicious code, viruses, or other harmful material into the Service</li>
          </ul>
        </Section>

        <Section title="6. Intellectual Property">
          <p>
            All content, features, and functionality of the Service, including
            but not limited to the software, design, text, graphics, and logos,
            are the exclusive property of Klokr and are protected by applicable
            intellectual property laws.
          </p>
          <p>
            You retain full ownership of the data you generate through use of the
            Service, including your browsing history and planner content. You
            grant us a limited license to store, process, and display that data
            solely to provide the Service to you.
          </p>
        </Section>

        <Section title="7. Data Export and Deletion">
          <p>
            You may export your tracked session data at any time in CSV format
            from the Settings page. You may permanently delete your account and
            all associated data from Settings. Deletion is irreversible.
          </p>
          <p>
            We retain deleted account data for up to 30 days in backups before
            it is purged from all systems.
          </p>
        </Section>

        <Section title="8. Disclaimers and Limitation of Liability">
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo; without warranties of any kind, express or implied.
            We do not warrant that the Service will be uninterrupted, error-free,
            or free of harmful components.
          </p>
          <p>
            To the maximum extent permitted by law, Klokr shall not be liable
            for any indirect, incidental, special, consequential, or punitive
            damages arising out of or related to your use of the Service.
          </p>
          <p>
            Our total liability to you for any claim arising from these terms or
            the Service shall not exceed the amount you paid us in the twelve
            months preceding the claim, or $10 USD, whichever is greater.
          </p>
        </Section>

        <Section title="9. Termination">
          <p>
            We may suspend or terminate your access to the Service at any time,
            with or without notice, if you breach these terms or if we choose to
            discontinue the Service.
          </p>
          <p>
            You may stop using the Service at any time. To permanently delete
            your account, use the account deletion option in Settings.
          </p>
        </Section>

        <Section title="10. Governing Law">
          <p>
            These terms are governed by applicable law without regard to
            conflict-of-law provisions. Any disputes will be resolved through
            good-faith negotiation in the first instance. If you have a concern,
            reach out to us directly before pursuing any formal action.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            If you have questions about these Terms, contact us at{" "}
            <a
              href="mailto:abdulmoiz3140@gmail.com"
              className="text-violet-400 underline-offset-2 hover:underline"
            >
              abdulmoiz3140@gmail.com
            </a>
            .
          </p>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
