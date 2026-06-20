# CLAUDE.md

This project's agent guidance lives in **[AGENTS.md](./AGENTS.md)** — read it
first. It is the single source of truth for architecture, conventions,
commands, the database setup, and guardrails. Everything below is
Claude-specific and additive.

## Instruction priority

1. The user's latest explicit request.
2. This `CLAUDE.md` and [`AGENTS.md`](./AGENTS.md).
3. The user's global `~/.claude/CLAUDE.md` (cross-project baseline).
4. General best practices.

The user's global `~/.claude/CLAUDE.md` already applies to every project (file
safety, secret handling, shell-command caution, validation order, commit
style). Do not restate it; follow it.

## Working style for this repo

- The spec calls this "v3.0", but treat it as **this project's v0/v1
  foundation**. The spec is a guide with real gaps — when it conflicts with a
  cleaner, simpler design, prefer the clean design and say so.
- The user works in Traditional Chinese. For coding tasks, structure the final
  reply as: Summary → Files changed → Validation → Risks / next step. Be direct;
  don't overclaim. Don't say something was tested/built if it wasn't.
- Privileged intents (Server Members, Message Content) are enabled in the dev
  portal; the client declares them. Image/music detection relies on Message
  Content — keep it.
- The DB is **Supabase PostgreSQL** (migrated from an earlier SQLite dev
  substitute). Use the vendored Supabase skills under `.agents/skills/` for
  Postgres work.

## Tools

- Use the Supabase skills in `.agents/skills/` for any Supabase/Postgres task.
- Live Discord login and slash-command registration are left to the operator;
  do not run them automatically (real token, mutates the command list).
