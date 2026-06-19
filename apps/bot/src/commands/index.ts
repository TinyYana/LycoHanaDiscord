import type { Command } from "./types";
import { ping } from "./ping";
import { activity } from "./activity";

/** Every slash command the bot exposes. Add new commands here. */
export const commands: Command[] = [ping, activity];
