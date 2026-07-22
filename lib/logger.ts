/**
 * Centralised logger — structured console output on every tier (FE/BE/DB/Server)
 * plus optional WhatsApp group alerts via a webhook URL.
 *
 * Set WHATSAPP_WEBHOOK_URL in .env.local to a CallMeBot / Green-API / Meta
 * Cloud API endpoint that accepts { text } in the POST body.
 * Without it, alerts are only written to the console.
 */

type Level = "info" | "warn" | "error" | "debug";
type Tier = "FE" | "BE" | "DB" | "SERVER";

interface LogEntry {
  level: Level;
  tier: Tier;
  message: string;
  data?: unknown;
}

function fmt({ level, tier, message, data }: LogEntry): string {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] [${tier}] ${message}`;
  return data !== undefined ? `${base} ${JSON.stringify(data)}` : base;
}

function write(entry: LogEntry) {
  const line = fmt(entry);
  if (entry.level === "error") console.error(line);
  else if (entry.level === "warn") console.warn(line);
  else console.log(line);
}

/** Fire-and-forget WhatsApp alert for warn/error events. */
async function alertWhatsApp(entry: LogEntry) {
  const url = process.env.WHATSAPP_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: fmt(entry) }),
    });
  } catch {
    // Never let an alert failure break the main flow.
  }
}

function log(tier: Tier, level: Level, message: string, data?: unknown) {
  const entry: LogEntry = { level, tier, message, data };
  write(entry);
  if (level === "warn" || level === "error") {
    void alertWhatsApp(entry);
  }
}

export const logger = {
  /** Front-end events (client components, browser actions). */
  fe: {
    info: (msg: string, data?: unknown) => log("FE", "info", msg, data),
    warn: (msg: string, data?: unknown) => log("FE", "warn", msg, data),
    error: (msg: string, data?: unknown) => log("FE", "error", msg, data),
    debug: (msg: string, data?: unknown) => log("FE", "debug", msg, data),
  },
  /** Back-end API route events. */
  be: {
    info: (msg: string, data?: unknown) => log("BE", "info", msg, data),
    warn: (msg: string, data?: unknown) => log("BE", "warn", msg, data),
    error: (msg: string, data?: unknown) => log("BE", "error", msg, data),
    debug: (msg: string, data?: unknown) => log("BE", "debug", msg, data),
  },
  /** Database-layer events. */
  db: {
    info: (msg: string, data?: unknown) => log("DB", "info", msg, data),
    warn: (msg: string, data?: unknown) => log("DB", "warn", msg, data),
    error: (msg: string, data?: unknown) => log("DB", "error", msg, data),
    debug: (msg: string, data?: unknown) => log("DB", "debug", msg, data),
  },
  /** Server / infrastructure events (startup, seed, pool). */
  server: {
    info: (msg: string, data?: unknown) => log("SERVER", "info", msg, data),
    warn: (msg: string, data?: unknown) => log("SERVER", "warn", msg, data),
    error: (msg: string, data?: unknown) => log("SERVER", "error", msg, data),
    debug: (msg: string, data?: unknown) => log("SERVER", "debug", msg, data),
  },
};
