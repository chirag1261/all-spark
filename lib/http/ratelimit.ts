/**
 * Tiny in-memory sliding-window rate limiter (per-process, like the rest of
 * the demo store). Production would use Redis so limits hold across instances.
 */

const g = globalThis as typeof globalThis & { __rateBuckets?: Map<string, number[]> };

function buckets(): Map<string, number[]> {
  if (!g.__rateBuckets) g.__rateBuckets = new Map();
  return g.__rateBuckets;
}

/** Returns true when the caller is within `limit` hits per `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const all = buckets();
  const hits = (all.get(key) ?? []).filter((t) => t > now - windowMs);
  if (hits.length >= limit) {
    all.set(key, hits);
    return false;
  }
  hits.push(now);
  all.set(key, hits);
  return true;
}

/** Best-effort client identity behind proxies/CDNs. */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0].trim() || "local";
}
