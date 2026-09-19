import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { REFERENCE_IMAGE_ALLOWED_TYPES } from "@/lib/validation";
import { getSession } from "@/lib/session";

/** Authorizes and brokers reference-image uploads that go straight from the
 * browser to Vercel Blob - never through this app's own Server Actions,
 * which Vercel caps at a hard ~4.5MB request body regardless of any
 * next.config.ts setting (confirmed via a live 413 FUNCTION_PAYLOAD_TOO_LARGE
 * against production). This route only ever sees a small JSON token
 * exchange, never the file bytes themselves. */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await getSession();
        if (!session) {
          throw new Error("Not authenticated");
        }
        return {
          allowedContentTypes: REFERENCE_IMAGE_ALLOWED_TYPES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
