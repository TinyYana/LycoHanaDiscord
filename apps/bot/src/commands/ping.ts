import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "./types";

export const ping: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("確認 Bot 是否在線並回報 WebSocket 延遲。"),

  async execute(interaction) {
    const latency = Math.round(interaction.client.ws.ping);
    await interaction.reply({
      content: latency >= 0 ? `🏓 Pong！(${latency}ms)` : "🏓 Pong！",
      flags: MessageFlags.Ephemeral,
    });
  },
};
