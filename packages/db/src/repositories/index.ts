import type { Db } from "../client";
import { createGuildConfigRepository } from "./guild-config-repository";
import { createActivityRepository } from "./activity-repository";
import { createRoleMenuRepository } from "./role-menu-repository";
import { createEmbedTemplateRepository } from "./embed-template-repository";
import { createModerationLogRepository } from "./moderation-log-repository";
import { createHoneypotRepository } from "./honeypot-repository";

export * from "./guild-config-repository";
export * from "./activity-repository";
export * from "./role-menu-repository";
export * from "./embed-template-repository";
export * from "./moderation-log-repository";
export * from "./honeypot-repository";

/**
 * Build all repositories over a single db client. Additional repositories
 * Each feature owns its repository while sharing one database client.
 */
export function createRepositories(db: Db) {
  return {
    guildConfig: createGuildConfigRepository(db),
    activity: createActivityRepository(db),
    roleMenu: createRoleMenuRepository(db),
    embedTemplate: createEmbedTemplateRepository(db),
    moderationLog: createModerationLogRepository(db),
    honeypot: createHoneypotRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
