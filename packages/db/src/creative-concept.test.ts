import { afterEach, describe, expect, it } from "vitest";
import {
  approveCreativeConcept,
  createCreativeConcept,
  getCreativeConcept,
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
