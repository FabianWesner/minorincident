import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from './fixtures';
import type { Game } from '../../src/Game';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { apcEngineStages } from '../../src/audio/apcEngine';

for (const tier of ['high','low'] as const) test(`T-E31-22-audio @E31-AC16 @E31-AC22 ${tier} snapshot stages own persistent engine voices and restore without transition cues`, async ({ page }) => {
  test.setTimeout(180000);
  await boot(page, `/?test=1&scenelab=1&renderer=webgl&quality=${tier}&dpr=1`);
  const spec = JSON.parse(readFileSync('specs/scenes/catalog/veh-apc-damage-760.json','utf8')) as SceneSpec;
  await page.evaluate(async spec => { await window.__SCENE__!.load(spec); }, spec);
  await page.mouse.click(200,200);
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); a.settings.set({ muted: false, captions: true }); await a.audio.unlock(); a.audio.clearLog(); });
  const evidence = [];
  for (const hp of [760,750,510,500,260,250,10,0]) {
    const stage = [750,500,250,0].filter(v => hp <= v).length;
    const state = await page.evaluate(async hp => {
      const lab = window.__SCENE__!, w = (lab as unknown as { game: Game }).game.world, id = [...w.vehicles!.cars.keys()][0], car = w.vehicles!.cars.get(id)!;
      w.vehicles!.damage(id, car.entity.health.current-hp); await window.__SS__!.step(1); await lab.ready();
      (lab as unknown as { game: Game }).game.audio.graph.setListener(car.entity.transform, {x:0,z:0});
      // The production sound event, repeated, must update its existing voices rather than spawn one each frame.
      for (let i=0;i<20;i++) window.__SS__!.audio.emit({ type:'vehicle.sound',tick:w.tick,sourceId:id,position:car.entity.transform,velocity:{x:0,z:0},rpm:3500,speed:0,health:hp/1000,phase:'engine' });
      // AudioParam automation becomes observable on the next audio rendering quantum.
      await new Promise(resolve=>setTimeout(resolve,30));
      const a = window.__SS__!;
      return { render:(lab as unknown as { game: Game }).game.view.labProbes().vehicles!.snapshot().find(v => v.id === id)!.apcDamage, emitters:a.audio.emitters(), audio:a.audio.snapshot() };
    },hp);
    expect(state.render).toMatchObject({ stage,dents:stage>=1,glass:stage>=2,smoke:stage===4?'heavy':stage===3?'light':'none' });
    const low = state.emitters.filter(v=>v.cue==='vehicle.engine-low' && v.loop), high = state.emitters.filter(v=>v.cue==='vehicle.engine-high' && v.loop);
    expect(low).toHaveLength(1); expect(high).toHaveLength(1);
    expect(low[0].rate).toBeCloseTo(1.1*apcEngineStages[stage].rate,4); expect(low[0].cutoff).toBe(apcEngineStages[stage].lowpass);
    expect(state.emitters.filter(v=>v.cue==='vehicle.sputter' && v.loop)).toHaveLength(stage>0?1:0);
    expect(state.emitters.filter(v=>v.cue==='vehicle.fire')).toHaveLength(0);
    expect(state.audio.voices).toBeLessThanOrEqual(tier==='high'?32:16);
    evidence.push({hp,stage,...state});
  }
  expect(evidence.at(-1)!.audio.captions.some(c=>c.includes('Barely functional'))).toBe(true);
  // A restored stage is read directly from the snapshot, with no synthetic stage events on load.
  const restored = await page.evaluate(async () => {
    const lab = window.__SCENE__!, game = (lab as unknown as { game: Game }).game, w = game.world;
    const before = window.__SS__!.events().filter(e=>e.type==='vehicle.damage-stage').length;
    const cars = structuredClone([...w.vehicles!.cars.values()].map(c=>({id:c.entity.id,health:c.entity.health,vehicle:c.entity.vehicle})));
    // E12 rebuilds physics from restored entity components. No transition cue is emitted by rebuilding.
    for (const c of cars) Object.assign(w.entities.get(c.id)!,{health:c.health,vehicle:c.vehicle});
    w.vehicles!.rebuild(); window.__SS__!.audio.clearLog(); await lab.step(30);
    return { audio:window.__SS__!.audio.snapshot(), transitions:window.__SS__!.events().filter(e=>e.type==='vehicle.damage-stage').length-before, hp:[...w.vehicles!.cars.values()][0].entity.health.current, render:game.view.labProbes().vehicles!.snapshot()[0].apcDamage };
  });
  expect(restored.render).toMatchObject({stage:4,smoke:'heavy',lightsOn:false}); expect(restored.hp).toBe(0);
  expect(restored.audio.cues.filter(c=>c.cue==='vehicle.crash' || c.cue==='vehicle.sputter')).toHaveLength(0);
  expect(restored.transitions).toBe(0);
  const dir='test-results/epics/E31/l9-a1'; mkdirSync(dir,{recursive:true}); writeFileSync(`${dir}/audio-${tier}.json`,JSON.stringify({evidence,restored},null,2));
});
