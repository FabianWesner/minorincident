/** Presentation only: keep three distinct dangers, favouring nearby and imminent attacks.
 * Overlapping warnings of the same shape/direction share their most urgent representative. */
export interface TelegraphThreat { slot: number; x: number; z: number; angle: number; shape: number; radius: number; resolves: number }
export function readableTelegraphs(threats: readonly TelegraphThreat[], player: { x: number; z: number }, now: number): Set<number> {
  const ranked = threats.map(t => ({ t, score: Math.hypot(t.x - player.x, t.z - player.z) + Math.max(0, t.resolves - now) * 4 }))
    .sort((a, b) => a.score - b.score || a.t.slot - b.t.slot);
  const chosen: TelegraphThreat[] = [];
  for (const { t } of ranked) {
    if (chosen.some(c => c.shape === t.shape && Math.cos(c.angle - t.angle) > .85 && Math.hypot(c.x - t.x, c.z - t.z) < Math.min(2, c.radius, t.radius))) continue;
    chosen.push(t); if (chosen.length === 3) break;
  }
  return new Set(chosen.map(t => t.slot));
}
