import { jsonb, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";
import { type EmbedTemplatePayload } from "@lycohana/domain";
import { timestamps } from "./_shared";

/**
 * Saved embed template (spec §5.5). Drafts live in memory; only committed
 * templates are persisted here. `name` is unique per guild (spec §7).
 */
export const embedTemplates = pgTable(
  "embed_templates",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    name: text("name").notNull(),
    payload: jsonb("payload").$type<EmbedTemplatePayload>().notNull(),
    createdBy: text("created_by").notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("embed_templates_guild_name_unique").on(t.guildId, t.name)],
);

export type EmbedTemplate = typeof embedTemplates.$inferSelect;
export type NewEmbedTemplate = typeof embedTemplates.$inferInsert;
