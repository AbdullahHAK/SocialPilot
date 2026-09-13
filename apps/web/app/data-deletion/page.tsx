import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Data Deletion Instructions — SocialPilot" };

const CONTACT_EMAIL = "support@socialpilot.app";

export default function DataDeletionPage() {
  return (
    <LegalPage title="Data Deletion Instructions" updatedDate="September 13, 2026">
      <p>
        You&apos;re always in control of the data SocialPilot has for you.
        Here&apos;s how to remove it, whether you want to disconnect a social
        account or delete your whole SocialPilot account.
      </p>

      <section>
        <h2>Disconnect Instagram or Facebook</h2>
        <p>
          Go to <strong>Connected Accounts</strong> in your dashboard and
          disconnect the account. This immediately deletes the stored access
          token and stops any further publishing to that account - it takes
          effect right away, no waiting period.
        </p>
      </section>

      <section>
        <h2>Delete your SocialPilot account entirely</h2>
        <p>
          Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline-offset-4 hover:underline">
            {CONTACT_EMAIL}
          </a>{" "}
          from the email address on your account and ask us to delete it.
          We&apos;ll confirm your identity and permanently delete the
          following within 30 days:
        </p>
        <ul>
          <li>Your account and login information</li>
          <li>Your business profile, logo, and brand settings</li>
          <li>Connected social account tokens</li>
          <li>Generated content, captions, and publishing history</li>
          <li>Your publishing schedule</li>
        </ul>
        <p>
          If you have an active subscription, please cancel it from the{" "}
          <strong>Subscription</strong> page first (or let us know in your
          email) so billing stops as well.
        </p>
      </section>

      <section>
        <h2>Removed the app from Facebook instead?</h2>
        <p>
          If you removed SocialPilot from your Facebook or Instagram settings
          directly, we no longer have permission to access that account, but
          your SocialPilot account itself isn&apos;t automatically deleted -
          email us at the address above if you&apos;d like that removed too.
        </p>
      </section>
    </LegalPage>
  );
}
