import { logger } from "@/lib/logger";

import { sendLogAlertEmail } from "./email";

export type DeployPlatform = "vercel" | "railway";
export type DeployStatus = "succeeded" | "failed";

interface DeployEvent {
  platform: DeployPlatform;
  status: DeployStatus;
  project?: string;
  url?: string;
  error?: string;
}

/**
 * Notifies on a deployment's outcome — success OR failure, unlike the general
 * logger.ts alert pipeline (which only fires on warn/error). Called from the
 * Vercel/Railway webhook routes. Always emails via sendLogAlertEmail directly
 * so a successful deploy is reported too, not just a failed one.
 */
export async function notifyDeploy(event: DeployEvent): Promise<void> {
  const { platform, status, project, url, error } = event;
  const label = `${platform} deploy ${status}`;
  const lines = [
    `Platform: ${platform}`,
    `Status: ${status}`,
    ...(project ? [`Project: ${project}`] : []),
    ...(url ? [`URL: ${url}`] : []),
    ...(error ? [`Error: ${error}`] : []),
  ].join("\n");

  if (status === "failed") {
    logger.server.error(label, { platform, project, url, error });
  } else {
    logger.server.info(label, { platform, project, url });
  }

  await sendLogAlertEmail(
    `[Utsav Events] ${status === "succeeded" ? "✅" : "❌"} ${platform} deploy ${status}${project ? ` — ${project}` : ""}`,
    lines
  );
}
