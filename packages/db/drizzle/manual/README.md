# Manual migrations

SQL here is **not** run by `pnpm db:migrate`. It is applied by an operator, by
hand, against the live Supabase project — kept under version control for review
and history, but deliberately outside the Drizzle journal.

## `0001_enable_rls_revoke_api_grants.sql`

Hardening for the "public tables, RLS disabled" follow-up in the 2026-06-20
security review. Enables row-level security on all eight app tables and revokes
Data API (`anon` / `authenticated` / `PUBLIC`) privileges. The bot uses a direct
PostgreSQL connection, so this does not change how the bot reads/writes — it
only narrows what the Supabase Data API can reach.

### Verify on the live project first (read-only checks)

Run these before and after applying, without mutating anything you don't intend:

1. **Connection role** — confirm the role in `DATABASE_URL` owns the tables or
   has `BYPASSRLS` (usually `postgres`). If the bot connects as
   `anon`/`authenticated`, do **not** apply this — it would break the bot.
2. **Data API exposure** — Supabase → Settings → API → "Exposed schemas". If
   `public` is exposed, these tables are reachable by API roles today.
3. **Current grants**:
   ```sql
   SELECT table_name, grantee, privilege_type
   FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'PUBLIC')
   ORDER BY table_name, grantee;
   ```
4. **RLS state**:
   ```sql
   SELECT relname, relrowsecurity
   FROM pg_class
   WHERE relnamespace = 'public'::regnamespace AND relkind = 'r';
   ```
5. **Advisors** — run Supabase's Security/Database advisors and confirm no
   "RLS disabled in public" warnings remain afterwards.

If these tables are only ever touched by the bot's direct connection, the
cleanest long-term option is to un-expose `public` (or move the tables to a
private schema) rather than maintaining RLS policies for a non-Auth workload.
This migration is the lower-risk, reversible first step.
