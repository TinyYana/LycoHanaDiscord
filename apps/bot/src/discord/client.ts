import { Client, GatewayIntentBits } from "discord.js";

/**
 * Discord client with only the intents v3.0 needs (spec M2). MessageContent
 * is intentionally NOT enabled — a hard rule across the project; activity and
 * honeypot detection never read message text.
 */
export function createClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
    ],
  });
}
