/** PKG-07/08 visual acceptance: real player/crowd poses, fixed game and close cameras. */
import { readFileSync } from 'node:fs';
import { SceneSession, stopServer, writeJson } from './session';
import { runSpec } from './run';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const phase = process.env.LONG_GUN_PHASE ?? 'after';
const filter = new RegExp(process.env.LONG_GUN_CASE ?? '.');
const session = new SceneSession();
const results = [];
let samples: unknown[] = [];
let failures = 0;
const snapshot = session.snapshot.bind(session);
session.snapshot = async () => {
  const sample = await session.page.evaluate(() => {
    const state = window.__SS__!.getState(), visible = state.render.actions!.attachments.filter(a => a.visible);
    const gun = visible[0]?.actionId;
    const gap = state.render.character!.supportHandGap;
    return { frame: window.__SCENE__!.frame, visible, gap, joints: state.render.character!.gunPose, crowd: state.render.npcs?.civilians, shot: state.render.vfx?.shots.at(-1),
      failure: visible.length > 1 || visible.some(a => a.gripDistance > .0001 || a.handDistance > .05) || !!gun && gun !== 'weapon.bat' && gap > .02 };
  });
  samples.push(sample); if (sample.failure && phase !== 'before') failures++;
  return snapshot();
};
try {
  await session.open();
  for (const model of ['female', 'male']) for (const gun of ['assault-rifle', 'hunting-rifle', 'shotgun', 'machine-gun', 'army-mg', 'rocket-launcher', 'smg']) for (const camera of ['game', 'close']) {
    const name = `${model}-${gun}-${camera}`;
    if (!filter.test(name)) continue;
    const spec = JSON.parse(readFileSync(`docs/scenes/gun-hold/${camera}.json`, 'utf8')) as SceneSpec;
    spec.name = name; spec.time = 'L1'; spec.actors![0].look = { model }; spec.actors![0].loadout = [`weapon.${gun}`, 'weapon.bat'];
    spec.shots = [0, 48, 80, 114]; spec.sheet = 16;
    const out = `docs/scenes/long-guns/captures/${phase}/${name}`;
    samples = []; failures = 0;
    const result = await runSpec(session, spec, { out });
    // Empty finite magazines with real continuous fire; campaign army MG has no reload.
    await session.page.evaluate(() => window.__SCENE__!.command('courier', { attack: 'target', seconds: 20, move: [0, 0] }));
    let reload = false;
    for (let frame = 0; frame < 900; frame += 6) {
      await session.step(6);
      const slot = await session.page.evaluate(() => window.__SS__!.getState().player!.weapons!.LEFT.rack[0]);
      if (slot.reloadUntil) { await session.screenshot(`${out}/reload.png`); await session.snapshot(); reload = true; break; }
      if (slot.magazine === 0) break;
    }
    const clipping = await session.clipping();
    const gripCheck = { name: 'supportAndGrip', pass: failures === 0, value: failures, limit: 0 };
    const bodyCheck = { name: 'reloadBodyClearance', pass: clipping.gunBodies.length === 0, value: clipping.gunBodies.length, limit: 0 };
    result.checks.push(gripCheck, bodyCheck); result.pass &&= gripCheck.pass && bodyCheck.pass;
    result.failed = result.checks.filter(check => !check.pass);
    writeJson(`${out}/poses.json`, samples);
    writeJson(`${out}/reload-clipping.json`, clipping.gunBodies);
    results.push({ ...result, reload }); console.log(JSON.stringify({ name, pass: result.pass, failed: result.failed, reload }));
  }
  for (const role of ['civilian', 'soldier', 'officer'] as const) for (const weapon of role === 'officer' ? ['rifle'] as const : ['rifle', 'hmg', 'hunting-rifle'] as const) for (const camera of ['game', 'close'] as const) {
    const name = `${role}-${weapon}-${camera}`;
    if (!filter.test(name)) continue;
    const spec: SceneSpec = {
      name, ground: 'asphalt', size: 80, time: 'L1', frames: 260, sheet: 10, shots: [0, 40, 70, 114, 116, 180, 240],
      actors: [{ id: 'courier', kind: 'courier', at: [0, role === 'officer' ? -1 : -4], state: 'idle' },
        { id: 'ally', kind: 'pedestrian', at: [0, 0], look: { model: role === 'soldier' ? 'npc.national-guard' : role === 'officer' ? 'npc.police-officer' : 'npc.civilian-man-a', handProp: weapon === 'hunting-rifle' ? 'hunting-rifle' : 'rifle' }, state: 'idle' }],
      camera: camera === 'game' ? { mode: 'game', target: [0, 0] } : { mode: 'close', target: 'ally', radius: 6, azimuth: 45 },
      script: [{ frame: 20, actor: 'ally', do: { walk: [[0, 0], [0, 1]] } }, { frame: 60, actor: 'ally', do: { run: [[0, 1], [0, 0]] } }, { frame: 100, actor: 'ally', do: 'idle' }, { frame: 110, actor: 'ally', do: { ally: { role, weapon } } }, { frame: 110, spawnActor: { id: 'target', kind: 'infected', at: [role === 'officer' ? 3 : 12, 0], state: 'idle' } }],
      expect: { consoleErrors: 0, clippingMax: 0 },
    };
    samples = [];
    const out = `docs/scenes/long-guns/captures/${phase}/${name}`;
    const result = await runSpec(session, spec, { out });
    writeJson(`${out}/poses.json`, samples);
    results.push(result); console.log(JSON.stringify({ name, pass: result.pass, failed: result.failed }));
  }
} finally { await session.close(); stopServer(); }
writeJson(`docs/scenes/long-guns/${phase}.json`, results);
process.exitCode = results.every(r => r.pass) ? 0 : 1;
