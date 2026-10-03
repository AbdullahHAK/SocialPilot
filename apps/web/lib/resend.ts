import { Resend } from "resend";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

let cachedClient: Resend | undefined;

export function getResendClient(): Resend {
  cachedClient ??= new Resend(requireEnv("RESEND_API_KEY"));
  return cachedClient;
}

/** Whether real email-sending is wired up yet. Lets every call site send
 * (or rather, skip sending) without caring whether the client has created
 * the Resend account yet - same pattern as isStripeConfigured() while
 * billing was still being set up. */
export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export const EMAIL_FROM = process.env.EMAIL_FROM || "YOPAPI <no-reply@yopapi.com>";
