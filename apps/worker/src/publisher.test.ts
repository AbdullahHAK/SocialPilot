import { prisma, upsertSocialAccount, type Platform } from "@socialpilot/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runPublishCycle } from "./publisher";

// TOKEN_ENCRYPTION_KEY and DATABASE_URL come from the global test env.

afterEach(async () => {
  await prisma.organization.deleteMany();
  vi.unstubAllGlobals();
});

async function createReadyJob(overrides: {
  platforms?: Platform[];
  scheduledFor?: Date;
  storyImageUrl?: string;
} = {}) {
  const org = await prisma.organization.create({ data: { name: "Acme" } });
  const platforms = overrides.platforms ?? (["INSTAGRAM"] as Platform[]);
  const job = await prisma.contentJob.create({
    data: {
      organizationId: org.id,
      scheduledFor: overrides.scheduledFor ?? new Date(Date.now() - 60_000),
      platforms,
      status: "READY",
      masterImageUrl: "https://example.com/a.png",
      storyImageUrl: overrides.storyImageUrl,
      caption: "Weekend special!",
      hashtags: ["#offer"],
      publications: { create: platforms.map((platform) => ({ platform })) },
    },
    include: { publications: true },
  });
  return { org, job };
}

describe("runPublishCycle", () => {
  it("publishes a due Instagram post and marks it PUBLISHED with the external id", async () => {
    const { org, job } = await createReadyJob();
    await upsertSocialAccount({
      organizationId: org.id,
      provider: "INSTAGRAM",
      externalId: "ig-1",
      accessToken: "raw-page-token",
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "creation-1" }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }))
        // The post-publish verification GET.
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 })),
    );

    await runPublishCycle();

    const publication = await prisma.contentPublication.findFirstOrThrow({
      where: { contentJobId: job.id, platform: "INSTAGRAM" },
    });
    expect(publication.status).toBe("PUBLISHED");
    expect(publication.externalPostId).toBe("ig-post-1");
    expect(publication.publishedAt).not.toBeNull();
    const updatedJob = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updatedJob.status).toBe("PUBLISHED");
  });

  it("retries (not permanently fails) when no matching social account is connected", async () => {
    const { job } = await createReadyJob({ platforms: ["FACEBOOK"] });

    await runPublishCycle();

    const publication = await prisma.contentPublication.findFirstOrThrow({
      where: { contentJobId: job.id, platform: "FACEBOOK" },
    });
    expect(publication.status).toBe("RETRYING");
    expect(publication.attempts).toBe(1);
    expect(publication.errorMessage).toMatch(/No connected FACEBOOK account/);
  });

  it("permanently fails once the attempt limit is exhausted, and stops being claimed", async () => {
    const { job } = await createReadyJob({ platforms: ["FACEBOOK"] });
    await prisma.contentPublication.updateMany({
      where: { contentJobId: job.id },
      data: { attempts: 4 }, // one more failure reaches MAX_PUBLISH_ATTEMPTS (5)
    });

    await runPublishCycle();

    const publication = await prisma.contentPublication.findFirstOrThrow({
      where: { contentJobId: job.id, platform: "FACEBOOK" },
    });
    expect(publication.status).toBe("FAILED");
    expect(publication.attempts).toBe(5);

    // A second cycle must not touch it again - no fetch calls at all.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await runPublishCycle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not touch a job that isn't due yet", async () => {
    const { job } = await createReadyJob({ scheduledFor: new Date(Date.now() + 60_000 * 60) });

    vi.stubGlobal("fetch", vi.fn());
    await runPublishCycle();

    const publication = await prisma.contentPublication.findFirstOrThrow({
      where: { contentJobId: job.id },
    });
    expect(publication.status).toBe("PENDING");
  });

  it("continues to the next job when one platform fails", async () => {
    const { job: failingJob } = await createReadyJob({ platforms: ["FACEBOOK"] });
    const { org: succeedingOrg, job: succeedingJob } = await createReadyJob({
      platforms: ["INSTAGRAM"],
    });
    await upsertSocialAccount({
      organizationId: succeedingOrg.id,
      provider: "INSTAGRAM",
      externalId: "ig-1",
      accessToken: "raw-page-token",
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "creation-1" }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 })),
    );

    await runPublishCycle();

    const failedPublication = await prisma.contentPublication.findFirstOrThrow({
      where: { contentJobId: failingJob.id },
    });
    const publishedPublication = await prisma.contentPublication.findFirstOrThrow({
      where: { contentJobId: succeedingJob.id },
    });
    expect(failedPublication.status).toBe("RETRYING");
    expect(publishedPublication.status).toBe("PUBLISHED");
  });

  describe("Instagram and Facebook publish independently (client's explicit example)", () => {
    it("Instagram succeeding is never touched again while only Facebook retries", async () => {
      const { org, job } = await createReadyJob({ platforms: ["INSTAGRAM", "FACEBOOK"] });
      await upsertSocialAccount({
        organizationId: org.id,
        provider: "INSTAGRAM",
        externalId: "ig-1",
        accessToken: "raw-page-token",
      });
      // No Facebook account connected - Facebook will fail this cycle.

      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "creation-1" }), { status: 200 }))
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
          )
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }))
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 })),
      );

      await runPublishCycle();

      let instagram = await prisma.contentPublication.findFirstOrThrow({
        where: { contentJobId: job.id, platform: "INSTAGRAM" },
      });
      let facebook = await prisma.contentPublication.findFirstOrThrow({
        where: { contentJobId: job.id, platform: "FACEBOOK" },
      });
      expect(instagram.status).toBe("PUBLISHED");
      expect(facebook.status).toBe("RETRYING");

      // Connect Facebook and clear its backoff, then retry - Instagram
      // must come through completely untouched.
      await upsertSocialAccount({
        organizationId: org.id,
        provider: "FACEBOOK",
        externalId: "page-1",
        accessToken: "raw-page-token",
      });
      await prisma.contentPublication.update({
        where: { id: facebook.id },
        data: { lastAttemptAt: new Date(Date.now() - 10 * 60_000) },
      });

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: "fb-post-1" }), { status: 200 }))
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "fb-post-1" }), { status: 200 })),
      );

      await runPublishCycle();

      instagram = await prisma.contentPublication.findFirstOrThrow({
        where: { contentJobId: job.id, platform: "INSTAGRAM" },
      });
      facebook = await prisma.contentPublication.findFirstOrThrow({
        where: { contentJobId: job.id, platform: "FACEBOOK" },
      });
      // Instagram: byte-for-byte unchanged from the first cycle.
      expect(instagram.status).toBe("PUBLISHED");
      expect(instagram.externalPostId).toBe("ig-post-1");
      expect(instagram.attempts).toBe(0);
      // Facebook: retried and now published.
      expect(facebook.status).toBe("PUBLISHED");
      expect(facebook.externalPostId).toBe("fb-post-1");

      const rolledUpJob = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(rolledUpJob.status).toBe("PUBLISHED");
    });
  });

  describe("idempotency against a crashed prior attempt", () => {
    it("verifies a stored externalPostId instead of publishing again", async () => {
      const { org, job } = await createReadyJob({ platforms: ["INSTAGRAM"] });
      await upsertSocialAccount({
        organizationId: org.id,
        provider: "INSTAGRAM",
        externalId: "ig-1",
        accessToken: "raw-page-token",
      });
      // Simulates a prior attempt that published successfully on Meta's
      // side but crashed before this row was marked PUBLISHED.
      await prisma.contentPublication.updateMany({
        where: { contentJobId: job.id },
        data: { externalPostId: "ig-post-1", attempts: 1, status: "RETRYING" },
      });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);

      await runPublishCycle();

      // Exactly one call - the verification GET - never a fresh publish.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const publication = await prisma.contentPublication.findFirstOrThrow({
        where: { contentJobId: job.id },
      });
      expect(publication.status).toBe("PUBLISHED");
      expect(publication.externalPostId).toBe("ig-post-1");
    });

    it("publishes fresh when a stored externalPostId no longer verifies", async () => {
      const { org, job } = await createReadyJob({ platforms: ["INSTAGRAM"] });
      await upsertSocialAccount({
        organizationId: org.id,
        provider: "INSTAGRAM",
        externalId: "ig-1",
        accessToken: "raw-page-token",
      });
      await prisma.contentPublication.updateMany({
        where: { contentJobId: job.id },
        data: { externalPostId: "stale-id", attempts: 1, status: "RETRYING" },
      });

      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          // Verification of the stale id fails.
          .mockResolvedValueOnce(new Response("not found", { status: 404 }))
          // Falls through to a fresh publish.
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "creation-1" }), { status: 200 }))
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
          )
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-2" }), { status: 200 }))
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-2" }), { status: 200 })),
      );

      await runPublishCycle();

      const publication = await prisma.contentPublication.findFirstOrThrow({
        where: { contentJobId: job.id },
      });
      expect(publication.status).toBe("PUBLISHED");
      expect(publication.externalPostId).toBe("ig-post-2");
    });
  });

  describe("race-condition protection", () => {
    it("does not publish twice when two publish cycles race the same publication (production incident pattern)", async () => {
      const { org, job } = await createReadyJob({ platforms: ["INSTAGRAM"] });
      await upsertSocialAccount({
        organizationId: org.id,
        provider: "INSTAGRAM",
        externalId: "ig-1",
        accessToken: "raw-page-token",
      });

      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "creation-1" }), { status: 200 }))
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
          )
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }))
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }))
          // If a race let both cycles through, a second full publish
          // sequence would be attempted here - fail loudly if so.
          .mockRejectedValue(new Error("should not publish a second time")),
      );

      await Promise.all([runPublishCycle(), runPublishCycle()]);

      const publications = await prisma.contentPublication.findMany({
        where: { contentJobId: job.id },
      });
      expect(publications).toHaveLength(1);
      expect(publications[0]!.status).toBe("PUBLISHED");
      expect(publications[0]!.externalPostId).toBe("ig-post-1");
    });
  });

  describe("Story sub-publish", () => {
    it("also publishes an Instagram Story when the job has a storyImageUrl", async () => {
      const { org, job } = await createReadyJob({
        platforms: ["INSTAGRAM"],
        storyImageUrl: "https://example.com/a-story.png",
      });
      await upsertSocialAccount({
        organizationId: org.id,
        provider: "INSTAGRAM",
        externalId: "ig-1",
        accessToken: "raw-page-token",
      });

      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "creation-1" }), { status: 200 }))
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
          )
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }))
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }))
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ id: "story-creation-1" }), { status: 200 }),
          )
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
          )
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-story-1" }), { status: 200 })),
      );

      await runPublishCycle();

      const publication = await prisma.contentPublication.findFirstOrThrow({
        where: { contentJobId: job.id },
      });
      expect(publication.status).toBe("PUBLISHED");
      expect(publication.externalStoryId).toBe("ig-story-1");
    });

    it("does not attempt a Story publish when storyImageUrl is absent", async () => {
      const { org, job } = await createReadyJob({ platforms: ["INSTAGRAM"] });
      await upsertSocialAccount({
        organizationId: org.id,
        provider: "INSTAGRAM",
        externalId: "ig-1",
        accessToken: "raw-page-token",
      });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "creation-1" }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);

      await runPublishCycle();

      expect(fetchMock).toHaveBeenCalledTimes(4);
      const publication = await prisma.contentPublication.findFirstOrThrow({
        where: { contentJobId: job.id },
      });
      expect(publication.externalStoryId).toBeNull();
    });

    it("keeps the main publication PUBLISHED even if the Story publish fails", async () => {
      const { org, job } = await createReadyJob({
        platforms: ["INSTAGRAM"],
        storyImageUrl: "https://example.com/a-story.png",
      });
      await upsertSocialAccount({
        organizationId: org.id,
        provider: "INSTAGRAM",
        externalId: "ig-1",
        accessToken: "raw-page-token",
      });

      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "creation-1" }), { status: 200 }))
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
          )
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }))
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }))
          // Story container creation fails outright.
          .mockResolvedValueOnce(new Response("rate limited", { status: 429 })),
      );

      await runPublishCycle();

      const publication = await prisma.contentPublication.findFirstOrThrow({
        where: { contentJobId: job.id },
      });
      expect(publication.status).toBe("PUBLISHED");
      expect(publication.externalPostId).toBe("ig-post-1");
      expect(publication.externalStoryId).toBeNull();
    });

    it("also publishes a Facebook Story via the photo-upload-then-story flow", async () => {
      const { org, job } = await createReadyJob({
        platforms: ["FACEBOOK"],
        storyImageUrl: "https://example.com/a-story.png",
      });
      await upsertSocialAccount({
        organizationId: org.id,
        provider: "FACEBOOK",
        externalId: "page-1",
        accessToken: "raw-page-token",
      });

      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "fb-post-1" }), { status: 200 }))
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "fb-post-1" }), { status: 200 }))
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: "photo-1" }), { status: 200 }))
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ post_id: "page_1_story_1" }), { status: 200 }),
          ),
      );

      await runPublishCycle();

      const publication = await prisma.contentPublication.findFirstOrThrow({
        where: { contentJobId: job.id },
      });
      expect(publication.status).toBe("PUBLISHED");
      expect(publication.externalStoryId).toBe("page_1_story_1");
    });
  });
  describe("publishing options (per-business setting)", () => {
    type Mode = "POST_AND_STORY" | "STORY_ONLY" | "POST_ONLY";

    async function setup(mode: Mode, includeCaption: boolean, storyImageUrl?: string) {
      const { org, job } = await createReadyJob({ platforms: ["INSTAGRAM"], storyImageUrl });
      await prisma.publishingSchedule.create({
        data: { organizationId: org.id, publishMode: mode, includeCaption },
      });
      await upsertSocialAccount({
        organizationId: org.id,
        provider: "INSTAGRAM",
        externalId: "ig-1",
        accessToken: "raw-page-token",
      });
      return { job };
    }

    const json = (body: object) => new Response(JSON.stringify(body), { status: 200 });

    it("post only: publishes the feed post and never a Story, even when a Story image exists", async () => {
      const { job } = await setup("POST_ONLY", true, "https://example.com/a-story.png");
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: "creation-1" }))
        .mockResolvedValueOnce(json({ status_code: "FINISHED" }))
        .mockResolvedValueOnce(json({ id: "ig-post-1" }))
        .mockResolvedValueOnce(json({ id: "ig-post-1" }));
      vi.stubGlobal("fetch", fetchMock);

      await runPublishCycle();

      expect(fetchMock).toHaveBeenCalledTimes(4);
      const publication = await prisma.contentPublication.findFirstOrThrow({
        where: { contentJobId: job.id },
      });
      expect(publication.status).toBe("PUBLISHED");
      expect(publication.externalPostId).toBe("ig-post-1");
      expect(publication.externalStoryId).toBeNull();
    });

    it("story only: publishes just the Story - no feed post - and marks the job PUBLISHED", async () => {
      const { job } = await setup("STORY_ONLY", true, "https://example.com/a-story.png");
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: "story-creation-1" }))
        .mockResolvedValueOnce(json({ status_code: "FINISHED" }))
        .mockResolvedValueOnce(json({ id: "ig-story-1" }));
      vi.stubGlobal("fetch", fetchMock);

      await runPublishCycle();

      expect(fetchMock).toHaveBeenCalledTimes(3);
      const publication = await prisma.contentPublication.findFirstOrThrow({
        where: { contentJobId: job.id },
      });
      expect(publication.status).toBe("PUBLISHED");
      expect(publication.externalPostId).toBeNull();
      expect(publication.externalStoryId).toBe("ig-story-1");
      const updatedJob = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(updatedJob.status).toBe("PUBLISHED");
    });

    it("story only with no Story image fails permanently without calling Meta", async () => {
      const { job } = await setup("STORY_ONLY", true);
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await runPublishCycle();

      expect(fetchMock).not.toHaveBeenCalled();
      const publication = await prisma.contentPublication.findFirstOrThrow({
        where: { contentJobId: job.id },
      });
      expect(publication.status).toBe("FAILED");
      expect(publication.errorMessage).toMatch(/no Story image/i);
    });

    it("caption off: the post goes out with an empty caption", async () => {
      await setup("POST_ONLY", false);
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: "creation-1" }))
        .mockResolvedValueOnce(json({ status_code: "FINISHED" }))
        .mockResolvedValueOnce(json({ id: "ig-post-1" }))
        .mockResolvedValueOnce(json({ id: "ig-post-1" }));
      vi.stubGlobal("fetch", fetchMock);

      await runPublishCycle();

      const containerUrl = new URL(String(fetchMock.mock.calls[0]![0]));
      expect(containerUrl.searchParams.get("caption")).toBe("");
    });

    it("caption on (default): the caption and hashtags are included", async () => {
      await setup("POST_ONLY", true);
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ id: "creation-1" }))
        .mockResolvedValueOnce(json({ status_code: "FINISHED" }))
        .mockResolvedValueOnce(json({ id: "ig-post-1" }))
        .mockResolvedValueOnce(json({ id: "ig-post-1" }));
      vi.stubGlobal("fetch", fetchMock);

      await runPublishCycle();

      const containerUrl = new URL(String(fetchMock.mock.calls[0]![0]));
      expect(containerUrl.searchParams.get("caption")).toBe("Weekend special!\n\n#offer");
    });
  });
});
