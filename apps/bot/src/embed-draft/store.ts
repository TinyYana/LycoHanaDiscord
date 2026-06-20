import { randomUUID } from "node:crypto";
import type { EmbedTemplatePayload } from "@lycohana/domain";

export interface EmbedDraft {
  id: string;
  guildId: string;
  ownerId: string;
  payload: EmbedTemplatePayload;
  targetChannelId?: string;
  status: "editing" | "sending" | "sent";
  expiresAt: number;
}

export class EmbedDraftStore {
  private readonly drafts = new Map<string, EmbedDraft>();

  constructor(private readonly ttlMs: number) {}

  create(guildId: string, ownerId: string, payload: EmbedTemplatePayload = {}): EmbedDraft {
    const draft: EmbedDraft = {
      id: randomUUID(),
      guildId,
      ownerId,
      payload: structuredClone(payload),
      status: "editing",
      expiresAt: Date.now() + this.ttlMs,
    };
    this.drafts.set(draft.id, draft);
    return draft;
  }

  get(id: string): EmbedDraft | undefined {
    const draft = this.drafts.get(id);
    if (draft && draft.expiresAt <= Date.now()) {
      this.drafts.delete(id);
      return undefined;
    }
    return draft;
  }

  delete(id: string): void {
    this.drafts.delete(id);
  }
}
