import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import type { EmbedDraft } from "./store";
import { draftCustomId } from "./view";

function input(
  id: string,
  style: TextInputStyle,
  value: string | undefined,
  maxLength: number,
): TextInputBuilder {
  const component = new TextInputBuilder()
    .setCustomId(id)
    .setStyle(style)
    .setRequired(false)
    .setMaxLength(maxLength);
  if (value) component.setValue(value);
  return component;
}

function labeledInput(label: string, component: TextInputBuilder): LabelBuilder {
  return new LabelBuilder().setLabel(label).setTextInputComponent(component);
}

export function textModal(draft: EmbedDraft): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(draftCustomId(draft.id, "text-modal"))
    .setTitle("編輯 Embed 文字")
    .addLabelComponents(
      labeledInput("標題", input("title", TextInputStyle.Short, draft.payload.title, 256)),
      labeledInput(
        "描述",
        input("description", TextInputStyle.Paragraph, draft.payload.description, 4000),
      ),
      labeledInput("Footer", input("footer", TextInputStyle.Short, draft.payload.footer, 2048)),
    );
}

export function appearanceModal(draft: EmbedDraft): ModalBuilder {
  const color = draft.payload.color?.toString(16).padStart(6, "0").toUpperCase();
  return new ModalBuilder()
    .setCustomId(draftCustomId(draft.id, "appearance-modal"))
    .setTitle("編輯 Embed 外觀")
    .addLabelComponents(
      labeledInput("色碼（例如 #F4A7B9）", input("color", TextInputStyle.Short, color, 7)),
      labeledInput(
        "圖片 URL",
        input("image_url", TextInputStyle.Short, draft.payload.imageUrl, 1000),
      ),
      labeledInput(
        "縮圖 URL",
        input("thumbnail_url", TextInputStyle.Short, draft.payload.thumbnailUrl, 1000),
      ),
    );
}

export function saveTemplateModal(draft: EmbedDraft): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(draftCustomId(draft.id, "save-modal"))
    .setTitle("儲存 Embed 模板")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("模板名稱")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("name")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100),
        ),
    );
}
