import { ApplicationCommandOptionType, ChannelType } from "discord.js";
import { describe, expect, it } from "vitest";
import { config } from "./config";

describe("/config dynamic-voice", () => {
  it("accepts an enabled flag and a voice-only trigger channel", () => {
    const command = config.data.toJSON();
    const subcommand = command.options?.find((option) => option.name === "dynamic-voice");

    expect(subcommand?.type).toBe(ApplicationCommandOptionType.Subcommand);
    if (subcommand?.type !== ApplicationCommandOptionType.Subcommand) return;

    const enabled = subcommand.options?.find((option) => option.name === "enabled");
    const channel = subcommand.options?.find((option) => option.name === "channel");
    expect(enabled).toMatchObject({
      type: ApplicationCommandOptionType.Boolean,
      required: true,
    });
    expect(channel).toMatchObject({
      type: ApplicationCommandOptionType.Channel,
      channel_types: [ChannelType.GuildVoice],
    });
  });
});
