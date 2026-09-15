import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";

/** Streams a previously-generated image back with a Content-Disposition
 * header that forces a real download, rather than relying on the `<a
 * download>` attribute - which browsers routinely ignore for a
 * cross-origin URL (our generated images are hosted on R2's own domain,
 * not this app's). Requires a session (not a fully open anonymous proxy)
 * and only ever fetches from our own STORAGE_PUBLIC_URL origin - anything
 * else is rejected outright, since this must never become an
 * arbitrary-URL fetcher (SSRF). */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const publicUrl = process.env.STORAGE_PUBLIC_URL?.replace(/\/$/, "");
  if (!publicUrl || !url.startsWith(`${publicUrl}/`)) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const filename = url.split("/").pop() ?? "image.png";
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
