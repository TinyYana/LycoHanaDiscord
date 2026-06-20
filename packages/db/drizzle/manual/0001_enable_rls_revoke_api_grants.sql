-- =============================================================================
-- DRAFT — manual, operator-applied. NOT wired into the Drizzle journal, so
-- `pnpm db:migrate` will NOT run this. Review, then apply by hand against the
-- Supabase project (SQL editor or psql) once the checks below are confirmed.
-- =============================================================================
--
-- Purpose
--   Close the "public tables, RLS disabled" follow-up from the 2026-06-20
--   security review. All eight tables live in `public` with RLS off. The bot
--   itself talks to PostgreSQL over a *direct connection*, so it does not need
--   RLS to work — this hardening is about the Supabase Data API (PostgREST),
--   which can expose `public` to the `anon` / `authenticated` roles.
--
-- What it does
--   1. Enables row-level security on every app table. With no policies, RLS
--      denies all access to non-owner, non-BYPASSRLS roles by default.
--   2. Revokes table/sequence privileges from `anon`, `authenticated`, and
--      `PUBLIC` as defence-in-depth (belt and suspenders alongside RLS).
--   We intentionally add NO policies: there is no Supabase Auth user context for
--   a bot table, so `auth.uid()` policies would be meaningless. The bot keeps
--   working because its connection role owns the tables / bypasses RLS.
--
-- BEFORE YOU APPLY — verify (do not assume):
--   * The role in DATABASE_URL is the table owner or has BYPASSRLS (typically
--     `postgres`). If the bot connects as `anon`/`authenticated`, this WILL
--     break it — stop and rethink.
--   * Whether `public` is actually exposed by the Data API. If you have already
--     un-exposed `public` (or moved these tables to a private schema), enabling
--     RLS is still harmless but the revokes may be redundant.
--   * Run Supabase's database advisors afterwards to confirm no table is left
--     "RLS disabled in public".
--
-- Rollback: `ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;` and re-GRANT as
-- needed. Take this slowly on a staging project first if you have one.
-- =============================================================================

BEGIN;

-- 1) Enable RLS (default-deny for non-privileged roles) -----------------------
ALTER TABLE public.guild_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_daily     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_menus         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_menu_options  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embed_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.honeypot_channels  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_voice_channels ENABLE ROW LEVEL SECURITY;

-- 2) Revoke Data API role privileges (defence in depth) -----------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, PUBLIC;

-- Stop PostgREST from auto-granting on future tables created in public.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;

COMMIT;
