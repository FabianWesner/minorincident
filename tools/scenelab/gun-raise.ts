/** First-click raise: every fixed tick through the discharge, both cameras and gaits. */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { SceneSession, stopServer, writeJson } from './session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const filter = process.env.GUN_RAISE_CASE ? new RegExp(process.env.GUN_RAISE_CASE) : null;
const session = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 1280, height: 720 } });
const results = [];
try {
  await session.open();
  for (const model of ['female', 'male']) for (const gun of ['handgun', 'army-mg']) for (const gait of ['idle', 'walk']) for (const camera of ['close', 'game']) {
    const name = `${model}-${gun}-${gait}-${camera}`, out = `docs/scenes/gun-raise/captures/${name}`;
    if (filter && !filter.test(name)) continue;
    const spec = JSON.parse(readFileSync(`docs/scenes/gun-hold/${camera}.json`, 'utf8')) as SceneSpec;
    spec.name = name; spec.actors![0].look = { model }; spec.actors![0].loadout = [`weapon.${gun}`, 'weapon.bat'];
    spec.script = [
      ...(gait === 'walk' ? [{ frame: 0, actor: 'courier', do: { walk: [[0, 0], [0, 5]] } }] : []),
      { frame: 20, actor: 'courier', do: { attack: 'target', seconds: 1 / 60, move: gait === 'walk' ? [0, .5] : [0, 0] } },
      ...(gait === 'walk' ? [{ frame: 21, actor: 'courier', do: { walk: [[0, 0], [0, 5]] } }] : []),
    ] as SceneSpec['script'];
    await session.load(spec); await session.step(19);
    const probes = [], cells = [];
    for (let frame = 19; frame <= 30; frame++) {
      if (frame > 19) await session.step(1);
      const probe = await session.page.evaluate(() => {
        const api = window.__SS__!, s = api.getState();
        const v = s.player!.survivor!.velocity;
        return { frame: window.__SCENE__!.frame, tick: s.tick, speed: Math.hypot(v.x, v.z), attachments: s.render.actions!.attachments.map(a => ({ ...a, iconUrl: undefined })), shot: s.render.vfx!.shots.at(-1) ?? null, pose: s.render.character!.gunPose };
      });
      probes.push(probe); cells.push({ frame, jpeg: await session.snapshot() });
      if (model === 'female' && gun === 'handgun' && camera === 'close' && [20, 23, 26, 27].includes(frame)) await session.screenshot(`${out}-f${frame}.png`);
    }
    await session.makeSheet(cells, `${out}.jpg`, 480, 800);
    const clipping = await session.clipping();
    for (const p of probes) {
      const visible = p.attachments.filter(a => a.visible);
      assert.equal(visible.length, 1); assert.equal(visible[0].side, 'LEFT');
      assert.ok(visible[0].gripDistance < .0001);
      if (p.frame < 27) assert.equal(p.shot, null);
    }
    const fired = probes.find(p => p.frame === 27)!, held = fired.attachments.find(a => a.visible)!;
    assert.equal(fired.shot!.tick, 27); assert.ok(Math.abs(held.barrel![1]) < .001);
    assert.ok(Math.hypot(...held.muzzle!.map((v, i) => v - fired.shot!.tracerStart[i])) < .05);
    if (gait === 'walk') assert.ok(fired.speed > .1);
    assert.equal(clipping.summary.gunBodyHits, 0);
    results.push({ name, probes, clipping: clipping.summary });
    writeJson(`${out}.json`, { name, probes, clipping });
    console.log(JSON.stringify({ name, clipping: clipping.summary }));
  }
} finally { await session.close(); stopServer(); }
writeJson('docs/scenes/gun-raise/captures/summary.json', { results: results.map(r => ({ name: r.name, frames: r.probes.length, shotTick: r.probes[8].shot!.tick, clipping: r.clipping })), errors: session.errors });
process.exitCode = session.errors.length || results.some(r => r.clipping.gunBodyHits) ? 1 : 0;
