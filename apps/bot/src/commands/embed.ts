import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command, CommandContext } from "./types";
import type { EmbedDraftStore } from "../embed-draft";
import { draftPanel, panelContent } from "../embed-draft";

export function createEmbedCommand(store: EmbedDraftStore): Command {
  return {
    data: new SlashCommandBuilder()
      .setName("embed")
      .setDescription("（管理員）建立與管理 Embed 草稿")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((subcommand) =>
        subcommand.setName("draft").setDescription("建立新的 Embed 草稿"),
      )
      .addSubcommandGroup((group) =>
        group
          .setName("template")
          .setDescription("Embed 模板")
          .addSubcommand((subcommand) => subcommand.setName("list").setDescription("列出可用模板"))
          .addSubcommand((subcommand) =>
            subcommand
              .setName("use")
              .setDescription("從模板建立草稿")
              .addStringOption((option) =>
                option
                  .setName("name")
                  .setDescription("模板名稱（完全相同）")
                  .setRequired(true)
                  .setMaxLength(100),
              ),
          ),
      ),

    async execute(interaction, ctx) {
      if (!interaction.inGuild()) {
        await interaction.reply({ content: "請在伺服器內使用。", flags: MessageFlags.Ephemeral });
        return;
      }
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "此指令僅限管理員。", flags: MessageFlags.Ephemeral });
        return;
      }

      const group = interaction.options.getSubcommandGroup(false);
      const subcommand = interaction.options.getSubcommand();
      const route = group ? `${group}:${subcommand}` : subcommand;
      const handlers: Record<string, () => Promise<void>> = {
        draft: () => createDraft(interaction, store),
        "template:list": () => listTemplates(interaction, ctx),
        "template:use": () => useTemplate(interaction, ctx, store),
      };
      await handlers[route]?.();
    },
  };
}

async function createDraft(
  interaction: ChatInputCommandInteraction,
  store: EmbedDraftStore,
): Promise<void> {
  if (!interaction.guildId) return;
  const draft = store.create(interaction.guildId, interaction.user.id);
  await interaction.reply({
    content: panelContent(draft),
    components: draftPanel(draft),
    flags: MessageFlags.Ephemeral,
  });
}

async function listTemplates(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  if (!interaction.guildId) return;
  const templates = await ctx.repos.embedTemplate.list(interaction.guildId);
  const content = templates.length
    ? `可用模板：\n${templates.map((template) => `• ${template.name}`).join("\n")}`
    : "目前沒有可用模板。";
  await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

async function useTemplate(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
  store: EmbedDraftStore,
): Promise<void> {
  if (!interaction.guildId) return;
  const name = interaction.options.getString("name", true);
  const template = await ctx.repos.embedTemplate.getByName(interaction.guildId, name);
  if (!template) {
    await interaction.reply({ content: `找不到模板 **${name}**。`, flags: MessageFlags.Ephemeral });
    return;
  }
  const draft = store.create(interaction.guildId, interaction.user.id, template.payload);
  await interaction.reply({
    content: `${panelContent(draft)}\n已載入模板：**${template.name}**`,
    components: draftPanel(draft),
    flags: MessageFlags.Ephemeral,
  });
}
