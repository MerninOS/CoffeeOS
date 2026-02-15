import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | CoffeeOS",
  description: "Privacy policy for CoffeeOS.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: February 15, 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            This Privacy Policy explains how CoffeeOS collects, uses, and protects information
            when you use our application and related services.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Information We Collect</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>Account details such as name, email address, and authentication data.</li>
            <li>
              Business and operational data you provide in the app, including product, inventory,
              order, and roasting workflow information.
            </li>
            <li>
              Shopify-related data that you authorize through app permissions and OAuth
              integrations.
            </li>
            <li>Technical data such as device, browser, IP address, and usage analytics.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How We Use Information</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>To provide, maintain, and improve CoffeeOS features.</li>
            <li>To authenticate users and secure account access.</li>
            <li>To synchronize and process connected platform data (including Shopify).</li>
            <li>To communicate important account, product, and support updates.</li>
            <li>To detect abuse, prevent fraud, and comply with legal obligations.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Data Sharing</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            We do not sell personal information. We may share data with service providers and
            infrastructure partners who support hosting, analytics, authentication, and platform
            integrations, and when required by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Data Retention</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            We retain information for as long as needed to provide services, maintain security and
            compliance records, resolve disputes, and enforce agreements.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Security</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            We use administrative, technical, and organizational safeguards designed to protect
            data. No method of transmission or storage is completely secure, and we cannot
            guarantee absolute security.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Your Choices and Rights</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Depending on your location, you may have rights to access, correct, delete, or restrict
            certain processing of your data. You can also manage some account information directly
            in the application.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Children&apos;s Privacy</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            CoffeeOS is not directed to children under 13, and we do not knowingly collect personal
            information from children under 13.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Policy Changes</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            We may update this Privacy Policy periodically. Updates will be posted on this page with
            a revised effective date.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            For privacy questions or requests, please contact the CoffeeOS support channel used by
            your organization.
          </p>
        </section>
      </div>
    </main>
  );
}
