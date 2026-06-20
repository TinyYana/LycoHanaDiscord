import type { ModalSubmitInteraction } from "discord.js";
import type { EmbedTemplatePayload } from "@lycohana/domain";
import type { EmbedDraft } from "./store";

export function applyTextValues(draft: EmbedDraft, interaction: ModalSubmitInteraction): void {
  draft.payload.title = optional(interaction.fields.getTextInputValue("title"));
  draft.payload.description = optional(interaction.fields.getTextInputValue("description"));
  draft.payload.footer = optional(interaction.fields.getTextInputValue("footer"));
}

export function readAppearanceValues(
  interaction: ModalSubmitInteraction,
): Pick<EmbedTemplatePayload, "color" | "imageUrl" | "thumbnailUrl"> | undefined {
  const color = parseColor(interaction.fields.getTextInputValue("color"));
  const imageUrl = parseOptionalUrl(interaction.fields.getTextInputValue("image_url"));
  const thumbnailUrl = parseOptionalUrl(interaction.fields.getTextInputValue("thumbnail_url"));
  if (color === false || imageUrl === false || thumbnailUrl === false) return undefined;
  return { color, imageUrl, thumbnailUrl };
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseColor(value: string): number | undefined | false {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const hex = trimmed.replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(hex) ? Number.parseInt(hex, 16) : false;
}

function parseOptionalUrl(value: string): string | undefined | false {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : false;
  } catch {
    return false;
  }
}
