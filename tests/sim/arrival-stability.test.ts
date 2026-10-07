import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { compositions } from '../../src/levels/compositions';
import type { DistrictLayout } from '../../src/levels/districts/types';
import { SimWorld } from '../../src/sim/world/SimWorld';

const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as DistrictLayout;
test.each(['corgi', 'curb', 'parked bike'])('arrival stays at rest for 3 s beside %s @E03 @E04', async location => {
  const world = new SimWorld(); await world.init(); world.loadComposition(compositions['D-GROVE'], [layout], 1);
  try {
    const player = world.entities.get(1)!, bike = world.vehicles!.bicycle.entity!;
    bike.bicycle!.armed = false; // An already dismounted bike: exercise solid-frame clearance without auto-mount.
    const target = location === 'parked bike' ? { x: bike.transform.x, z: bike.transform.z } : location === 'curb' ? { x: -67.5, z: 3.2 } : { x: -66.4, z: 7 };
    world.setInput({ moveTarget: target }); world.update(); world.setInput({ moveTarget: undefined });
    for (let i = 0; i < 300 && world.controls.moveTarget; i++) world.update();
    expect(world.controls.moveTarget).toBeNull();
    // Let the renderer-facing yaw and vertical grounding settle after the final step.
    for (let i = 0; i < 30; i++) world.update();
    const start = { ...player.transform };
    let distance = 0;
    for (let i = 0; i < 180; i++) {
      const previous = { ...player.transform }; world.update();
      distance += Math.hypot(player.transform.x - previous.x, player.transform.y - previous.y, player.transform.z - previous.z);
      expect(player.survivor!.animation).toBe('idle');
      expect(Math.hypot(player.survivor!.velocity.x, player.survivor!.velocity.z)).toBeLessThan(.001);
      expect(Math.abs(player.transform.yaw - start.yaw)).toBeLessThan(.001);
    }
    expect(distance / 3).toBeLessThanOrEqual(.001);
    expect([...world.entities.iterate()].some(e => e.companion)).toBe(true);
  } finally { world.dispose(); }
});
