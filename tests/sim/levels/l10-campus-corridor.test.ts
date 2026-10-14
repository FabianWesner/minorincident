import { Walker } from '../../../src/debug/bot/Walker';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { compositions } from '../../../src/levels/compositions';
import { cure } from '../../../src/levels/L10/district';
import { resolveCampaignMission } from '../../../src/levels/missions';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { preset } from '../../../src/sim/progression/Campaign';
import type { DistrictLayout } from '../../../src/levels/districts/types';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;
for (const tier of ['high','low'] as const) test(`T-E32-03-D3-${tier} @E32-AC03 @E32-AC05 @E32-AC27 @E32-AC28 route from R4 through R5/R6 reaches complex`, async () => {
  const w = new SimWorld(); await w.init();
  try {
    w.loadComposition(compositions.L10, [layout], 32); applyCampaign(w, preset('L10-default')); w.chunks!.setQuality(tier);
    const m = w.loadMission(resolveCampaignMission('L10', w.districts!)); m.begin();
    // Resume the real R4 weapon checkpoint, then walk the full R4-to-R7 approach.
    m.loadCheckpoint('cure-military');
    const [x,z] = cure.anchors['cure-military']; Object.assign(w.entities.get(1)!.transform,{x,z});
    w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform,true); w.chunks!.update(); w.update();
    expect(m.state.checkpoint).toBe('cure-military');
    const times: number[] = []; const walker = new Walker();
    const walk = (name: string, point: [number,number]) => {
      for (let tick = 0; tick < 5000; tick++) {
        const p = w.entities.get(1)!.transform, dx = point[0]-p.x, dz = point[1]-p.z, d = Math.hypot(dx,dz);
        if (d < .25) { w.setInput({ move: { x:0,z:0 } }); w.update(); return; }
        expect(tick, `${name} stuck at ${p.x},${p.z}; HP=${w.entities.get(1)!.health.current}, deaths=${m.state.stats.deaths}, tick=${w.tick}`).toBeLessThan(4999);
        const rack = w.combat!.runner.loadout.state.RIGHT.rack;
        const enemies = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.infectionRise && !e.infected?.pursuit && Math.hypot(e.transform.x-p.x,e.transform.z-p.z) < 35 && w.infected!.nav.visible(p,e.transform,0))
          .sort((a,b) => Math.hypot(a.transform.x-p.x,a.transform.z-p.z)-Math.hypot(b.transform.x-p.x,b.transform.z-p.z));
        const target = enemies[0], distance = target ? Math.hypot(target.transform.x-p.x,target.transform.z-p.z) : 0;
        const weapon = distance > 14 && rack.some(s => s.id === 'weapon.rocket-launcher') ? 'weapon.rocket-launcher' : 'weapon.army-mg';
        w.setInput({ move: walker.step(w, { x: point[0], z: point[1] }, .2, name) ?? { x:0,z:0 },
          selectedSlot: { side: 'RIGHT', index: rack.findIndex(s => s.id === weapon) }, right: { down: false, held: !!target, up: false },
          ...(target ? { aim: { x: (target.transform.x-p.x)/distance, z: (target.transform.z-p.z)/distance }, aimPoint: { x: target.transform.x, z: target.transform.z }, aimSource: 'pointer' as const } : {}) });
        const start=performance.now(); w.update(); times.push(performance.now()-start);
        expect(w.chunks!.resident(p.x,p.z)).toBe(true);
        expect(w.chunks!.stats().resident).toBeLessThanOrEqual(tier==='high'?25:9);
        expect(w.infected!.nav.clear(p.x,p.z,.3)).toBe(true);
        expect(w.physics.floorHeight(p.x,p.z)).toBeGreaterThanOrEqual(0);
      }
    };
    for (const point of cure.regions[3].route.slice(1)) walk('military exit',point);
    expect(m.state.checkpoint).toBe('cure-research-entry');
    const research = cure.regions[4], corridor = cure.regions[5];
    for (const point of research.route.slice(1,3)) walk('campus',point);
    walk('terminal',cure.anchors['cure-terminal']); w.setInput({ interact:true }); w.update();
    expect(m.state.states['terminal-read']).toBe(true);
    walk('canister',cure.anchors['cure-canister']); w.setInput({ interact:true }); w.update();
    expect(m.state.items).toEqual(['cure-canister']);
    for (const point of research.route.slice(3)) walk('research exit',point);
    expect(m.state.checkpoint).toBe('cure-research');
    walk('rocket',cure.anchors['cure-corridor']); w.setInput({move:{x:0,z:0},interact:true}); for(let t=0;t<40;t++) w.update();
    expect(m.state.checkpoint).toBe('cure-corridor'); expect(w.progression!.campaign!.ownedActions).toContain('weapon.rocket-launcher');
    for (const point of corridor.route.slice(1)) walk('corridor',point);
    expect(m.state.checkpoint).toBe('cure-complex'); expect(m.state.items).toEqual(['cure-canister']);
    expect(m.state.stats.deaths).toBe(0);
    m.restore(); expect(m.state.checkpoint).toBe('cure-complex'); expect(m.state.states['cure-carried']).toBe(true);
    times.sort((a,b)=>a-b); const p95=times[Math.ceil(times.length*.95)-1]; expect(p95).toBeLessThanOrEqual(tier==='high'?4:6);
    mkdirSync('test-results/epics/E32/D3',{recursive:true}); writeFileSync(`test-results/epics/E32/D3/route-${tier}.json`,JSON.stringify({tier,p95,ticks:w.tick,checkpoint:m.state.checkpoint,deaths:m.state.stats.deaths,kills:m.state.stats.kills,items:m.state.items,arsenal:w.progression!.campaign!.ownedActions,chunks:w.chunks!.stats()},null,2));
  } finally { w.dispose(); }
},120_000);
