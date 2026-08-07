import { NextResponse } from "next/server";

import { getCurrentCustomer } from "@/lib/auth/customer";

/** GET /api/auth/me — the signed-in customer's public profile. */
export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      emailVerified: customer.emailVerified,
      phoneVerified: customer.phoneVerified,
    },
  });
}
