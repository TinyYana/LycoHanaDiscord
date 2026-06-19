/**
 * Content-based detection helpers. Pure string logic — the bot passes in
 * attachment metadata / message content (requires the MessageContent intent).
 */

const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|bmp|heic|heif|tiff?|avif)$/i;

const MUSIC_URL =
  /(open\.spotify\.com|spotify:|(?:music|www)\.youtube\.com\/|youtube\.com\/watch|youtu\.be\/|soundcloud\.com|music\.apple\.com|bandcamp\.com|deezer\.com|tidal\.com)/i;

/** True if an attachment looks like an image, by content-type or filename. */
export function isImageAttachment(fileName: string | null, contentType: string | null): boolean {
  if (contentType?.startsWith("image/")) return true;
  return fileName != null && IMAGE_EXTENSION.test(fileName);
}

/** True if the message content contains a known music-service link. */
export function detectMusicShare(content: string): boolean {
  if (!content) return false;
  return MUSIC_URL.test(content);
}
