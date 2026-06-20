import {
  type Client,
  Events,
  type GuildMember,
  type Message,
  PermissionFlagsBits,
} from "discord.js";
import type { HoneypotChannel, Repositories } from "@lycohana/db";
import type { ModerationLog } from "../moderation";
import type { Logger } from "../logger";
import { errMessage } from "../errors";

/** Discord caps a member timeout at 28 days. */
const DISCORD_MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

export interface HoneypotDeps {
  repos: Repositories;
  logger: Logger;
  moderationLog: ModerationLog;
  /** Fallback timeout when a honeypot channel has no per-channel duration. */
  defaultTimeoutSeconds: number;
}

/**
 * Honeypot enforcement (spec §5.7, M8): any non-staff human who posts in a
 * decoy channel has their message removed and the configured action applied
 * (timeout by default, or ban), with the action recorded to the moderation log.
 */
export function registerHoneypot(client: Client, deps: HoneypotDeps): void {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message.inGuild()) return;
      if (message.author.bot || message.system) return;
      const honeypot = await deps.repos.honeypot.getByChannel(message.channelId);
      if (!honeypot) return;
      await enforce(message, honeypot, deps);
    } catch (error) {
      deps.logger.error("honeypot failed", { error: errMessage(error) });
    }
  });
}

async function enforce(
  message: Message<true>,
  honeypot: HoneypotChannel,
  deps: HoneypotDeps,
): Promise<void> {
  const member =
    message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (!member || isStaff(member)) return; // never punish staff or the owner

  await message.delete().catch((error) => {
    deps.logger.error("honeypot: message delete failed", {
      guild: message.guildId,
      channel: message.channelId,
      error: errMessage(error),
    });
  });

  const reason = "honeypot：於誘捕頻道發言";
  const acted =
    honeypot.action === "ban"
      ? await banMember(member, reason, deps)
      : await timeoutMember(member, honeypot, reason, deps);
  if (!acted) return;

  await deps.moderationLog.record(message.guild, {
    action: `honeypot_${honeypot.action}`,
    targetUserId: member.id,
    moderatorId: null,
    reason,
    messageRef: `${message.channelId}/${message.id}`,
  });
}

function isStaff(member: GuildMember): boolean {
  return (
    member.id === member.guild.ownerId || member.permissions.has(PermissionFlagsBits.ManageMessages)
  );
}

async function timeoutMember(
  member: GuildMember,
  honeypot: HoneypotChannel,
  reason: string,
  deps: HoneypotDeps,
): Promise<boolean> {
  if (!member.moderatable) {
    deps.logger.error("honeypot: cannot timeout member", {
      guild: member.guild.id,
      member: member.id,
    });
    return false;
  }
  const seconds = honeypot.timeoutSeconds ?? deps.defaultTimeoutSeconds;
  const ms = Math.min(seconds * 1000, DISCORD_MAX_TIMEOUT_MS);
  try {
    await member.timeout(ms, reason);
    return true;
  } catch (error) {
    deps.logger.error("honeypot: timeout failed", {
      guild: member.guild.id,
      member: member.id,
      error: errMessage(error),
    });
    return false;
  }
}

async function banMember(
  member: GuildMember,
  reason: string,
  deps: HoneypotDeps,
): Promise<boolean> {
  if (!member.bannable) {
    deps.logger.error("honeypot: cannot ban member", {
      guild: member.guild.id,
      member: member.id,
    });
    return false;
  }
  try {
    await member.ban({ reason });
    return true;
  } catch (error) {
    deps.logger.error("honeypot: ban failed", {
      guild: member.guild.id,
      member: member.id,
      error: errMessage(error),
    });
    return false;
  }
}
