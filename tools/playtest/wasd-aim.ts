import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Game } from '../../src/Game';
import { survivor } from '../../src/data/survivor';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, encodeWebm, stopServer, writeJson } from '../scenelab/session';

/** Real keyboard/mouse input, fixed-tick game-camera evidence. No input injection or production balance edits.
 * SCENE_PORT=4880 sh tools/e2e-lock.sh node --import tsx tools/playtest/wasd-aim.ts [out]
 */
const settingsOnly = process.argv.includes('--settings-only');
const args = process.argv.slice(2), only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;
const names = ['left-shoot-right', 'down-shoot-up', 'circle-strafe'] as const;
assert(!only || names.includes(only as typeof names[number]), 'unknown --only capture');
const out = resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--only') ?? 'test-results/playtest/wasd-aim-capture');
mkdirSync(out, { recursive: true });
const session = new SceneSession({ tier: 'high', query: {} });
const results: object[] = [];
try {
  await session.open();
  for (const name of names.filter(name => !settingsOnly && (!only || only === name))) {
    const circle = name === 'circle-strafe';
    const spec: SceneSpec = {
      name: `wasd-${name}`, seed: 1, size: 70, ground: 'sidewalk', time: 'L3',
      actors: [{ id: 'courier', kind: 'courier', at: circle ? [6, 0] : [0, 0], look: { model: 'female', gearTier: 0 }, loadout: [['weapon.handgun'], ['weapon.bat']] },
        ...circle ? [{ id: 'target', kind: 'infected' as const, at: [0, 0] as [number, number], archetype: 'infected.runner', state: 'idle' as const }] : []],
      camera: { mode: 'follow', actor: 'courier', zoom: circle ? 1 : .65 },
    };
    await session.load(spec);
    await session.page.evaluate(() => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      g.input.clear(); g.world.clearInput();
      const shots: { tick: number; direction: { x: number; z: number }; aim: { x: number; z: number } | null }[] = [];
      (window as unknown as { __wasdShots: typeof shots }).__wasdShots = shots;
      g.world.events.on('combat.attack', e => {
        if (e.type === 'combat.attack' && e.sourceId === 1) shots.push({ tick: e.tick, direction: { ...e.direction }, aim: g.world.inputFrame.aim ? { ...g.world.inputFrame.aim } : null });
      });
      // Durable, otherwise ordinary moving infected for the orbit fixture; no production definition changes.
      for (const e of g.world.entities.iterate()) if (e.faction === 'infected') e.health.current = e.health.max = 100000;
    });
    await session.page.keyboard.press('Digit4');
    await session.page.evaluate(async () => { await window.__SS__!.step(12); });
    const video: Buffer[] = [], cells: { frame: number; jpeg: Buffer }[] = [];
    const samples: Awaited<ReturnType<typeof observe>>[] = [];
    const keys = new Set<string>();
    const frames = circle ? 600 : 180;
    for (let frame = 0; frame < frames; frame++) {
      const command = await session.page.evaluate(({ circle, down }) => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game, p = g.world.entities.get(1)!.transform;
        const a = g.view.view.azimuth, c = Math.cos(a), s = Math.sin(a);
        const enemy = circle ? [...g.world.entities.iterate()].find(e => e.faction === 'infected') : undefined;
        let moveKeys = [down ? 'KeyS' : 'KeyA'];
        let aim = { x: p.x + (down ? -s : c) * 1.5, z: p.z + (down ? -c : -s) * 1.5 };
        if (enemy) {
          const rx = p.x - enemy.transform.x, rz = p.z - enemy.transform.z, radius = Math.hypot(rx, rz) || 1;
          const correction = (6 - radius) * .8, dx = -rz / radius + rx / radius * correction, dz = rx / radius + rz / radius * correction;
          const right = c * dx - s * dz, below = s * dx + c * dz, length = Math.hypot(right, below);
          moveKeys = [];
          if (Math.abs(right) / length > .38) moveKeys.push(right > 0 ? 'KeyD' : 'KeyA');
          if (Math.abs(below) / length > .38) moveKeys.push(below > 0 ? 'KeyS' : 'KeyW');
          aim = enemy.transform;
        }
        return { keys: moveKeys, cursor: window.__SS__!.input.project(aim, 'destination') };
      }, { circle, down: name === 'down-shoot-up' });
      for (const key of [...keys]) if (!command.keys.includes(key)) { await session.page.keyboard.up(key); keys.delete(key); }
      for (const key of command.keys) if (!keys.has(key)) { await session.page.keyboard.down(key); keys.add(key); }
      await session.page.mouse.move(command.cursor.x, command.cursor.y);
      if (!frame) await session.page.mouse.down();
      await session.page.evaluate(async () => { await window.__SS__!.step(1); });
      samples.push(await observe());
      if (frame % 3 === 0) {
        const jpeg = await session.page.screenshot({ type: 'jpeg', quality: 80 }); video.push(jpeg);
        if (frame % (circle ? 60 : 18) === 0) cells.push({ frame, jpeg });
      }
    }
    await session.page.mouse.up(); for (const key of keys) await session.page.keyboard.up(key);
    encodeWebm(video, `${out}/${name}.webm`);
    await session.makeSheet(cells, `${out}/${name}.jpg`, 640, 1100);
    const settled = samples.slice(30), speeds = settled.map(s => s.speed);
    // WASD turns have the shipped acceleration curve. Compare its velocity to the same movement request
    // without any combat modifier; linear backpedaling must also hold the full 4.5 m/s throughout.
    let previousVelocity = { x: 0, z: 0 }, movementError = 0;
    for (const sample of samples) {
      const dx = sample.move.x * survivor.speed - previousVelocity.x, dz = sample.move.z * survivor.speed - previousVelocity.z;
      const length = Math.hypot(dx, dz), k = length ? Math.min(1, survivor.acceleration / 60 / length) : 0;
      const expected = { x: previousVelocity.x + dx * k, z: previousVelocity.z + dz * k };
      movementError = Math.max(movementError, Math.hypot(sample.velocity.x - expected.x, sample.velocity.z - expected.z));
      previousVelocity = sample.velocity;
    }
    let anchorDrift = 0;
    for (let i = 1; i < samples.length; i++) for (let f = 0; f < 2; f++) {
      const prev = samples[i - 1].contacts[f], next = samples[i].contacts[f];
      if (prev?.locked && next?.locked) anchorDrift = Math.max(anchorDrift, Math.hypot(...next.anchor.map((v, j) => v - prev.anchor[j])));
    }
    const shots = await session.page.evaluate(() => (window as unknown as { __wasdShots: { tick: number; direction: { x: number; z: number }; aim: { x: number; z: number } | null }[] }).__wasdShots);
    const result = { name, ticks: frames, shots: shots.length, shotEvents: shots, minRunSpeed: Math.min(...speeds), maxRunSpeed: Math.max(...speeds), movementError, anchorDrift, maxFacingError: Math.max(...settled.map(s => s.facingError)), samples };
    writeJson(`${out}/${name}.json`, result); results.push({ ...result, samples: undefined });
    assert(shots.length >= (circle ? 8 : 3), `${name}: held button must repeatedly shoot`);
    assert(movementError < 1e-6, `${name}: shooting changed the normal movement response by ${movementError}m/s`);
    if (!circle) assert(speeds.every(v => v > 4.4), `${name}: backward shooting must retain full run speed`);
    assert(result.maxFacingError < .12, `${name}: facing must track the cursor`);
    assert(shots.every(s => s.aim && s.direction.x * s.aim.x + s.direction.z * s.aim.z > .98), `${name}: shots must travel toward the cursor`);
    assert(samples.every(s => !s.destination && s.strafe), `${name}: pointer must never navigate`);
    assert(anchorDrift < .01, `${name}: planted feet drifted ${anchorDrift}m`);
  }
  const settings = await verifySettings(); writeJson(`${out}/settings.json`, settings);
  if (!settingsOnly) {
    const evidence = names.filter(name => existsSync(`${out}/${name}.json`)).map(name => ({ ...JSON.parse(readFileSync(`${out}/${name}.json`, 'utf8')), samples: undefined }));
    writeJson(`${out}/summary.json`, { pass: session.errors.length === 0 && evidence.length === names.length, errors: session.errors, results: evidence, settings });
  }
  assert.equal(session.errors.length, 0, 'browser console errors');
  console.log(JSON.stringify({ out, results }, null, 2));
} finally { await session.close(); stopServer(); }

