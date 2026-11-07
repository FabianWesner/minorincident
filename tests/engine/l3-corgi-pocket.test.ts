import { expect, test } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import { preset } from '../../src/sim/progression/Campaign';
import { missionControls } from '../../src/sim/missions/controls';
import { loadLevel } from '../../tools/sim-runner/levels';

// G-27 (final-g low real-input route): the corgi stood in the house-c gate gap beside the crashed Oak sedan at
// (-72.56, 23.42) for 171 s while the courier waited at the army checkpoint 298 m away. The wreck's baked box leaves the
// gate cells as a cut-off pocket on the crowd grid; the dog must still follow the courier who walked past it.
test('L3 corgi leaves the Oak gate pocket and follows the courier', async () => {
  const world = await loadLevel('L3', 1, preset('L3-default'), 0, { quality: 'low' });
  try {
    world.player!.damage = () => 0;
    const dog = [...world.entities.iterate()].find(e => e.companion)!, controls = missionControls(world);
    controls.teleport('player', { x: -82, z: 23.7 });
    const walk = (to: { x: number; z: number }, ticks: number) => {
      for (let t = 0; t < ticks; t++) {
        const p = world.entities.get(1)!.transform, f = emptyInput(), dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz);
        if (d > .8) f.move = { x: dx / d, z: dz / d };
        world.applyInput(f, 'keyboard'); world.update();
      }
    };
    walk({ x: -69, z: 23.7 }, 200);
    controls.teleport(dog.id, { x: -72.5633, z: 23.4243 });
    const nav = world.infected!.nav, start = nav.nearestCell(dog.transform.x, dog.transform.z, .44);
    expect(nav.path(start, nav.nearestCell(-60, 23.7, .44), [], 1600)).toBe(false); // the pocket this guards
    walk({ x: -60, z: 23.7 }, 240); walk({ x: -55, z: 21 }, 120); walk({ x: -51, z: 9 }, 240);
    const p = world.entities.get(1)!.transform;
    expect(Math.hypot(dog.transform.x - p.x, dog.transform.z - p.z)).toBeLessThan(6);
  } finally { world.dispose(); }
}, 60_000);
