import type { Command } from "./types";
import { ping } from "./ping";
import { activity } from "./activity";
import { createConfigCommand } from "./config";
import { roleMenu } from "./role-menu";
import { createEmbedCommand } from "./embed";
import { honeypot } from "./honeypot";
import type { EmbedDraftStore } from "../embed-draft";
import type { Messages } from "../messages";

/** Build every slash command, sharing the in-memory Embed draft store. */
export function createCommands(embedDrafts: EmbedDraftStore, messages: Messages): Command[] {
  return [
    ping,
    activity,
    createConfigCommand(messages),
    roleMenu,
    createEmbedCommand(embedDrafts),
    honeypot,
  ];
}
