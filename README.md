# 彼岸花 Bot v3.0

Discord community-operations bot for the LycoHana server.

## Stack

- TypeScript · discord.js v14 · Drizzle ORM
- pnpm monorepo
- **Database:** Drizzle + SQLite (dev substitute for PostgreSQL)

## Layout

```
apps/bot         Discord client, commands, events, scheduling
packages/db      Drizzle schema, migrations, db client, repositories
packages/domain  Pure logic (no discord.js): scoring, thresholds, time windows
```

## Setup

```bash
pnpm install
cp .env.example .env   # fill in DISCORD_TOKEN / DISCORD_CLIENT_ID
pnpm build
pnpm --filter @lycohana/bot start
```

## Scripts

| Command          | Purpose                          |
| ---------------- | -------------------------------- |
| `pnpm build`     | Build all packages (topological) |
| `pnpm dev`       | Run the bot with watch reload    |
| `pnpm typecheck` | Type-check all packages          |
| `pnpm lint`      | ESLint across the workspace      |
| `pnpm format`    | Prettier write                   |

## Milestones

Implemented through **M7**:

- M0–M2: workspace, database, Discord client and slash-command foundation
- M3–M4: privacy-safe activity aggregation and active-member role gate
- M5: persistent self-service button role menus with availability windows
- M6: configurable welcome messages and private leave logs
- M7: admin-only in-memory Embed drafts, previews, confirmation, sending and templates

Embed fields and template deletion remain outside the scoped M7 first version. Draft lifetime is
configured with `EMBED_DRAFT_TTL_MINUTES`; server-specific IDs live in guild settings rather than
source code.
