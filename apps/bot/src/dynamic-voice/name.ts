const MAX_CHANNEL_NAME_LENGTH = 100;
const CHANNEL_NAME_SUFFIX = " 的語音頻道";

/** Build Discord's default dynamic-channel name without exceeding its limit. */
export function dynamicVoiceChannelName(displayName: string): string {
  const available = MAX_CHANNEL_NAME_LENGTH - CHANNEL_NAME_SUFFIX.length;
  return `${displayName.slice(0, available)}${CHANNEL_NAME_SUFFIX}`;
}
