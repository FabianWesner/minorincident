/** PO gun-hold: production poses, both cameras/skins, every player gun mesh. */
import { readFileSync } from 'node:fs';
import { SceneSession, stopServer, writeJson } from './session';
import { runSpec } from './run';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const session = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 1280, height: 720 } });
const guns = ['handgun', 'pistol', 'army-mg', 'shotgun', 'nail-gun', 'smg', 'hunting-rifle', 'assault-rifle', 'rocket-launcher'];
const results = [];
const filter = process.env.GUN_HOLD_CASE ? new RegExp(process.env.GUN_HOLD_CASE) : null;
let probes: unknown[] = [];
let contractFailures = 0;
const snapshot = session.snapshot.bind(session);
session.snapshot = async () => {
  const probe = await session.page.evaluate(() => {
    const state = window.__SS__!.getState();
    const selected = state.player!.weapons!.selectedSide, attachments = state.render.actions!.attachments, visible = attachments.filter(a => a.visible);
    const failures = Number(visible.length > 1) + visible.filter(a => a.side !== selected || a.gripDistance > .0001 || a.handDistance > .05).length;
    return { frame: window.__SCENE__!.frame, selected, attachments, failures, joints: state.render.character!.gunPose, shot: state.render.vfx?.shots.at(-1), weapons: state.player!.weapons };
  });
  probes.push(probe); contractFailures += probe.failures;
  return snapshot();
};
try {
  await session.open();
  for (const model of ['female', 'male']) for (const gun of guns) for (const melee of ['bat', 'fists']) for (const camera of ['game', 'close']) for (const tier of ['handgun', 'army-mg'].includes(gun) ? [0, 4] : [0]) {
    const spec = JSON.parse(readFileSync(`docs/scenes/gun-hold/${camera}.json`, 'utf8')) as SceneSpec;
    spec.name = `gun-hold-${model}-${gun}-${melee}-${camera}${tier ? `-tier${tier}` : ''}`;
    if (filter && !filter.test(spec.name)) continue;
    spec.actors![0].look = { model, gearTier: tier }; spec.actors![0].loadout = [`weapon.${gun}`, `weapon.${melee}`];
    if (gun === 'pistol') {
      spec.script = [
        { frame: 16, actor: 'courier', do: { aim: 'target', seconds: .4 } },
        { frame: 40, actor: 'courier', do: { attack: 'target', seconds: 2.5, move: [0, 0] } },
        { frame: 192, actor: 'courier', do: 'idle' },
        { frame: 208, actor: 'courier', do: { select: 'RIGHT' } },
        { frame: 224, actor: 'courier', do: { select: 'LEFT' } },
      ];
      spec.frames = 240; spec.sheet = 10; spec.shots = [0, 24, 40, 42, 115, 140, 175, 200, 216, 240];
    }
    probes = []; contractFailures = 0;
    const result = await runSpec(session, spec, { out: `test-results/gun-hold/${spec.name}` });
    const contract = { name: 'heldWeaponGripAndVisibility', pass: contractFailures === 0, value: contractFailures, limit: 0 };
    result.checks.push(contract); result.pass &&= contract.pass; if (!contract.pass) result.failed.push(contract);
    writeJson(`test-results/gun-hold/${spec.name}/probes.json`, probes);
    results.push(result); console.log(JSON.stringify({ name: spec.name, pass: result.pass, failed: result.failed }));
  }
  // Record the zero-windup first click explicitly, without a preparatory aim.
  for (const model of ['female', 'male']) for (const camera of ['game', 'close']) {
    const spec = JSON.parse(readFileSync(`docs/scenes/gun-hold/${camera}.json`, 'utf8')) as SceneSpec;
    spec.name = `gun-hold-${model}-unprepared-${camera}`; spec.actors![0].look = { model };
    if (filter && !filter.test(spec.name)) continue;
    spec.script = [{ frame: 20, actor: 'courier', do: { attack: 'target', seconds: .3, move: [0, 0] } }];
    spec.frames = 40; spec.sheet = 2; spec.shots = [19, 20, 21, 24, 28, 40];
    probes = []; contractFailures = 0;
    const result = await runSpec(session, spec, { out: `test-results/gun-hold/${spec.name}` });
    writeJson(`test-results/gun-hold/${spec.name}/probes.json`, probes);
    results.push(result); console.log(JSON.stringify({ name: spec.name, pass: result.pass, failed: result.failed }));
  }
} finally { await session.close(); stopServer(); }
writeJson(`test-results/gun-hold/summary${filter ? '-filtered' : ''}.json`, results);
process.exitCode = results.every(r => r.pass) ? 0 : 1;
