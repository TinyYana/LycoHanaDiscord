import type { Command } from "./types";
import { ping } from "./ping";
import { activity } from "./activity";
import { config } from "./config";
import { roleMenu } from "./role-menu";
import { createEmbedCommand } from "./embed";
import { honeypot } from "./honeypot";
import type { EmbedDraftStore } from "../embed-draft";

/** Build every slash command, sharing the in-memory Embed draft store. */
export function createCommands(embedDrafts: EmbedDraftStore): Command[] {
  return [ping, activity, config, roleMenu, createEmbedCommand(embedDrafts), honeypot];
}
