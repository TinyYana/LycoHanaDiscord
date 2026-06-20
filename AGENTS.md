# AGENTS.md

Guidance for AI agents (and humans) working in this repository. This is the
project-level contract; it sits above general best practices and below the
user's explicit, in-the-moment instructions.

## What this project is

The community-operations bot (**彼岸花 Bot v3**) for the LycoHana Discord
server: activity tracking, active-member roles, self-service role menus,
welcome/leave messages, embed sending, and a small moderation safety net
(honeypot + moderation log).

Scope is deliberately limited to the community-operations core. **Do not** turn
it into a general bot platform, add a web dashboard, or introduce an economy /
shop / RPG layer unless explicitly asked — those are noted as possible future
work, not current goals. Prefer the smallest change that satisfies the request.

## Architecture

pnpm workspace monorepo, three packages with a strict dependency direction:

```
packages/domain  →  pure logic, NO discord.js and NO drizzle imports
packages/db      →  Drizzle schema, migrations, client, repositories (depends on domain)
apps/bot         →  discord.js client, commands, events, schedulers (depends on db + domain)
```

- **domain** holds anything testable in isolation: scoring, hysteresis
  thresholds, time windows, detection regexes, constants/defaults. If it needs
  `discord.js` or `drizzle`, it does not belong here.
- **db** owns persistence. Each feature gets its own repository file exposing an
  interface; `createRepositories(db)` wires them. Repositories return plain
  rows/types — no discord.js.
- **bot** is the composition root (`apps/bot/src/index.ts`) and feature modules
  (`activity/`, `active-member/`, `role-menu/`, `embed-draft/`, `members/`,
  `honeypot/`, `moderation/`). Dependencies are injected via `CommandContext`
  (`{ logger, repos, config }`); avoid module-level singletons and global state.

## Conventions

- **Interface-first.** Define the contract (types/interface) before the
  implementation. No throwaway placeholder code.
- **Feature-named modules**, not generic buckets. Package names may be
  layer-roles (`bot`/`db`/`domain`); everything inside is named by feature.
- **No hard-coded tunables.** Anything an operator might change goes through env
  (validated in `apps/bot/src/config/env.ts`) or per-guild DB config, with the
  default living in `packages/domain`. Genuine platform limits (e.g. Discord's
  28-day timeout cap) are fine as clearly-named, commented constants.
- **Cut over-engineering.** Remove speculative abstractions, unused fields, and
  "clever" indirection. YAGNI.
- **Errors stay visible.** Event handlers contain their own errors and log via
  the structured logger; never swallow silently. Use `errMessage(error)` from
  `apps/bot/src/errors.ts`.
- **TypeScript:** strict, CommonJS, explicit types at public boundaries. Build
  is `tsc -b` over project references.

## Commands

| Command             | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `pnpm build`        | Build all packages (`tsc -b`)                |
| `pnpm typecheck`    | Type-check without emit                      |
| `pnpm lint`         | ESLint across the workspace                  |
| `pnpm format`       | Prettier write                               |
| `pnpm format:check` | Prettier check                               |
| `pnpm dev`          | Run the bot with file watching               |
| `pnpm db:generate`  | Generate a migration from the Drizzle schema |
| `pnpm db:migrate`   | Apply migrations to the database             |

**Before claiming a task is done:** `pnpm build && pnpm typecheck && pnpm lint`
must pass, and Prettier must be clean. Add a targeted smoke test for DB or
command-shape changes where practical. State honestly what was and was not run.

## Database (Supabase PostgreSQL)

- Drizzle ORM + **postgres.js** (`drizzle-orm/postgres-js`). The client sets
  `{ ssl: "require", prepare: false }`; `prepare: false` keeps it compatible
  with the Supavisor transaction pooler.
- **Connectivity gotcha:** the Supabase direct host `db.<ref>.supabase.co` is
  IPv6-only. On IPv4 networks use the **pooler** host
  (`aws-<n>-<region>.pooler.supabase.com`, user `postgres.<ref>`, port 5432
  session / 6543 transaction).
- Schema lives in `packages/db/src/schema/*` (one file per feature). After a
  schema change: `pnpm db:generate` (commit the generated SQL under
  `packages/db/drizzle/`) then `pnpm db:migrate`. Do not hand-edit generated
  migration SQL.
- Postgres returns `sum()`/numeric as strings — cast aggregates (`::int`) when
  a JS number is expected.
- For non-trivial Postgres/Supabase work, consult the vendored skills under
  `.agents/skills/` (`supabase`, `supabase-postgres-best-practices`).

## Security & guardrails

- **Never commit secrets.** `.env` is gitignored; only `.env.example` (with
  placeholders) is tracked. Never paste tokens or DB credentials into commits,
  logs, issues, or screenshots. If one leaks, recommend rotating it.
- **Outward-facing / destructive actions need confirmation** and are generally
  left to the operator: live bot login + slash-command registration (uses the
  real token and mutates the app's command list), and any bulk change to Discord
  roles, channels, or permissions.
- Do not force-push or rewrite published history. Commit only when asked.

## Commits

Conventional Commits (`feat`, `fix`, `refactor`, `docs`, `chore`, `test`),
scoped by feature (e.g. `feat(honeypot): …`). Keep commits focused. End commit
messages with:

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
