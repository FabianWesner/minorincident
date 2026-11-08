/** Functional probes only: night spill, bounded flicker and a moving/turning nozzle, in one pooled browser. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import type { FieldLight } from '../../src/render/LightField';
import type { InstancedMesh } from 'three';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, origin, stopServer } from './session';

const out = 'test-results/r15-flamevfx', report = 'docs/reports/r15-flamevfx';
const base = JSON.parse(readFileSync('docs/reports/r15-flamer/scene.json', 'utf8')) as SceneSpec;
base.name = 'r15-flamevfx-night'; base.time = 'night'; base.weather = 'clear';
base.actors!.find(a => a.id === 'target')!.at = [5.2, 0];
const session = new SceneSession({ backend: 'webgl2', viewport: { width: 1280, height: 720 } });
const rows: unknown[] = [];
mkdirSync(out, { recursive: true });
try {
  await session.open();
  for (const tier of ['high', 'low'] as const) {
    session.options.tier = tier;
    await session.page.goto(`${origin}/?test=1&scenelab=1&renderer=webgl&dpr=1&quality=${tier}&audio=muted&seed=1`);
    await session.page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
    await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
    await session.load(structuredClone(base)); await session.step(45);
    await session.screenshot(`${out}/${tier}-night-on.png`);
    const night = await session.page.evaluate(() => {
      const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game, field = game.view.lightField!;
      const entries = (field as unknown as { transients: { light: FieldLight }[] }).transients;
      const state = api.getState(), courier = state.player!.transform;
      const target = [...game.world.entities.iterate()].find(e => e.faction === 'infected')!.transform;
      const result = { lighting: state.render.lighting, jet: state.render.vfx!.blasts.flameJet, transients: entries.map(t => ({ ...t.light })),
        courier: api.camera.project(courier.x, courier.y + .3, courier.z), target: api.camera.project(target.x, target.y + .3, target.z) };
      for (const t of entries) t.light.on = false;
      game.view.update(1); return result;
    });
    assert.equal(night.transients.length, 1, 'Only one stream transient light');
    assert(night.jet?.light); assert.equal(night.transients[0].flicker, 1);
    await session.screenshot(`${out}/${tier}-night-off.png`);
    await session.page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const entries = (game.view.lightField! as unknown as { transients: { light: FieldLight }[] }).transients;
      for (const t of entries) t.light.on = true;
      game.view.update(1);
    });
    const radiance: number[] = [];
    for (let i = 0; i < 12; i++) {
      await session.step(1);
      radiance.push(await session.page.evaluate(() => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game, field = game.view.lightField!;
        const mesh = (field as unknown as { mesh: InstancedMesh }).mesh;
        return mesh.instanceColor!.getX(mesh.count - 1);
      }));
    }
    assert(Math.max(...radiance) - Math.min(...radiance) > .001, 'Uploaded light radiance flickers');
    const moving = structuredClone(base); moving.name = 'r15-flamevfx-moving';
    moving.actors!.push({ id: 'turn-target', kind: 'infected', at: [1, -5], state: 'idle' });
    moving.script = [
      { frame: 0, actor: 'courier', do: { select: 'LEFT' } },
      { frame: 0, actor: 'courier', do: { aim: 'target', seconds: 2 } },
      { frame: 20, actor: 'courier', do: { attack: 'target', seconds: 1, move: [0, .6] } },
      { frame: 60, actor: 'courier', do: { attack: 'turn-target', seconds: 1, move: [.6, 0] } },
    ];
    await session.load(moving); await session.step(35);
    const poses = [];
    for (let frame = 36; frame <= 100; frame++) {
      await session.step(1);
      const pose = await session.page.evaluate(() => {
        const s = window.__SS__!.getState(), jet = s.render.vfx!.blasts.flameJet;
        const muzzle = s.render.actions!.attachments.find(a => a.visible)?.muzzle;
        return { jet, muzzle, player: s.player!.transform, transients: s.render.lighting!.lightField.transients,
          gap: jet && muzzle ? Math.hypot(jet.x - muzzle[0], jet.y - muzzle[1], jet.z - muzzle[2]) : null };
      });
      assert(pose.jet && pose.gap !== null && pose.gap < .15, `Attached jet at moving frame ${frame}: gap=${pose.gap}`);
      assert.equal(pose.transients, 1); poses.push({ frame, ...pose });
    }
    await session.screenshot(`${out}/${tier}-moving-turn.png`);
    rows.push({ tier, night, radiance, poses });
    console.log(JSON.stringify({ tier, lightCount: night.transients.length, flickerRange: Math.max(...radiance) - Math.min(...radiance), maxMuzzleGap: Math.max(...poses.map(p => p.gap!)) }));
  }
  assert.deepEqual(session.errors, []);
  writeFileSync(`${report}/runtime.json`, JSON.stringify({ method: 'Actual night render with the single transient toggled off/on at an identical frozen pose; uploaded field radiance over 12 sim ticks; actual moving/firing inputs and an aim-target turn, 65 successive frames per tier.', rows, errors: session.errors }, null, 2) + '\n');
} finally { await session.close(); stopServer(); }
