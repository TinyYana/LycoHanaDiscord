import { describe, expect, it } from "vitest";
import {
  type ActiveMemberDecisionInput,
  type ActiveMemberVerdict,
  decideActiveMember,
  explainActiveMember,
} from "./decision";

// prettier-ignore
const cases: [string, ActiveMemberDecisionInput, ActiveMemberVerdict][] = [
  ["score == high grants", { score: 10, high: 10, low: 5, hasRole: false }, { action: "grant", reason: "at-or-above-high" }],
  ["below high holds", { score: 9, high: 10, low: 5, hasRole: false }, { action: "hold", reason: "below-high" }],
  ["score == low keeps", { score: 5, high: 10, low: 5, hasRole: true }, { action: "hold", reason: "at-or-above-low" }],
  ["between low and high keeps", { score: 7, high: 10, low: 5, hasRole: true }, { action: "hold", reason: "at-or-above-low" }],
  ["score < low revokes", { score: 4, high: 10, low: 5, hasRole: true }, { action: "revoke", reason: "below-low" }],
  ["low = 0 never revokes", { score: 0, high: 10, low: 0, hasRole: true }, { action: "hold", reason: "revoke-disabled-low-zero" }],
  ["low = null never revokes", { score: 0, high: 10, low: null, hasRole: true }, { action: "hold", reason: "revoke-disabled-low-null" }],
  ["high = null never grants", { score: 99, high: null, low: 5, hasRole: false }, { action: "hold", reason: "grant-disabled-high-null" }],
];

describe("active-member decision", () => {
  it.each(cases)("%s", (_name, input, expected) => {
    expect(explainActiveMember(input)).toEqual(expected);
    expect(decideActiveMember(input)).toBe(expected.action === "hold" ? "none" : expected.action);
  });
});
