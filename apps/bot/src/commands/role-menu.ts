import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type SlashCommandSubcommandBuilder,
} from "discord.js";
import type { Command } from "./types";
import { createRoleMenu, MAX_ROLE_MENU_OPTIONS } from "../role-menu";

const data = new SlashCommandBuilder()
  .setName("role-menu")
  .setDescription("（管理員）建立自助身分組選單")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((subcommand) => {
    // Discord requires all required options before optional ones, so the
    // required title/channel + role_1/label_1 come first, then the optional
    // availability window last.
    subcommand
      .setName("create")
      .setDescription("建立按鈕身分組選單")
      .addStringOption((option) =>
        option.setName("title").setDescription("選單標題").setRequired(true).setMaxLength(100),
      )
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("發送頻道")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true),
      );
    addRoleOptions(subcommand);
    subcommand
      .addStringOption((option) =>
        option.setName("available_from").setDescription("開始時間（ISO 8601，可省略）"),
      )
      .addStringOption((option) =>
        option.setName("available_until").setDescription("結束時間（ISO 8601，可省略）"),
      );
    return subcommand;
  });

export const roleMenu: Command = {
  data,
  async execute(interaction, ctx) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "此指令僅限管理員。", flags: MessageFlags.Ephemeral });
      return;
    }
    await createRoleMenu(interaction, ctx);
  },
};

function addRoleOptions(subcommand: SlashCommandSubcommandBuilder): void {
  for (let index = 1; index <= MAX_ROLE_MENU_OPTIONS; index += 1) {
    subcommand.addRoleOption((option) =>
      option
        .setName(`role_${index}`)
        .setDescription(`身分組 ${index}`)
        .setRequired(index === 1),
    );
    subcommand.addStringOption((option) =>
      option
        .setName(`label_${index}`)
        .setDescription(`按鈕文字 ${index}`)
        .setMaxLength(80)
        .setRequired(index === 1),
    );
  }
}
