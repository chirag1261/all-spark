import { NextRequest, NextResponse } from "next/server";

import { getCurrentCustomer, normalizeIdentifier } from "@/lib/auth/customer";
import { getCustomerByIdentifier, updateCustomer } from "@/lib/db";

/**
 * PUT /api/account — Body: { name, email? }
 * Updates the signed-in customer's profile. Changing the email address marks
 * it UNVERIFIED again (they'll re-verify it next time they use it to sign in
 * via OTP) — an unverified email must never keep showing a stale "Verified" badge.
 */
export async function PUT(req: NextRequest) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: "Name must be 2–80 characters" }, { status: 400 });
  }

  // Email is optional in the payload — omit it to leave the address untouched.
  let email = customer.email;
  let emailVerified = customer.emailVerified;
  if (body.email !== undefined) {
    const raw = typeof body.email === "string" ? body.email.trim() : "";
    if (!raw) {
      if (!customer.phone) {
        return NextResponse.json(
          { error: "Add a phone number before removing your email — you need one way to sign in" },
          { status: 400 }
        );
      }
      email = null;
      emailVerified = false;
    } else {
      const normalized = normalizeIdentifier(raw);
      if (!normalized || normalized.channel !== "email") {
        return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
      }
      if (normalized.identifier !== customer.email) {
        const owner = await getCustomerByIdentifier(normalized.identifier);
        if (owner && owner.id !== customer.id) {
          return NextResponse.json(
            { error: "That email is already in use by another account" },
            { status: 409 }
          );
        }
        email = normalized.identifier;
        emailVerified = false; // unverified until they next sign in with it via OTP
      }
    }
  }

  const updated = await updateCustomer(customer.id, { name, email, emailVerified });
  return NextResponse.json({
    ok: true,
    customer: {
      id: updated!.id,
      name: updated!.name,
      email: updated!.email,
      emailVerified: updated!.emailVerified,
    },
  });
}
