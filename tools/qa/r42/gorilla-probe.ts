/* eslint-disable @typescript-eslint/no-explicit-any -- diagnostic (r42-arenas) */
// l8-before-gorilla, courier with the MG shooting the gorilla (real input frames: aim + right button) from a fixed spot:
// counts the gorilla's hits on her and the time to kill. Usage: tsx gorilla-probe.ts [stay-z] [god]
import { loadLevel } from '../../sim-runner/levels';
import { readFixture } from '../fixture-io';
import { decodeSave } from '../../../src/sim/progression/Save';
import { emptyInput } from '../../../src/input/InputFrame';
const stayZ = Number(process.argv[2] ?? -14), god = process.argv[3] === 'god';
const fx: any = readFixture('tests/fixtures/saves/qa/l8-before-gorilla.json.br'), decoded = decodeSave(JSON.stringify(fx.campaign));
if (decoded.status !== 'ok') throw new Error('decode');
const w: any = await loadLevel('L8', 1, decoded.save, 0, { quality: 'low' } as any);
w.missions.loadResume(fx.resume);
w.combat.damage.god = god;
const pe = w.entities.get(1), p = pe.transform;
const arena = w.missions.l8.state.arenas.find((a: any) => a.id === 'gorilla');
const rack = pe.weapons.RIGHT.rack; const mg = rack.findIndex((r: any) => /mg/.test(r.id));
console.log('rack', rack.map((r: any) => r.id).join(','), 'mg', mg);
w.applyInput({ ...emptyInput(), selectedSlot: { side: 'RIGHT', index: Math.max(0, mg) } }, 'keyboard'); for (let i = 0; i < 30; i++) w.update();
const gor = () => arena.ids.map((id: number) => w.entities.get(id)).find((e: any) => e?.infected && e.health.current > 0);
let hitsOnHer = 0, hpLost = 0; w.events.on('combat.hit', (e: any) => { if (e.targetId === 1 && e.sourceId !== 1) hitsOnHer++; });
let engagedAt = -1, lastHp = pe.health.current;
for (let i = 0; i < 5400; i++) {
  const g = gor() ?? (process.env.SHOOT0 ? arena.ids.map((id: number) => w.entities.get(id)).find((e: any) => e && e.health.current > 0) : undefined);
  const tx = 60, tz = stayZ; const f: any = emptyInput();
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz); if (d > .4) f.move = { x: dx / d, z: dz / d };
  if (g && (arena.phase > 0 || process.env.SHOOT0)) { const ax = g.transform.x - p.x, az = g.transform.z - p.z, ad = Math.hypot(ax, az) || 1; Object.assign(f, { aim: { x: ax / ad, z: az / ad }, aimPoint: { x: g.transform.x, z: g.transform.z }, aimSource: 'pointer', strafe: true, right: { down: i % 20 === 0, held: true, up: false } }); }
  w.applyInput(f, 'mouse-keyboard'); w.update();
  if (engagedAt < 0 && arena.phase > 0) engagedAt = w.tick;
  if (pe.health.current < lastHp) hpLost += lastHp - pe.health.current; lastHp = pe.health.current; if (!god && pe.health.current < 30) pe.health.current = 100;
  if (i % 30 === 0 && g && g.infected?.arenaBoss?.cover) console.log('  cover', JSON.stringify(g.infected.arenaBoss.cover), 'stag', g.combat.staggerUntil, 'tick', w.tick, 'cur', JSON.stringify(Object.keys(g.infected).filter(k => /stun|stag|freeze/i.test(k)).map(k => [k, g.infected[k]])), 'los', w.combat.query.shotVisible(p, g.transform), 'gor', g.transform.x.toFixed(1), g.transform.z.toFixed(1), 'hp', Math.round(g.health.current), 'pillars', w.destruction.objects.filter((o: any) => o.id.includes('gorilla-pillar')).map((o: any) => o.home.p.map((n: number) => +n.toFixed(1)).join('/') + (o.state.collapsed ? 'X' : '')).join(' '));
  if (i % 120 === 0 && g) console.log(w.tick, 'phase', arena.phase, 'armed', arena.armed, 'her', p.x.toFixed(1), p.z.toFixed(1), 'gor', g.transform.x.toFixed(1), g.transform.z.toFixed(1), 'hp', Math.round(g.health.current), g.infected?.state, g.infected?.specialAttack?.move ?? '-', 'hits', hitsOnHer);
  if (!g && (arena.phase > 0 || process.env.SHOOT0) && arena.ids.every((id: number) => (w.entities.get(id)?.health.current ?? 0) <= 0)) { console.log('gorilla dead at tick', w.tick, 'engaged', engagedAt, 'fight s', ((w.tick - engagedAt) / 60).toFixed(1), 'hitsOnHer', hitsOnHer, 'hpLost', hpLost); break; }
}
console.log('end phase', arena.phase, 'ids', arena.ids.map((id: number) => Math.round(w.entities.get(id)?.health.current ?? -1)).join(','), 'her', p.x.toFixed(1), p.z.toFixed(1)); console.log('end phase', arena.phase, 'hitsOnHer', hitsOnHer);
w.dispose();
