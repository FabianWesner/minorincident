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
    // Ground clicks now aim/fire only; WASD is the only desktop locomotion input.
    await page.mouse.click(ground.x, ground.y, { delay: 40 });
    const clicked = await step();
    assert.equal(clicked.controls, undefined, 'ground click creates no movement command');
    assert.equal(clicked.input.frame.moveTarget, undefined, 'ground click creates no input destination');
    assert.ok(clicked.input.frame.aimPoint && Math.hypot(clicked.input.frame.aimPoint.x - 5, clicked.input.frame.aimPoint.z - 2) < .1, 'ground click aims at its cursor point');
    await page.keyboard.down('KeyD'); await step(45); await page.keyboard.up('KeyD');
    const walked = await step();
    assert.ok(Math.hypot(walked.player!.transform.x - start.x, walked.player!.transform.z - start.z) > .5, 'WASD moves the courier');
    assert.equal(walked.input.frame.moveTarget, undefined, 'WASD movement needs no destination');
    await page.keyboard.up(entry.key);
    const end = await step();
    const name = `${entry.key}-${entry.weapon.replace('weapon.', '')}`;
    await page.screenshot({ path: `${out}/${name}.png` });
    results.push({ ...entry, start, groundAim: clicked.input.frame.aimPoint, walked: walked.player!.transform, end: end.player!.transform, attacks });
  }
  assert.deepEqual(session.errors, [], 'no browser errors');
  writeFileSync(`${out}/proof.json`, JSON.stringify({ headless: true, backend: 'webgl2', input: 'real keyboard/mouse; no input.set or teleport', results }, null, 2));
  console.log(`Q-152 real-input proof: ${results.length}/${cases.length} cases passed → ${out}/proof.json`);
} finally { await session.close(); stopServer(); }
