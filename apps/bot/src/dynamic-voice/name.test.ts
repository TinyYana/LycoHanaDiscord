import { describe, expect, it } from "vitest";
import { dynamicVoiceChannelName } from "./name";

describe("dynamicVoiceChannelName", () => {
  it("uses the member display name in the default channel name", () => {
    expect(dynamicVoiceChannelName("小花")).toBe("小花 的語音頻道");
  });

  it("keeps the generated name within Discord's 100-character limit", () => {
    const name = dynamicVoiceChannelName("a".repeat(120));

    expect(name).toHaveLength(100);
    expect(name).toMatch(/ 的語音頻道$/);
  });
});
