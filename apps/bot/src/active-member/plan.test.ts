import type { Guild } from "discord.js";
import type { GuildConfig, UserActivityTotals } from "@lycohana/db";
import { describe, expect, it, vi } from "vitest";
import { type ActiveMemberPlanRepos, planActiveMemberGuild } from "./plan";

const ROLE = "role-active";
const EXEMPT = "role-exempt";
const NOW = new Date("2026-10-15T12:00:00Z");
const OPTIONS = { windowDays: 30, timeZone: "UTC" };

interface FakeMemberSpec {
  id: string;
  roles?: string[];
  bot?: boolean;
}

function fakeGuild(specs: FakeMemberSpec[]): Guild {
  const cache = new Map(
    specs.map((spec) => [
      spec.id,
      {
        id: spec.id,
        displayName: `name-${spec.id}`,
        user: { bot: spec.bot ?? false },
        roles: { cache: new Map((spec.roles ?? []).map((r) => [r, {}])) },
      },
    ]),
  );
  const holders = specs.filter((s) => s.roles?.includes(ROLE)).map((s) => [s.id, cache.get(s.id)]);
  const role = { id: ROLE, managed: false, members: new Map(holders) };
  const me = {
    permissions: { has: () => true },
    roles: { highest: { comparePositionTo: () => 1 } },
  };
  return {
    id: "g1",
    members: { me, cache, fetch: vi.fn(async () => cache) },
    roles: { cache: new Map([[ROLE, role]]), fetch: vi.fn(async () => null) },
  } as unknown as Guild;
}

/** No activity rows in the window: holders must still be planned (at score 0). */
function fakeRepos(config: Partial<GuildConfig>) {
  const aggregateByUserBetween = vi.fn(async (): Promise<UserActivityTotals[]> => []);
  const repos = {
    guildConfig: { get: vi.fn(async () => config as GuildConfig) },
    activity: { aggregateByUserBetween },
  } as unknown as ActiveMemberPlanRepos;
  return { repos, aggregateByUserBetween };
}

const CONFIG: Partial<GuildConfig> = {
  guildId: "g1",
  activeMemberRoleId: ROLE,
  activityThresholdHigh: 10,
  activityThresholdLow: 1,
  activityWeights: { chat: 1, image: 0, music: 0, interaction: 0, voicePer10Min: 0 },
  exemptRoleIds: [EXEMPT],
};

describe("planActiveMemberGuild", () => {
  it("queries the window, revokes an idle holder and skips exempt members", async () => {
    const guild = fakeGuild([
      { id: "idle", roles: [ROLE] },
      { id: "staff", roles: [ROLE, EXEMPT] },
      { id: "lurker" },
    ]);
    const { repos, aggregateByUserBetween } = fakeRepos(CONFIG);

    const plan = await planActiveMemberGuild(guild, repos, OPTIONS, NOW);
    const byUser = new Map(plan.candidates.map((c) => [c.userId, c]));

    expect(aggregateByUserBetween).toHaveBeenCalledWith("g1", "2026-09-16", "2026-10-15");
    expect(plan.window).toEqual({ from: "2026-09-16", to: "2026-10-15" });
    expect([...byUser.keys()].sort()).toEqual(["idle", "staff"]);
    expect(byUser.get("idle")).toMatchObject({ score: 0, action: "revoke", reason: "below-low" });
    expect(byUser.get("staff")).toMatchObject({ action: "skip", reason: "exempt" });
  });
});
