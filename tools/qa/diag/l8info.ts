/* eslint-disable @typescript-eslint/no-explicit-any -- diagnostic (r31-nadia) */
import { loadLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
const c: any = preset('L8-default' as any); c.seed = 1; c.settings.quality = 'low';
const w: any = await loadLevel('L8', 1, c, 0, { quality: 'low' } as any);
const z = w.missions.l8;
for (const [k, v] of Object.entries(w.missions.def.anchors)) console.log(k, JSON.stringify(v));
console.log('player', JSON.stringify(w.entities.get(1).transform));
console.log('keeper', JSON.stringify(w.entities.get(z.state.keeperId).transform));
z.state.animals.forEach((id: number, i: number) => console.log('animal', i, w.entities.get(id).civilian.zooAnimal, w.entities.get(id).transform.x, w.entities.get(id).transform.z));
console.log('roster', z.roster().map((id: number) => { const t = w.entities.get(id).transform; return [t.x.toFixed(0), t.z.toFixed(0)]; }).join(' '));
process.exit(0);
