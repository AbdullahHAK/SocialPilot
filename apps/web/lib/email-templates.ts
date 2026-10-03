import type { SubscriptionPlan } from "@socialpilot/db";

export const PLAN_DISPLAY_NAMES: Record<SubscriptionPlan, string> = {
  MONTHLY: "Monthly",
  SIX_MONTH: "6 Months",
  YEARLY: "Yearly",
};

// Escapes values that came from the customer themselves (business name,
// email) before they go into an HTML email body - low-severity in an inbox
// compared to a browser, but free to do correctly.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailContent {
  subject: string;
  html: string;
}

function wrapEmail(bodyHtml: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a;line-height:1.5">${bodyHtml}<p style="margin-top:32px;font-size:12px;color:#888">YOPAPI</p></div>`;
}

export interface AdminNewCustomerEmailInput {
  businessName: string;
  ownerEmail: string;
  plan: SubscriptionPlan;
  amountLabel: string;
  source: "card" | "code";
}

/** To the client (admin), the moment a brand-new customer's first
 * subscription is created - not a general sales report, just this one
 * event, with enough detail to act on it immediately. */
export function adminNewCustomerEmail(input: AdminNewCustomerEmailInput): EmailContent {
  const rows: [string, string][] = [
    ["Business", input.businessName],
    ["Owner email", input.ownerEmail],
    ["Plan", PLAN_DISPLAY_NAMES[input.plan]],
    ["Amount", input.amountLabel],
    ["Paid via", input.source === "card" ? "Card (Stripe)" : "Activation code"],
  ];
  return {
    subject: `New YOPAPI customer: ${input.businessName}`,
    html: wrapEmail(
      `<h2 style="margin:0 0 16px">New customer subscribed</h2>` +
        `<table style="border-collapse:collapse;width:100%">` +
        rows
          .map(
            ([label, value]) =>
              `<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:4px 0;font-weight:600">${escapeHtml(value)}</td></tr>`,
          )
          .join("") +
        `</table>`,
    ),
  };
}

export interface CustomerConfirmationEmailInput {
  businessName: string;
  plan: SubscriptionPlan;
}

/** To the customer, right after a card payment goes through - Stripe's own
 * receipt-email setting covers the payment receipt itself; this is the
 * separate "you're set up and active" confirmation. */
export function customerConfirmationEmail(input: CustomerConfirmationEmailInput): EmailContent {
  return {
    subject: "You're all set - welcome to YOPAPI!",
    html: wrapEmail(
      `<h2 style="margin:0 0 16px">Welcome to YOPAPI!</h2>` +
        `<p>Your <strong>${escapeHtml(PLAN_DISPLAY_NAMES[input.plan])}</strong> subscription for <strong>${escapeHtml(input.businessName)}</strong> is now active.</p>` +
        `<p>Log in any time to connect your accounts, set your publishing schedule, and watch your content go live.</p>`,
    ),
  };
}

export interface CustomerActivationEmailInput {
  businessName: string;
  plan: SubscriptionPlan;
  expiresAt: Date;
}

/** To the customer, after an activation-code signup - no card was charged,
 * so there's no Stripe receipt to rely on; this is the only confirmation
 * they get that anything actually happened. */
export function customerActivationEmail(input: CustomerActivationEmailInput): EmailContent {
  const formattedDate = input.expiresAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return {
    subject: "Your YOPAPI account is activated!",
    html: wrapEmail(
      `<h2 style="margin:0 0 16px">You're activated!</h2>` +
        `<p>Your <strong>${escapeHtml(PLAN_DISPLAY_NAMES[input.plan])}</strong> subscription for <strong>${escapeHtml(input.businessName)}</strong> is now active, through <strong>${formattedDate}</strong>.</p>` +
        `<p>Log in any time to connect your accounts, set your publishing schedule, and watch your content go live.</p>`,
    ),
  };
}
