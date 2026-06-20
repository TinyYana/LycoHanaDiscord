import { EmbedBuilder } from "discord.js";
import type { HoneypotAction } from "@lycohana/domain";

/**
 * The public warning posted in a honeypot channel when it is configured, so
 * ordinary members are told not to post here — only those who ignore it get
 * caught by the enforcement in `events.ts`.
 */
export function buildHoneypotNotice(action: HoneypotAction): EmbedBuilder {
  const consequence = action === "ban" ? "**被封鎖（ban）出伺服器**" : "**被禁言（timeout）**";
  return new EmbedBuilder()
    .setColor(0xb3001b) // 彼岸花紅
    .setTitle("⚠️ 警告：請勿在此頻道發言")
    .setDescription(
      [
        "這是一個受自動監控的頻道。",
        `任何在此發言的成員，訊息會被立即刪除，並會${consequence}。`,
        "",
        "如果你是一般成員，請直接離開此頻道，**不要回覆或測試**。",
      ].join("\n"),
    )
    .setFooter({ text: "彼岸花 · 自動安全防護" });
}
