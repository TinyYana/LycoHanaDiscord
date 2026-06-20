import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import type { CommandContext } from "../commands/types";
import { roleMenuCustomId } from "./custom-id";

export const MAX_ROLE_MENU_OPTIONS = 5;

interface Availability {
  availableFrom: Date | null;
  availableUntil: Date | null;
}

interface MenuOptionInput {
  roleId: string;
  label: string;
  emoji: null;
}

type InputResult<T> = { ok: true; value: T } | { ok: false; message: string };

export async function createRoleMenu(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await reply(interaction, "請在伺服器內使用。");
    return;
  }

  const channel = resolveTargetChannel(interaction);
  const availability = readAvailability(interaction);
  const options = readMenuOptions(interaction);
  const error = firstError(channel, availability, options);
  if (error) {
    await reply(interaction, error);
    return;
  }
  if (!channel.ok || !availability.ok || !options.ok) return;
  if (!canPost(interaction, channel.value)) {
    await reply(interaction, "我沒有在該頻道檢視或發送訊息的權限。");
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const created = await ctx.repos.roleMenu.create({
    menu: {
      guildId: interaction.guildId,
      channelId: channel.value.id,
      title: interaction.options.getString("title", true),
      ...availability.value,
    },
    options: options.value,
  });
  const message = await channel.value.send({
    content: `**${created.menu.title}**`,
    components: buildRows(created.menu.id, created.options),
  });
  await ctx.repos.roleMenu.setMessageId(created.menu.id, message.id);
  ctx.logger.info("role menu created", {
    guild: interaction.guildId,
    menuId: created.menu.id,
    channel: channel.value.id,
    options: options.value.length,
  });
  await interaction.editReply(`已在 <#${channel.value.id}> 建立身分組選單。`);
}

function resolveTargetChannel(
  interaction: ChatInputCommandInteraction<"cached">,
): InputResult<GuildTextBasedChannel> {
  const channel = interaction.options.getChannel("channel", true);
  if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
    return { ok: true, value: channel };
  }
  return { ok: false, message: "請選擇文字或公告頻道。" };
}

function readAvailability(interaction: ChatInputCommandInteraction): InputResult<Availability> {
  const availableFrom = parseOptionalDate(interaction.options.getString("available_from"));
  const availableUntil = parseOptionalDate(interaction.options.getString("available_until"));
  if (availableFrom === undefined || availableUntil === undefined) {
    return { ok: false, message: "期間請使用有效的 ISO 8601 時間。" };
  }
  if (availableFrom && availableUntil && availableFrom >= availableUntil) {
    return { ok: false, message: "結束時間必須晚於開始時間。" };
  }
  return { ok: true, value: { availableFrom, availableUntil } };
}

function readMenuOptions(interaction: ChatInputCommandInteraction): InputResult<MenuOptionInput[]> {
  const options: MenuOptionInput[] = [];
  for (let index = 1; index <= MAX_ROLE_MENU_OPTIONS; index += 1) {
    const role = interaction.options.getRole(`role_${index}`);
    const label = interaction.options.getString(`label_${index}`);
    if (Boolean(role) !== Boolean(label)) {
      return { ok: false, message: `身分組 ${index} 與按鈕文字必須一起填寫。` };
    }
    if (role && label) options.push({ roleId: role.id, label, emoji: null });
  }
  return { ok: true, value: options };
}

function parseOptionalDate(value: string | null): Date | null | undefined {
  if (!value) return null;
  const milliseconds = Date.parse(value);
  return Number.isNaN(milliseconds) ? undefined : new Date(milliseconds);
}

function firstError(...results: InputResult<unknown>[]): string | undefined {
  return results.find((result) => !result.ok)?.message;
}

function canPost(
  interaction: ChatInputCommandInteraction<"cached">,
  channel: GuildTextBasedChannel,
): boolean {
  const me = interaction.guild.members.me;
  return Boolean(
    me &&
    channel
      .permissionsFor(me)
      .has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]),
  );
}

function buildRows(
  menuId: number,
  options: Array<{ id: number; label: string }>,
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let offset = 0; offset < options.length; offset += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        options
          .slice(offset, offset + 5)
          .map((option) =>
            new ButtonBuilder()
              .setCustomId(roleMenuCustomId(menuId, option.id))
              .setLabel(option.label)
              .setStyle(ButtonStyle.Secondary),
          ),
      ),
    );
  }
  return rows;
}

async function reply(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
  await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}
