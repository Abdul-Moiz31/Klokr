import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Klokrs",
  description: "Privacy policy for Klokrs, the tab time tracking app.",
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

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-white/35">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        {/* Intro */}
        <p className="mb-10 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-sm leading-relaxed text-white/55">
          Your privacy matters. This policy explains what data Klokrs collects,
          why we collect it, and how we use and protect it. We will never sell
          your personal data to third parties.
        </p>

        <Section title="1. Who We Are">
          <p>
            Klokrs is an independently built productivity tool. If you have any
            questions about this policy, contact us at{" "}
            <a
              href="mailto:abdulmoiz3140@gmail.com"
              className="text-violet-400 underline-offset-2 hover:underline"
            >
              abdulmoiz3140@gmail.com
            </a>
            .
          </p>
        </Section>

        <Section title="2. What Data We Collect">
          <p>We collect the following categories of data:</p>

          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="mb-1.5 font-semibold text-white/75">Account data</p>
              <p>
                Your email address and any display name you set. This is
                collected when you create an account and is used to identify
                you and send account-related communications.
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="mb-1.5 font-semibold text-white/75">Browsing activity</p>
              <p>
                The domain names and page titles of browser tabs you visit
                while the Klokrs extension is active and tracking is enabled.
                We record the start time, end time, and duration of each
                visit. We do not capture full URLs, passwords, form inputs,
                page content, or any personally identifiable information from
                the pages you visit.
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="mb-1.5 font-semibold text-white/75">Planner and task data</p>
              <p>
                Task lists, routine templates, and planner entries you create
                are stored on our servers so they sync across devices and
                persist across sessions.
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="mb-1.5 font-semibold text-white/75">Usage and technical data</p>
              <p>
                Standard web server logs including IP addresses, browser type,
                and request timestamps. These are used for security monitoring
                and infrastructure management and are not associated with your
                browsing history.
              </p>
            </div>
          </div>
        </Section>

        <Section title="3. What We Do NOT Collect">
          <ul className="ml-5 list-disc space-y-2">
            <li>Full page URLs (only the domain and page title)</li>
            <li>Page content, text, or any data you type on websites</li>
            <li>Passwords or authentication tokens from other services</li>
            <li>Private browsing / incognito tab activity</li>
            <li>Data from websites when tracking is paused or disabled</li>
            <li>Location data beyond the coarse country-level derived from IP address</li>
          </ul>
        </Section>

        <Section title="4. How We Use Your Data">
          <p>We use your data exclusively to:</p>
          <ul className="ml-5 list-disc space-y-2">
            <li>Display your time tracking analytics and reports in the dashboard</li>
            <li>Calculate streaks, productivity scores, and activity heatmaps</li>
            <li>Sync your planner tasks and routine templates across sessions</li>
            <li>Send essential transactional emails (account verification, password reset)</li>
            <li>Detect and prevent abuse or security incidents</li>
            <li>Improve the service based on aggregated, anonymised usage patterns</li>
          </ul>
          <p>
            We do not use your data for advertising, and we do not share it
            with advertisers or data brokers.
          </p>
        </Section>

        <Section title="5. Data Storage and Security">
          <p>
            Your data is stored securely using{" "}
            <span className="text-white/75">Supabase</span>, hosted on AWS
            infrastructure with encryption at rest and in transit (TLS 1.2+).
            Row-level security ensures your data is only accessible to your
            own account.
          </p>
          <p>
            Authentication tokens are stored locally in your browser. We
            implement short-lived JWT tokens with automatic refresh to minimise
            the risk of token compromise.
          </p>
          <p>
            No security system is impenetrable. In the event of a data breach
            that affects your personal data, we will notify you as required by
            applicable law.
          </p>
        </Section>

        <Section title="6. Data Sharing">
          <p>
            We share your data only in the following limited circumstances:
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <span className="text-white/75">Infrastructure providers:</span>{" "}
              Supabase (database and auth), Vercel (web hosting). These
              providers process data only as necessary to operate the service.
            </li>
            <li>
              <span className="text-white/75">Legal requirements:</span> If
              required by law, court order, or governmental authority, we may
              disclose your data to the extent legally required.
            </li>
          </ul>
          <p>We will never sell your data.</p>
        </Section>

        <Section title="7. Your Rights and Choices">
          <p>You have the following rights over your data:</p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <span className="text-white/75">Pause tracking:</span> Use the
              extension popup or dashboard Settings to stop data collection at
              any time.
            </li>
            <li>
              <span className="text-white/75">Export your data:</span> Download
              all your tracked sessions as a CSV file from Settings.
            </li>
            <li>
              <span className="text-white/75">Delete your account:</span>{" "}
              Permanently erase all your data from Settings. Deletion is
              irreversible and processed within 30 days.
            </li>
            <li>
              <span className="text-white/75">Correct your data:</span> Update
              your display name and email from Settings.
            </li>
            <li>
              <span className="text-white/75">Request a copy:</span> Email us
              at{" "}
              <a
                href="mailto:abdulmoiz3140@gmail.com"
                className="text-violet-400 underline-offset-2 hover:underline"
              >
                abdulmoiz3140@gmail.com
              </a>{" "}
              to request a full export of your personal data.
            </li>
          </ul>
        </Section>

        <Section title="8. Cookies and Local Storage">
          <p>
            Klokrs uses browser local storage and cookies solely for session
            management (keeping you logged in) and storing your preferences such
            as tracking state. We do not use tracking cookies, third-party
            analytics cookies, or advertising cookies.
          </p>
        </Section>

        <Section title="9. Children&apos;s Privacy">
          <p>
            Klokrs is not directed at children under 13. We do not knowingly
            collect data from children under 13. If you believe a child under
            13 has created an account, contact us and we will delete it promptly.
          </p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. When we make
            material changes, we will update the &ldquo;Last updated&rdquo; date
            at the top of this page and, where appropriate, notify you by email.
            Continued use of the service after changes constitutes acceptance of
            the updated policy.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            If you have questions, concerns, or requests regarding this Privacy
            Policy or your personal data, contact us at:
          </p>
          <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-white/70">Klokrs</p>
            <a
              href="mailto:abdulmoiz3140@gmail.com"
              className="mt-1 block text-violet-400 underline-offset-2 hover:underline"
            >
              abdulmoiz3140@gmail.com
            </a>
          </div>
          <p className="mt-4">
            Also see our{" "}
            <Link
              href="/terms"
              className="text-violet-400 underline-offset-2 hover:underline"
            >
              Terms of Service
            </Link>
            .
          </p>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
