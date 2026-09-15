import { afterEach, describe, expect, it } from "vitest";
import {
  approveCreativeConcept,
  createCreativeConcept,
  getCreativeConcept,
  getMostRecentPendingConcept,
  listCreativeConcepts,
} from "./creative-concept";
import { getBrandCreativeProfile } from "./brand-creative-profile";
import { prisma } from "./index";

afterEach(async () => {
  await prisma.organization.deleteMany();
});

describe("createCreativeConcept / getCreativeConcept / listCreativeConcepts", () => {
  it("creates a PENDING concept and lists it for its organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });

    const concept = await createCreativeConcept({
      organizationId: org.id,
      brief: "Promote our new burger",
      imageUrls: ["https://example.com/1.png", "https://example.com/2.png"],
    });

    expect(concept.status).toBe("PENDING");

    const fetched = await getCreativeConcept(org.id, concept.id);
    expect(fetched?.id).toBe(concept.id);

    const list = await listCreativeConcepts(org.id);
    expect(list).toHaveLength(1);
  });

  it("does not return a concept belonging to a different organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "A" } });
    const orgB = await prisma.organization.create({ data: { name: "B" } });

    const concept = await createCreativeConcept({
      organizationId: orgA.id,
      brief: "Brief",
      imageUrls: ["https://example.com/1.png"],
    });

    expect(await getCreativeConcept(orgB.id, concept.id)).toBeNull();
  });

  it("defaults to kind BRAND_STYLE and sets a 10-hour expiry", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const before = Date.now();

    const concept = await createCreativeConcept({
      organizationId: org.id,
      brief: "Brief",
      imageUrls: ["https://example.com/1.png"],
    });

    expect(concept.kind).toBe("BRAND_STYLE");
    const hoursUntilExpiry = (concept.expiresAt!.getTime() - before) / (60 * 60 * 1000);
    expect(hoursUntilExpiry).toBeGreaterThan(9.9);
    expect(hoursUntilExpiry).toBeLessThan(10.1);
  });

  it("stores an explicit kind", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });

    const concept = await createCreativeConcept({
      organizationId: org.id,
      brief: "[logo] Brief",
      imageUrls: ["https://example.com/1.png"],
      kind: "LOGO",
    });

    expect(concept.kind).toBe("LOGO");
  });
});

describe("getMostRecentPendingConcept", () => {
  it("returns the latest not-yet-expired, not-yet-approved concept of the given kind", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await createCreativeConcept({
      organizationId: org.id,
      brief: "Older",
      imageUrls: ["https://example.com/1.png"],
      kind: "BRAND_STYLE",
    });
    const newer = await createCreativeConcept({
      organizationId: org.id,
      brief: "Newer",
      imageUrls: ["https://example.com/2.png"],
      kind: "BRAND_STYLE",
    });

    const result = await getMostRecentPendingConcept(org.id, "BRAND_STYLE");
    expect(result?.id).toBe(newer.id);
  });

  it("ignores a different kind", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await createCreativeConcept({
      organizationId: org.id,
      brief: "[logo]",
      imageUrls: ["https://example.com/1.png"],
      kind: "LOGO",
    });

    expect(await getMostRecentPendingConcept(org.id, "BRAND_STYLE")).toBeNull();
  });

  it("ignores an already-approved concept", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const concept = await createCreativeConcept({
      organizationId: org.id,
      brief: "Brief",
      imageUrls: ["https://example.com/1.png"],
    });
    await approveCreativeConcept(org.id, concept.id, "https://example.com/1.png");

    expect(await getMostRecentPendingConcept(org.id, "BRAND_STYLE")).toBeNull();
  });

  it("ignores an expired concept", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const concept = await createCreativeConcept({
      organizationId: org.id,
      brief: "Brief",
      imageUrls: ["https://example.com/1.png"],
    });
    await prisma.creativeConcept.update({
      where: { id: concept.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await getMostRecentPendingConcept(org.id, "BRAND_STYLE")).toBeNull();
  });
});

describe("approveCreativeConcept", () => {
  it("marks the concept APPROVED and writes a brand creative profile", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const concept = await createCreativeConcept({
      organizationId: org.id,
      brief: "Weekend offer on chicken burgers",
      imageUrls: ["https://example.com/1.png", "https://example.com/2.png"],
    });

    const profile = await approveCreativeConcept(
      org.id,
      concept.id,
      "https://example.com/2.png",
    );

    expect(profile?.referenceImageUrls).toEqual(["https://example.com/2.png"]);
    expect(profile?.promptTemplateAdditions).toBe(
      "Weekend offer on chicken burgers",
    );

    const updatedConcept = await getCreativeConcept(org.id, concept.id);
    expect(updatedConcept?.status).toBe("APPROVED");

    const stored = await getBrandCreativeProfile(org.id);
    expect(stored?.id).toBe(profile?.id);
  });

  it("returns null for a concept that doesn't belong to the organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "A" } });
    const orgB = await prisma.organization.create({ data: { name: "B" } });
    const concept = await createCreativeConcept({
      organizationId: orgA.id,
      brief: "Brief",
      imageUrls: ["https://example.com/1.png"],
    });

    expect(
      await approveCreativeConcept(orgB.id, concept.id, "https://example.com/1.png"),
    ).toBeNull();
  });

  it("stores the analyzed style profile alongside the approved image", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const concept = await createCreativeConcept({
      organizationId: org.id,
      brief: "Weekend offer",
      imageUrls: ["https://example.com/1.png"],
    });

    const styleDescriptors = { colors: ["red"], photographyStyle: "rustic" };
    const profile = await approveCreativeConcept(
      org.id,
      concept.id,
      "https://example.com/1.png",
      styleDescriptors,
    );

    expect(profile?.styleDescriptors).toEqual(styleDescriptors);
  });

  it("keeps the previous style profile when re-approving without a fresh analysis", async () => {
    // The analysis is best-effort (see approveConceptAction) - a failed
    // call shouldn't wipe out a style profile from an earlier approval.
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const firstConcept = await createCreativeConcept({
      organizationId: org.id,
      brief: "First",
      imageUrls: ["https://example.com/1.png"],
    });
    await approveCreativeConcept(org.id, firstConcept.id, "https://example.com/1.png", {
      colors: ["red"],
    });

    const secondConcept = await createCreativeConcept({
      organizationId: org.id,
      brief: "Second",
      imageUrls: ["https://example.com/2.png"],
    });
    const profile = await approveCreativeConcept(
      org.id,
      secondConcept.id,
      "https://example.com/2.png",
      // No styleDescriptors this time.
    );

    expect(profile?.styleDescriptors).toEqual({ colors: ["red"] });
    expect(profile?.referenceImageUrls).toEqual(["https://example.com/2.png"]);
  });
});
