/** Physical mouse duels on the saved, progressed real L4 fixture. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, encodeWebm, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
const out = resolve('test-results/uat-l4-infected'); mkdirSync(out, { recursive: true });
const evidence: Record<string, unknown> = {};
const store = () => writeFileSync(`${out}/pointer-evidence.json`, JSON.stringify({ ...evidence, errors: session.errors }, null, 2));
const session = new SceneSession({ backend: 'webgl2', tier: 'high', query: { ui: '1', test: '1' } });
try {
  await session.open(); const page = session.page; await page.addInitScript('window.__name = fn => fn');
  await page.evaluate(async () => { await window.__SS__!.loadLevel('L4', {seed: 1, progression: 'L4-default', checkpoint: 'turn'}); window.__SS__!.pause(); });
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-scene-hud', '');
    document.querySelectorAll('#hud,.hud').forEach(e => e.setAttribute('data-scene-hud', ''));
  });
  const fixture = JSON.parse(readFileSync(`${out}/progressed-save.json`, 'utf8')) as { resume: ReturnType<NonNullable<Game['world']['missions']>['saveResume']> };
  const initial = { resume: fixture.resume, corgi: 29 };
  // Physical pointer input reaches the same player attack path at melee range.
  // The simulation is stepped for reproducible timing; no input frames are injected.
  for (const weapon of ['mp', 'melee'] as const) {
    const duel = await page.evaluate(async ({ initial, weapon }) => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
      a.input.clear(); w.missions!.loadResume(initial.resume); w.combat!.damage.god = false;
      for (const e of [...w.infected!.active]) w.infected!.release(e);
      for (const e of w.entities.iterate()) if (e.civilian) { e.hidden = true; if (e.civilian.ally) e.civilian.ally.nextAttack = w.tick + 100_000; }
      w.combat!.setLoadout(['weapon.bat'], ['weapon.army-mg']);
      a.teleport(1, { x: -17, z: 3 }); a.teleport(initial.corgi, { x: -17, z: 5 }); a.camera.zoom(.8);
      const id = a.spawn('infected.riot', { x: -16.1, z: 3 }, { yaw: Math.PI, state: 'chase' });
      return { id, start: w.tick, weapon };
    }, { initial, weapon });
    const duelFrames: Buffer[] = [], duelCells: { frame: number; jpeg: Buffer }[] = [];
    // Current controls: Digit5/2 selects the active weapon; LMB attacks and RMB cycles.
    await page.locator('canvas').first().focus();
    await page.keyboard.press(weapon === 'mp' ? 'Digit5' : 'Digit2');
    await page.evaluate(() => window.__SS__!.step(1));
    const button = 'left'; let defeated = false;
    for (let frame = 0; frame < 900 && !defeated; frame += 6) {
      const aim = await page.evaluate(id => {
        const a = window.__SS__!, e = a.getEntity(id)!;
        const p = a.camera.project(e.transform.x, e.transform.y + .2, e.transform.z);
        return { x: (p[0] + 1) * innerWidth / 2, y: (1 - p[1]) * innerHeight / 2 };
      }, duel.id);
      await page.mouse.move(aim.x, aim.y); if (frame === 0) await page.mouse.down({ button });
      defeated = await page.evaluate(async id => {
        const a = window.__SS__!; for (let i = 0; i < 6; i++) { a.vfx.stepRender(1 / 60); await a.step(1); }
        return a.getEntity(id)!.health.current <= 0 || a.getEntity(1)!.health.current <= 0;
      }, duel.id);
      if (frame === 0) console.log(await page.evaluate(({id, aim}) => { const g=(window.__SCENE__ as unknown as {game: Game}).game; return { input:g.world.getState().input, weapon:g.world.entities.get(1)!.weapons, top:document.elementFromPoint(aim.x,aim.y)?.outerHTML.slice(0,250), active:document.activeElement?.outerHTML.slice(0,80), id }; }, {id:duel.id,aim}));
      const jpeg = await session.snapshot(); duelFrames.push(jpeg); if (frame % 30 === 0) duelCells.push({ frame, jpeg });
    }
    await page.mouse.up({ button });
    const result = await page.evaluate(({ id, start }) => {
      const a = window.__SS__!, e = a.getEntity(id)!, p = a.getEntity(1)!;
      return { seconds: (a.tick() - start) / 60, enemyHp: e.health.current, recoverAt: e.infected!.recoverAt, playerHp: p.health.current, maxHp: p.health.max,
        hits: a.events(start).filter(e => e.type === 'combat.hit' && e.targetId === id), attacks: a.events(start).filter(e => e.type === 'infected.attack' && e.sourceId === id) };
    }, duel);
    evidence[`${weapon}PointerDuel`] = result; store();
    // Keep the visible fall and settled body in the clip; an instant zero-HP
    // end frame can still look like a standing cop without a bar.
    if (result.enemyHp === 0) for (let frame = 0; frame < 120; frame += 6) {
      await page.evaluate(async () => { const a = window.__SS__!; for (let i = 0; i < 6; i++) { a.vfx.stepRender(1 / 60); await a.step(1); } });
      const jpeg = await session.snapshot(); duelFrames.push(jpeg); if (frame % 30 === 0) duelCells.push({ frame: Math.round(result.seconds * 60) + frame, jpeg });
    }
    encodeWebm(duelFrames, `${out}/${weapon}-pointer-duel.webm`, 10);
    await session.makeSheet(duelCells, `${out}/${weapon}-pointer-sheet.jpg`);
    await session.screenshot(`${out}/${weapon}-pointer-kill.png`);
    assert.equal(result.enemyHp, 0, `${weapon} pointer input defeats the riot`); assert.equal(result.recoverAt, -1);
    if (weapon === 'mp') assert.ok(result.playerHp / result.maxHp >= .4, 'tier-2 player retains at least 40% HP');
  }
  assert.deepEqual(session.errors, []);
} finally { store(); await session.close(); stopServer(); }
