/** Hetzner: npx tsx docs/reports/l10-mega-speed/evidence/calibration.ts */
import { runFinaleCalibration } from '../../../../tools/sim-runner/l10-finale-calibration';
for (const tier of ['high', 'low'] as const) {
  const r = await runFinaleCalibration(tier);
  console.log(JSON.stringify({ tier, arrival: r.arrival, activation: r.activation,
    activationBoss: r.activationBoss, released: r.released, deaths: r.deaths,
    bossId: r.bossId, bossIdChanged: r.bossIdChanged,
    fullChargeBossGate: r.fullChargeBossGate, fullChargeBossGateText: r.fullChargeBossGateText,
    bossGatePursuitM: r.bossGatePursuitM,
    approachStepMaxM: r.bossApproachStepMaxM }));
}
