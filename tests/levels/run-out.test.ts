import { afterEach, describe, expect, test } from 'vitest';
import { runOutRule } from '../../src/sim/missions/Respawn';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadLevel } from '../../tools/sim-runner/levels';

/**
 * PO 2026-10-13 verbatim: "For all levels. After I reached the final checkpoint, if there is still action, then let it go for another 5s,
 * so it doesn't feel cutted." The shared completion path (Mission.finish) holds the result/transition for 5 s while infected are engaged
 * within 25 m or a swing, shot or explosion happened in the last 2 s; without action the level ends at once.
 */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });

/** Complete every objective but the finishing one, then the finishing one with or without a chasing crowd next to the courier. */
async function finishLevel(level: 'L2' | 'L6', withAction: boolean) {
  const w = world = await loadLevel(level, 1), m = w.missions!, p = w.entities.get(1)!;
  const requested: number[] = [], completed: number[] = [];
  w.events.on('progression.requested', e => { requested.push(e.tick); });
  w.events.on('level.completed', e => { completed.push(e.tick); });
  for (let i = 0; i < 120; i++) w.update();
  for (let guard = 0; guard < 60 && m.state.phase === 'playing'; guard++) {
    const active = m.def.steps.filter(s => m.state.steps[s.id].status === 'active');
    if (active.length === 0) break;
    const last = active.length === 1 && m.def.finish.includes(active[0].id);
    if (last) {
      // Calm start: no infected chasing, no swings in the last 2 s.
      // Objectives are completed back to back here, so L6's staged breach arrivals (fed in over 32 ticks) are still pending: a calm start has none.
      if (m.state.l6) delete m.state.l6.arrivals;
      for (const e of w.infected!.active) if (e.health.current > 0) { e.health.current = 0; e.hidden = true; }
      for (let i = 0; i < 180; i++) w.update();
      if (withAction) {
        let placed = 0;
        for (let r = 3; r <= 12 && placed < 3; r++) for (let k = 0; k < 12 && placed < 3; k++) {
          const at = { x: p.transform.x + Math.cos(k * Math.PI / 6) * r, z: p.transform.z + Math.sin(k * Math.PI / 6) * r };
          if (!w.infected!.nav.clear(at.x, at.z, .6)) continue;
          try { w.infected!.spawn('infected.runner', at, { state: 'chase' }); placed++; } catch { /* collider */ }
        }
        expect(placed).toBeGreaterThan(0);
        for (let i = 0; i < 30; i++) w.update();
      }
    }
    if (m.state.phase !== 'playing') break;
    m.completeObjective(active[0].id);
    if (last) break;
  }
  return { w, m, p, requested, completed };
}

describe('run-out after the final objective', () => {
  for (const level of ['L2', 'L6'] as const) {
    // L2 ends in the middle of its horde: the no-action case is L6 (night walk, nothing chasing).
    if (level === 'L6') test(`${level}: without action the level ends at once`, async () => {
      const { m, requested } = await finishLevel(level, false);
      expect(m.state.runOutUntil, `no run-out, phase ${m.state.phase}`).toBeUndefined();
      expect(m.def.finish.every(id => m.state.steps[id].status === 'completed'), 'finish objectives done').toBe(true);
      expect(m.state.phase === 'result' || m.state.phase === 'progression' || m.state.phase === 'cinematic').toBe(true);
      expect(requested.length).toBeLessThanOrEqual(1);
    }, 300_000);

    test(`${level}: with action the world runs ${runOutRule.seconds} s, invulnerable, then the transition happens once`, async () => {
      const { w, m, p, requested, completed } = await finishLevel(level, true);
      const t0 = w.tick;
      expect(m.state.phase, 'still playing during the run-out').toBe('playing');
      expect(m.state.runOutUntil).toBe(t0 + runOutRule.seconds * 60);
      expect(completed).toHaveLength(0);
      for (let i = 0; i < runOutRule.seconds * 60 - 2; i++) { w.update(); expect(p.survivor!.invulnerableUntil).toBeGreaterThan(w.tick); }
      expect(completed, 'not before 5 s').toHaveLength(0);
      for (let i = 0; i < 400 && !completed.length; i++) w.update();
      expect(completed).toHaveLength(1);
      expect(completed[0] - t0).toBeGreaterThanOrEqual(runOutRule.seconds * 60 - 2);
      expect(completed[0] - t0).toBeLessThanOrEqual(runOutRule.seconds * 60 + 4);
      for (let i = 0; i < 300; i++) w.update();
      expect(completed, 'saved once').toHaveLength(1);
      expect(requested.length).toBeLessThanOrEqual(1);
    }, 300_000);
  }
});
