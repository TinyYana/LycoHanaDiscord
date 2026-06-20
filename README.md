# LycoHana Discord Bot v3.0

The community-operations bot for the LycoHana Discord server. It keeps activity tracking, roles, welcome messages, embeds, and basic safeguards in one maintainable workflow without turning a community tool into an entire platform.

[繁體中文](./README.zh-TW.md) · **English** · [Operator guide (繁體中文)](./docs/USER_GUIDE.zh-TW.md) · [Feature spec (繁體中文)](./docs/SPEC.zh-TW.md)

## What this project does

This is the third version of the bot I maintain for the LycoHana Discord community. It handles the repetitive parts of community operations that should not require someone to watch them every day: activity summaries, active-member roles, self-service role menus, welcome messages, embeds, and a small moderation safety net.

The scope is deliberately limited to the community-operations core. It is not a general Discord bot platform and it does not have a separate web dashboard; configuration lives in slash commands and environment variables.

## Current features

- **Activity traces:** aggregates daily chat, image, music-share, reply/reaction, and voice activity without storing raw message content.
- **Active-member roles:** grants and removes a role using separate high and low thresholds, with exempt roles for members who should not be changed automatically.
- **Self-service role menus:** creates button-based role menus with optional availability windows.
- **Welcome and private leave logs:** sends welcome messages and keeps departure logs in an administrator-selected channel.
- **Embed drafts and templates:** previews and confirms embeds in an ephemeral admin workflow before sending; templates are persisted while unfinished drafts remain in memory.
- **Honeypot channels:** deletes messages from non-staff members in decoy channels, then applies a configured timeout or ban and records the action.
- **Dynamic voice channels:** creates a member-owned voice channel when someone joins a configured entry channel, then removes it after everyone leaves.
- **Per-guild configuration:** stores channel, threshold, weight, and role IDs in the database instead of hard-coding them.

## Stack and structure

- Node.js 20+, TypeScript, and discord.js v14
- pnpm workspace monorepo
- Drizzle ORM and PostgreSQL (currently Supabase)
- Zod, Pino, and node-cron

```text
apps/bot/         Discord client, commands, events, schedules, and interactions
packages/db/      Drizzle schema, migrations, database client, and repositories
packages/domain/  Scoring, thresholds, time, and validation logic without discord.js
```

## Prerequisites

You will need:

- Node.js 20 or newer
- pnpm
- A Discord Application / Bot
- A PostgreSQL database; the current configuration and migrations target Supabase PostgreSQL

Enable these options under the Bot page in the Discord Developer Portal:

- **Server Members Intent**
- **Message Content Intent**

Invite the bot with the `bot` and `applications.commands` scopes. Grant only the permissions required by the features you use. Common permissions are:

- View Channels, Send Messages, and Embed Links
- Manage Roles for active-member and self-service roles
- Manage Channels, Manage Roles, and Move Members for dynamic voice channels
- Manage Messages, Moderate Members, and Ban Members for honeypot channels

The bot's role must sit above every role and member it needs to manage. Discord's role hierarchy still applies even when the permission checkbox looks correct.

## Install and run

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the environment template:

   ```powershell
   Copy-Item .env.example .env
   ```

   On macOS or Linux:

   ```bash
   cp .env.example .env
   ```

3. Fill in the three required values in `.env`:

   ```dotenv
   DISCORD_TOKEN=
   DISCORD_CLIENT_ID=
   DATABASE_URL=postgresql://...
   ```

   Set `DISCORD_GUILD_ID` during development to register slash commands to one guild, where changes usually appear immediately. Without it, the bot registers commands globally.

   `DATABASE_URL` may use a Supabase direct connection on port 5432 or the transaction pooler on port 6543. The client requires SSL and disables prepared statements for compatibility with both connection types. Never commit `.env`, and do not paste bot tokens or database credentials into issues, logs, or screenshots.

4. Apply database migrations:

   ```bash
   pnpm db:migrate
   ```

