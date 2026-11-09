/** One pooled headless browser; frozen before/after views differ only in the renderer's cellar blend. */
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { createHash } from 'node:crypto';
import { launchBrowser } from '../browser-pool/client.ts';

const backend = process.argv[2] ?? 'webgl';
assert(['webgl', 'webgpu'].includes(backend));
const origin = process.env.CELLAR_ORIGIN ?? 'http://127.0.0.1:4986';
const out = `test-results/r21-cellar/${backend}`;
await mkdir(out, { recursive: true });
const rows = [], transitions = [], nativeExits = [], errors = [];
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
const sourceHashes = Object.fromEntries(await Promise.all(['src/render/GameView.ts','src/render/PostFx.ts','dist/index.html'].map(async path => [path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  for (const tier of ['low', 'high']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(120000);
      page.on('console', m => { if (m.type() === 'error') errors.push({ tier, message: m.text() }); });
      page.on('pageerror', e => errors.push({ tier, message: e.message }));
      await page.addInitScript('window.__name=f=>f');
      await page.goto(`${origin}/?test=1&testApi=1&scenelab=1&ui=1&renderer=${backend}&quality=${tier}&audio=muted&dpr=1`);
      await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
      await page.evaluate(async tier => { await window.__SS__.ready; window.__SS__.settings.set({ quality: tier }); }, tier);
      for (const level of ['L5', 'L4']) {
        console.log(`capture ${backend} ${tier} ${level}`);
        await page.evaluate(async level => {
          const api = window.__SS__, game = window.__SCENE__.game;
          await api.loadLevel(level, { seed: 1, ...(level === 'L4' ? { checkpoint: 'line-break' } : {}) });
          api.pause(); game.world.missions.begin(); game.ui.show(null); game.view.unfreeze();
          api.cheats.god(true);
          if (level === 'L4') { api.teleport('player', game.world.missions.def.anchors['l4-cellar-door']); api.input.set({ interact: true }); await api.step(45); api.input.clear(); if (game.world.missions.state.l4.phase !== 'cellar') throw Error('Native cellar entry did not complete'); game.view.snapCamera(); game.view.advance(0); }
          game.view.cellarBlend = 1; game.view.districts.advance(4); game.view.update(1); game.ui.update();
          await api.screenshotReady();
        }, level);
        for (const zoom of [1, 1.5]) {
          await page.evaluate(async zoom => { const api=window.__SS__; api.camera.follow(); api.camera.zoom(zoom); await api.screenshotReady(); }, zoom);
          const pair = [];
          for (const phase of ['before', 'after']) {
            const data = await page.evaluate(async phase => {
              const api=window.__SS__, game=window.__SCENE__.game;
              game.view.cellarBlend = phase === 'before' ? 0 : 1; game.view.update(1); await api.screenshotReady();
              const w=game.world;
              return { tick: w.tick, level: w.scenario, controllerPhase: w.missions.state.l4?.phase ?? w.missions.state.l5?.phase,
                backend: api.perf().backend, quality: game.quality.snapshot().tier, camera: game.view.view.getState(), mask: game.view.postFx.snapshot().cellar,
                threats: { director: w.infected.director.count, live: [...w.entities.iterate()].filter(e => e.infected && e.health.current > 0 && !e.hidden).length },
                sim: JSON.stringify(w.getState()), hud: [...document.querySelectorAll('[data-testid]')].filter(e => e.offsetParent && !e.closest('[data-testid="mission-marker"]')).map(e => [e.dataset.testid,e.textContent]) };
            }, phase);
            assert.equal(data.backend, backend); assert.equal(data.quality, tier);
            const { sim, hud, ...receipt } = data;
            const hudHash = createHash('sha256').update(JSON.stringify(hud)).digest('hex');
            const stateHash = createHash('sha256').update(sim).digest('hex');
            const file = `${out}/${level}-${tier}-z${zoom}-${phase}.png`;
            await page.screenshot({ path: file });
            const png=PNG.sync.read(await readFile(file));
            let exteriorMax=0;
            for(let y=360;y<440;y++)for(let x=1120;x<1200;x++)for(let c=0;c<3;c++) exteriorMax=Math.max(exteriorMax,png.data[(y*png.width+x)*4+c]);
            if(phase==='after') assert.equal(exteriorMax,0,'Exterior patch must be pure black, including explosion flashes');
            const row = { level, tier, zoom, phase, file, stateHash, hudHash, exteriorMax, ...receipt };
            pair.push(row); rows.push(row);
          }
          assert.equal(pair[0].stateHash, pair[1].stateHash, 'darkening must not change simulation');
          assert.deepEqual(pair[0].camera, pair[1].camera, 'darkening must not change camera');
          assert.equal(pair[0].hudHash, pair[1].hudHash, 'darkening must not change HUD');
        }
        const transition = await page.evaluate(level => {
          const game=window.__SCENE__.game, v=game.view, s=game.world.missions.state;
          const oldL4=s.l4?.descendAt, oldL5=s.l5?.phase;
          v.cellarBlend=0;
          const entering=[0]; for(let i=0;i<10;i++){v.frame(.05); entering.push(v.cellarBlend);}
          if(level==='L4') s.l4.descendAt=0; else s.l5.phase='emerged';
          const leaving=[v.cellarBlend]; for(let i=0;i<20;i++){v.frame(.05);leaving.push(v.cellarBlend);}
          if(level==='L4')s.l4.descendAt=oldL4;else s.l5.phase=oldL5;
          return {entering,leaving};
        }, level);
        assert(transition.entering.every((x,i,a) => i===0 || x>a[i-1]));
        assert(transition.leaving.every((x,i,a) => i===0 || x<=a[i-1]));
        assert(transition.entering.at(-1)>.98 && transition.leaving.at(-1)===0);
        transitions.push({level,tier,...transition});
        if (level === 'L5') {
          await page.evaluate(() => { const api=window.__SS__,game=window.__SCENE__.game; api.teleport('player',game.world.missions.def.anchors['l5-brace']); api.input.set({interact:true}); api.resume(); });
          await page.waitForFunction(() => window.__SCENE__.game.world.missions.state.l5.phase === 'emerged' && window.__SCENE__.game.view.cellarBlend === 0, null, {timeout:15000});
          const exit = await page.evaluate(async () => { const api=window.__SS__,game=window.__SCENE__.game; api.pause();api.input.clear();await api.screenshotReady();return {phase:game.world.missions.state.l5.phase, tick:game.world.tick, mask:game.view.postFx.snapshot().cellar, zoom:game.view.view.playerZoom, player:{...game.world.entities.get(1).transform}, emergedEvent:api.events().find(e=>e.type==='l5.emerged')}; });
          assert.equal(exit.mask.amount,0); assert(exit.emergedEvent);
          await page.screenshot({path:`${out}/L5-${tier}-native-exit.png`});
          nativeExits.push({tier,...exit});
        }
      }
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(`docs/reports/r21-cellar/${backend}.json`, JSON.stringify({ backend, revision, sourceHashes, rows, transitions, nativeExits, errors }, null, 2)+'\n');
}
assert.equal(rows.length,16); assert.deepEqual(errors,[]);
console.log(`saved ${rows.length} frames and ${transitions.length} transition probes for ${backend}`);
