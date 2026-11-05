/** Controlled contact fixture: a courage-hidden dog travels, then recovers in a crowd.
 * Disabling history invalidation is the pre-fix fault control. No route/visual claim. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { provenance } from './accept/probe';

const cases = [];
for (const fault of [true, false]) {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1);
  try {
    const dog = w.entities.get(w.npcs!.companion.spawn())!;
    assert(w.solids.relocate(dog, { x: 10, y: .3, z: 10 }, 'probe.before-hide', 0, false));
    w.tick++; w.solids.commit();
    const old = { ...dog.transform };
    dog.companion!.state = 'hide'; w.tick++; w.solids.commit();
    Object.assign(dog.transform, { x: 20, z: 10 }); w.tick++; w.solids.commit();
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4, x = 20 + Math.cos(angle) * 1.3, z = 10 + Math.sin(angle) * 1.3;
      const id = w.infected!.spawn('infected.alpha', { x, z }, { state: 'idle' }), e = w.entities.get(id)!;
      Object.assign(e.transform, { x, z }); w.solids.remember(e, 'probe.recovery-crowd');
    }
    const current = { ...dog.transform };
    const forget = w.solids.forget.bind(w.solids);
    if (fault) w.solids.forget = () => {};
    dog.companion!.until = w.tick; w.npcs!.companion.update();
    w.solids.forget = forget;
    assert.equal(dog.companion!.state, 'follow');
    w.tick++; w.solids.commit();
    const displacementM = Math.hypot(dog.transform.x - current.x, dog.transform.z - current.z);
    assert(fault ? displacementM >= 9 : displacementM <= 4.01);
    assert.equal(w.solids.snapshot().failures, 0);
    cases.push({ fault, old, current, recovered: { ...dog.transform }, displacementM, collision: w.solids.snapshot() });
  } finally { w.dispose(); }
}
const out = 'docs/reports/sweep-b/corgi'; mkdirSync(out, { recursive: true });
const tool = 'tools/qa/sweep-b-corgi-recovery.ts';
writeFileSync(`${out}/recovery-proof.json`, JSON.stringify({ ...provenance(), tool,
  toolSha256: createHash('sha256').update(readFileSync(tool)).digest('hex'),
  method: 'Controlled synthetic crowd contact; actual Companion.update and SolidRegistry.commit. Pre-fix fault suppresses only history invalidation.', cases }, null, 2) + '\n');
console.log(JSON.stringify(cases.map(c => ({ fault: c.fault, displacementM: c.displacementM, collisionFailures: c.collision.failures }))));
