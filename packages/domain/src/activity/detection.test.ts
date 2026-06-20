import { describe, expect, it } from "vitest";
import { detectMusicShare, isImageAttachment } from "./detection";

describe("isImageAttachment", () => {
  it("accepts an image content-type regardless of name", () => {
    expect(isImageAttachment(null, "image/png")).toBe(true);
    expect(isImageAttachment("note", "image/webp")).toBe(true);
  });

  it("accepts known image extensions by filename", () => {
    expect(isImageAttachment("photo.JPG", null)).toBe(true);
    expect(isImageAttachment("art.webp", "application/octet-stream")).toBe(true);
  });

  it("rejects non-image files", () => {
    expect(isImageAttachment("report.pdf", "application/pdf")).toBe(false);
    expect(isImageAttachment(null, null)).toBe(false);
  });
});

describe("detectMusicShare", () => {
  it("detects known music-service links", () => {
    expect(detectMusicShare("listen: https://open.spotify.com/track/abc")).toBe(true);
    expect(detectMusicShare("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(detectMusicShare("https://music.apple.com/album/x")).toBe(true);
  });

  it("ignores plain text and unrelated links", () => {
    expect(detectMusicShare("just chatting here")).toBe(false);
    expect(detectMusicShare("https://example.com/youtube")).toBe(false);
    expect(detectMusicShare("")).toBe(false);
  });
});