async function observe() {
  return session.page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game, p = g.world.entities.get(1)!;
    const pose = g.view.labProbes().character!.getState(), input = g.world.inputFrame, aim = input.aim;
    const delta = aim ? pose.yaw + Math.atan2(aim.z, aim.x) : 0;
    return { tick: g.world.tick, position: { ...p.transform }, speed: Math.hypot(p.survivor!.velocity.x, p.survivor!.velocity.z),
      facingError: Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta))), aim: aim ? { ...aim } : null, destination: !!input.moveTarget,
      strafe: !!input.strafe, move: { ...input.move }, velocity: { ...p.survivor!.velocity }, aimSource: input.aimSource, mouseAttack: input.mouseAttack, left: { ...input.left }, right: { ...input.right }, weapon: g.world.combat?.runner.loadout.current(p.weapons!.selectedSide).id, contacts: pose.footContacts, feet: pose.feet, animation: pose.animation };
  });
}

async function verifySettings() {
  const url = new URL('/?test=1&ui=1&scenelab=1&renderer=webgl&audio=muted&quality=high&controls=classic', session.page.url());
  await session.page.goto(url.href);
  await session.page.waitForFunction(() => !!window.__SS__);
  await session.page.evaluate(async () => { await window.__SS__!.ready; });
  const original = await session.page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.input.scheme);
  await session.page.getByTestId('title-settings').click();
  assert.equal(await session.page.getByTestId('setting-controlMode').count(), 0, 'control scheme selector is removed');
  await session.page.screenshot({ path: `${out}/settings.png` });
  await session.page.reload();
  await session.page.waitForFunction(() => !!window.__SS__);
  await session.page.evaluate(async () => { await window.__SS__!.ready; });
  const restored = await session.page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.input.scheme);
  await session.page.getByTestId('start-game').click();
  await session.page.getByTestId('character-female').click();
  const campaign = await session.page.evaluate(() => {
    const saved = (window.__SCENE__ as unknown as { game: Game }).game.saves.load();
    return saved.status === 'ok' ? { status: saved.status, ...saved.save.settings } : { status: saved.status };
  });
  assert.equal(campaign.status, 'ok'); assert.equal('controlMode' in campaign, false, 'new saves omit legacy controls');
  const legacy = await session.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game; return g.ui.settings.patch({ controlMode: 'classic' } as never), g.input.scheme; });
  assert.ok(['mouse-only', 'mouse-keyboard', 'keyboard', 'touch'].includes(legacy));
  return { default: original, restored, campaign, legacy };
}
