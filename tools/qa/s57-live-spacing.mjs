/** Read-only per-tick spacing observer around the existing native L8 fight fixture. */
import { execFileSync } from 'node:child_process';
process.env.L8_BOSS_OUT ??= `test-results/s57-live-arena-${process.env.L8_BOSS_TIER ?? 'low'}`;
process.env.L8_BOSS_REVISION = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
import { SimWorld } from '../../src/sim/world/SimWorld.ts';
import { writeFileSync } from 'node:fs';
const update = SimWorld.prototype.update;
const receipt = { ticks: 0, maxLiving: 0, maxFlight: 0, minHorizontalM: null, minCentre3dM: null, pairsWithinHalfMetre: 0 };
SimWorld.prototype.update = function(...args) {
  const result = update.apply(this, args);
  const arena = this.missions?.l8?.state.arenas.find(a => a.id === 'flamingo');
  if (arena && (arena.phase === 1 || arena.phase === 2)) {
    const birds = arena.ids.map(id => this.entities.get(id)).filter(e => e?.infected && e.health.current > 0);
    receipt.ticks++; receipt.maxLiving = Math.max(receipt.maxLiving, birds.length); receipt.maxFlight = Math.max(receipt.maxFlight, arena.flights ?? 1);
    for (let i=0;i<birds.length;i++) for(let j=0;j<i;j++) {
      const a=birds[i].transform,b=birds[j].transform,h=Math.hypot(a.x-b.x,a.z-b.z),d=Math.hypot(h,a.y-b.y);
      receipt.minHorizontalM=Math.min(receipt.minHorizontalM??Infinity,h);receipt.minCentre3dM=Math.min(receipt.minCentre3dM??Infinity,d);if(d<.5)receipt.pairsWithinHalfMetre++;
    }
  }
  return result;
};
process.argv[2]='flamingo';process.argv[3]='skilled';
await import('../sim-runner/l8-bosses.ts');
writeFileSync(`${process.env.L8_BOSS_OUT}/spacing.json`,JSON.stringify(receipt,null,2));console.log(receipt);
