import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";
import { COMPANY_LEGAL_NAME, CONTACT_EMAIL } from "@/lib/company";

export const metadata: Metadata = { title: "Terms of Service — YOPAPI" };

export default async function TermsOfServicePage() {
  const t = await getTranslations("legal");
  return (
    <LegalPage title={t("termsTitle")} updatedDate="September 21, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of
        YOPAPI (the &quot;Service&quot;), owned and operated by{" "}
        {COMPANY_LEGAL_NAME}. By creating an account, you agree to these
        Terms.
      </p>

      <section>
        <h2>1. The Service</h2>
        <p>
          YOPAPI generates AI-based social media content on your behalf
          and publishes it, as feed posts and Stories, to the Instagram
          and/or Facebook accounts you connect, on a schedule you configure,
          for the duration of your subscription.
        </p>
      </section>

      <section>
        <h2>2. Your account</h2>
        <p>
          You&apos;re responsible for keeping your login credentials secure
          and for all activity under your account. You must provide accurate
          business information, since it&apos;s used to generate your content.
        </p>
      </section>

      <section>
        <h2>3. Connected social accounts</h2>
        <p>
          You authorize YOPAPI to publish content to any Instagram or
          Facebook account you connect through Meta&apos;s official login. You
          can revoke this authorization at any time by disconnecting the
          account from your dashboard or by removing YOPAPI&apos;s access
          in your Meta account settings.
        </p>
      </section>

      <section>
        <h2>4. Subscriptions and billing</h2>
        <p>
          Subscriptions are billed in advance on a monthly or yearly basis
          through Stripe. Subscriptions renew automatically until cancelled.
          You can cancel at any time from the Subscription page in your
          dashboard; access continues until the end of the current billing
          period.
        </p>
      </section>

      <section>
        <h2>5. Content and acceptable use</h2>
        <p>
          You&apos;re responsible for the content published to your accounts,
          including reviewing generated content for accuracy. You agree not
          to use the Service to publish unlawful, infringing, or misleading
          content, or in any way that violates Meta&apos;s own platform
          policies.
        </p>
      </section>

      <section>
        <h2>6. Intellectual property</h2>
        <p>
          You retain ownership of your business information, logo, and the
          content generated for your account. YOPAPI retains ownership
          of the Service itself, including its software and design.
        </p>
      </section>

      <section>
        <h2>7. Disclaimer and limitation of liability</h2>
        <p>
          The Service is provided &quot;as is&quot;, without warranties of any
          kind. YOPAPI is not liable for indirect, incidental, or
          consequential damages arising from your use of the Service,
          including any impact from content published on your behalf.
        </p>
      </section>

      <section>
        <h2>8. Termination</h2>
        <p>
          We may suspend or terminate an account that violates these Terms or
          Meta&apos;s platform policies. You may cancel your subscription and
          stop using the Service at any time.
        </p>
      </section>

      <section>
        <h2>9. Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. We&apos;ll update the
          &quot;Last updated&quot; date above when we do.
        </p>
      </section>

      <section>
        <h2>10. Contact us</h2>
        <p>
          {COMPANY_LEGAL_NAME} is the owner and operator of YOPAPI. Questions
          about these Terms? Contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline-offset-4 hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
