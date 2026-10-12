import { expect, test } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import { TrapRescue } from '../../src/sim/world/TrapRescue';
import { followFrustum, loadL3 } from '../../tools/sim-runner/l3Bots';

/** PO 10-12: "Somehow everone walked through the gap of the bridge and just ended up downstairs." and "the player is locked in below the bridge". */
const DECK_Y = 5.2;
type World = Awaited<ReturnType<typeof loadL3>>['world'];
const place = (w: World, id: number, x: number, z: number) => {
  const e = w.entities.get(id)!, at = { x, y: .72 + (w.districts?.groundHeight(x, z) ?? 0), z };
  Object.assign(e.transform, at); w.spatial.set(id, x, z);
  if (id === 1) { w.physics.playerBody!.setTranslation(at, true); w.previousPlayer = { ...e.transform }; }
};
const quiet = (w: World) => { for (const e of w.infected!.active) e.health.current = 0; for (const e of w.entities.iterate()) if (e.hazard?.kind === 'fire') e.hazard.activeUntil = -1; };

test('@E21 L3 nav: no deck cell links to the lower road except along the authored ramps', async () => {
  const { world: w } = await loadL3(1);
  try {
    const nav = w.infected!.nav, d = w.districts!, st = .3, drops: string[] = [];
    for (let z = -9; z <= 9; z += st) for (let x = 130; x <= 215; x += st) {
      if (!nav.clear(x, z, .3)) continue;
      const g = d.groundHeight(x, z);
      for (const [dx, dz] of [[st, 0], [0, st], [st, st], [st, -st]]) {
        if (!nav.clear(x + dx, z + dz, .3)) continue;
        const g2 = d.groundHeight(x + dx, z + dz);
        if (Math.abs(g - g2) > .6) drops.push(`${x.toFixed(1)},${z.toFixed(1)} h${g.toFixed(1)} -> ${(x + dx).toFixed(1)},${(z + dz).toFixed(1)} h${g2.toFixed(1)}`);
      }
    }
    expect(drops, drops.slice(0, 6).join(' | ')).toEqual([]);
  } finally { w.dispose(); }
}, 120000);

test('@E21 L3 sim: nobody leaves the deck through the ramp-to-span junctions, and the group crosses the whole bridge on the deck', async () => {
  const { world: w, mission: m } = await loadL3(1);
  try {
    quiet(w); const courier = w.entities.get(1)!;
    // The two junction slots from the PO screenshot: walk off the edge of the deck at each.
    for (const [x, z, dir] of [[166.4, 1.0, 1], [180.6, -1.0, -1], [172, 1.9, 1], [175, -1.9, -1]] as const) {
      place(w, 1, x, z); const y0 = courier.transform.y;
      expect(y0).toBeGreaterThan(DECK_Y);
      for (let tick = 0; tick < 240; tick++) { quiet(w); w.applyInput({ ...emptyInput(), move: { x: 0, z: dir }, walk: true }, 'keyboard'); w.update(); }
      expect(courier.transform.y - .72, `fell off the deck at ${x},${z}: ${JSON.stringify(courier.transform)}`).toBeGreaterThan(DECK_Y);
    }
    // Full crossing with real navigation, courier plus companion and squad.
    for (const id of m.state.l3!.officerIds) if (!m.state.l3!.squadIds.includes(id)) w.entities.get(id)!.health.current = 0;
    m.completeObjective('armory'); m.completeObjective('defend');
    const state = m.state.l3!; state.pending = []; state.waves = []; state.populated = [true, true, true];
    place(w, 1, 134, 0);
    const goal = { x: 207, z: 0 }, actors = [1, ...state.squadIds, ...[...w.entities.iterate()].filter(e => e.companion).map(e => e.id)];
    let minDeckY = Infinity, onDeck = 0, fell = '';
    for (let tick = 0; tick < 12000 && Math.hypot(courier.transform.x - goal.x, courier.transform.z - goal.z) > 1; tick++) {
      state.pending = []; quiet(w); followFrustum(w);
      w.applyInput({ ...emptyInput(), moveTarget: goal, navigation: true }, 'mouse-only'); w.update();
      for (const id of actors) {
        const e = w.entities.get(id); if (!e) continue;
        const feet = e.transform.y - (e.companion ? .3 : .7);
        // Between the two ramp crowns the span is at deck height; anything lower there means a fall.
        if (e.transform.x > 168 && e.transform.x < 179) { minDeckY = Math.min(minDeckY, feet); if (id === 1) onDeck++; if (feet < DECK_Y && !fell) fell = `${id} at ${JSON.stringify(e.transform)} tick ${tick}`; }
      }
    }
    expect(courier.transform.x).toBeGreaterThan(205);
    expect(onDeck, 'courier crossed the span').toBeGreaterThan(30);
    expect(fell, `someone dropped below the deck (min ${minDeckY.toFixed(2)})`).toBe('');
  } finally { w.dispose(); }
}, 360000);

test('@E21 L3 safety net: a player stranded off the route for 3 s is faded out and put back on a cell that reaches the objective', async () => {
  const { world: w } = await loadL3(1);
  try {
    quiet(w);
    const rescue = w.trapRescue!; expect(rescue).toBeTruthy();
    // The enclosed lower outskirts between the highway entries (reachable only by falling).
    place(w, 1, 160, -9); const start = { ...w.entities.get(1)!.transform };
    let fadedAt = -1;
    for (let tick = 0; tick < TrapRescue.waitTicks + TrapRescue.fadeTicks + 60; tick++) {
      quiet(w); w.applyInput(emptyInput(), 'keyboard'); w.update();
      if (rescue.fading && fadedAt < 0) fadedAt = tick;
      if (rescue.rescues) break;
    }
    expect(rescue.rescues).toBe(1); expect(fadedAt).toBeGreaterThanOrEqual(TrapRescue.waitTicks - 2); expect(fadedAt).toBeLessThan(TrapRescue.waitTicks + 20);
    const after = w.entities.get(1)!.transform;
    expect(Math.hypot(after.x - start.x, after.z - start.z)).toBeGreaterThan(2);
    expect(rescue.fading).toBe(false);
    // Settled on the route: stays put for another 4 s.
    for (let tick = 0; tick < 240; tick++) { quiet(w); w.applyInput(emptyInput(), 'keyboard'); w.update(); }
    expect(rescue.rescues).toBe(1);
  } finally { w.dispose(); }
}, 120000);
