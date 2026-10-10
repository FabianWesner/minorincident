/** Measures real perception along three bat-to-station street routes, with normal walking input. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadL1, runL1, Walker } from './l1Bots';
const out = process.argv[2] ?? 'test-results/l1-street-infected/after';
mkdirSync(out, { recursive: true });
const rows = [];
for (const [name, points] of Object.entries({
  direct: [[14, 30], [14, -36], [40.03, -36], [40.03, -40.65]],
  west: [[-30, 30], [-30, -36], [40.03, -36], [40.03, -40.65]],
  east: [[66, 30], [66, 0], [50, 0], [50, -36], [40.03, -36], [40.03, -40.65]],
})) {
  if (process.argv[3] && name !== process.argv[3]) continue;
  const { world: w, mission: m } = await loadL1(1);
  try {
    runL1(w, m, 'complete', { stopWhen: m => m.state.steps.weapon.status === 'completed' });
    // After the first real damage, protect the observer so the entire route can be sampled.
    w.combat!.damage.god = false;
    const initialHP = w.entities.get(1)!.health.current; let damage = 0;
    const walker = new Walker(), noticed = new Set<number>();
    let leg = 0, travelled = 0, hits = 0, last = { ...w.entities.get(1)!.transform };
    const notices: { id: number; m: number; x: number; z: number }[] = [];
    const stop = w.events.on('infected.attack', e => { if (e.type === 'infected.attack' && e.targetId === 1) hits++; });
    for (let i = 0; i < 60 * 180 && m.state.phase === 'playing'; i++) {
      const player = w.entities.get(1)!;
      if (player.health.current < initialHP && !damage) { damage = initialHP - player.health.current; w.combat!.damage.god = true; }
      const p = player.transform;
      travelled += Math.hypot(p.x - last.x, p.z - last.z); last = { ...p };
      for (const e of w.infected!.active) if (e.health.current > 0 && e.infected?.l1?.targetId === 1 && ['chase', 'bite'].includes(e.infected.l1.mode) && !noticed.has(e.id)) {
        noticed.add(e.id); notices.push({ id: e.id, m: +travelled.toFixed(1), x: p.x, z: p.z });
      }
      const goal = { x: points[leg][0], z: points[leg][1] };
      if (Math.hypot(p.x - goal.x, p.z - goal.z) < (leg === points.length - 1 ? .25 : 1.2) && leg < points.length - 1) { leg++; walker.reset(); }
      w.setInput({ move: walker.step(w, { x: points[leg][0], z: points[leg][1] }, leg === points.length - 1 ? .25 : 1, String(leg)) ?? { x: 0, z: 0 }, left: { down: false, held: false, up: false }, attackTarget: undefined });
      w.update();
    }
    stop();
    // New encounters begin after 10 m of walking since the previous encounter's first detection.
    const encounters: { m: number; ids: number[] }[] = [];
    for (const n of notices) { const prev = encounters.at(-1); if (!prev || n.m - prev.m >= 10) encounters.push({ m: n.m, ids: [n.id] }); else prev.ids.push(n.id); }
    const positions = [0, ...encounters.map(e => e.m), travelled];
    const row = { route: name, finished: m.state.steps.firestation.status === 'completed', metres: +travelled.toFixed(1), encounters: encounters.length, noticed: noticed.size, longestGapM: +Math.max(...positions.slice(1).map((v, i) => v - positions[i])).toFixed(1), attacks: hits, damageBeforeProtection: damage, groups: encounters, notices, population: m.state.l1!.streetGroups?.map(g => ({ ...g, members: g.ids.map(id => { const e = w.entities.get(id)!; return { id, hp: e.health.current, x: e.transform.x, z: e.transform.z, mode: e.infected?.l1?.mode, target: e.infected?.l1?.targetId }; }) })) };
    rows.push(row); console.log(JSON.stringify(row));
  } finally { w.dispose(); }
}
writeFileSync(`${out}/routes.json`, JSON.stringify(rows, null, 2) + '\n');
