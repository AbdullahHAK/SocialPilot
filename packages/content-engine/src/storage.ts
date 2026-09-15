import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

function getClient(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: requireEnv("STORAGE_ENDPOINT"),
    credentials: {
      accessKeyId: requireEnv("STORAGE_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("STORAGE_SECRET_ACCESS_KEY"),
    },
  });
}

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function uploadLogo(
  organizationId: string,
  file: File,
): Promise<string> {
  const bucket = requireEnv("STORAGE_BUCKET");
  const publicUrl = requireEnv("STORAGE_PUBLIC_URL");
  const extension = EXTENSION_BY_MIME_TYPE[file.type] ?? "bin";
  const key = `logos/${organizationId}-${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }),
  );

  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}

/** Uploads an AI-generated concept/content image (PNG) and returns its
 * public URL. Filenames are unique per call so multiple concepts/posts
 * never collide. `prefix` just organizes the bucket (e.g. "stories" for
 * the 9:16 versions rendered alongside a post) - doesn't change behavior. */
export async function uploadGeneratedImage(
  organizationId: string,
  imageBuffer: Buffer,
  prefix: string = "generated",
): Promise<string> {
  const bucket = requireEnv("STORAGE_BUCKET");
  const publicUrl = requireEnv("STORAGE_PUBLIC_URL");
  const key = `${prefix}/${organizationId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: imageBuffer,
      ContentType: "image/png",
    }),
  );

  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}

/** Deletes a previously-uploaded generated image - used by the concept
 * cleanup cycle to actually free storage for an expired, never-approved
 * Brand Style/logo candidate. A no-op (not an error) for any URL that
 * doesn't live under our own STORAGE_PUBLIC_URL, so a bad or unrelated URL
 * can never cause this to delete something outside our own bucket. */
export async function deleteGeneratedImage(url: string): Promise<void> {
  const publicUrl = requireEnv("STORAGE_PUBLIC_URL").replace(/\/$/, "");
  if (!url.startsWith(`${publicUrl}/`)) return;

  const key = url.slice(publicUrl.length + 1);
  await getClient().send(
    new DeleteObjectCommand({ Bucket: requireEnv("STORAGE_BUCKET"), Key: key }),
  );
}
