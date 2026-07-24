import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { notifyDeploy } from "@/lib/notifications/deploy";

/**
 * POST /api/webhooks/deploy/railway
 *
 * Set up in Railway: Project → Settings → Webhooks → add one pointing here.
 * Railway gives you a signing secret at creation time — put it in
 * RAILWAY_WEBHOOK_SECRET.
 *
 * NOTE: this is written defensively because Railway's exact payload field
 * names / signature header couldn't be verified against a live webhook
 * delivery from this environment. If the shape below doesn't match what
 * Railway actually sends, the raw body is logged (never silently dropped) so
 * it can be adjusted from a real delivery.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RAILWAY_WEBHOOK_SECRET;
  const raw = await req.text();

  if (secret) {
    const signature =
      req.headers.get("x-railway-signature") ?? req.headers.get("x-webhook-signature") ?? "";
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (!signature || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      logger.server.warn("Railway deploy webhook rejected — bad or missing signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    logger.server.warn("Railway deploy webhook received with RAILWAY_WEBHOOK_SECRET unset — skipping verification");
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Best-effort field extraction — Railway's exact shape may differ; adjust
  // these once a real webhook delivery has been inspected.
  const rawStatus = String(body.status ?? body.type ?? body.event ?? "").toUpperCase();
  const project =
    typeof body.projectName === "string"
      ? body.projectName
      : typeof body.serviceName === "string"
        ? body.serviceName
        : undefined;
  const url = typeof body.url === "string" ? body.url : undefined;

  const succeeded = ["SUCCESS", "DEPLOYMENT.SUCCESS", "DEPLOY.SUCCESS"].includes(rawStatus);
  const failed = ["FAILED", "CRASHED", "DEPLOYMENT.FAILED", "DEPLOY.FAILED"].includes(rawStatus);

  if (succeeded) {
    await notifyDeploy({ platform: "railway", status: "succeeded", project, url });
  } else if (failed) {
    await notifyDeploy({ platform: "railway", status: "failed", project, url });
  } else {
    // Unrecognized shape — log the raw payload rather than silently ignore it.
    logger.server.warn("Railway deploy webhook — unrecognized payload shape", { body });
  }

  return NextResponse.json({ ok: true });
}
