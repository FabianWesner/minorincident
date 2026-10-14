import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { compositions } from '../../../src/levels/compositions';
import { cure, curePursuitRoute } from '../../../src/levels/L10/district';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { resolveCampaignMission } from '../../../src/levels/missions';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { preset } from '../../../src/sim/progression/Campaign';
import { MegaPursuit } from '../../../src/sim/ai/MegaPursuit';

const layout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;
for (const tier of ['high', 'low'] as const) test(`T-E32-03-D1-D2-${tier} @E32-AC02 @E32-AC05 @E32-AC03 @E32-AC27 @E32-AC28 route through R1–R4 acquires the ordered arsenal and retains ground/nav/checkpoint support`, async () => {
  const w = new SimWorld(); await w.init();
  try {
    w.loadComposition(compositions.L10, [layout], 32);
    applyCampaign(w, preset('L10-default'));
    w.chunks!.setQuality(tier);
    const mission = w.loadMission(resolveCampaignMission('L10', w.districts!)); mission.begin();
    const times: number[] = [], regions: { id: string; ticks: number }[] = [];
    for (const region of cure.regions.slice(0, 4)) {
      const start = w.tick;
      for (const [x, z] of [region.route[0], cure.anchors[region.checkpoint], ...region.route.slice(1)]) {
        for (let i = 0; i < 5000; i++) {
          const p = w.entities.get(1)!.transform, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
          if (d < .25) {
            if (x === cure.anchors[region.checkpoint][0] && z === cure.anchors[region.checkpoint][1]) {
              w.setInput({ move: { x: 0, z: 0 }, interact: true });
              for (let hold = 0; hold < 40; hold++) w.update();
              expect(mission.state.checkpoint).toBe(region.checkpoint);
              if (region.weapon) expect(w.progression!.campaign!.ownedActions).toContain(region.weapon);
            }
            break;
          }
          expect(i, `stuck toward ${x},${z} from ${p.x},${p.z}`).toBeLessThan(4999);
          w.setInput({ move: { x: dx / d, z: dz / d } });
          const at = performance.now(); w.update(); times.push(performance.now() - at);
          expect(w.chunks!.resident(p.x, p.z)).toBe(true);
          expect(w.physics.floorHeight(p.x, p.z)).toBeGreaterThanOrEqual(0);
          expect(w.chunks!.stats().resident).toBeLessThanOrEqual(tier === 'high' ? 25 : 9);
          expect(w.infected!.nav.clear(p.x, p.z, .3)).toBe(true);
        }
      }
      regions.push({ id: region.id, ticks: w.tick - start });
    }
    w.setInput({ move: { x: 0, z: 0 } });
    expect(w.entities.get(1)!.health.current).toBe(w.entities.get(1)!.health.max);
    expect(w.entities.get(1)!.weapons!.LEFT.rack.map(s => s.id)).toEqual(['weapon.fire-axe']);
    expect(w.entities.get(1)!.weapons!.RIGHT.rack.map(s => s.id)).toEqual(['weapon.fire-axe', 'weapon.pistol', 'weapon.shotgun', 'weapon.army-mg']);
    expect(mission.state.checkpoint).toBe('cure-research-entry');
    const lastCheckpoint = mission.state.checkpoint;
    const captured = mission.saveResume().checkpoint.entities.find(e => e.id === 1)!.transform;
    mission.restore();
    expect([w.entities.get(1)!.transform.x, w.entities.get(1)!.transform.z]).toEqual([captured.x, captured.z]);
    expect(w.chunks!.resident(2467, -5)).toBe(true);
    mission.restore('cure-crash'); expect(w.entities.get(1)!.transform.x).toBe(547);
    expect(w.chunks!.resident(547, 0)).toBe(true);
    times.sort((a, b) => a - b); const p95 = times[Math.ceil(times.length * .95) - 1];
    expect(p95).toBeLessThanOrEqual(tier === 'high' ? 4 : 6);
    mkdirSync('test-results/epics/E32/D2', { recursive: true });
    writeFileSync(`test-results/epics/E32/D2/route-${tier}.json`, JSON.stringify({ tier, regions, p95, chunks: w.chunks!.stats(), lastCheckpoint }, null, 2));
  } finally { w.dispose(); }
}, 120_000);

test('T-E32-28-D1 @E32-AC10 @E32-AC28 authored pursuit crosses the R1/R2 seam using shared residency', async () => {
  const w = new SimWorld(); await w.init();
  try {
    w.loadComposition(compositions.L10, [layout], 32); w.chunks!.setQuality('low');
    Object.assign(w.entities.get(1)!.transform, { x: 807, z: 25 }); w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); w.chunks!.update();
    w.combat!.damage.god = true; w.infected!.director.levelCap = 200;
    const pursuit = w.megaPursuit = new MegaPursuit(w, { route: curePursuitRoute, spawn: { x: 547, z: 0 }, introduceTick: null });
    const id = pursuit.introduce(); let previous = { ...w.entities.get(id)!.transform }, maxStep = 0; const modes = new Set<string>();
    for (let i = 0; i < 6000; i++) {
      w.update(); const e = w.entities.get(id)!; modes.add(pursuit.state.mode);
      maxStep = Math.max(maxStep, Math.hypot(e.transform.x - previous.x, e.transform.z - previous.z)); previous = { ...e.transform };
      if (e.transform.x > 750) break;
    }
    expect(w.entities.get(id)!.transform.x).toBeGreaterThan(750); expect(modes.has('coarse')).toBe(true); expect(modes.has('detailed')).toBe(true);
    expect(maxStep).toBeLessThanOrEqual(.5); expect(w.infected!.active.filter(e => e.infected!.pursuit)).toHaveLength(1);
  } finally { w.dispose(); }
});
