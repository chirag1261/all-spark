import { NextRequest, NextResponse } from "next/server";

import { clientKey, rateLimit } from "@/lib/http/ratelimit";
import { logger } from "@/lib/logger";
import { sendContactMessage } from "@/lib/notifications/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/contact — public "get in touch" form. Rate-limited; emails the team. */
export async function POST(req: NextRequest) {
  // Public + unauthenticated → keep it spam-resistant.
  if (!rateLimit(`contact:${clientKey(req)}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "Too many messages — please wait a minute and try again." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const phone = str(body.phone);
  const topic = str(body.topic);
  const message = str(body.message);

  if (name.length < 2) return NextResponse.json({ error: "Please enter your name" }, { status: 400 });
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email" }, { status: 400 });
  }
  if (message.length < 5) {
    return NextResponse.json({ error: "Please enter a message" }, { status: 400 });
  }

  const { sent } = await sendContactMessage({
    name,
    email,
    phone: phone || undefined,
    topic: topic || undefined,
    message: message.slice(0, 4000),
  });
  if (!sent) {
    logger.be.warn("Contact message could not be emailed", { email, topic });
  }

  // Always confirm receipt — even if delivery is pending, the message is logged.
  return NextResponse.json({ ok: true });
}
