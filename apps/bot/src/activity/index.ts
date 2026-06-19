import type { Client } from "discord.js";
import { registerMessageTracking } from "./message-tracker";
import { registerVoiceTracking } from "./voice-tracker";
import { registerReactionTracking } from "./reaction-tracker";
import type { ActivityTrackerDeps } from "./shared";

/** Attach all activity-tracking listeners to the client (spec §2.1, M3). */
export function registerActivityTracking(client: Client, deps: ActivityTrackerDeps): void {
  registerMessageTracking(client, deps);
  registerVoiceTracking(client, deps);
  registerReactionTracking(client, deps);
}
