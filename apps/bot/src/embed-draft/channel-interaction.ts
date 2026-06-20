import type { ChannelSelectMenuInteraction } from "discord.js";
import type { EmbedDraft } from "./store";
import { draftPanel, panelContent } from "./view";
import { resolveWritableEmbedChannel } from "./channel";
import { replyEphemeral } from "./responses";

export async function handleDraftChannelSelect(
  interaction: ChannelSelectMenuInteraction,
  draft: EmbedDraft,
  action: string,
): Promise<void> {
  if (action !== "channel") {
    await replyEphemeral(interaction, "無法辨識這個頻道操作。");
    return;
  }
  if (!interaction.inCachedGuild()) {
    await replyEphemeral(interaction, "請在伺服器內使用。");
    return;
  }

  const result = await resolveWritableEmbedChannel(interaction.guild, interaction.values[0]);
  if (!result.ok) {
    await replyEphemeral(interaction, result.message);
    return;
  }

  draft.targetChannelId = result.channel.id;
  await interaction.update({ content: panelContent(draft), components: draftPanel(draft) });
}
