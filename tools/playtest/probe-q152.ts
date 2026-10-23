/** Q-152: real keyboard/mouse repro with melee, handgun and launcher. Only scenario/loadout setup uses the test API. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';

const out = process.argv[2] ?? 'test-results/q152/playtest';
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'low', viewport: { width: 1600, height: 900 } });
const cases = [
  { key: 'Space', weapon: 'weapon.bat', shortcut: '2' },
  { key: 'Space', weapon: 'weapon.handgun', shortcut: '4' },
  { key: 'Space', weapon: 'weapon.rocket-launcher', shortcut: '7' },
  { key: 'KeyJ', weapon: 'weapon.bat', shortcut: '2' },
  { key: 'KeyK', weapon: 'weapon.handgun', shortcut: '4' },
];
const results: unknown[] = [];
try {
  await session.open();
  const page = session.page;
  const step = (ticks = 1) => page.evaluate(async n => { await window.__SS__!.step(n); return window.__SS__!.getState(); }, ticks);
  const point = (x: number, z: number) => page.evaluate(at => window.__SS__!.input.project(at), { x, z });
  for (const entry of cases) {
    await page.evaluate(async weapon => {
      const a = window.__SS__!; await a.loadScenario('combat-arena'); a.pause();
      a.setLoadout(['weapon.bat'], [weapon === 'weapon.bat' ? 'weapon.handgun' : weapon]);
      a.spawn('infected.dummy', { x: -2, z: 0 }, { hp: 100000 });
    }, entry.weapon);
    await page.keyboard.press(entry.shortcut); await step(20);
    const enemy = await point(-2, 0);
    await page.mouse.move(enemy.x, enemy.y); await page.keyboard.down(entry.key); await step(40);
    const attacks = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack'));
    assert.ok(attacks.some(e => e.type === 'combat.attack' && e.actionId === entry.weapon), `${entry.key} fires ${entry.weapon}`);
    const start = (await step()).player!.transform;
    const ground = await point(5, 2);
    // Exact reported gesture: a ~40 ms LMB click while the attack key stays held.
    await page.mouse.click(ground.x, ground.y, { delay: 40 });
    const clicked = await step(), destination = clicked.controls!.moveTarget!;
    assert.ok(Math.hypot(destination.x - 5, destination.z - 2) < .05, 'clear-ground click sets destination');
    const aim = await point(-2, 0);
    await page.mouse.move(aim.x, aim.y);
    const aimed = await step(10);
    assert.equal(aimed.input.frame.moveTarget, undefined, 'aim sends no replacement move command');
    assert.deepEqual(aimed.controls!.moveTarget, destination, 'destination stays fixed toward safe ground');
    assert.ok(aimed.input.frame.aimPoint!.x < -1.9, 'pointer now aims back toward the infected');
    const fresh = await point(4, -2);
    await page.mouse.move(fresh.x, fresh.y); await page.mouse.down();
    const retargeted = await step(), next = retargeted.controls!.moveTarget!;
    assert.ok(Math.hypot(next.x - 4, next.z + 2) < .05, 'new LMB press still retargets');
    await page.mouse.move(aim.x, aim.y);
    const chord = await step(10);
    assert.deepEqual(chord.controls!.moveTarget, next, 'held attack plus held LMB only aims between clicks');
    await page.mouse.up(); await page.keyboard.up(entry.key);
    const end = await step(180);
    assert.ok(Math.hypot(end.player!.transform.x - 4, end.player!.transform.z + 2) < .15, 'courier reaches the clicked destination');
    const name = `${entry.key}-${entry.weapon.replace('weapon.', '')}`;
    await page.screenshot({ path: `${out}/${name}.png` });
    results.push({ ...entry, start, destination, aimPoint: aimed.input.frame.aimPoint, afterAim: aimed.controls, afterFreshClick: retargeted.controls, afterChord: chord.controls, end: end.player!.transform, attacks });
  }
  assert.deepEqual(session.errors, [], 'no browser errors');
  writeFileSync(`${out}/proof.json`, JSON.stringify({ headless: true, backend: 'webgl2', input: 'real keyboard/mouse; no input.set or teleport', results }, null, 2));
  console.log(`Q-152 real-input proof: ${results.length}/${cases.length} cases passed → ${out}/proof.json`);
} finally { await session.close(); stopServer(); }
