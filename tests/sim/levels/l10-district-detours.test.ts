import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { compositions } from '../../../src/levels/compositions';
import { cure } from '../../../src/levels/L10/district';
import type { DistrictLayout } from '../../../src/levels/districts/types';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;
for (const tier of ['high', 'low'] as const) test(`T-E32-03-D2-detours-${tier} @E32-AC03 @E32-AC28 service road and motor pool alternatives retain collision/nav support`, async () => {
  const w = new SimWorld(); await w.init();
  try {
    w.loadComposition(compositions.L10, [layout], 32); w.chunks!.setQuality(tier);
    for (const detour of cure.detours) {
      const [x, z] = detour.route[0]; Object.assign(w.entities.get(1)!.transform, { x, z });
      w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); w.chunks!.update();
      for (const [x, z] of detour.route.slice(1)) for (let i = 0; i < 5000; i++) {
        const p = w.entities.get(1)!.transform, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
        if (d < .25) break;
        expect(i, `stuck on ${detour.id} from ${p.x},${p.z}`).toBeLessThan(4999);
        w.setInput({ move: { x: dx / d, z: dz / d } }); w.update();
        expect(w.chunks!.resident(p.x, p.z)).toBe(true);
        expect(w.physics.floorHeight(p.x, p.z)).toBeGreaterThanOrEqual(0);
        expect(w.infected!.nav.clear(p.x, p.z, .3)).toBe(true);
      }
    }
  } finally { w.dispose(); }
}, 120_000);
