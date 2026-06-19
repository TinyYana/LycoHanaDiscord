/** The five participation dimensions tracked per member (spec §2.1, §4.2). */
export interface ActivityCounts {
  chatCount: number;
  voiceSeconds: number;
  imageCount: number;
  musicCount: number;
  interactionCount: number;
}

/**
 * Weight applied to each dimension when collapsing counts into a single
 * active-member score (spec §4.8). Voice is weighted per 10 minutes.
 */
export interface ActivityWeights {
  chat: number;
  image: number;
  music: number;
  interaction: number;
  voicePer10Min: number;
}
