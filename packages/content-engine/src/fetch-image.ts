/** Fetches an already-hosted image (e.g. the org's approved logo on R2) as
 * a Buffer so it can be passed to OpenAI's image edit endpoint as one more
 * reference image alongside any the user uploads directly. */
export async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image (${res.status}): ${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
