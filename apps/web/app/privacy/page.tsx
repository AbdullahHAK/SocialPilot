import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy — YOPAPI" };

const CONTACT_EMAIL = "support@yopapi.com";

export default async function PrivacyPolicyPage() {
  const t = await getTranslations("legal");
  return (
    <LegalPage title={t("privacyTitle")} updatedDate="September 13, 2026">
      <p>
        This Privacy Policy explains what information YOPAPI (&quot;we&quot;,
        &quot;us&quot;) collects when you use our website and dashboard (the
        &quot;Service&quot;), how we use it, and the choices you have.
      </p>

      <section>
        <h2>1. Information we collect</h2>
        <ul>
          <li>
            <strong>Account information:</strong> your name, email address, and
            password (stored as a secure hash, never in plain text).
          </li>
          <li>
            <strong>Business information:</strong> the business name, category,
            description, logo, brand colors, tone, and products/services you
            provide during onboarding.
          </li>
          <li>
            <strong>Connected social accounts:</strong> when you connect
            Instagram or Facebook through Meta&apos;s official login, we
            receive and store a Page/Instagram account identifier and an
            access token, which we use solely to publish content on your
            behalf. We never see or store your Facebook password.
          </li>
          <li>
            <strong>Generated content:</strong> the images, captions, and
            hashtags YOPAPI generates for you, and the publishing
            schedule you configure.
          </li>
          <li>
            <strong>Billing information:</strong> subscription and payment
            details are handled entirely by Stripe, our payment processor. We
            store only your subscription status and plan - we never see or
            store your card number.
          </li>
          <li>
            <strong>Usage data:</strong> basic technical logs (e.g. request
            timestamps) used for debugging and reliability.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. How we use this information</h2>
        <ul>
          <li>To generate on-brand social media content on your behalf.</li>
          <li>To publish that content to the Instagram and Facebook accounts you connect, on the schedule you set.</li>
          <li>To operate, maintain, and improve the Service.</li>
          <li>To process payments and manage your subscription.</li>
          <li>To communicate with you about your account or the Service.</li>
        </ul>
      </section>

      <section>
        <h2>3. How we share information</h2>
        <p>
          We share information only as needed to operate the Service: with
          Meta (Facebook/Instagram) to publish your content, with our
          infrastructure providers (hosting, database, and file storage) to
          run the application, and with Stripe to process payments. We do not
          sell your personal information to third parties.
        </p>
      </section>

      <section>
        <h2>4. Data retention and deletion</h2>
        <p>
          We retain your information for as long as your account is active.
          You can request deletion of your account and associated data at any
          time - see our{" "}
          <a href="/data-deletion" className="text-primary underline-offset-4 hover:underline">
            Data Deletion Instructions
          </a>{" "}
          page for how to do this.
        </p>
      </section>

      <section>
        <h2>5. Your choices</h2>
        <p>
          You can disconnect a connected Instagram or Facebook account at any
          time from your dashboard, which immediately revokes our access to
          publish on your behalf. You can edit or delete your business
          information from Brand Settings at any time.
        </p>
      </section>

      <section>
        <h2>6. Security</h2>
        <p>
          Access tokens for connected social accounts are encrypted at rest.
          We use industry-standard practices to protect your data, but no
          method of transmission or storage is 100% secure.
        </p>
      </section>

      <section>
        <h2>7. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We&apos;ll
          update the &quot;Last updated&quot; date above when we do.
        </p>
      </section>

      <section>
        <h2>8. Contact us</h2>
        <p>
          Questions about this Privacy Policy? Contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline-offset-4 hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
