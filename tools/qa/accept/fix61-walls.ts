/** Read-only: list static walls (level arg 2, default L5) and layout placements near points (no route run). Usage: ... "x,z;x,z" */
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';

const points = (process.argv[2] ?? '').split(';').map(p => p.split(',').map(Number));
const campaign = preset((process.argv[3] ?? 'L5') + '-default' as 'L5-default'); campaign.settings.quality = 'low';
type W = { x: number; z: number; y: number; halfX: number; halfZ: number; halfY: number; navBlocker?: boolean; yaw?: number };
await runLevel((process.argv[3] ?? 'L5') as 'L5', 'complete', 1, 1, 'auto', campaign, undefined, 0, { quality: 'low', beforeBegin: world => {
  const nav = world.infected!.nav as unknown as { walls: W[]; clear: (x: number, z: number, r: number) => boolean };
  for (const [x, z] of points) {
    console.log(`point ${x},${z} clear.35=${nav.clear(x, z, .35)}`);
    for (const w of nav.walls) if (Math.abs(w.x - x) < w.halfX + 1.2 && Math.abs(w.z - z) < w.halfZ + 1.2)
      console.log(`  wall x=${w.x.toFixed(2)} z=${w.z.toFixed(2)} hx=${w.halfX.toFixed(2)} hz=${w.halfZ.toFixed(2)} y=${(w.y - w.halfY).toFixed(2)}..${(w.y + w.halfY).toFixed(2)} nb=${!!w.navBlocker} yaw=${w.yaw ?? 0}`);
    for (const d of world.districts!.districts) for (const p of d.layout.placements)
      if (Math.hypot(p.position[0] + d.origin[0] - x, p.position[2] + d.origin[1] - z) < Number(process.env.R ?? 2.5)) console.log(`  placement ${p.id} ${p.assetId} at ${(p.position[0] + d.origin[0]).toFixed(2)},${(p.position[2] + d.origin[1]).toFixed(2)}`);
  }
} });
