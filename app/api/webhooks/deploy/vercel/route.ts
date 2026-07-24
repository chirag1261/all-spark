import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { notifyDeploy } from "@/lib/notifications/deploy";

/**
 * POST /api/webhooks/deploy/vercel
 *
 * Set up in Vercel: Project/Account Settings → Webhooks → create one for
 * `deployment.succeeded` and `deployment.error`, pointing here. Vercel gives
 * you a signing secret at creation time — put it in VERCEL_WEBHOOK_SECRET.
 *
 * Verifies the `x-vercel-signature` header (HMAC-SHA1 of the raw body) before
 * trusting the payload — never parse/act on an unverified webhook body.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  const raw = await req.text();

  if (secret) {
    const signature = req.headers.get("x-vercel-signature") ?? "";
    const expected = crypto.createHmac("sha1", secret).update(raw).digest("hex");
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      logger.server.warn("Vercel deploy webhook rejected — bad signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    logger.server.warn("Vercel deploy webhook received with VERCEL_WEBHOOK_SECRET unset — skipping verification");
  }

  let body: { type?: string; payload?: Record<string, unknown> };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type = body.type ?? "";
  const payload = body.payload ?? {};
  const project = typeof payload.name === "string" ? payload.name : undefined;
  const url = typeof payload.url === "string" ? `https://${payload.url}` : undefined;

  if (type === "deployment.succeeded") {
    await notifyDeploy({ platform: "vercel", status: "succeeded", project, url });
  } else if (type === "deployment.error") {
    const errMessage =
      payload.error && typeof payload.error === "object" && "message" in payload.error
        ? String((payload.error as { message: unknown }).message)
        : undefined;
    await notifyDeploy({ platform: "vercel", status: "failed", project, url, error: errMessage });
  }
  // Other event types (deployment.created, etc.) are intentionally ignored.

  return NextResponse.json({ ok: true });
}
