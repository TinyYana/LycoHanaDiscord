import { schedule, type ScheduledTask, validate } from "node-cron";
import type { Client } from "discord.js";
import { errMessage } from "../errors";
import {
  type ActiveMemberDeps,
  type ActiveMemberSweepResult,
  emptySweep,
  logSweepSkip,
  runActiveMemberSweep,
} from "./sweep";

export interface ActiveMemberScheduleDeps extends ActiveMemberDeps {
  /** Receives every sweep outcome, including skipped and failed ones. */
  recordResult(result: ActiveMemberSweepResult): void;
}

/**
 * One scheduled run: sweep the client's cached guilds, or record a skip when
 * the client is not ready yet (its guild cache would be empty).
 */
async function runScheduledSweep(
  client: Client,
  deps: ActiveMemberScheduleDeps,
): Promise<ActiveMemberSweepResult> {
  let result: ActiveMemberSweepResult;
  if (!client.isReady()) {
    logSweepSkip(deps, "client-not-ready");
    result = emptySweep("skipped", "client-not-ready");
  } else {
    try {
      result = await runActiveMemberSweep(client.guilds.cache.values(), deps);
    } catch (error) {
      deps.logger.error("active member sweep crashed", { error: errMessage(error) });
      result = emptySweep("failed", errMessage(error));
    }
  }
  deps.recordResult(result);
  return result;
}

/**
 * Schedule the daily active-member sweep. Returns the cron task so the caller
 * can stop it on shutdown, or undefined when the expression is invalid.
 */
export function scheduleActiveMemberSweep(
  client: Client,
  deps: ActiveMemberScheduleDeps,
  cronExpr: string,
): ScheduledTask | undefined {
  if (!validate(cronExpr)) {
    deps.logger.error("invalid ACTIVE_MEMBER_CRON; sweep not scheduled", { cron: cronExpr });
    return undefined;
  }

  const task = schedule(cronExpr, () => void runScheduledSweep(client, deps), {
    timezone: deps.timeZone,
  });
  deps.logger.info("active member sweep scheduled", { cron: cronExpr, timeZone: deps.timeZone });
  return task;
}
