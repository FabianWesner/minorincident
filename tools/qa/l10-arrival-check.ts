/** L10 finale timing check after a D-CURE dressing change (the deleted tests/sim/levels/l10-arrival.test.ts as a script).
 * usage: npx tsx tools/qa/l10-arrival-check.ts   -> one line per tier: Mega arrival (s), released, deaths, peak infected.
 * Pins before look-l10-l8-2: high 143.15 s, low 143.48 s (band 135-145, PO 2026-10-16 / E32-AC21). */
import { runFinaleCalibration } from '../sim-runner/l10-finale-calibration';

for (const tier of ['high', 'low'] as const) {
  const r = await runFinaleCalibration(tier);
  console.log(JSON.stringify({ tier, arrival: r.arrival, released: r.released, deaths: r.deaths, peak: r.peak, fullChargeBossGate: r.fullChargeBossGate, bossIdChanged: r.bossIdChanged }));
}
