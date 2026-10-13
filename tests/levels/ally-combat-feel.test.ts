import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../src/sim/world/types';
import { followFrustum, loadL3, runL3 } from '../../tools/sim-runner/l3Bots';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';
import { l4, l4Crowd } from '../../src/data/l4';

const slots = [...l4Crowd.queue.line1, ...l4Crowd.queue.line2, ...l4.calm.waiting];

/**
 * ally-combat-feel (PO 2026-10-13, verbatim): "Everyone is just standing around and shooting, this doesn'T look like a fight scene."
 * "Peds with weapons need to use them against Zombies". "Also seems like visibility range of soldiers is so high, that they kill all
 * Zombies before i see them myself". Fighting allies keep moving, nobody fires at an infected outside the player's view, and the
 * unarmed queue breaks up the moment the war starts. One seed per level (PO 10-09: no batteries).
 */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const HEAVY = 1_800_000;

interface FightMetrics {
  /** Mean share of fighting allies that moved >= 0.5 m within the trailing 5 s window. */
  moved5: number;
  /** Mean share of fighting allies standing still (< 0.25 m) for more than 2 s. */
  still2: number;
  /** Ally shots (soldiers, officers, armed civilians, HMG crews, the helicopter) at a target outside the player's view, and all shots. */
  offscreenShots: number; shots: number;
  /** Most unarmed civilians still standing in the registration queue (calm) 3 s or more into the fight. */
  queued: number;
  fighters: number; samples: number;
}
const fighting = (e: EntitySnapshot, tick: number) => e.health.current > 0 && !e.infection && !e.hidden && !!e.civilian?.ally && e.civilian.state !== 'grabbed' && e.civilian.state !== 'bitten' && tick >= e.civilian.knockedUntil;

/** Samples every 15 ticks: an ally is "in the fight" while it had a target within the last 3 s and stays fighting for the window. */
function observer(w: SimWorld, allies: () => EntitySnapshot[], queueIds: () => number[]) {
  const lastTarget = new Map<number, number>(), anchor = new Map<number, { x: number; z: number; tick: number }>(), trail = new Map<number, { x: number; z: number; tick: number }[]>();
  let moved = 0, movedN = 0, still = 0, stillN = 0, shots = 0, offscreen = 0, queued = 0, samples = 0;
  const seen = new Set<number>();
  // A checkpoint restore (the idle courier can still be dragged down) puts everybody back where they stood at the turn.
  let restoredAt = -1e9;
  const offRestore = w.events.on('checkpoint.restored', e => { restoredAt = e.tick; });
  const off = w.events.on('ally.attack', e => {
    if (e.type !== 'ally.attack' || !e.targetId || e.role === 'firefighter' || e.role === 'tank' || !e.from) return;
    const t = w.entities.get(e.targetId); if (!t) return;
    shots++; if (!w.infected!.director.inPlayerView(t.transform)) offscreen++;
  });
  return {
    tick(combatS: number) {
      const tick = w.tick;
      for (const e of allies()) if (e.civilian!.ally!.targetId) lastTarget.set(e.id, tick);
      if (tick % 15) return;
      samples++;
      for (const e of allies()) {
        const p = { x: e.transform.x, z: e.transform.z, tick };
        const active = fighting(e, tick) && tick - (lastTarget.get(e.id) ?? -1e9) <= 180;
        if (!active) { anchor.delete(e.id); trail.delete(e.id); continue; }
        seen.add(e.id);
        const a = anchor.get(e.id);
        if (!a || Math.hypot(p.x - a.x, p.z - a.z) >= .25) anchor.set(e.id, p);
        const since = (tick - (anchor.get(e.id)!.tick)) / 60;
        const tr = trail.get(e.id) ?? []; tr.push(p); while (tr.length && tick - tr[0].tick > 300) tr.shift(); trail.set(e.id, tr);
        // Judge stillness only once the ally has been in the fight for 2 s, mobility once it has a full 5 s window.
        if (tick - tr[0].tick >= 120 || since > 2) { stillN++; if (since > 2) still++; }
        if (tick - tr[0].tick >= 285) { movedN++; if (tr.some(q => Math.hypot(q.x - tr[0].x, q.z - tr[0].z) >= .5)) moved++; }
      }
      if (combatS >= 3 && tick - restoredAt >= 180) {
        let n = 0;
        for (const id of queueIds()) {
          const e = w.entities.get(id), c = e?.civilian;
          if (!c || c.ally || e!.infection || e!.health.current <= 0 || e!.hidden) continue;
          // Standing in line: a calm (or frozen alarmed) person on a registration-queue or waiting slot.
          if ((c.state === 'calm' || c.state === 'alarmed') && slots.some(([x, z]) => Math.hypot(e!.transform.x - x, e!.transform.z - z) < 1.2)) n++;
        }
        queued = Math.max(queued, n);
      }
    },
    done(): FightMetrics { off(); offRestore(); return { moved5: movedN ? moved / movedN : 1, still2: stillN ? still / stillN : 0, offscreenShots: offscreen, shots, queued, fighters: seen.size, samples }; },
  };
}
function record(name: string, value: unknown) { mkdirSync('test-results/epics/E22', { recursive: true }); writeFileSync(`test-results/epics/E22/${name}.json`, JSON.stringify(value, null, 1) + '\n'); }
function feel(m: FightMetrics): void {
  expect(m.fighters).toBeGreaterThanOrEqual(4);
  expect(m.moved5).toBeGreaterThanOrEqual(.7);
  expect(m.still2).toBeLessThan(.2);
  expect(m.offscreenShots).toBe(0);
}

describe('ally combat feel', () => {
  test('L4 war: soldiers and armed civilians keep moving, never fire off screen, and the queue breaks up', async () => {
    const l = await loadL4(2); world = l.world; const w = l.world, m = l.mission;
    runL4(w, m, 'idle', { seed: 2, god: true, maxSeconds: 300, stopWhen: mm => mm.state.l4!.phase === 'war' });
    const s = m.state.l4!, allies = () => [...s.soldierIds, ...s.armed.map(a => a.id)].map(id => w.entities.get(id)).filter((e): e is EntitySnapshot => !!e?.civilian?.ally);
    const queue = () => [...s.evacueeIds, ...s.residentIds];
    const o = observer(w, allies, queue);
    for (let t = 0; t < 30 * 60; t++) { followFrustum(w); w.applyInput(emptyInput(), 'keyboard'); w.update(); o.tick((w.tick - s.turnAt) / 60); }
    const r = o.done(); record('ally-feel-l4', r);
    feel(r);
    expect(r.queued).toBe(0);
  }, HEAVY);

  test('L3 station attack: the police move and fight in view of the idle courier', async () => {
    const l = await loadL3(1); world = l.world; const w = l.world, m = l.mission;
    runL3(w, m, 'complete', { stopWhen: mm => !!mm.state.l3!.attackAt });
    w.combat!.damage.god = true;
    const s = m.state.l3!, allies = () => s.officerIds.map(id => w.entities.get(id)).filter((e): e is EntitySnapshot => !!e?.civilian?.ally);
    const o = observer(w, allies, () => []);
    for (let t = 0; t < 30 * 60; t++) { followFrustum(w); w.applyInput(emptyInput(), 'keyboard'); w.update(); o.tick(0); }
    const r = o.done(); record('ally-feel-l3', r);
    feel(r);
  }, HEAVY);
});
