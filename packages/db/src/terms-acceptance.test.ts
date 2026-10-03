import { afterEach, describe, expect, it } from "vitest";
import { recordTermsAcceptance } from "./terms-acceptance";
import { prisma } from "./index";

afterEach(async () => {
  await prisma.organization.deleteMany();
});

describe("recordTermsAcceptance", () => {
  it("records the organization, version, and ip address", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });

    await recordTermsAcceptance({
      organizationId: org.id,
      version: "2026-09-21",
      ipAddress: "203.0.113.4",
    });

    const record = await prisma.termsAcceptance.findFirst({
      where: { organizationId: org.id },
    });
    expect(record?.version).toBe("2026-09-21");
    expect(record?.ipAddress).toBe("203.0.113.4");
  });

  it("allows a missing ip address", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });

    await recordTermsAcceptance({ organizationId: org.id, version: "2026-09-21" });

    const record = await prisma.termsAcceptance.findFirst({
      where: { organizationId: org.id },
    });
    expect(record?.ipAddress).toBeNull();
  });
});
