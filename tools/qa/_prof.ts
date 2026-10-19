import { Walker } from '../../src/debug/bot/Walker';
import { readFileSync } from 'node:fs';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { compositions } from '../../src/levels/compositions';
import { cure } from '../../src/levels/L10/district';
import { resolveCampaignMission } from '../../src/levels/missions';
import { applyCampaign } from '../../src/sim/progression/apply';
import { preset } from '../../src/sim/progression/Campaign';
import type { DistrictLayout } from '../../src/levels/districts/types';
/** Temporary look-l10 sim timing probe: R4 -> R5 walk like tests/sim/levels/l10-campus-corridor.test.ts. */
const layout = JSON.parse(readFileSync(process.argv[2] ?? 'public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;
const w = new SimWorld(); await w.init();
w.loadComposition(compositions.L10, [layout], 32); applyCampaign(w, preset('L10-default')); w.chunks!.setQuality('high');
const m = w.loadMission(resolveCampaignMission('L10', w.districts!)); m.begin(); m.loadCheckpoint('cure-military');
const [x, z] = cure.anchors['cure-military']; Object.assign(w.entities.get(1)!.transform, { x, z });
w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); w.chunks!.update(); w.update();
const times: number[] = []; const walker = new Walker();
const walk = (name: string, point: [number, number]) => {
  for (let tick = 0; tick < 5000; tick++) {
    const p = w.entities.get(1)!.transform, d = Math.hypot(point[0] - p.x, point[1] - p.z);
    if (d < .25) { w.setInput({ move: { x: 0, z: 0 } }); w.update(); return; }
    const rack = w.combat!.runner.loadout.state.RIGHT.rack;
    const enemies = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.infectionRise && !e.infected?.pursuit && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 35 && w.infected!.nav.visible(p, e.transform, 0)).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z));
    const target = enemies[0], distance = target ? Math.hypot(target.transform.x - p.x, target.transform.z - p.z) : 0;
    w.setInput({ move: walker.step(w, { x: point[0], z: point[1] }, .2, name) ?? { x: 0, z: 0 }, selectedSlot: { side: 'RIGHT', index: rack.findIndex(s => s.id === 'weapon.army-mg') }, right: { down: false, held: !!target, up: false }, ...(target ? { aim: { x: (target.transform.x - p.x) / distance, z: (target.transform.z - p.z) / distance }, aimPoint: { x: target.transform.x, z: target.transform.z }, aimSource: 'pointer' as const } : {}) });
    const s = performance.now(); w.update(); times.push(performance.now() - s);
  }
  console.log('stuck', name);
};
for (const point of cure.regions[3].route.slice(1)) walk('military exit', point as [number, number]);
for (const point of cure.regions[4].route.slice(1, 3)) walk('campus', point as [number, number]);
times.sort((a, b) => a - b);
console.log('ticks', times.length, 'p50', times[times.length >> 1].toFixed(2), 'p95', times[Math.ceil(times.length * .95) - 1].toFixed(2), 'walls', w.chunks!.walls.length, JSON.stringify(w.chunks!.stats()));
w.dispose();
