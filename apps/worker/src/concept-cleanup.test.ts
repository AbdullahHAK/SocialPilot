import { createCreativeConcept, prisma } from "@socialpilot/db";
import { afterEach, describe, expect, it, vi } from "vitest";

const deleteGeneratedImageMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@socialpilot/content-engine", () => ({
  deleteGeneratedImage: (...args: unknown[]) => deleteGeneratedImageMock(...args),
}));

const { runConceptCleanupCycle } = await import("./concept-cleanup");

afterEach(async () => {
  await prisma.organization.deleteMany();
  deleteGeneratedImageMock.mockClear();
});

async function makeExpiredConcept(organizationId: string, status: "PENDING" | "APPROVED" = "PENDING") {
  const concept = await createCreativeConcept({
    organizationId,
    brief: "Brief",
    imageUrls: ["https://example.com/a.png", "https://example.com/a-alt.png"],
  });
  return prisma.creativeConcept.update({
    where: { id: concept.id },
    data: { status, expiresAt: new Date(Date.now() - 1000) },
  });
}

describe("runConceptCleanupCycle", () => {
  it("deletes an expired PENDING concept's images and the row itself", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const concept = await makeExpiredConcept(org.id, "PENDING");

    await runConceptCleanupCycle();

    expect(deleteGeneratedImageMock).toHaveBeenCalledWith("https://example.com/a.png");
    expect(deleteGeneratedImageMock).toHaveBeenCalledWith("https://example.com/a-alt.png");
    expect(await prisma.creativeConcept.findUnique({ where: { id: concept.id } })).toBeNull();
  });

  it("never touches an APPROVED concept, even past its expiresAt", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const concept = await makeExpiredConcept(org.id, "APPROVED");

    await runConceptCleanupCycle();

    expect(deleteGeneratedImageMock).not.toHaveBeenCalled();
    expect(await prisma.creativeConcept.findUnique({ where: { id: concept.id } })).not.toBeNull();
  });

  it("does not touch a PENDING concept that hasn't expired yet", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const concept = await createCreativeConcept({
      organizationId: org.id,
      brief: "Brief",
      imageUrls: ["https://example.com/a.png"],
    });

    await runConceptCleanupCycle();

    expect(deleteGeneratedImageMock).not.toHaveBeenCalled();
    expect(await prisma.creativeConcept.findUnique({ where: { id: concept.id } })).not.toBeNull();
  });
});
