import { CONTACT_EMAIL } from "@/lib/company";
import {
  adminNewCustomerEmail,
  customerActivationEmail,
  customerConfirmationEmail,
  type AdminNewCustomerEmailInput,
  type CustomerActivationEmailInput,
  type CustomerConfirmationEmailInput,
  type EmailContent,
} from "@/lib/email-templates";
import { EMAIL_FROM, getResendClient, isResendConfigured } from "@/lib/resend";

const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || CONTACT_EMAIL;

/** Every send goes through here so both the "not configured yet" skip and
 * the "configured but Resend rejected it" failure share one rule: email
 * delivery must never break the signup/payment it's attached to. A
 * customer's account is already fully created and their subscription
 * already active by the time any of this runs - a bounced or misconfigured
 * send should be loud in the logs, not a 500 to the customer. */
async function send(to: string, template: EmailContent): Promise<void> {
  if (!isResendConfigured()) {
    console.log(`[email] Resend not configured - skipping "${template.subject}" to ${to}`);
    return;
  }
  try {
    await getResendClient().emails.send({
      from: EMAIL_FROM,
      to,
      subject: template.subject,
      html: template.html,
    });
  } catch (error) {
    console.error(`Failed to send email "${template.subject}" to ${to}`, error);
  }
}

export function notifyAdminNewCustomer(input: AdminNewCustomerEmailInput): Promise<void> {
  return send(ADMIN_NOTIFICATION_EMAIL, adminNewCustomerEmail(input));
}

export function sendCustomerConfirmationEmail(
  to: string,
  input: CustomerConfirmationEmailInput,
): Promise<void> {
  return send(to, customerConfirmationEmail(input));
}

export function sendCustomerActivationEmail(
  to: string,
  input: CustomerActivationEmailInput,
): Promise<void> {
  return send(to, customerActivationEmail(input));
}
