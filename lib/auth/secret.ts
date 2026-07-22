/**
 * The single HMAC key used to sign session cookies and hash OTPs.
 *
 * Security: this key is the root of trust for auth — anyone who knows it can
 * forge admin/customer session cookies. So in production we REQUIRE a dedicated,
 * sufficiently long secret and refuse to fall back to the admin password or a
 * hard-coded string (both of which would be guessable/known). In development we
 * allow a fixed fallback so local work needs no setup.
 */
const MIN_SECRET_LEN = 16;

export function sessionSecret(): string {
  const configured = process.env.AUTH_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || "";

  if (configured.length >= MIN_SECRET_LEN) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SESSION_SECRET (or ADMIN_SESSION_SECRET) must be set to a random value of at least " +
        `${MIN_SECRET_LEN} characters in production. Generate one with: openssl rand -hex 32`
    );
  }

  // Development only — never reached in production (throws above).
  return configured || "dev-only-insecure-session-secret";
}
