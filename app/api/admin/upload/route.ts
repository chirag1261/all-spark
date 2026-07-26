import { NextRequest, NextResponse } from "next/server";

import { validateImageUpload } from "@/constants";
import { getCurrentAdmin, hasPermission } from "@/lib/auth/admin";
import { cloudinaryConfigured, uploadToCloudinary } from "@/lib/integrations/cloudinary";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/upload — multipart form with a "file" image field.
 * Uploads to Cloudinary (signed, server-side) and returns the CDN URL.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "events") && !hasPermission(user, "organizers")) {
    logger.be.warn("Upload denied — missing permission", { userId: user.id });
    return NextResponse.json(
      { error: "Missing events or organizers permission" },
      { status: 403 }
    );
  }
  if (!cloudinaryConfigured()) {
    logger.be.error("Upload attempted with Cloudinary not configured");
    return NextResponse.json(
      {
        error:
          "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET — or paste an image URL instead.",
      },
      { status: 501 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }
  const invalid = validateImageUpload({ name: file.name, type: file.type, size: file.size });
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  const result = await uploadToCloudinary(file);
  if (!result.ok) {
    logger.be.error("Cloudinary upload failed", { fileName: file.name, error: result.error });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ url: result.url });
}
