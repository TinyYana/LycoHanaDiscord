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

Built milestone-by-milestone per the v3.0 spec. Current: **M0 — project skeleton**.
