// r27-l9apc diagnostic: list L9 district colliders near a point. Usage: npx tsx tools/qa/diag/l9solidsnear.ts X Z [R]
import { loadLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';

const [x, z, r = 12] = process.argv.slice(2).map(Number);
const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
try {
  for (const d of world.districts!.districts) {
    for (const c of [...d.decay.colliders.map(c => ({ ...c, kind: 'decay' })), ...d.blockers.map(aabb => ({ aabb, kind: 'blocker' }))]) {
      const a = c.aabb, cx = (a.min[0] + a.max[0]) / 2 + d.origin[0], cz = (a.min[2] + a.max[2]) / 2 + d.origin[1];
      if (Math.hypot(cx - x, cz - z) < r) console.log(c.kind, d.id, JSON.stringify({ cx, cz, ...c, aabb: a }));
    }
  }
} finally { world.dispose(); }
