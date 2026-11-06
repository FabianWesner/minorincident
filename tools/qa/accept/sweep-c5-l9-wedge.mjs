import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from '../../browser-pool/client.ts';
import { provenance } from './probe.ts';
import { browserHash } from './browser.ts';

const identity = provenance(), hash = browserHash();
const out = resolve(`test-results/sweep-c5-l9-wedge-${Date.now()}`);
mkdirSync(out, { recursive: true });
const socket = createServer();
await new Promise(r => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port;
await new Promise(r => socket.close(r));
assert.notEqual(port, 3300);
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break; } catch { /* owned server starts */ }
    await delay(100);
  }
  for (const tier of ['low', 'high'].filter(tier => !process.argv[2] || process.argv[2] === tier)) for (const mode of ['wedge']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const leaseTimer = setTimeout(() => { void context.close(); }, 8 * 60_000);
    const page = await context.newPage(), errors = [], captures = [], samples = [], commands = [];
    page.on('pageerror', e => errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    try {
      await page.addInitScript('window.__name=f=>f');
      await page.goto(`http://127.0.0.1:${port}/?test=1&scenelab=1&ui=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);
      await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
      const setup = await page.evaluate(async tier => {
        const a = window.__SS__, g = window.__SCENE__.game;
        await a.ready; a.pause();
        a.settings.set({ quality: tier });
        await a.loadLevel('L9', { seed: 1, progression: 'L9-default' }); a.pause();
        a.settings.set({ quality: tier, vfx: true, timeOfDay: 'night', cameraShake: false, cheapDof: false });
        a.missions.begin(); g.driver = null; g.ui.show(null); g.input.release(); g.world.clearInput();
        const car = g.world.vehicles.cars.get(g.world.missions.l9.state.carId);
        const before = car.entity.health.current;
        window.__zeroProof = { start: a.tick(), inputs: [], events: [] };
        g.input.tap = frame => window.__zeroProof.inputs.push({ tick: a.tick(), drive: { ...frame.drive }, brake: frame.brake });
        g.world.events.on('vehicle.durability-hit', e => {
          const target = g.world.entities.get(e.targetId);
          const group = Object.entries(g.world.missions.l9.state.encounters.ids).find(([, ids]) => ids.includes(e.targetId))?.[0];
          window.__zeroProof.events.push({ ...e, target: target ? { archetype: target.archetype, hp: target.health.current,
            position: { ...target.transform }, state: target.infected?.state, group } : null });
        });
        g.world.events.on('mission.signal', e => window.__zeroProof.events.push({ ...e }));
        g.world.events.on('objective.started', e => window.__zeroProof.events.push({ ...e }));
        return { before, after: car.entity.health.current, carId: car.entity.id, backend: a.perf().backend, quality: a.getState().render.quality };
      }, tier);
      await page.locator('canvas').first().focus();
      let held=[];
      const keys=async(next,tick)=>{for(const k of held.filter(k=>!next.includes(k)))await page.keyboard.up(k);for(const k of next.filter(k=>!held.includes(k)))await page.keyboard.down(k);held=next;commands.push({tick,keys:[...next]});};
      const snap=()=>page.evaluate(()=>{const g=window.__SCENE__.game,w=g.world,c=w.vehicles.cars.get(w.missions.l9.state.carId);return{tick:w.tick,phase:w.missions.l9.state.phase,position:{...c.entity.transform},speed:c.physics.speed,hp:c.entity.health.current,hud:document.querySelector('[data-testid="vehicle-durability"]')?.textContent,events:[...window.__zeroProof.events]};});
      const photo=async label=>{for(const zoom of [.5,1.5]){await page.evaluate(async z=>{window.__SS__.camera.zoom(z);await window.__SS__.screenshotReady();},zoom);const file=resolve(out,`${tier}-${label}-z${zoom}.jpg`);await page.screenshot({path:file,type:'jpeg',quality:90});captures.push({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),label,zoom,state:await snap()});}};
      const targets=[{id:'prop.tent:2455',x:-516,z:-75},{id:'veh.school-bus:2427',x:-429.42,z:-120.69},{id:'kit.army-checkpoint:2454',x:-330,z:31}],challenges=[];
      for(const target of targets){
       const begin=await snap();let contact=null,minDistance=Infinity,stalled=0;
       for(let i=0;i<700;i++){
        const s=await snap(),distance=Math.hypot(target.x-s.position.x,target.z-s.position.z);samples.push({stage:'approach',target:target.id,...s});minDistance=Math.min(minDistance,distance);
        if(Math.abs(s.speed)<.5&&distance<12)stalled+=6;else stalled=0;
        if(distance<4.5||stalled>=120){contact=s;break;}
        const want=-Math.atan2(target.z-s.position.z,target.x-s.position.x),delta=Math.atan2(Math.sin(want-s.position.yaw),Math.cos(want-s.position.yaw)),throttle=Math.abs(delta)>.5&&Math.abs(s.speed)>5?'KeyS':'KeyW';
        await keys([throttle,...(Math.abs(delta)>.035?[delta>0?'KeyD':'KeyA']:[])],s.tick);await page.evaluate(()=>window.__SS__.step(6));
       }
       if(!contact){challenges.push({target,begin,minDistance,contact:null,escaped:false});break;}
       await keys(['KeyW'],contact.tick);for(let i=0;i<40;i++){await page.evaluate(()=>window.__SS__.step(6));samples.push({stage:'press-contact',target:target.id,...await snap()});}
       contact=await snap();await keys([],contact.tick);await photo(`${target.id}-contact`);
       let escaped=false,escape=null;const attempts=[];
       for(const pattern of [['KeyS'],['KeyS','KeyD'],['KeyS','KeyA'],['KeyW','KeyD'],['KeyS']]){
        await keys(pattern,(await snap()).tick);const before=await snap();for(let i=0;i<50;i++){await page.evaluate(()=>window.__SS__.step(6));const s=await snap();samples.push({stage:'recover',target:target.id,keys:pattern,...s});if(Math.hypot(s.position.x-contact.position.x,s.position.z-contact.position.z)>=8){escape=s;escaped=true;break;}}
        attempts.push({keys:pattern,before,after:await snap()});if(escaped)break;
       }
       await keys([],(await snap()).tick);await photo(`${target.id}-${escaped?'escaped':'still-wedged'}`);challenges.push({target,begin,minDistance,contact,attempts,escaped,escape});if(!escaped)break;
      }
      await keys([],(await snap()).tick);
      const result = await page.evaluate(() => ({ ...window.__zeroProof, preCrashDurability: window.__SCENE__.game.world.missions.l9.state.preCrashDurability, phase: window.__SCENE__.game.world.missions.l9.state.phase }));
      rows.push({ tier, mode, targets,challenges, setup, captures, samples, commands, result, errors });
      console.log(tier,mode,{samples:samples.length,captures:captures.length,challenges:challenges.map(c=>({target:c.target.id,escaped:c.escaped,contact:!!c.contact,minDistance:c.minDistance})),errors});
    } finally { clearTimeout(leaseTimer); await context.close(); }
  }
} finally {
  await browser.close(); server.kill('SIGTERM');
  writeFileSync(`docs/reports/sweep-c5/L9-06/${process.argv[2]}-physical.json.gz`, gzipSync(JSON.stringify({ ...identity, browserHash: hash,
    toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), out,
    method: 'Adversarial actual physical WASD approach/contact/press/reverse attempts against three existing map obstacles off-road, starting ordinary L9-default. No fixture placement/actor writes. Recovery uses reverse, both steer directions and forward-turn only; exact controls/health/contact events and paired photos retained. Shared headless Metal WebGL2, actual physical WASD, normal damage/AI/physics. No cheats, actor writes, teleports, objective skips or performance timing. Read-only input, health, contacts and pre-crash event ledger; per-route screenshots at both PO zooms.', rows })));
}
