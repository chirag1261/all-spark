/** App-wide constants. Domain limits live here so both the API and UI agree. */

export const MAX_SEATS_PER_BOOKING = 10;
export const MAX_TOTAL_ROWS = 26; // rows are lettered A–Z
export const MAX_GALLERY_PHOTOS = 12;

// ---------- Image uploads ----------
// Admins may only upload small, modern-format images. Enforced on the server
// (authoritative) and mirrored in the UI for instant feedback.
export const MAX_UPLOAD_BYTES = 1024 * 1024; // 1 MB
export const ALLOWED_IMAGE_TYPES = ["image/webp", "image/avif"] as const;
/** For the file picker's `accept` attribute. */
export const ALLOWED_IMAGE_ACCEPT = ".webp,.avif,image/webp,image/avif";

/** BookMyShow wordmark, hosted on our Cloudinary and served optimized. */
export const BOOKMYSHOW_LOGO_URL =
  "https://res.cloudinary.com/cih7cika/image/upload/f_auto,q_auto,h_40/utsav-events/bookmyshow-logo";

/** Validates an upload's format + size. Returns an error message, or null if OK. */
export function validateImageUpload(file: { name: string; type: string; size: number }): string | null {
  const okType =
    (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type) ||
    /\.(webp|avif)$/i.test(file.name);
  if (!okType) return "Only .webp or .avif images are allowed";
  if (file.size > MAX_UPLOAD_BYTES) return "Image must be 1 MB or smaller";
  return null;
}
