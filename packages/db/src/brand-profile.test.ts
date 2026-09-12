import { afterEach, describe, expect, it } from "vitest";
import { getBrandProfile, setBrandLogo, upsertBrandProfile } from "./brand-profile";
import { prisma } from "./index";

afterEach(async () => {
  await prisma.organization.deleteMany();
});

describe("upsertBrandProfile", () => {
  it("creates a brand profile for an organization that has none", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });

    await upsertBrandProfile({
      organizationId: org.id,
      businessName: "Acme Coffee Co",
      category: "Cafe",
      description: "Small-batch coffee roaster",
      colors: ["#4B2E2B", "#F5E9DA"],
      language: "en",
      tone: "Warm and friendly",
      productsServices: ["Espresso", "Cold brew", "Subscriptions"],
    });

    const profile = await getBrandProfile(org.id);
    expect(profile?.businessName).toBe("Acme Coffee Co");
    expect(profile?.colors).toEqual(["#4B2E2B", "#F5E9DA"]);
    expect(profile?.productsServices).toEqual([
      "Espresso",
      "Cold brew",
      "Subscriptions",
    ]);
  });

  it("updates an existing brand profile instead of duplicating it", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });

    await upsertBrandProfile({
      organizationId: org.id,
      businessName: "Acme Coffee Co",
      language: "en",
    });
    await upsertBrandProfile({
      organizationId: org.id,
      businessName: "Acme Coffee Co (renamed)",
      language: "en",
    });

    const profile = await getBrandProfile(org.id);
    expect(profile?.businessName).toBe("Acme Coffee Co (renamed)");

    const count = await prisma.brandProfile.count({
      where: { organizationId: org.id },
    });
    expect(count).toBe(1);
  });
});

describe("getBrandProfile", () => {
  it("returns null when no profile exists yet", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await expect(getBrandProfile(org.id)).resolves.toBeNull();
  });
});

describe("setBrandLogo", () => {
  it("updates only the logo, leaving other fields untouched", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await upsertBrandProfile({
      organizationId: org.id,
      businessName: "Acme Coffee Co",
      language: "en",
      tone: "Warm and friendly",
    });

    await setBrandLogo(org.id, "https://example.com/logo.png");

    const profile = await getBrandProfile(org.id);
    expect(profile?.logoUrl).toBe("https://example.com/logo.png");
    expect(profile?.tone).toBe("Warm and friendly");
  });
});
