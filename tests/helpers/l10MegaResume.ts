import { expect } from 'vitest';
import { decodeSave } from '../../src/sim/progression/Save';
import { loadLevel } from '../../tools/sim-runner/levels';
import { markerAnchor } from '../../src/sim/missions/markerAnchor';
import { emptyInput } from '../../src/input/InputFrame';
import { readFixture } from '../../tools/qa/fixture-io';

// r29-l10mega (called from tests/engine/missions.test.ts; the test budget forbids a new case): a resumed L10 console save kept the Mega stunned until the old absolute tick (minutes), so "Kill the Mega Alpha"
// showed no Mega. Timers must be rebased, the Mega must reach the courier at the console, and the objective must point at it.
export async function l10MegaResumeCheck(): Promise<void> {
  const f = readFixture('tests/fixtures/saves/qa/l10-dispersal-console.json.gz');
  const decoded = decodeSave(JSON.stringify(f.campaign));
  if (decoded.status !== 'ok') throw new Error('decode');
  const world = await loadLevel('L10', 1, decoded.save);
  try {
    const m = world.missions!;
    m.loadResume(decoded.save.cureResume!);
    const player = world.entities.get(1)!, console_ = m.def.anchors['cure-console'];
    const mega = world.megaPursuit!.entity()!;
    expect(mega.combat!.staggerUntil - world.tick, 'rebased stagger, not an absolute tick from the old clock').toBeLessThan(600);
    let near = -1, guide: ReturnType<typeof markerAnchor> = null;
    for (let t = 0; t < 70 * 60; t++) {
      player.health.current = player.health.max;
      const fr = emptyInput(), pc = Math.hypot(console_.x - player.transform.x, console_.z - player.transform.z);
      if (pc > 1.2) fr.move = { x: (console_.x - player.transform.x) / pc, z: (console_.z - player.transform.z) / pc };
      fr.interact = t % 60 < 45 && pc <= console_.radius;
      world.applyInput(fr, 'keyboard'); world.update();
      const e = world.megaPursuit!.entity()!;
      if (near < 0 && Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) <= 15) near = t;
      if (!guide && m.state.steps.mega.status === 'active') guide = markerAnchor(m);
    }
    expect(near, 'Mega within 15 m of the courier').toBeGreaterThanOrEqual(0);
    expect(near / 60).toBeLessThan(20);
    expect(m.state.states['charge-ready']).toBe(true);
    expect(guide, 'Mega objective has a live pointer').not.toBeNull();
    expect(Math.hypot(guide!.x - console_.x, guide!.z - console_.z)).toBeLessThan(40);
  } finally { world.dispose(); }
}
