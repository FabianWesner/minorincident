import { drive, metrics, wander } from './harness';
// Robustness sweep: seeded wander plans per body (npx tsx tools/crowdfoot/sweep.ts [seeds]); prints slide cm / yaw drift ° / lift cm per seed.
const seeds = Number(process.argv[2] ?? 6);
for (const [asset, kind, scale, speeds] of [['npc.civilian-man-a', 'civilian', 1, [0, 1.4, 1.4, 4.8]], ['npc.civilian-man-a', 'civilian', .7, [0, 1.4, 4.8]], ['npc.civilian-woman-a', 'civilian', 1, [0, 1.4, 4.8]], ['inf.common-worker.lod1', 'infected', 1, [0, 1, 5.1, 5.6]], ['npc.civilian-elderly', 'civilian', 1, [0, 1, 2.8]]] as const) {
  const rows: string[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const m = metrics(await drive(asset, { kind, tier: 'infected-lurch' }, 12, wander([...speeds], seed * 13 + 1), true, scale));
    rows.push(`${m.slideMaxCm}/${m.yawDriftMaxDeg}/${m.liftMaxCm}`);
  }
  console.log(`${asset}@${scale}`.padEnd(28), rows.join('  '));
}