5. Build and start the bot:

   ```bash
   pnpm build
   pnpm --filter @lycohana/bot start
   ```

For development with file watching:

```bash
pnpm dev
```

On each start, the bot synchronizes its slash-command definitions before logging in to Discord.

## Environment variables

See [`.env.example`](./.env.example) for the complete list and defaults.

| Variable                   | Required | Purpose                                                  |
| -------------------------- | -------- | -------------------------------------------------------- |
| `DISCORD_TOKEN`            | Yes      | Discord Bot token                                        |
| `DISCORD_CLIENT_ID`        | Yes      | Discord Application ID                                   |
| `DATABASE_URL`             | Yes      | PostgreSQL / Supabase connection string                  |
| `DISCORD_GUILD_ID`         | No       | Register commands to one development guild               |
| `NODE_ENV`                 | No       | `development`, `production`, or `test`                   |
| `LOG_LEVEL`                | No       | `debug`, `info`, `warn`, or `error`                      |
| `ACTIVITY_*`               | No       | Time zone, chat cooldown, voice cap, and interaction cap |
| `ACTIVE_MEMBER_*`          | No       | Active-member calculation window and schedule            |
| `EMBED_DRAFT_TTL_MINUTES`  | No       | Lifetime of in-memory embed drafts                       |
| `HONEYPOT_TIMEOUT_SECONDS` | No       | Default honeypot timeout in seconds                      |

The bot connects directly to PostgreSQL and does not require the Supabase Data API. If the project's `public` schema is exposed through the Data API, separately restrict API-role privileges or enable RLS policies that match the real access model. A bot-only table is not automatically unreachable from the API.

## Slash commands

| Command               | Access         | Purpose                                                               |
| --------------------- | -------------- | --------------------------------------------------------------------- |
| `/ping`               | Everyone       | Check bot availability and latency                                    |
| `/activity me`        | Everyone       | View the caller's activity traces for the current month               |
| `/activity stats`     | Administrators | View server activity and threshold distribution                       |
| `/config ...`         | Administrators | Configure active roles, thresholds, weights, exemptions, and channels |
| `/role-menu create`   | Administrators | Create a permanent or time-limited self-service role menu             |
| `/embed draft`        | Administrators | Create, preview, and send an embed draft                              |
| `/embed template ...` | Administrators | List or load saved templates                                          |
| `/honeypot ...`       | Administrators | Add, remove, or list honeypot channels                                |

## Data and privacy boundaries

Activity tracking stores per-member daily counters, not message bodies. Image and music-share detection still reads attachment metadata and message content, which is why the Message Content Intent is required, but that content is not written to the database.

Chat cooldowns, active voice sessions, and unfinished embed drafts live only in memory and disappear after a restart. Completed daily aggregates, guild configuration, dynamic-voice ownership records, templates, and moderation logs remain in PostgreSQL. Persisting dynamic-voice ownership lets startup reconciliation safely remove empty bot-created channels without guessing from their names.

## Development scripts

| Command             | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `pnpm build`        | Build every workspace package                |
| `pnpm dev`          | Run the bot with file watching               |
| `pnpm typecheck`    | Run the TypeScript type check                |
| `pnpm lint`         | Run ESLint across the workspace              |
| `pnpm format`       | Write formatting with Prettier               |
| `pnpm format:check` | Check formatting without modifying files     |
| `pnpm db:generate`  | Generate a migration from the Drizzle schema |
| `pnpm db:migrate`   | Apply existing migrations to the database    |

## License

This repository is licensed under the [TinyYana Universal Software License 1.0](./LICENSE). You may inspect, use, modify, distribute, and integrate the code into personal or commercial projects. Prior written permission is required if the bot, its functions, or its interface will become the main component of a directly monetized product or paid service.

This README is only a summary; `LICENSE` controls. For licensing or commercial-use questions, contact [admin@tinyyana.com](mailto:admin@tinyyana.com).
