/**
 * SMS delivery abstraction. No provider account exists yet, so:
 * - With TWILIO_* env vars set, sends via Twilio's REST API (no SDK needed).
 * - Without a provider, logs the message to the SERVER console only (visible
 *   to the developer, never to the browser) so the OTP flow stays testable.
 *   The OTP is never included in any API response either way.
 */

export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM
  );
}

export async function sendSms(to: string, body: string): Promise<{ sent: boolean }> {
  if (!smsConfigured()) {
    console.log(`[sms:dev] To ${to}: ${body}`);
    return { sent: true }; // dev delivery — the server console is the "phone"
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM!, Body: body }),
    });
    if (!res.ok) {
      console.error("SMS send failed:", res.status, await res.text());
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error("SMS send failed:", err);
    return { sent: false };
  }
}
