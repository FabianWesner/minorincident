// r32-l9fun diagnostic: is the run-up and landing lane of every L9 ramp free of static solids and layout props?
// Usage: node --import tsx/esm tools/qa/diag/l9ramps.ts
import { loadLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { l9Course } from '../../../src/data/l9';

const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
try {
  for (const ramp of l9Course.ramps) {
    const blocked: string[] = [];
    for (let x = ramp.x - 40; x <= ramp.x + 40; x += 2) for (let z = -4; z <= 4; z += 2) {
      if (x > ramp.x - 7 && x < ramp.x + 16) continue; // the ramp plate and its collapsed landing block
      const at = { x, y: .7, z: ramp.z + z };
      if (!world.solids.clear(at, .5, undefined, false)) blocked.push(`${x},${ramp.z + z}`);
    }
    console.log(ramp.id, blocked.length ? `blocked: ${blocked.join(' ')}` : 'clear');
  }
} finally { world.dispose(); }
