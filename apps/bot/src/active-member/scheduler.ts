import { schedule, validate } from "node-cron";
import type { Client } from "discord.js";
import { runActiveMemberSweep, type ActiveMemberDeps } from "./sweep";

/**
 * Schedule the daily active-member sweep. Reads guilds from the client's cache
 * at fire time, so it must be set up on a logged-in client.
 */
export function scheduleActiveMemberSweep(
  client: Client,
  deps: ActiveMemberDeps,
  cronExpr: string,
): void {
  if (!validate(cronExpr)) {
    deps.logger.error("invalid ACTIVE_MEMBER_CRON; sweep not scheduled", { cron: cronExpr });
    return;
  }

  schedule(cronExpr, () => void runActiveMemberSweep(client.guilds.cache.values(), deps), {
    timezone: deps.timeZone,
  });
  deps.logger.info("active member sweep scheduled", { cron: cronExpr, timeZone: deps.timeZone });
}
