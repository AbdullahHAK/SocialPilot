import { afterEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn().mockResolvedValue({});

vi.mock("@aws-sdk/client-s3", () => {
  class FakeS3Client {
    send = sendMock;
  }
  class FakeDeleteObjectCommand {
    constructor(public input: unknown) {}
  }
  class FakePutObjectCommand {
    constructor(public input: unknown) {}
  }
  return {
    S3Client: FakeS3Client,
    DeleteObjectCommand: FakeDeleteObjectCommand,
    PutObjectCommand: FakePutObjectCommand,
  };
});

const { deleteGeneratedImage } = await import("./storage");

afterEach(() => {
  sendMock.mockClear();
});

describe("deleteGeneratedImage", () => {
  it("deletes the object at the key derived from the URL", async () => {
    const publicUrl = process.env.STORAGE_PUBLIC_URL!.replace(/\/$/, "");

    await deleteGeneratedImage(`${publicUrl}/generated/abc-123.png`);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0]![0] as { input: { Bucket: string; Key: string } };
    expect(command.input).toEqual({
      Bucket: process.env.STORAGE_BUCKET,
      Key: "generated/abc-123.png",
    });
  });

  it("is a no-op for a URL that isn't under our STORAGE_PUBLIC_URL", async () => {
    await deleteGeneratedImage("https://not-our-bucket.example.com/generated/abc-123.png");

    expect(sendMock).not.toHaveBeenCalled();
  });
});
