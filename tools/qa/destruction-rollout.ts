/** Native placement/damage/checkpoint audit; destructive fixtures run in disposable worlds. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadLevel, type RunnerLevel } from '../sim-runner/levels';
import { Explosions } from '../../src/sim/combat/Explosions';

const outputIndex = process.argv.indexOf('--out');
const output = outputIndex < 0 ? 'test-results/r16-destroll/destruction.json' : process.argv[outputIndex + 1];
const weapons = {
  melee: 'weapon.bat', sidearm: 'weapon.handgun', shotgun: 'weapon.shotgun',
  automatic: 'weapon.army-mg', explosive: 'weapon.rocket-launcher', fire: 'weapon.molotov',
};
const results = [];
for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L9', 'L10'] as RunnerLevel[]) {
  const world = await loadLevel(level, 1);
  try {
    const destruction = world.destruction!, mission = world.missions!;
    const checkpoint = mission.def.checkpoints[0];
    mission.checkpoint(checkpoint);
    const initial = destruction.snapshot();
    const targets = destruction.objects.filter(o => o.present && !o.protected);
    assert(targets.length > 0, `${level}: no live targets`);
    const classes: Record<string, number> = {};
    for (const object of targets) classes[object.placement.destruction!.class] = (classes[object.placement.destruction!.class] ?? 0) + 1;
    const families = [];
    for (const [family, action] of Object.entries(weapons)) {
      // Restore entities too: an owned fire from the preceding fixture can
      // outlive its object's burn clock and must not ignite the next fixture.
      mission.restore(checkpoint);
      assert.deepEqual(destruction.snapshot(), initial, `${level}/${family}: pristine checkpoint`);
      const nav = world.districts!.nav.cells.slice();
      // Normalized material contacts cover every occupied part. The lazy
      // district hash keeps bulk collider changes from rescanning the grid.
      // Counts describe native destruction responses, not player DPS.
      for (const object of targets) {
        assert(object.parts.some(p => p.role === 'structure'), `${object.id}: no structural hit geometry`);
        for (const [part, shape] of object.parts.entries()) destruction.damage({ object, part, distance: 0, local: shape.bounds.min, normal: [0, 1, 0] }, action, 3000);
      }
      let peakFires = 0, peakDebris = 0;
      for (let tick = 0; tick < 721; tick++) {
        world.tick++;
        destruction.update();
        world.hazards!.debris.update(world.tick);
        peakFires = Math.max(peakFires, world.entities.values().filter(e => e.hazard?.kind === 'fire' && e.hazard.activeUntil > world.tick).length);
        peakDebris = Math.max(peakDebris, world.hazards!.debris.pieces.length);
      }
      const damaged = targets.filter(o => o.state.hp.some((hp, i) => hp < o.parts[i].hp)).length;
      const brokenParts = targets.reduce((n, o) => n + o.state.hp.filter(hp => hp === 0).length, 0);
      const collapsed = targets.filter(o => o.state.collapsed).length;
      assert(damaged > 0, `${level}/${family}: no response`);
      if (family === 'explosive') assert.equal(collapsed, targets.length, `${level}: rockets demolish every opted-in target`);
      assert(peakFires <= Explosions.maxFires, `${level}/${family}: fire cap`);
      assert(peakDebris <= 32, `${level}/${family}: debris cap`);
      assert(!world.districts!.nav.cells.some((cell, i) => nav[i] === 1 && cell === 0), `${level}/${family}: collapse closed navigation`);
      families.push({ family, action, damaged, brokenParts, collapsed, peakFires, peakDebris, navigationOnlyOpens: true });
      console.log(`[destruction-rollout] ${level}/${family}: ${damaged} damaged, ${collapsed} collapsed`);
    }
    // Exercise complete collider removal for each authored policy separately
    // from the comparable weapon counts. Vehicles retain their original hull.
    const nav = world.districts!.nav.cells.slice();
    const collapseClasses = [];
    for (const kind of Object.keys(classes)) {
      const object = targets.find(o => o.placement.destruction!.class === kind)!;
      for (let part = 0; part < object.parts.length; part++) destruction.damage({ object, part, distance: 0, local: object.parts[part].bounds.min, normal: [0, 1, 0] }, 'weapon.rocket-launcher', 1e6);
      assert(object.state.collapsed, `${level}/${kind}: collapse`);
      collapseClasses.push(kind);
    }
    assert(!world.districts!.nav.cells.some((cell, i) => nav[i] === 1 && cell === 0), `${level}: complete collapse closed navigation`);
    const saved = destruction.snapshot();
    mission.restore(checkpoint);
    assert.deepEqual(destruction.snapshot(), initial, `${level}: pristine checkpoint`);
    destruction.restore(saved);
    mission.checkpoint(checkpoint);
    destruction.restore(initial);
    mission.restore(checkpoint);
    assert.deepEqual(destruction.snapshot(), saved, `${level}: damaged checkpoint`);
    results.push({ level, targets: targets.length, classes, families, collapseClasses, checkpoint: true });
    console.log(`[destruction-rollout] ${level}: ${targets.length} targets; all weapon/checkpoint/navigation/cap checks passed`);
  } finally { world.dispose(); }
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ method: 'Native loaded levels and Rapier. Direct normalized damage fixture: one 3000-damage contact per occupied part, then 721 destruction ticks. Separate full-collapse sample per policy; no route completion claim.', results }, null, 2) + '\n');
