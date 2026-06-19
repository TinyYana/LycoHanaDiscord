/**
 * Activity domain — pure value types and logic shared across layers (no
 * discord.js / drizzle). Persisted by `db`, computed by the bot's trackers
 * and the active-member gate.
 */
export * from "./types";
export * from "./config";
export * from "./scoring";
export * from "./detection";
export * from "./time";
