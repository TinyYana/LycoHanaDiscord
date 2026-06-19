import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { type EmbedTemplatePayload } from "@lycohana/domain";
import { timestamps } from "./_shared";

/**
 * Saved embed template (spec §5.5). Drafts live in memory; only committed
 * templates are persisted here. `name` is unique per guild (spec §7).
 */
export const embedTemplates = sqliteTable(
  "embed_templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guildId: text("guild_id").notNull(),
    name: text("name").notNull(),
    payload: text("payload", { mode: "json" }).$type<EmbedTemplatePayload>().notNull(),
    createdBy: text("created_by").notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("embed_templates_guild_name_unique").on(t.guildId, t.name)],
);

export type EmbedTemplate = typeof embedTemplates.$inferSelect;
export type NewEmbedTemplate = typeof embedTemplates.$inferInsert;
