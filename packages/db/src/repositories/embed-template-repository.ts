import { and, asc, eq } from "drizzle-orm";
import type { EmbedTemplatePayload } from "@lycohana/domain";
import type { Db } from "../client";
import { embedTemplates, type EmbedTemplate } from "../schema";

export interface SaveEmbedTemplateInput {
  guildId: string;
  name: string;
  payload: EmbedTemplatePayload;
  createdBy: string;
}

export interface EmbedTemplateRepository {
  list(guildId: string): Promise<EmbedTemplate[]>;
  getByName(guildId: string, name: string): Promise<EmbedTemplate | undefined>;
  save(input: SaveEmbedTemplateInput): Promise<EmbedTemplate>;
}

export function createEmbedTemplateRepository(db: Db): EmbedTemplateRepository {
  return {
    async list(guildId) {
      return db
        .select()
        .from(embedTemplates)
        .where(eq(embedTemplates.guildId, guildId))
        .orderBy(asc(embedTemplates.name));
    },

    async getByName(guildId, name) {
      const [template] = await db
        .select()
        .from(embedTemplates)
        .where(and(eq(embedTemplates.guildId, guildId), eq(embedTemplates.name, name)))
        .limit(1);
      return template;
    },

    async save(input) {
      const [template] = await db
        .insert(embedTemplates)
        .values(input)
        .onConflictDoUpdate({
          target: [embedTemplates.guildId, embedTemplates.name],
          set: {
            payload: input.payload,
            createdBy: input.createdBy,
            updatedAt: new Date(),
          },
        })
        .returning();
      return template;
    },
  };
}
