import { runLevel } from '../sim-runner/levels';
import { readFileSync, writeFileSync } from 'node:fs';
const rows: { level: string; ticks: number; attacks: number; contacts: number; flags: unknown[]; outcome?: string }[] = [];
for (const level of ['L1','L2','L4','L5','L6','L7','L8','L9','L10'] as const) {
 const row = { level, ticks: 0, attacks: 0, contacts: 0, flags: [] as unknown[], outcome: '' }; rows.push(row);
 const report = await runLevel(level, 'complete', 1, 120, 'auto', undefined, undefined, 0, { beforeBegin(w) {
 const watch = new Map<number, { hp: number; since: number; reported: boolean }>(); let fired = -999;
 w.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1) { row.attacks++; fired = w.tick; } });
 w.events.on('sim.tick', () => {
 row.ticks++; const p = w.entities.get(1)!;
 const aim = w.inputFrame.aim; const attacking = w.tick - fired <= 60;
 for (const e of w.entities.iterate()) {
 if (!e.infected || e.health.current <= 0 || !aim || !attacking) { watch.delete(e.id); continue; }
 const dx = e.transform.x - p.transform.x, dz = e.transform.z - p.transform.z, d = Math.hypot(dx,dz);
 if (d > 1 || dx*aim.x+dz*aim.z < d*.7) { watch.delete(e.id); continue; }
 row.contacts++; let seen = watch.get(e.id);
 if (!seen || seen.hp !== e.health.current) { seen = { hp:e.health.current,since:w.tick,reported:false }; watch.set(e.id,seen); }
 if (!seen.reported && w.tick-seen.since > 120) { seen.reported=true; row.flags.push({ tick:w.tick,id:e.id,hp:e.health.current,d,playerY:p.transform.y,targetY:e.transform.y,state:e.infected.state,weapon:p.weapons?.selectedSide }); }
 }
 });
 } });
 row.outcome=report.outcome; console.log(JSON.stringify(row));
}
const path='docs/reports/s142-l3hit/evidence.json',v=JSON.parse(readFileSync(path,'utf8'));v.campaignWindowScan={secondsPerLevel:120,policy:'complete',seed:1,rows};writeFileSync(path,JSON.stringify(v,null,2)+'\n');
