import { describe, expect, it } from "vitest";
import {
  adminNewCustomerEmail,
  customerActivationEmail,
  customerConfirmationEmail,
} from "./email-templates";

describe("adminNewCustomerEmail", () => {
  it("includes the business, owner email, plan, amount, and payment source", () => {
    const { subject, html } = adminNewCustomerEmail({
      businessName: "Acme Co",
      ownerEmail: "owner@acme.com",
      plan: "SIX_MONTH",
      amountLabel: "$99.00",
      source: "card",
    });
    expect(subject).toContain("Acme Co");
    expect(html).toContain("Acme Co");
    expect(html).toContain("owner@acme.com");
    expect(html).toContain("6 Months");
    expect(html).toContain("$99.00");
    expect(html).toContain("Card (Stripe)");
  });

  it("labels an activation-code signup distinctly from a card payment", () => {
    const { html } = adminNewCustomerEmail({
      businessName: "Acme Co",
      ownerEmail: "owner@acme.com",
      plan: "MONTHLY",
      amountLabel: "Activation code (no charge)",
      source: "code",
    });
    expect(html).toContain("Activation code");
    expect(html).not.toContain("Card (Stripe)");
  });

  it("escapes a business name that contains HTML", () => {
    const { html } = adminNewCustomerEmail({
      businessName: "<script>alert(1)</script>",
      ownerEmail: "owner@acme.com",
      plan: "MONTHLY",
      amountLabel: "$19.90",
      source: "card",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("customerConfirmationEmail", () => {
  it("names the business and plan", () => {
    const { subject, html } = customerConfirmationEmail({
      businessName: "Acme Co",
      plan: "YEARLY",
    });
    expect(subject.length).toBeGreaterThan(0);
    expect(html).toContain("Acme Co");
    expect(html).toContain("Yearly");
  });
});

describe("customerActivationEmail", () => {
  it("names the business, plan, and formatted expiry date", () => {
    const { html } = customerActivationEmail({
      businessName: "Acme Co",
      plan: "MONTHLY",
      expiresAt: new Date("2026-11-02T00:00:00Z"),
    });
    expect(html).toContain("Acme Co");
    expect(html).toContain("Monthly");
    expect(html).toContain("November 2, 2026");
  });
});
