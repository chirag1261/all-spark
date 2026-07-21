import crypto from "crypto";

/**
 * Minimal Cloudinary REST client (no SDK): signed uploads straight from the
 * server, so the API secret never reaches the browser. Uploaded images are
 * served from Cloudinary's CDN via the returned secure_url.
 */

export function cloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

const UPLOAD_FOLDER = "utsav-events";

export async function uploadToCloudinary(
  file: File
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  const timestamp = Math.floor(Date.now() / 1000);
  // Cloudinary signature: SHA-1 of the alphabetically-sorted params + secret.
  const signature = crypto
    .createHash("sha1")
    .update(`folder=${UPLOAD_FOLDER}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", UPLOAD_FOLDER);
  form.append("signature", signature);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });
    const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (!res.ok || !data.secure_url) {
      return {
        ok: false,
        error: data.error?.message ?? `Cloudinary upload failed (${res.status})`,
      };
    }
    return { ok: true, url: data.secure_url };
  } catch (err) {
    console.error("Cloudinary upload failed:", err);
    return { ok: false, error: "Could not reach Cloudinary" };
  }
}
