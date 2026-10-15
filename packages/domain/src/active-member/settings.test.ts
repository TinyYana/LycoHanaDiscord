import { describe, expect, it } from "vitest";
import { type ActiveMemberSettingsInput, validateActiveMemberSettings } from "./settings";

const weights = { chat: 1, image: 3, music: 3, interaction: 1, voicePer10Min: 2 };

// prettier-ignore
const cases: [string, ActiveMemberSettingsInput, string[], string[]][] = [
  // name, input, error codes, warning codes
  ["valid settings", { high: 10, low: 3, weights }, [], []],
  ["high < low", { high: 2, low: 3 }, ["high-below-low"], []],
  ["non-finite / negative thresholds", { high: Number.NaN, low: -1 }, ["not-finite", "below-min"], []],
  ["fractional threshold", { high: 1.5, low: 1 }, ["not-integer"], []],
  ["bad weights", { weights: { ...weights, chat: -1, image: "3" as unknown as number } }, ["below-min", "not-finite"], []],
  ["null weight", { weights: { chat: null as unknown as number } }, ["required"], []],
  ["low = 0 allowed with warning", { high: 10, low: 0 }, [], ["revoke-disabled-low-zero"]],
  ["null thresholds warn", { high: null, low: null }, [], ["grant-disabled-high-null", "revoke-disabled-low-null"]],
];

describe("validateActiveMemberSettings", () => {
  it.each(cases)("%s", (_name, input, errors, warnings) => {
    const result = validateActiveMemberSettings(input);
    expect(result.errors.map((issue) => issue.code)).toEqual(errors);
    expect(result.warnings.map((issue) => issue.code)).toEqual(warnings);
    expect(result.ok).toBe(errors.length === 0);
  });
});
