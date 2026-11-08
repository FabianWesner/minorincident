/** Prove simultaneous windups retain distinct approach bearings before melee range. */
import { writeFileSync } from 'node:fs';
import { runLevel, LevelRunStopped } from '../sim-runner/levels';
import { observeAttackStarts } from './threat/attackStarts';
const entries = new Map<number, { tick: number; sector: string; x: number; z: number; playerX: number; playerZ: number }>();
const proofs: Record<string, { tick: number; directions: number; player: { x: number; z: number }; attackers: unknown[] }> = {};
const sector = (x: number, z: number) => ['E','SE','S','SW','W','NW','N','NE'][(Math.round(Math.atan2(z, x) * 4 / Math.PI) + 8) % 8];
const run = await runLevel('L7', 'complete', 1, 180, undefined, undefined, undefined, 0, {
  quality: 'high', beforeBegin: w => {
    w.events.on('entity.spawned', e => { if (e.type === 'entity.spawned') entries.delete(e.id); });
    w.events.on('sim.tick', () => {
      if (w.tick % 6) return;
      const p = w.entities.get(1)!.transform;
      for (const e of w.infected!.active) if (!entries.has(e.id) && e.health.current > 0 && !e.hidden && ['chase','attack'].includes(e.infected!.state) && Math.hypot(e.transform.x-p.x,e.transform.z-p.z) >= 6 && Math.hypot(e.transform.x-p.x,e.transform.z-p.z) <= 12) entries.set(e.id,{ tick:w.tick,sector:sector(e.transform.x-p.x,e.transform.z-p.z),x:e.transform.x,z:e.transform.z,playerX:p.x,playerZ:p.z });
    });
    observeAttackStarts(w, () => {
      const p = w.entities.get(1)!.transform, phase = p.x < -30 ? 'bus' : p.x < 100 ? 'corridor' : 'streets';
      const attackers = w.infected!.active.filter(e => e.health.current > 0 && e.infected!.state === 'attack' && e.infected!.until > w.tick && entries.has(e.id) && (w.entities.get(e.infected!.targetId || 1)?.health.current ?? 0) > 0 && ((e.infected!.targetId || 1) === 1 || w.l7Encounters!.state.roster.some(r=>r.id===e.infected!.targetId && r.status==='following')))
        .map(e => ({ id:e.id, target:e.infected!.targetId || 1, entry:entries.get(e.id)!, windupEnds:e.infected!.until, x:e.transform.x,z:e.transform.z }));
      const directions = new Set(attackers.map(e=>e.entry.sector)).size;
      if (directions > (proofs[phase]?.directions ?? 0)) proofs[phase] = {tick:w.tick,directions,player:{x:p.x,z:p.z},attackers};
    });
  }, stopWhen: () => (proofs.bus?.directions ?? 0) >= 3 && (proofs.corridor?.directions ?? 0) >= 2,
}).catch(error => { if (error instanceof LevelRunStopped) return {outcome:'observer-satisfied'}; throw error; });
const result = {method:'Final high seed1 route, same controller. Eight approach bearings stored when a chasing actor is first observed at 6–12m. Count only overlapping ordinary attack windups (until > current tick), preserving entry bearings rather than near-body wrap-around.',proofs,outcome:run.outcome};
writeFileSync('docs/reports/r12-l7/crossfire.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(proofs).map(([key,p])=>[key,p.directions]))));
