/** Targeted r10-p2 proof: registered missions, physical WASD/mouse/E, fixed ticks.
 * L6 planner advice is translated to real devices; no bot driver, actor writes,
 * teleports or objective skips. Generic downed-pose cases are labelled fixtures.
 * R10_DIST=/path/to/dist node --import tsx tools/qa/r10-p2-proof.ts before|after L6|L8|L9
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preview } from 'vite';
import { launchBrowser } from '../browser-pool/client';
import { crossing } from '../../src/levels/L9/district';
import { weaponKey } from '../../src/data/weaponKeys';
import { VehicleRecovery } from '../playtest/driving';
import type { Game } from '../../src/Game';
import { provenance } from './accept/probe';

const [side, level] = process.argv.slice(2);
assert(['before', 'after'].includes(side) && ['L6', 'L8', 'L9'].includes(level));
const out = resolve(`test-results/r10-p2/${side}-${level}`); mkdirSync(out, { recursive: true });
const server = await preview({ configFile: false, build: { outDir: resolve(process.env.R10_DIST ?? 'dist') }, preview: { host: '127.0.0.1', port: 0, strictPort: true } });
const address = server.httpServer.address(); assert(address && typeof address !== 'string' && address.port !== 3300);
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const rows: unknown[] = [], inputs: unknown[] = [], captures: unknown[] = [], errors: string[] = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage(); page.setDefaultTimeout(120000);
page.on('pageerror', error => errors.push(String(error)));
await page.addInitScript('globalThis.__name = fn => fn');
let keys = new Set<string>(), mouse = false;
const press = async (next: string[]) => {
  for (const k of keys) if (!next.includes(k)) await page.keyboard.up(k);
  for (const k of next) if (!keys.has(k)) await page.keyboard.down(k);
  keys = new Set(next);
};
const fire = async (on: boolean) => { if (mouse !== on) { if (on) await page.mouse.down(); else await page.mouse.up(); mouse = on; } };
const step = async (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
const state = () => page.evaluate(() => {
  const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, m = w.missions!, p = w.entities.get(1)!;
  const visible = (id: string) => { const e = document.querySelector<HTMLElement>(`[data-testid="${id}"]`); return !!e && !e.hidden && !!e.getClientRects().length; };
  const cue = document.querySelector<HTMLElement>('[data-testid=survivor-world-cue]');
  const render = a.getState().render as { actions: { attachments: { actionId: string; visible: boolean }[] } };
  return { tick: w.tick, player: { ...p.transform }, phase: m.state.phase, l6: m.state.l6 && { phase: m.state.l6.phase, strayed: m.state.l6.strayed, alarm: m.state.l6.alarm },
    crash: m.l9?.state.phase, car: m.l9 && { ...w.entities.get(m.l9.state.carId)!.transform }, breached: m.state.states.breached,
    objective: document.querySelector('[data-testid=objective-text]')?.textContent ?? '', tracker: visible('mission-tracker'),
    cue: cue && { text: cue.textContent, visible: !cue.hidden && !!cue.getClientRects().length, arrow: visible('survivor-cue-arrow'), opacity: getComputedStyle(cue).opacity },
    target: document.querySelector('[data-testid=minimap-cue]')?.getAttribute('data-survivor'),
    attachments: render.actions.attachments, selected: p.weapons?.selectedSide };
});
const load = async (id: string) => page.evaluate(async id => {
  const a = window.__SS__!; await a.loadLevel(id, { seed: 1, progression: `${id}-default` } as never); a.pause(); a.missions.begin();
  ((window.__SCENE__ as unknown as { game: Game }).game).ui.show(null); a.cheats.god(true); a.camera.follow(); await a.step(1);
}, id);
const matrix = async (name: string) => {
  await press([]); await fire(false);
  for (const quality of ['low', 'high'] as const) {
    await page.evaluate(q => window.__SS__!.settings.set({ quality: q }), quality);
    for (const zoom of [1, 1.5]) {
      await page.evaluate(async z => { window.__SS__!.camera.zoom(z); await window.__SS__!.screenshotReady(); }, zoom);
      const file = `${out}/${name}-${quality}-z${zoom}.jpg`; await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
      const snapshot = await state(); captures.push({ name, quality, zoom, file, ...snapshot }); console.log(side, level, name, quality, zoom, snapshot.tick, snapshot.crash ?? snapshot.objective);
    }
  }
};
const moveToward = async (x: number, z: number) => {
  const d = await page.evaluate(({ x, z }) => { const a = window.__SS__!, p = a.getEntity(1)!.transform; const u = a.camera.project(p.x, p.y, p.z), v = a.camera.project(x, p.y, z); return { x: v[0]-u[0], y: u[1]-v[1] }; }, { x, z });
  const length = Math.max(Math.abs(d.x), Math.abs(d.y));
  await press(length < .002 ? [] : [...(Math.abs(d.x)/length > .25 ? [d.x > 0 ? 'KeyD' : 'KeyA'] : []), ...(Math.abs(d.y)/length > .25 ? [d.y > 0 ? 'KeyS' : 'KeyW'] : [])]);
};
try {
  await page.goto(`http://127.0.0.1:${address.port}/?test=1&scenelab=1&renderer=webgl&quality=high&preload=0&audio=muted&dpr=1`);
  await page.waitForFunction(() => !!window.__SS__); await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  await load(level);
  if (level === 'L8') {
    await press(['KeyD']); await step(60); await press([]);
    await matrix('opening');
    while ((await state()).tick < 3540) { await step(60); rows.push(await state()); }
    await matrix('calm-end');
    const calm = rows.filter(row => (row as { tick: number }).tick < 3600) as { tracker: boolean; objective: string; breached: unknown }[];
    assert(calm.length > 40 && calm.every(r => !r.breached));
    assert(calm.every(r => side === 'after' ? r.tracker && r.objective.includes('Stay with the group') : !r.tracker && !r.objective));
    await step(60); rows.push(await state());
  } else if (level === 'L9') {
    await page.keyboard.press('Digit7'); await step(1);
    const route = crossing.routes.find(r => r.id === 'road')!.points; let waypoint = 1;
    const recovery = new VehicleRecovery();
    for (let i = 0; i < 2000; i++) {
      const s = await state(); rows.push(s);
      if (s.crash !== 'driving') break;
      const car = s.car!;
      while (waypoint < route.length-1 && Math.hypot(route[waypoint][0]-car.x,route[waypoint][1]-car.z)<18) waypoint++;
      const target = route[waypoint], delta = Math.atan2(Math.sin(-Math.atan2(target[1]-car.z,target[0]-car.x)-car.yaw),Math.cos(-Math.atan2(target[1]-car.z,target[0]-car.x)-car.yaw));
      const next = recovery.keys(car, s.tick/60*1000) ?? ['KeyW', ...(Math.abs(delta)>.08 ? [delta>0?'KeyD':'KeyA'] : [])];
      await press(next); inputs.push({ tick:s.tick, keys:next, waypoint }); await step(15);
    }
    await press([]); assert.notEqual((await state()).crash, 'driving', 'physical road route reaches the crash');
    while ((await state()).crash !== 'impact') await step(1);
    await step(70); await matrix('impact');
    const impact = (captures as { name: string; attachments: { visible: boolean }[] }[]).filter(r=>r.name==='impact');
    assert(impact.every(r => side==='after' ? r.attachments.every(a=>!a.visible) : r.attachments.some(a=>a.visible)), 'impact weapon counterexample');
    while ((await state()).crash !== 'crawl') await step(1);
    await step(90); await matrix('crawl');
    if (side==='after') assert((await state()).attachments.every(a=>!a.visible));
    // Controlled shared-rule fixtures: normal carried arsenal, no crash phase.
    await load('L8'); await page.keyboard.press('Digit7'); await step(5);
    for (const pose of ['standing','knockdown','get-up','die','crawl'] as const) {
      await page.evaluate(pose => {
        const g=(window.__SCENE__ as unknown as { game: Game }).game,p=g.world.entities.get(1)!;
        p.health.current=pose==='die'?0:p.health.max; p.survivor!.animation=pose==='standing'||pose==='crawl'?'idle':pose;
        p.survivor!.scriptedClip=pose==='crawl'?'crawl':undefined;
        p.survivor!.knockdown=pose==='knockdown'?{started:g.world.tick,until:g.world.tick+120}:undefined;
        g.view.update(1);
      },pose);
      await page.evaluate(()=>window.__SS__!.screenshotReady()); const s=await state(); rows.push({pose,...s});
      if(side==='after') assert.equal(s.attachments.some(a=>a.visible),pose==='standing',`shared rule ${pose}`);
    }
  } else {
    let sprint = false, photographed = false;
    for (let i = 0; i < 2400; i++) {
      const s = await state();
      if (i%20===0) { rows.push(s); console.log(side,level,s.tick,s.player.x,s.objective); }
      sprint ||= s.player.x > 210;
      if (sprint) { await fire(false); await moveToward(242, 15); }
      else {
        const p = await page.evaluate(() => {
          const a=window.__SS__!,g=(window.__SCENE__ as unknown as { game: Game }).game,plan=a.bot.plan(),e=g.world.entities.get(1)!;
          const slot=plan.frame.selectedSlot, attackSide=plan.frame.attackTarget?.side;
          const selected=slot ? e.weapons![slot.side].rack[slot.index].id : attackSide ? e.weapons![attackSide].rack[e.weapons![attackSide].index].id : null;
          const target=plan.target, screen=target?a.camera.project(target.x,target.y+.5,target.z):null;
          return { frame:plan.frame, selected, screen, player:{...e.transform} };
        });
        const key=p.selected&&weaponKey(p.selected); if(key) await page.keyboard.press(`Digit${key}`);
        await moveToward(p.player.x+p.frame.move.x*5,p.player.z+p.frame.move.z*5);
        if(p.frame.interact) await press([...keys,'KeyE']);
        if(p.screen) await page.mouse.move(Math.max(5,Math.min(1275,(p.screen[0]+1)*640)),Math.max(5,Math.min(715,(1-p.screen[1])*360)));
        await fire(!!p.frame.attackTarget);
      }
      await step(15);
      if(sprint && Math.hypot(s.player.x-242,s.player.z-15)<1.1 && s.l6?.strayed) {
        await matrix('exit-regroup'); photographed=true;
        await step(360); await matrix('regroup-after-banner');
        const v=await state();
        if(side==='after' && v.l6?.strayed) assert(v.cue?.visible && v.objective.includes('Rejoin') && !/· 0\s*m/.test(v.objective));
        if(side==='after' && v.l6?.strayed) {
          const target=await page.evaluate(()=>{
            const id=Number(document.querySelector('[data-testid=minimap-cue]')?.getAttribute('data-survivor'));
            return window.__SS__!.getEntity(id)!.transform;
          });
          const before=Math.hypot(target.x-v.player.x,target.z-v.player.z);
          await moveToward(target.x,target.z); await step(30); await press([]);
          const end=await state(); const after=Math.hypot(target.x-end.player.x,target.z-end.player.z);
          rows.push({cueFollow:{before,after},...end}); assert(after<before,'physical movement along the displayed survivor bearing closes the distance');
        }
        break;
      }
      if(s.phase==='result'||s.phase==='progression')break;
    }
    assert(photographed,'ordinary physical retreat and early exit run produces regroup');
  }
  assert.equal(errors.length,0);
} catch(error) { errors.push(String(error)); throw error; }
finally {
  writeFileSync(`${out}/receipt.json`,JSON.stringify({harness:provenance(),renderedRevision:process.env.R10_REVISION??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),side,level,dist:process.env.R10_DIST??'dist',method:'Registered production mission; physical keyboard/mouse/E translated from read-only native L6 planner or authored L9 road. Fixed-tick stepping. Courier survival protected. No actor relocation, population edits, objective skips or simulation timer changes. L9 generic pose probes are explicitly controlled presentation fixtures.',rows,inputs,captures,errors},null,2));
  await context.close(); await browser.close(); await server.close();
}
