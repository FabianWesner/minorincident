/** Normal speed during the playable release; cinematic time compression carries the tide over the entire journey. */
export function cureRadius(elapsedTicks: number): number {
  const seconds = elapsedTicks / 60;
  return Math.min(seconds, 8) * 10 + Math.max(0, seconds - 8) * 130;
}
