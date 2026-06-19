import type { Db } from "../client";
import { createGuildConfigRepository } from "./guild-config-repository";
import { createActivityRepository } from "./activity-repository";

export * from "./guild-config-repository";
export * from "./activity-repository";

/**
 * Build all repositories over a single db client. Additional repositories
 * (role menus, embed templates, moderation, honeypot) are added in their
 * respective milestones.
 */
export function createRepositories(db: Db) {
  return {
    guildConfig: createGuildConfigRepository(db),
    activity: createActivityRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
