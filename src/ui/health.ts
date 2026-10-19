/** Health-fill math shared by the HUD and world-space enemy bars. */
export function healthFraction(current: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
}
/** HUD's bright health red, dark frame and a high-contrast enemy outline. */
export const healthBarColors = { fill: '#ef6670', background: '#101824', outline: '#ffffff' };

/** Linear-light gains for the ruined-city night: quieter bars retain 3:1 between all three layers. */
export const nightHealthBarGains = { outline: .7, fill: .6 } as const;
