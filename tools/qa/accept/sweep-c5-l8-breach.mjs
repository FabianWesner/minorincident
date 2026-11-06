import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from '../../browser-pool/client.ts';
import { provenance } from './probe.ts';
import { browserHash } from './browser.ts';

assert(['low', 'high'].includes(process.argv[2]), 'Supply one tier per pooled command');
assert(['0','1','2','3'].includes(process.argv[3]), 'Supply tunnel index0–3');
const outletIndex=Number(process.argv[3]);
const identity = provenance(), hash = browserHash(), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const geometryPath = 'docs/reports/fix55-c/L8-enclosure-paths.json', geometryBytes = readFileSync(geometryPath), geometry = JSON.parse(geometryBytes);
assert.equal(geometry.sourceHash, identity.sourceHash);
const out = resolve(`test-results/sweep-c5-l8-breach-${Date.now()}`); mkdirSync(out, { recursive: true });
const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port; await new Promise(r => socket.close(r)); assert.notEqual(port, 3300);
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const rows = [], deadline = Date.now() + 540000;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break; } catch { /* owned server */ } await delay(100); }
  for (const tier of [process.argv[2]]) {
    const seedPath = `docs/reports/sweep-c4/L8-07-actual-${tier}-campaign.json.gz`, seedBytes = readFileSync(seedPath), campaign = JSON.parse(gunzipSync(seedBytes).toString());
    const goals = [];
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(), errors = [], samples = [], commands = [], reached = [], captures = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.addInitScript('window.__name=f=>f');
      await page.goto(`http://127.0.0.1:${port}/?test=1&ui=1&scenelab=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);
      await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
      const setup = await page.evaluate(async ({ campaign, tier }) => {
        const a = window.__SS__, g = window.__SCENE__.game;
        await a.ready; a.pause(); a.campaign.restore(campaign);
        await a.loadLevel('L8', { seed: 1 }); a.pause(); a.settings.set({ quality: tier }); a.missions.begin();
        a.cheats.god(true); g.driver = null; g.ui.show(null); g.input.release(); g.world.clearInput();
        window.__pathWalk = { path: [], goal: -1, pathIndex: 0 };
        return { tick: a.tick(), backend: a.perf().backend, quality: a.getState().render.quality,
          roster: [...g.world.missions.l8.state.roster], outlets: structuredClone(g.world.missions.l8.state.outlets), apc: { ...g.world.missions.def.anchors.exit } };
      }, { campaign, tier });

      const outlet=setup.outlets[outletIndex];goals.push({x:outlet.sx+outlet.nx*5,z:outlet.sz+outlet.nz*5});
      await page.mouse.click(640, 360);
      let at = 0, held = [], lastShot = -900;
      for (let iteration = 0; iteration < 1000 && at < goals.length && Date.now() < deadline; iteration++) {
        const goal = goals[at];
        const sample = await page.evaluate(goal => {
          const w = window.__SCENE__.game.world, p = w.entities.get(1), m = w.missions;
          const next = { x: goal.x, z: goal.z };
          w.infected.nav.steer(p.transform, goal, window.__pathWalk, .45, next, Infinity, true);
          return { tick: w.tick, phase: m.state.phase, position: { ...p.transform }, hp: p.health.current, next,
            marker: m.state.marker, anchor: { ...m.def.anchors.exit }, camera: window.__SS__.getState().render.camera, figures: window.__SCENE__.game.view.crowdFigures().map(f => ({id:f.id,clip:f.clip,phase:f.phase,drawn:f.drawn})), activities:[...w.entities.iterate()].filter(e=>e.civilian&&!e.hidden&&e.health.current>0).map(e=>({id:e.id,archetype:e.archetype,species:e.civilian.zooAnimal,position:{...e.transform},state:e.civilian.state,survivor:!!e.civilian.survivor,role:e.civilian.ally?.role,activity:e.civilian.schedule?.[e.civilian.scheduleStep??0],activityUntil:e.civilian.activityUntil})), breached:!!m.l8.state.breachedAt, arrivals:structuredClone(m.l8.state.arrivals), doors:[...w.openDoors], tunnelActors:m.l8.state.arrivals.map(a=>{const e=w.entities.get(a.id),f=window.__SCENE__.game.view.crowdFigures().find(f=>f.id===a.id);return {...a,hp:e?.health.current,hidden:e?.hidden,pending:e?.pendingAdmission,emerging:e?.emerging,position:e?{...e.transform}:null,drawn:!!f?.drawn,clip:f?.clip};}) };
        }, goal);
        samples.push({ ...sample, goalIndex: at });

        if (Math.hypot(sample.position.x-goal.x,sample.position.z-goal.z)<.65 && at<goals.length-1) { reached.push({index:at,tick:sample.tick,position:sample.position});at++; }
        if ([3540,3600,3630,3660,3720,3840].includes(sample.tick) && lastShot!==sample.tick) {
          for (const zoom of [.5,1.5]) {
            await page.evaluate(async z=>{window.__SS__.camera.zoom(z);await window.__SS__.screenshotReady();},zoom);
            const file=resolve(out,`${tier}-outlet${outletIndex}-t${sample.tick}-z${zoom}.jpg`);await page.screenshot({path:file,type:'jpeg',quality:88});
            captures.push({file,sha256:sha(readFileSync(file)),tick:sample.tick,zoom,label:'breach'});
          }
          lastShot=sample.tick;
        }
        if(sample.tick>=3840)break;
        const close=Math.hypot(sample.position.x-goal.x,sample.position.z-goal.z)<.65;
        const dx = close?0:sample.next.x - sample.position.x, dz = close?0:sample.next.z - sample.position.z;
        const x = dx - dz, y = dx + dz, keys = [];
        if (Math.abs(x) > .15) keys.push(x > 0 ? 'KeyD' : 'KeyA');
        if (Math.abs(y) > .15) keys.push(y > 0 ? 'KeyS' : 'KeyW');
        for (const key of held.filter(k => !keys.includes(k))) await page.keyboard.up(key);
        for (const key of keys.filter(k => !held.includes(k))) await page.keyboard.down(key);
        held = keys; commands.push({ tick: sample.tick, keys, goalIndex: at });
        await page.evaluate(n => window.__SS__.step(n), sample.tick>=3540?3:6);
      }
      for (const key of held) await page.keyboard.up(key);
      if (samples.at(-1)?.tick < 3840) {
        const file = resolve(out, `${tier}-incomplete-goal-${at}.jpg`); await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
        captures.push({ file, sha256: sha(readFileSync(file)), tick: samples.at(-1)?.tick, goalIndex: at, label: 'incomplete' });
      }
      rows.push({ tier, outletIndex, outlet, setup, seed: { file: seedPath, sha256: sha(seedBytes) }, goals, reached, completed: samples.at(-1)?.tick >= 3840, samples, commands, captures, errors });
      console.log(tier, { completed: samples.at(-1)?.tick >= 3840, reached: at, goals: goals.length, last: samples.at(-1), captures: captures.length });
    } finally { await context.close(); }
  }
} finally {
  await browser.close(); server.kill('SIGTERM');
  writeFileSync(`docs/reports/sweep-c5/L8-04/${process.argv[2]}-${outletIndex}-physical.json`, JSON.stringify({ ...identity, browserHash: hash, toolSha256: sha(readFileSync(new URL(import.meta.url))),
    geometry: { file: geometryPath, sha256: sha(geometryBytes) }, out,
    method: 'Exact qualified current physical L7 result, normal L8 constructor/Begin. Actual WASD to one tunnel-front observation point before breach; ordinary6tick steps then3tick observations from3540 through3840. Actual door states, admission/emergence actor positions and submittedbody flags; paired POzoom image strips. Normal NPCs/AI/physics; protected courier only. No actor/timer/cap writes, performance measurement or hostile fixture in this natural visual run.', rows }, null, 2) + '\n');
}
