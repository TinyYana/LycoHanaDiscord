import { describe, expect, it } from "vitest";
import { cappedDelta, computeActivityScore } from "./scoring";
import type { ActivityCounts, ActivityWeights } from "./types";

const weights: ActivityWeights = { chat: 1, image: 3, music: 3, interaction: 1, voicePer10Min: 2 };

describe("computeActivityScore", () => {
  it("sums each dimension by its weight, voice per 10 minutes", () => {
    const counts: ActivityCounts = {
      chatCount: 4,
      imageCount: 2,
      musicCount: 1,
      interactionCount: 5,
      voiceSeconds: 1200, // 20 minutes -> 2 units
    };
    // 4*1 + 2*3 + 1*3 + 5*1 + (1200/600)*2 = 4 + 6 + 3 + 5 + 4
    expect(computeActivityScore(counts, weights)).toBe(22);
  });

  it("is zero for an all-zero member", () => {
    const counts: ActivityCounts = {
      chatCount: 0,
      imageCount: 0,
      musicCount: 0,
      interactionCount: 0,
      voiceSeconds: 0,
    };
    expect(computeActivityScore(counts, weights)).toBe(0);
  });
});

describe("cappedDelta", () => {
  it("allows the full delta when there is room", () => {
    expect(cappedDelta(5, 3, 20)).toBe(3);
  });

  it("only allows the remaining room near the cap", () => {
    expect(cappedDelta(19, 5, 20)).toBe(1);
  });

  it("allows nothing at or above the cap", () => {
    expect(cappedDelta(20, 1, 20)).toBe(0);
    expect(cappedDelta(25, 1, 20)).toBe(0);
  });

  it("treats non-positive deltas as no-ops", () => {
    expect(cappedDelta(5, 0, 20)).toBe(0);
    expect(cappedDelta(5, -3, 20)).toBe(0);
  });
});
