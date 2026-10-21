/** Fixed Scene Lab captures for the E07 D and E27 H reviews.
 * E2E_UNITS=1 E2E_PORT=4051 SCENE_PORT=4052 sh tools/e2e-lock.sh npx tsx tools/qa/shared-ac-vision.ts horde|vfx
 * Timing/heap evidence belongs to quiet-run, never to these capture clocks. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';

const mode = process.argv[2];
assert.ok(mode === 'horde' || mode === 'vfx', 'Choose horde or vfx');
const selectedTier = process.argv[3];
if (selectedTier !== undefined && selectedTier !== 'high' && selectedTier !== 'low') throw new Error('Choose high or low');
const tiers: ('high' | 'low')[] = selectedTier ? [selectedTier] : ['high', 'low'];
const collapseOnly = process.argv.includes('--collapse-only');
const fireOnly = process.argv.includes('--fire-only');
const out = `test-results/ac-close-shared/${mode}`;
mkdirSync(out, { recursive: true });
const proof: unknown[] = [];

async function capture(s: SceneSession, name: string, extra: object = {}) {
  const state = await s.page.evaluate(() => {
    const a = window.__SS__!, st = a.getState(), p = a.perf();
    return { tick: a.tick(), backend: p.backend, tier: p.quality.tier,
      entities: st.entities.map(e => ({ id: e.id, kind: e.kind, archetype: e.archetype, health: e.health, transform: e.transform, corpse: !!e.corpse, vehicle: e.vehicle })), camera: st.render.camera,
      lighting: st.render.lighting, crowd: st.render.crowd, vfx: st.render.vfx, weather: st.weather,
      events: a.events().filter(e => ['explosion', 'vehicle.exploded', 'prop.destroyed', 'telegraph', 'infected.special'].includes(e.type)) };
  });
  const file = `${out}/${name}.png`;
  await s.screenshot(file); proof.push({ file, ...extra, ...state });
}

const blasts: SceneSpec = {
  name: 'blast-lab', seed: 7, ground: 'asphalt', size: 70, time: 'L4', dof: false,
  actors: [
    { id: 'courier', kind: 'courier', at: [-5, 8], god: true, state: 'idle' },
    { id: 'body', kind: 'infected', archetype: 'infected.runner', at: [1, 2], state: 'idle' },
  ],
  props: [
    { id: 'cart', asset: 'prop.shopping-cart', at: [-2.5, 1] },
    { id: 'cone', asset: 'prop.traffic-cone', at: [2, -1] },
    { id: 'bench', asset: 'prop.bench', at: [4, -3] },
  ],
  camera: { mode: 'game', target: [0, 0], zoom: 1.15 },
  script: [{ frame: 0, actor: 'body', do: { corpse: true } }],
};

try {
  for (const backend of (mode === 'horde' ? ['webgl2', 'webgpu'] : ['webgl2']) as Backend[]) {
    for (const tier of tiers) {
      const s = new SceneSession({ backend, tier, viewport: { width: 1600, height: 900 } });
      try {
        await s.open();
        if (mode === 'horde') {
          for (const zoom of [.5, 1, 1.5]) {
            await s.page.evaluate(async zoom => {
              const a = window.__SS__!; await a.loadScenario('horde-readability', { seed: 7 }); a.pause(); a.cheats.god(true);
              for (let i = 0; i < 60; i++) a.spawn('infected.runner', { x: i % 6 * .9 - 2.3, z: Math.floor(i / 6) * 1.2 - 14 }, { state: 'idle', yaw: -Math.PI / 4 });
              a.spawn('weapon.bat', { x: -3, z: 3 }); a.spawn('weapon.grenade', { x: 2, z: 5 });
              a.settings.set({ timeOfDay: 'golden', bloom: true });
              const v = (window.__SCENE__ as unknown as { game: Game }).game.view.view;
              // Named photo presets are cinematic poses: wheel zoom is locked
              // while they are active. Set the real zoom first, then scale that
              // spot's fixed offset by the same ratio so every row truly differs.
              v.follow();
              v.zoom(Math.log(zoom / v.getState().targetZoom), true);
              a.camera.preset('horde-readability');
              a.camera.cinematic({ position: [15 * zoom, .5 + 14.5 * zoom, -1 + 20 * zoom], target: [0, .5, -1] }, true);
              await a.step(0); await a.screenshotReady();
            }, zoom);
            const count = await s.page.evaluate(() => window.__SS__!.getState().ai!.count);
            assert.equal(count, 60);
            assert.equal(await s.page.evaluate(() => window.__SS__!.getState().render.camera.zoom), zoom);
            await capture(s, `${backend}-${tier}-z${zoom}`, { zoom, fixture: '60 runners' });
            await s.page.evaluate(async () => {
              const a = window.__SS__!;
              a.spawn('infected.brute', { x: -2, z: -2 }, { state: 'chase' });
              a.spawn('infected.runner', { x: -1.5, z: 1 }, { state: 'chase' });
              await a.step(1); await a.screenshotReady();
            });
            await capture(s, `${backend}-${tier}-z${zoom}-telegraphs`, { zoom, fixture: '60 runners + Brute/runner warnings' });
          }
        } else {
          if (!collapseOnly) {
          for (const kind of (fireOnly ? [] : ['medium', 'car', 'mega']) as ('medium' | 'car' | 'mega')[]) {
            const scene: SceneSpec = { ...blasts, name: `blast-lab-${kind}`, vehicles: kind === 'car' ? [{ id: 'car', asset: 'vehicle.sedan', at: [0, 0], yaw: 25 }] : [],
              script: [...blasts.script!, { frame: 5, effect: kind === 'car' ? { wreck: 'car' } : { blast: kind === 'medium' ? 'explosion.propane' : 'explosion.fuel-truck', at: [0, 0] } }] };
            await s.load(scene);
            let at = 0;
            const frames = kind === 'car' ? [0, 184, 186, 190, 200, 230, 360, 1080] : kind === 'mega' ? [0, 6, 20, 40, 46, 70, 220, 940] : [0, 6, 8, 12, 21, 46, 186, 906];
            for (const frame of frames) { await s.step(frame - at); at = frame; await capture(s, `${tier}-${kind}-f${frame}`, { fixture: scene.name, frame }); }
          }
          const fire: SceneSpec = {
            name: 'fire-lab', ground: 'asphalt', size: 60, time: 'night', weather: 'wind', dof: false, seed: 7,
            props: [{ id: 'house', asset: 'bld.house-a', at: [0, -3], yaw: 0 }],
            actors: [{ id: 'courier', kind: 'courier', at: [2, 4], god: true, state: 'idle' }],
            camera: { mode: 'pose', position: [15, 18, 23], target: [0, 4, 0] },
            script: [{ frame: 0, effect: { hazard: 'fire', at: [0, 2], radius: 2, duration: 60 } }],
          };
          for (const [name, spec, frames] of [
            ['building-night', fire, [60, 90, 180, 600]],
            ['grenade', { ...fire, name: 'smoke-lab-grenade', props: [], weather: 'clear',
              actors: [{ id: 'courier', kind: 'courier', at: [0, 0], god: true, loadout: ['weapon.fists', 'weapon.smoke-grenade'] },
                { id: 'target', kind: 'infected', at: [2, 0], state: 'idle' }],
              script: [{ frame: 0, actor: 'courier', do: { attack: 'target', side: 'RIGHT', seconds: .02 } }] }, [1, 90, 240, 840]],
            ['column', { ...fire, name: 'smoke-lab-column', props: [] }, [60, 180, 360, 600]],
          ] as [string, SceneSpec, number[]][]) {
            await s.load(spec); let at = 0;
            for (const frame of frames) { await s.step(frame - at); at = frame; await capture(s, `${tier}-${name}-f${frame}`, { fixture: spec.name, frame }); }
          }
          }
          if (fireOnly) continue;
          // Production L4 set piece, using the same ordinary objective setup as
          // T-E27-15, rather than replacing it with a generic lab explosion.
          await s.page.evaluate(async () => {
            const a = window.__SS__!;
            await a.loadLevel('L4', { seed: 2, progression: 'L4-default' });
            a.pause(); a.missions.begin(); a.cheats.god(true); a.settings.set({ cameraShake: false });
            a.cheats.completeObjective('ride'); await a.step(180); a.cheats.completeObjective('quartermaster');
            a.teleport('player', { x: -17, z: 3 }); a.camera.preset('D-FAIR/W0/l4-collapse'); await a.step(8);
            a.cheats.completeObjective('hold');
          });
          let at = 0;
          for (const frame of [0, 2, 6, 15, 40, 120, 150, 180, 182, 186, 195, 220, 300, 600, 900]) {
            await s.page.evaluate(async n => {
              const a = window.__SS__!;
              for (let i = 0; i < n; i++) { await a.step(1); a.vfx.stepRender(1 / 60); }
            }, frame - at);
            at = frame; await capture(s, `${tier}-collapse-f${frame}`, { fixture: 'L4/l4-collapse', frame });
          }
        }
        assert.deepEqual(s.errors, []);
      } finally { await s.close(); }
    }
  }
} finally { writeFileSync(`${out}/proof.json`, JSON.stringify(proof, null, 2)); stopServer(); }
