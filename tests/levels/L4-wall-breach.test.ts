import { afterEach, expect, test } from 'vitest';
import { l4 } from '../../src/data/l4';
import { l4Breaches, l4WallSlots } from '../../src/data/l4Perimeter';
import { objectiveText } from '../../src/sim/missions/objectiveText';
import { cowerThreatM } from '../../src/sim/outbreak/Outbreak';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';

/**
 * PO 10-23 ("L4 is still no action ... make them destructable, so Zombies or alphas can tear them down and then float oin"): the military
 * wall is E26 slots; the first Alpha is announced at the west wall, tears the breach down by logged damage, and the horde comes in through
 * the gap. PO Q-159 ("Also in L4 people behave strange"): nobody cowers in the open without an infected within `cowerThreatM`.
 */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const HEAVY = 1_800_000;
const per = l4.perimeter, inside = (p: { x: number; z: number }) => p.x > per.x0 && p.x < per.x1 && p.z > per.z0 && p.z < per.z1;

test('T-E22-wall @nightly @E22 @E22-AC13 the west wall falls to an announced Alpha by logged E26 damage and the horde comes through the gap (low)', async () => {
  const l = await loadL4(3, 'low'); world = l.world; const w = l.world, m = l.mission;
  const damage: { slot: string; source: string; amount: number }[] = [], broken: string[] = [];
  w.events.on('barricade.damaged', e => { if (e.type === 'barricade.damaged' && e.groupId === 'l4-wall') damage.push({ slot: e.slotId, source: w.entities.get(e.sourceId)?.archetype ?? '?', amount: e.amount }); });
  w.events.on('barricade.broken', e => { if (e.type === 'barricade.broken' && e.groupId === 'l4-wall') broken.push(e.slotId); });
  let text = '', marker: string | null = null, announcedText = '', throughGap = 0, cowerViolations = 0, sheltered = 0;
  const staleCowers: unknown[] = [];
  const westIds = new Set(l4Breaches.west.segments.map(i => l4WallSlots[i].id)), seenInside = new Set<number>();
  runL4(w, m, 'idle', { seed: 3, god: true, maxSeconds: 200, stopWhen: mm => {
    const s = mm.state.l4!; if (!s.turnAt) return false;
    const t = (w.tick - s.turnAt) / 60, hold = mm.def.steps.find(d => d.id === 'hold')!;
    if (s.breaches?.west?.announcedAt && !s.breaches.west.openAt && !announcedText) announcedText = objectiveText(mm, hold.text);
    if (s.breaches?.west?.openAt && !text) { text = objectiveText(mm, hold.text); marker = mm.state.marker; }
    if (s.breaches?.west?.openAt && w.tick % 30 === 0) for (const e of w.infected!.active) if (e.health.current > 0 && inside(e.transform) && !seenInside.has(e.id) && e.transform.x < per.x0 + 6) { seenInside.add(e.id); throughGap++; }
    if (w.tick % 60 === 0) for (const e of w.entities.iterate()) {
      const c = e.civilian; if (!c || c.ally || e.hidden || e.health.current <= 0 || e.infection) continue;
      if (c.schedule?.[c.scheduleStep ?? 0]?.anchor === 'refuge/shelter') sheltered++;
      if (c.story?.clip !== 'npc-cower') continue;
      // 10-tick check cadence: allow the distance a runner covers meanwhile.
      const near = [...w.infected!.active, ...[...w.entities.iterate()].filter(x => x.infection && x.id !== e.id)].some(a => a.health.current > 0 && !a.hidden && Math.hypot(a.transform.x - e.transform.x, a.transform.z - e.transform.z) < cowerThreatM + 2);
      if (!near) { cowerViolations++; staleCowers.push({ t, id: e.id, state: c.state, anchor: c.schedule?.[c.scheduleStep ?? 0]?.anchor, at: { ...e.transform } }); }
    }
    return t > 75;
  } });
  const s = m.state.l4!;
  expect(s.breaches?.west?.announcedAt, 'the Alpha is announced at the wall').toBeGreaterThan(0);
  expect(announcedText).toMatch(/^Alpha at the west wall/);
  expect(s.breaches?.west?.openAt, 'the west wall falls').toBeGreaterThan(s.breaches!.west!.announcedAt);
  expect((s.breaches!.west!.openAt - s.turnAt) / 60, 'within the line-1 beat').toBeLessThan(l4.director.lines[0].dueS);
  // Only the breach site fell, only by logged damage, and the Alpha did the decisive damage.
  expect(broken.length).toBeGreaterThan(0); expect(broken.every(id => westIds.has(id))).toBe(true);
  const west = damage.filter(d => westIds.has(d.slot));
  expect(west.filter(d => d.source === 'infected.alpha').reduce((a, d) => a + d.amount, 0)).toBeGreaterThanOrEqual(west.reduce((a, d) => a + d.amount, 0) / 2);
  expect(text).toMatch(/^Hold the west breach/); expect(marker).toBe('l4-breach-west');
  expect(throughGap, 'infected come in through the west gap').toBeGreaterThanOrEqual(3);
  expect(sheltered, 'civilians reach real shelter').toBeGreaterThan(0);
  expect(cowerViolations, `no cower without an infected close by: ${JSON.stringify(staleCowers)}`).toBe(0);
}, HEAVY);
