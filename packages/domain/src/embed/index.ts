/**
 * Embed domain — serializable shape of a stored embed template (spec §5.5,
 * §7). Plain data only (no discord.js): the bot maps this to an EmbedBuilder
 * at send time. Fields mirror the M7 modal inputs.
 */

export interface EmbedFieldData {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedTemplatePayload {
  title?: string;
  description?: string;
  /** Resolved color integer (from the modal's hex input). */
  color?: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  footer?: string;
  fields?: EmbedFieldData[];
}
