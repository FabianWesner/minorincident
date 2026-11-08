/** QA route: native policy supplies advice; only physical device events reach gameplay. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { SceneSession, stopServer } from '../../../tools/scenelab/session';
import { weaponKey } from '../../../src/data/weaponKeys';

const [level = 'L6', quality = 'low', checkpoint, backend = 'webgl2'] = process.argv.slice(2);
const out = `docs/reports/qa-browser/${level.toLowerCase()}-${quality}${checkpoint==='cure-military'?'-campus':''}${process.env.QA_RUN_SUFFIX?`-${process.env.QA_RUN_SUFFIX}`:''}`;
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: backend as 'webgl2'|'webgpu', tier: quality as 'low' | 'high', viewport: { width: 1280, height: 800 }, seed: 1, query: { ui: '1' } });
const receipt: Record<string, unknown> = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), level, quality, checkpoint, method: 'Planner advice translated to physical WASD, number keys, E and mouse; no injected driver, teleport, god mode, objective skip or time scaling during route.' };
const captures: unknown[] = [], timeline: unknown[] = [], seen = new Set<string>();
let held: string[] = [], firing = false;
async function keys(next: string[]) {
  for (const k of held) if (!next.includes(k)) await session.page.keyboard.up(k);
  for (const k of next) if (!held.includes(k)) await session.page.keyboard.down(k);
  held = next;
}
async function fire(on: boolean) { if (on === firing) return; if (on) await session.page.mouse.down(); else await session.page.mouse.up(); firing = on; }
async function capture(stage: string, state: unknown, zooms = [1.5]) {
  if (seen.has(stage)) return; seen.add(stage);
  for (const zoom of zooms) {
    await session.page.evaluate(async z => { window.__SS__!.camera.zoom(z); await window.__SS__!.screenshotReady(); }, zoom);
    const file = `${stage}-z${zoom}.jpg`;
    await session.page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 75 });
    captures.push({ stage, file, zoom, state });
  }
  await session.page.evaluate(() => window.__SS__!.camera.zoom(1.5));
}
try {
  await session.open();
  await session.page.evaluate(async ({ level, checkpoint, quality }) => {
    const a = window.__SS__!, g = window.__SCENE__.game;
    await a.loadLevel(level, { seed: 1, progression: `${level}-default`, ...(checkpoint ? { checkpoint } : {}) });
    a.settings.set({quality});await a.screenshotReady();a.pause(); a.bot.stop(); a.camera.follow(); a.camera.zoom(1.5);
    a.bot.start('complete'); window.qaPlanner = g.driver; a.bot.stop();
    window.qaCheckpoint=checkpoint;
    window.qaEvents = [];
    for (const name of ['combat.attack', 'combat.hit', 'combat.kill', 'combat.empty', 'player.died', 'l6.collected', 'l6.rejoined', 'l6.gate-closed', 'l6.exit']) g.world.events.on(name, e => { window.qaEvents.push({...e,...('targetId' in e?{targetHp:g.world.entities.get(e.targetId)?.health.current,targetType:g.world.entities.get(e.targetId)?.archetype}: {})}); });
  }, { level, checkpoint, quality });
  await session.page.addStyleTag({ content: '#hud,.hud,.story-bubble,.mission-subtitle,[data-testid=mission-button]{visibility:visible!important}' });
  await session.page.evaluate(()=>{document.documentElement.dataset.sceneHud='1';document.querySelectorAll('#hud,.hud').forEach(n=>n.setAttribute('data-scene-hud',''));});
  if (await session.page.evaluate(() => window.__SS__!.missions.state()?.phase === 'briefing')) await session.page.getByTestId('mission-button').click({ force: true });
  await session.page.mouse.up();await session.page.evaluate(() => {window.__SS__!.pause();window.__SS__!.input.clear();});
  let end, lastStep = '', lastLog = -1, nightAt = 0, lastMoveTick = 0, lastAt = { x: 0, z: 0 };
  const wallStart = Date.now();
  for (let i = 0; i < 12000 && Date.now() - wallStart < 510000; i++) {
    const state = await session.page.evaluate(() => {
      const a = window.__SS__!, g = window.__SCENE__.game, w = g.world, p = w.entities.get(1)!, m = w.missions!.state;
      const active = Object.entries(m.steps).filter(([, s]) => s.status === 'active').map(([id]) => id);
      const s = m.l6, l8 = a.getState().l8, car = l8 && w.entities.get(l8.carId);
      return { tick: w.tick, level: w.scenario, phase: m.phase, active, hp: p.health.current, position: { ...p.transform }, driver: g.driver !== null, god: w.combat!.damage.god, backend:a.getState().render.backend, quality:a.getState().render.quality, zoom:a.getState().render.camera.zoom, caption: m.subtitle?.text, checkpoint: m.checkpoint, objective: document.querySelector('[data-testid=objective-text]')?.textContent, rejoin: document.body.innerText.match(/Rejoin [^\n]+/)?.[0],
        weapons: p.weapons, mountedGun: w.mountedGun && { mounted: w.mountedGun.mounted, heat: w.mountedGun.heat },
        l6: s && { phase: s.phase, gateAt: s.gateAt, survivors: s.survivors.map(r => { const e = w.entities.get(r.id)!; return { ...r, hidden: !!e.hidden, transform: { ...e.transform }, hp: e.health.current }; }), spawns: s.spawnLog.filter(q => q.wave === 3) },
        l7: w.l7Departure && { ...w.l7Departure.state }, marker:m.marker, states:m.states,
        l8: car && { driver:car.vehicle.driver, passengers:car.vehicle.passengers, ring:a.getState().render.vehicles.find(v=>v.id===car.id)?.entryRingVisible, roster:w.missions.l8.roster().map(id=>{const e=w.entities.get(id);return {id,hp:e?.health.current,passengerOf:e?.passengerOf,at:e?.transform};}) },
        enemies: w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x-p.transform.x,e.transform.z-p.transform.z)<20).map(e => ({ id:e.id, type:e.archetype, hp:e.health.current, at:{...e.transform}, state:e.infected?.state })) };
    });
    end = state;
    if (state.driver || state.god) throw Error('Route purity violation');
    if(state.quality!==quality)throw Error(`Quality changed to ${state.quality}; requested ${quality}`);
    if(level==='L10'&&checkpoint==='cure-military'&&Math.hypot(state.position.x-2363.99,state.position.z+75.39)<.45){await capture('native-campus',state,[1.3]);receipt.finished=true;break;}
    if (level==='L7' && !seen.has('launcher-safety') && state.weapons.RIGHT.rack.some(s=>s.id==='weapon.rocket-launcher')) {
      await keys([]); await fire(false);
      await session.page.keyboard.press(`Digit${weaponKey('weapon.rocket-launcher')}`);
      await session.page.evaluate(async()=>{const a=window.__SS__!,w=window.__SCENE__.game.world;await a.step(1);for(let i=0;i<600;i++){const l=w.combat.runner.loadout;if(!w.storyLock&&w.tick>=Math.max(l.state.RIGHT.swapUntil,l.current('RIGHT').readyAt))break;await a.step(1);}await a.step(2);});
      const probeBefore=await session.page.evaluate(()=>{const g=window.__SCENE__.game,w=g.world,p=w.entities.get(1).transform,q=g.view.project(p.x-2,w.districts.groundHeight(p.x-2,p.z),p.z);return {tick:w.tick,slot:{...w.combat.runner.loadout.current('RIGHT')},events:window.qaEvents.filter(e=>e.type==='combat.attack'&&e.actionId==='weapon.rocket-launcher').length,point:{x:(q[0]+1)*640,y:(1-q[1])*400}};});
      if(process.env.QA_PICKUP_PROBE_ONLY==='1'&&probeBefore.events!==0)throw Error('Launcher already fired before the first-ready close probe');
      await session.page.mouse.move(probeBefore.point.x,probeBefore.point.y);await fire(true);await session.page.evaluate(()=>window.__SS__!.step(16));await fire(false);
      const close=await session.page.evaluate(()=>({tick:window.__SS__!.tick(),slot:{...window.__SCENE__.game.world.combat.runner.loadout.current('RIGHT')},events:window.qaEvents.filter(e=>e.type==='combat.attack'&&e.actionId==='weapon.rocket-launcher').length,hint:document.querySelector('.hud-weapon-hint')?.textContent,rejected:window.qaEvents.filter(e=>e.type==='combat.empty'&&e.reason==='too-close')}));
      receipt.launcherClose={before:probeBefore,after:close};await capture('launcher-safety',close);
      const far=await session.page.evaluate(()=>{const g=window.__SCENE__.game,w=g.world,p=w.entities.get(1).transform,q=g.view.project(p.x+8,w.districts.groundHeight(p.x+8,p.z),p.z);return{x:(q[0]+1)*640,y:(1-q[1])*400};});
      await session.page.mouse.move(far.x,far.y);await fire(true);await session.page.evaluate(()=>window.__SS__!.step(65));await fire(false);await capture('launcher-far-shot',await session.page.evaluate(()=>window.qaEvents.slice(-20)));
      if(process.env.QA_PICKUP_PROBE_ONLY==='1'){receipt.finished=true;receipt.probeOnly=true;break;}
    }
    if (state.tick - lastLog >= 60 || state.active.join() !== lastStep) { timeline.push(state);writeFileSync(`${out}/live.json`,JSON.stringify({tick:state.tick,phase:state.phase,active:state.active,quality:state.quality,player:state.position,hp:state.hp,marker:state.marker,driver:state.l8?.driver,passengers:state.l8?.passengers?.length,roster:state.l8?.roster}));lastLog = state.tick; }
    if (state.active.join() !== lastStep) { lastStep = state.active.join(); console.log(`${level}/${quality} tick ${state.tick} ${state.phase} ${lastStep} at ${state.position.x.toFixed(1)},${state.position.z.toFixed(1)}`); await capture(`step-${lastStep || state.phase}`, state, level === 'L6' ? [1, 1.5] : [1.5]); }
    if (Math.hypot(state.position.x-lastAt.x,state.position.z-lastAt.z)>1) { lastMoveTick=state.tick;lastAt=state.position; }
    if (state.hp <= 0 || state.phase === 'retry') {
      await keys([]);await fire(false);await capture(`death-${(receipt.deaths as number??0)+1}`,state,[1,1.5]);
      receipt.deaths=(receipt.deaths as number??0)+1;
      if((receipt.deaths as number)>10){receipt.failure='More than ten ordinary mortal deaths';break;}
      if(state.phase==='retry') await session.page.getByTestId('mission-button').click({force:true});
      else await session.page.evaluate(async()=>{for(let i=0;i<240&&window.__SS__!.getEntity(1)!.health.current<=0;i++)await window.__SS__!.step(1);});
      await session.page.evaluate(async quality=>{const a=window.__SS__!,g=window.__SCENE__.game;a.pause();a.settings.set({quality});await a.screenshotReady();window.qaL8ReturnIndex=0;a.bot.start('complete');window.qaPlanner=g.driver;a.bot.stop();a.input.clear();},quality);continue;
    }
    if (state.phase === 'result' || state.phase === 'progression' || state.level !== level) { await capture('result',state,[1,1.5]); receipt.finished=true; break; }
    if (level === 'L6' && state.l6) {
      const people=state.l6.survivors, live=people.filter(r=>!['out','dead','turned'].includes(r.status)), out=people.filter(r=>r.status==='out');
      if (state.position.x>95 && state.position.x<140 && state.enemies.length) await capture('rail',state,[1,1.5]);
      if (state.l6.spawns.length>=6) await capture('successive-cohorts',state,[1,1.5]);
      if (state.position.x>=240) await capture('northgate',state,[1,1.5]);
      if (out.length) await capture('first-safe',state,[1,1.5]);
      if (out.length && !live.length) await capture('last-crossed',state,[1,1.5]);
      if (out.length && !live.length && out.every(r=>r.transform.x>=266)) await capture('street-clear',state,[1,1.5]);
    }
    if (state.phase === 'cinematic') {
      await keys([]); await fire(false); nightAt ||= state.tick;
      await capture('cinematic-first',state,level==='L6'?[1,1.5]:[1.5]);
      if(state.tick-nightAt>=180) await capture('cinematic-middle',state,level==='L6'?[1,1.5]:[1.5]);
      await session.page.evaluate(() => window.__SS__!.step(1)); continue;
    }
    if (level==='L7' && state.position.x < 90 && state.position.x>0) await capture('corridor',state);
    if (level==='L7' && state.position.x<0) await capture('bus',state,[1.5,.8]);
    if (level==='L10' && state.mountedGun?.mounted) await capture('mounted-gun',state);
    if (level==='L10' && state.active.includes('mega')) await capture('moving-mega',state);
    if (level==='L8') {
      if(state.tick<3600&&Math.hypot(state.position.x-7,state.position.z-78)<1) await capture('gate-before-breach',state,[1,1.5]);
      if(state.tick>=3125&&state.tick<3600) await capture('early-apc-52s',state,[1,1.5]);
      if(state.tick>=3660) await capture('apc-breach-61s',state,[1,1.5]);
      if(state.tick>=3660&&state.marker!=='zoo-gate') await capture('gate-rendezvous',state,[1,1.5]);
      if(state.l8?.driver===1) await capture('driver-boarded',state,[1,1.5]);
      if(state.l8?.passengers?.length&&state.l8.passengers.every(p=>p.phase==='seated')) await capture('passengers-seated',state,[1,1.5]);
    }
    if (state.tick-lastMoveTick>7200) { receipt.failure='No movement for 120 simulation seconds'; await capture('stalled',state); break; }
    const plan = await session.page.evaluate(() => {
      const g=window.__SCENE__.game,w=g.world,p=w.entities.get(1)!;
      let f;
      if(w.scenario==='L8'&&(w.tick<3660||w.missions.state.steps.sanctuary.status==='active')){
        const returning=w.tick>=3660,route=returning?[[96.5,78.5],[90,78.5],[66,78],[24,78],[7,78]]:[[7,78],[24,78],[66,78],[90,78],[96.5,76.5]],key=returning?'qaL8ReturnIndex':'qaL8Index';
        window[key]??=0;
        let goal=route[window[key]],dx=goal[0]-p.transform.x,dz=goal[1]-p.transform.z,d=Math.hypot(dx,dz);
        if(d<.5&&window[key]<route.length-1){window[key]++;goal=route[window[key]];dx=goal[0]-p.transform.x;dz=goal[1]-p.transform.z;d=Math.hypot(dx,dz);}
        f=returning?window.qaPlanner.sample():{left:{},right:{}};
        const live=w.missions.l8.roster().map(id=>w.entities.get(id)).filter(e=>e&&e.health.current>0&&!e.infected&&e.passengerOf===undefined),wait=returning&&live.some(e=>Math.hypot(e.transform.x-p.transform.x,e.transform.z-p.transform.z)>Math.max(12,Math.ceil(live.length/3)*1.2+5));
        f.move=d>.4&&!wait?{x:dx/d,z:dz/d}:{x:0,z:0};f.interact=!returning&&window[key]===4&&d<.6;
      }else if(w.scenario==='L10'&&window.qaCheckpoint==='cure-military'&&p.transform.x>2300){
        const dx=2363.99-p.transform.x,dz=-75.39-p.transform.z,d=Math.hypot(dx,dz);f={move:{x:dx/d,z:dz/d},left:{},right:{},interact:false};
      }else f=window.qaPlanner.sample();
      const az=g.view.view.azimuth;
      const x=Math.cos(az)*f.move.x-Math.sin(az)*f.move.z,y=Math.sin(az)*f.move.x+Math.cos(az)*f.move.z, keys=[];
      if(Math.abs(x)>.35)keys.push(x>0?'KeyD':'KeyA');if(Math.abs(y)>.35)keys.push(y>0?'KeyS':'KeyW');
      const point=f.aimPoint??(f.aim?{x:p.transform.x+f.aim.x*10,z:p.transform.z+f.aim.z*10}:null);
      const q=point?g.view.project(point.x,w.districts!.groundHeight(point.x,point.z),point.z):null;
      const attack=f.left.held||f.left.down||f.right.held||f.right.down;
      const side=f.left.held||f.left.down?'LEFT':'RIGHT';
      let wanted=f.selectedSlot?p.weapons[f.selectedSlot.side].rack[f.selectedSlot.index].id:attack?w.combat.runner.loadout.current(side).id:null;
      if(w.scenario==='L8'&&attack){const near=w.infected.active.filter(e=>e.health.current>0&&!e.hidden).reduce((best,e)=>Math.min(best,Math.hypot(e.transform.x-p.transform.x,e.transform.z-p.transform.z)),Infinity),rack=p.weapons.RIGHT.rack;const choice=near<6?'weapon.shotgun':near>=8?'weapon.rocket-launcher':null;if(choice&&rack.some(s=>s.id===choice))wanted=choice;}
      return {keys,interact:f.interact,attack,wanted,current:w.combat.runner.loadout.current(p.weapons.selectedSide).id,projected:q&&Math.abs(q[0])<.98&&Math.abs(q[1])<.95?{x:(q[0]+1)*640,y:(1-q[1])*400}:null};
    });
    if(plan.wanted&&plan.wanted!==plan.current) { const shortcut=weaponKey(plan.wanted);if(shortcut) await session.page.keyboard.press(`Digit${shortcut}`); }
    await keys(plan.keys);
    if(plan.interact) await session.page.keyboard.press('KeyE');
    if(plan.projected) await session.page.mouse.move(plan.projected.x,plan.projected.y);
    await fire(!!plan.projected&&plan.attack&&!(level==='L7'&&process.env.QA_PICKUP_PROBE_ONLY==='1'&&!seen.has('launcher-safety')));
    const ticks=level==='L6'&&state.position.x>255?1:level==='L10'&&checkpoint==='cure-military'&&state.position.x>2350?1:level==='L10'&&state.enemies.length===0&&!state.active.some(a=>['hold','mega'].includes(a))?30:6;
    await session.page.evaluate(n => window.__SS__!.step(n),ticks);
  }
  receipt.end=end; receipt.wallSeconds=(Date.now()-wallStart)/1000;
  receipt.events=await session.page.evaluate(()=>window.qaEvents);
  if(!receipt.finished&&!receipt.failure) receipt.failure='Bounded route ended before completion';
} catch(error) {receipt.error=String(error);console.error(error);process.exitCode=1;}
finally {
  await keys([]).catch(()=>{});await fire(false).catch(()=>{});
  receipt.captures=captures;receipt.timeline=timeline;receipt.errors=session.errors;
  writeFileSync(`${out}/receipt.json`,JSON.stringify(receipt,null,2));
  await session.close();stopServer();
}
