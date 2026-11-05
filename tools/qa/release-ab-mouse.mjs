/** Physical LMB input plumbing, complementing native normal-HP campaign and weapon runs. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from '../browser-pool/client.ts';
const out = resolve('test-results/release-ab-1101/weapons'); mkdirSync(out, { recursive: true });
const selection = process.argv[2], weapons = selection ? selection.split(',') : ['weapon.bat', 'weapon.handgun', 'weapon.smg', 'weapon.shotgun', 'weapon.assault-rifle', 'weapon.army-mg', 'weapon.rocket-launcher'];
const receipt = selection ? 'physical-mouse-offaxis-ab.json' : 'physical-mouse-ab.json';
const rows = [], browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  for (const weapon of weapons) for (const [side, origin] of [['prod', 'http://127.0.0.1:4902'], ['candidate', 'http://127.0.0.1:4901']]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }), page = await context.newPage(); page.setDefaultTimeout(120000);
    const row = { side, weapon, errors: [] }, held = new Set(); page.on('pageerror', e => row.errors.push(e.stack ?? e.message));
    try {
      await page.addInitScript('window.__name = f => f');
      await page.goto(`${origin}/?test=1&scenelab=1&quality=low&controls=wasd&audio=muted&dpr=1&preload=0`);
      await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
      row.setup = await page.evaluate(async weapon => {
        const a = window.__SS__, g = window.__SCENE__.game; await a.ready; a.pause(); await a.loadScenario('combat-arena', 1); a.pause(); a.settings.set({ quality: 'low', vfx: true }); a.cheats.god(true); a.setLoadout([weapon], ['weapon.kick']);
        g.driver = null; g.ui.show(null); g.input.release(); g.world.clearInput();
        const id = a.spawn('infected.runner', { x: weapon === 'weapon.bat' ? 1.1 : 7, z: weapon === 'weapon.bat' ? .5 : 2.5 });
        const e = g.world.entities.get(id); e.health.current = e.health.max = 60;
        window.__mouseProof = { id, start: a.tick(), inputs: [] }; g.input.tap = frame => window.__mouseProof.inputs.push({ tick: a.tick(), move: { ...frame.move }, aimPoint: frame.aimPoint, mouseAttack: frame.mouseAttack, selectedActiveSlot: frame.selectedActiveSlot });
        a.camera.follow(); a.camera.zoom(1.5); await a.screenshotReady();
        return { id, hp: 60, target: { ...e.transform }, player: { ...g.world.entities.get(1).transform }, backend: a.perf().backend, quality: a.getState().render.quality };
      }, weapon);
      const cursor = await page.evaluate(() => window.__SS__.input.project(window.__SCENE__.game.world.entities.get(window.__mouseProof.id).transform, 'destination'));
      await page.mouse.move(cursor.x, cursor.y);
      await page.keyboard.down('ShiftLeft'); await page.mouse.down();
      for (let i = 0; i < 60; i++) {
        const command = await page.evaluate(weapon => {
          const a = window.__SS__, g = window.__SCENE__.game, e = g.world.entities.get(window.__mouseProof.id), p = g.world.entities.get(1).transform;
          const at = a.input.project(e.transform, 'destination'), dx = e.transform.x - p.x, dz = e.transform.z - p.z, angle = g.view.view.azimuth, x = Math.cos(angle) * dx - Math.sin(angle) * dz, z = Math.sin(angle) * dx + Math.cos(angle) * dz, d = Math.hypot(x, z) || 1;
          return { hp: e.health.current, cursor: { x: at.x, y: at.y }, keys: weapon === 'weapon.bat' && d > 1 ? [Math.abs(x) / d > .35 ? x > 0 ? 'KeyD' : 'KeyA' : '', Math.abs(z) / d > .35 ? z > 0 ? 'KeyS' : 'KeyW' : ''].filter(Boolean) : [] };
        }, weapon);
        if (command.hp <= 0) break;
        for (const key of [...held]) if (!command.keys.includes(key)) { await page.keyboard.up(key); held.delete(key); }
        for (const key of command.keys) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
        await page.mouse.move(command.cursor.x, command.cursor.y); await page.evaluate(() => window.__SS__.step(6));
      }
      await page.mouse.up(); await page.keyboard.up('ShiftLeft');
      row.result = await page.evaluate(() => { const a = window.__SS__, r = window.__mouseProof, e = window.__SCENE__.game.world.entities.get(r.id); return { hp: e.health.current, ticks: a.tick() - r.start, inputs: r.inputs, events: a.events(r.start).filter(e => ['combat.attack', 'combat.hit', 'combat.kill', 'explosion'].includes(e.type)) }; });
      row.attacks = row.result.events.filter(e => e.type === 'combat.attack' && e.sourceId === 1).length;
      row.hits = row.result.events.filter(e => e.type === 'combat.hit' && e.sourceId === 1 && e.targetId === row.setup.id && e.amount > 0).length;
      if (row.result.hp > 0 || !row.hits) throw new Error('Physical LMB did not hit and kill the controlled runner');
    } catch (e) { row.failure = String(e); }
    finally { for (const key of held) await page.keyboard.up(key).catch(() => {}); await context.close(); rows.push(row); writeFileSync(resolve(out, receipt), JSON.stringify(rows, null, 2)); console.log(JSON.stringify({ side, weapon, attacks: row.attacks, hits: row.hits, hp: row.result?.hp, failure: row.failure, errors: row.errors })); }
  }
} finally { await browser.close(); }
if (rows.some(r => r.failure || r.errors.length)) process.exitCode = 1;
