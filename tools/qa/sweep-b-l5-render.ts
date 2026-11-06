/** Ordinary production bot renderer/audio supplement, not a physical human benchmark. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';
import { preset } from '../../src/sim/progression/Campaign';
import { provenance } from './accept/probe';
const out = 'test-results/sweep-b/L5-render'; mkdirSync(`${out}/captures`, { recursive: true });
const rows = [];
try {
  for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ tier, backend: 'webgl2', query: { profile: '0', ui: '1' } });
    try {
      await session.open();
      const save = preset('L5-default'); save.settings.quality = tier;
      await session.page.evaluate(async ({ tier, save }) => {
        document.documentElement.setAttribute('data-scene-hud', '');
        const a = window.__SS__!; a.settings.set({ quality: tier, muted: false }); a.campaign.restore(save); await a.loadLevel('L5', { seed: 1 });
        a.pause(); a.settings.set({ quality: tier, cameraShake: false, muted: false }); a.missions.begin(); a.cheats.god(false); a.camera.follow(); a.camera.zoom(1.5);
        await a.audio.unlock();
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        if (g.world.missions!.state.l5!.infectedIds.length !== (tier === 'low' ? 100 : 150)) throw new Error('Initial tier census mismatch');
        a.bot.start('complete');
      }, { tier, save });
      await session.page.bringToFront(); await session.page.click('canvas', { position: { x: 640, y: 360 } });
      await session.page.evaluate(async () => { await window.__SS__!.audio.unlock(); window.__SS__!.input.clear(); });
      const samples = [], captures = [];
      let found = false;
      for (let i = 0; i < 300; i++) {
        await session.page.evaluate(async () => { await window.__SS__!.step(60); });
        const state = await session.page.evaluate(() => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, s = w.missions!.state.l5;
          if (!s) return { level: w.scenario, tick: w.tick, l5: null };
          const audio = a.audio.snapshot(), render = g.view.getState();
          const entities = [...w.entities.iterate()];
          return { level: w.scenario, tick: w.tick, l5: { phase: s.phase, emergedAt: s.emergedAt, metroAt: s.metroAt, shutterAt: s.shutterAt, doneAt: s.doneAt, gloom: s.gloom, survivors: structuredClone(s.survivors), stationIds: s.stationIds },
            actualTier: w.infected!.director.tier, renderTier: render.quality, god: w.combat!.damage.god, initialInfected: s.infectedIds.length, camera: render.camera, lighting: { intensity: render.lighting?.intensity, preset: render.lighting?.preset }, audioMusic: audio.music, audioFlags: { state: audio.state, unlocked: audio.unlocked, background: audio.background, muted: audio.muted },
            allies: entities.filter(e => e.health.current > 0 && !e.hidden && !!e.civilian?.ally).map(e => ({ id: e.id, ally: e.civilian!.ally, at: { ...e.transform } })),
            vehicles: entities.filter(e => !!e.vehicle || !!e.traffic || e.kind === 'setpiece' && e.archetype.startsWith('veh.')).map(e => ({ id: e.id, at: { ...e.transform } })),
            bars: render.healthBars, events: a.events().filter(e => ['l5.found', 'l5.emerged', 'l5.searching', 'ally.attack', 'l5.shutter'].includes(e.type)),
            figures: a.crowdFigures().filter(e => s.stationIds.includes(e.id)),
            player: { ...w.entities.get(1)!.transform }, companion: entities.filter(e => e.companion).map(e => ({ id: e.id, at: { ...e.transform }, hidden: e.hidden })) };
        });
        samples.push(state);
        const s = state.l5;
        const firstFound: boolean = !!s?.survivors.some(r => r.foundAt) && !found;
        if (i === 0 || firstFound || s?.metroAt) {
          const file = `${out}/captures/${tier}-t${state.tick}-${s?.phase}.jpg`;
          await session.page.screenshot({ path: file, type: 'jpeg', quality: 90 }); captures.push(file);
        }
        found ||= firstFound;
        if (!s || s.doneAt) break;
      }
      rows.push({ tier, samples, captures, errors: session.errors });
      writeFileSync(`${out}/proof.json`, JSON.stringify({ ...provenance(), producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l5-render.ts')).digest('hex'), method: 'Production mortal complete bot input with no objective advance or actor relocation. One-second rendered snapshots of actual music state, allies, vehicle positions, metro residents/figures and camera. Every metro second captured. Controlled renderer supplement, not physical input or a human benchmark; no performance timing.', rows }, null, 2) + '\n');
      console.log(tier, samples.length, captures.length);
    } finally { await session.close(); }
  }
} finally { stopServer(); }
