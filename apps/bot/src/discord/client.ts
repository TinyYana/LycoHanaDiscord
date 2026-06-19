import { Client, GatewayIntentBits, Partials } from "discord.js";

/**
 * Discord client with the intents v3.0 needs. MessageContent is enabled
 * (operator decision, overriding the spec default) so image attachments and
 * music links can be detected for activity tracking (M3). Partials let us
 * handle reactions on uncached messages.
 */
export function createClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
  });
}
