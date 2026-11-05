import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { SAVE_KEY, validateSave } from '../../../src/sim/progression/Save';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { runSession } from '../../playtest/session';
import { provenance } from './probe';
import { browserHash } from './browser';
import { atomicJson } from './report';
import { l7CorridorAnchors } from '../../../src/levels/L7/corridor';
import { weaponKey } from '../../../src/data/weaponKeys';

// runSession uses launchProfile: one context in the shared headless pool.

// Physical capture policy v11; no simulation, actor or objective writes.
const [tierArg, levelArg = 'L7,L8', saveArg] = process.argv.slice(2);
assert(tierArg === 'low' || tierArg === 'high');
assert(['L7,L8', 'L8', 'L10'].includes(levelArg));
const levels = levelArg.split(','), identity = provenance(), hash = browserHash();
const build = JSON.parse(readFileSync('dist/.qa-accept-build.json', 'utf8'));
assert.equal(build.sourceHash, identity.sourceHash); assert.equal(build.browserHash, hash);
assert(saveArg, 'Supply the actual native-generated L6 completion save');
const save = JSON.parse(gunzipSync(readFileSync(saveArg)).toString());
assert(validateSave(save) && save.results?.L6?.escapedSurvivors?.length);
const cell = `${levels.join('-')}-carried-${tierArg}`, out = resolve(`test-results/fix51-r10c/${cell}-${Date.now()}`);
mkdirSync(out, { recursive: true });
const socket = createServer();
await new Promise<void>((ready, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', ready); });
const address = socket.address(); assert(address && typeof address !== 'string' && address.port !== 3300);
const port = address.port; await new Promise<void>(ready => socket.close(() => ready()));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const profile = join(out, 'profile'); mkdirSync(profile, { recursive: true });
writeProfile();
function writeProfile() {
  const storage = { cookies: [], origins: [{ origin, localStorage: [{ name: SAVE_KEY, value: JSON.stringify(save) }] }] };
  writeFileSync(join(profile, 'pool-storage.json'), JSON.stringify(storage));
}
const selections: {weapon:string; key:number; observed:string; tick:number}[]=[];
const auditWeapons=process.env.PLAYTEST_AUDIT_WEAPON_SELECTIONS==='1';
const physicalRoute=process.env.PLAYTEST_L7_AUTHORED_ROUTE==='1';
assert(!physicalRoute || !auditWeapons, 'Route capture and weapon-selection audit are separate physical policies');
// Same road/parked-bus waypoints as the ordinary LevelSevenBot, driven by actual WASD.
const door=l7CorridorAnchors['l7-bus-boarding'].position;
const route=[{x:88,z:15},{x:88,z:46},{x:-12,z:52},{x:-30,z:52},{x:-30,z:47},{x:-36,z:47},{x:-36,z:41.7},{x:-50,z:41.7},{x:-50,z:47},{x:door[0],z:door[2]}];
const routeCommands: {tick:number;waypoint:number;x:number;z:number;keys:string[]}[]=[];
const zooRoute=[{x:24,z:78},{x:66,z:78},{x:75,z:74},{x:93,z:74}];
let routeLevel='L7',waypoint=0,routeReleased=false,pendingRouteTick:number|null=null;
let result: Awaited<ReturnType<typeof runSession>> | null = null, error: string | null = null;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* owned preview starts */ }
    await delay(100);
  }
  assert(ready, 'Owned preview must start');
  process.env.PLAYTEST_BACKEND = 'webgl2'; process.env.PLAYTEST_GOD = '1';
  process.env.PLAYTEST_NO_FRAME_TIMING = '1'; process.env.PLAYTEST_FRAME_GATE = '0'; process.env.PLAYTEST_CPU_PROFILE = '0';
  process.env.PLAYTEST_ACCEPTANCE_LEDGER = '1'; process.env.PLAYTEST_ACCEPTANCE_CAPTURES = '1';
  process.env.PLAYTEST_HANDOVER_AUDIT = '1'; process.env.PLAYTEST_L7_ESCORT_ROUTE = '1';
  if(auditWeapons||physicalRoute) process.env.PLAYTEST_VISIBLE_ONLY='1';
  const control=join(out,'control.json');
  if(auditWeapons||physicalRoute) process.env.PLAYTEST_CONTROL_FILE=control;
  let finished=false;
  const live=runSession({ origin, out, levels, quality: tierArg, zoom: 1.5, heroine: 'female', entry: 'continue', profile, levelMinutes: 8,
    sampleSeconds: 480, stopAfterLevel: false, tag: 'late-input', noSkip: true }).finally(()=>{finished=true;});
  // Observe rejection immediately while the physical-selection poll is active.
  void live.catch(()=>{});
  const weapons=['weapon.bat','weapon.fire-axe','weapon.handgun','weapon.shotgun','weapon.army-mg','weapon.rocket-launcher'];
  let sent=false;
  while((auditWeapons||physicalRoute)&&!finished){
    const latest=join(out,'latest.json');
    if(existsSync(latest)&&!existsSync(control)){
      let eye;try{eye=JSON.parse(readFileSync(latest,'utf8'));}catch{await delay(50);continue;}
      if(physicalRoute&&eye.level==='L8'&&routeLevel==='L7'){routeLevel='L8';waypoint=0;routeReleased=false;pendingRouteTick=null;}
      if(physicalRoute&&routeLevel==='L7'&&eye.level==='L7'&&eye.phase==='playing'&&eye.step==='departure'&&!routeReleased){writeFileSync(control,JSON.stringify({manual:false}));routeReleased=true;}
      if(pendingRouteTick!==null&&eye.tick===pendingRouteTick){await delay(100);continue;}
      if(physicalRoute&&eye.phase==='playing'&&((eye.level==='L7'&&eye.step==='corridor')||(eye.level==='L8'&&eye.tick>=3600&&!eye.player?.riding))&&!routeReleased&&eye.player){
        const activeRoute=routeLevel==='L7'?route:zooRoute;
        const player=eye.player,goal=activeRoute[waypoint];
        const dx=goal.x-player.x,dz=goal.z-player.z,distance=Math.hypot(dx,dz);
        if(distance<(routeLevel==='L8'||waypoint<3?1.2:.35)){
          if(waypoint<activeRoute.length-1)waypoint++;
          else {writeFileSync(control,JSON.stringify({manual:false}));routeReleased=true;}
        }else{
          // Fixed gameplay azimuth pi/4: inverse of InputSystem.screenVector.
          const screenX=dx-dz,screenY=dx+dz,longest=Math.max(Math.abs(screenX),Math.abs(screenY));
          const pulse=(routeCommands.length%8)/8,keys:string[]=[];
          if(pulse<Math.abs(screenX)/longest)keys.push(screenX>0?'KeyD':'KeyA');
          if(pulse<Math.abs(screenY)/longest)keys.push(screenY>0?'KeyS':'KeyW');
          pendingRouteTick=eye.tick;
          routeCommands.push({tick:eye.tick,waypoint,x:player.x,z:player.z,keys});
          writeFileSync(control,JSON.stringify({manual:true,keys,ms:Math.max(30,Math.min(800,distance/4.5*700)),combat:true}));
        }
      }
      if(auditWeapons&&selections.length<6&&eye.level==='L7'&&eye.phase==='playing'&&weapons.every(w=>eye.player?.weapons.includes(w))){
        if(sent){const weapon=weapons[selections.length],key=weaponKey(weapon)!,log=readFileSync(join(out,'log-late-input.jsonl'),'utf8');if(eye.player.current===weapon&&log.includes(`"capture":"selected-${weapon}"`)){selections.push({weapon,key,observed:eye.player.current,tick:eye.tick});sent=false;}else{await delay(100);continue;}}
        if(!sent&&selections.length<weapons.length){const weapon=weapons[selections.length];writeFileSync(control,JSON.stringify({manual:true,key:`Digit${weaponKey(weapon)}`,keys:[],ms:150,capture:`selected-${weapon}`}));sent=true;}
        else writeFileSync(control,JSON.stringify({manual:false}));
      }
    }
    await delay(250);
  }
  result=await live;
  if(auditWeapons) assert.equal(selections.length,6,'all six physical weapon selections required');
} catch (caught) { error = String(caught); }
finally { server.kill('SIGTERM'); rmSync(join(out, 'profile'), { recursive: true, force: true }); }
atomicJson(`docs/reports/fix51-r10c/${cell}-input.json`, { ...identity, browserHash: hash,
  producer:'tools/qa/accept/carried-input-r11.ts', selections, physicalRoute, route, zooRoute, routeCommands, routeReleased, seedSaveSha256: createHash('sha256').update(JSON.stringify(save)).digest('hex'),
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), out, levels, tier: tierArg,
  method: 'Shared headless Metal WebGL2, physical WASD/mouse/mission UI, production campaign handovers. Protected courier, no objective skips or actor relocation. Read-only acceptance ledger; no frame timing. Each capture pauses simulation and restores quality/zoom.', result, error });
console.log(cell, { result, error });
process.exitCode = error || result?.issues.some(issue => ['console-error', 'page-error', 'cannot-finish'].includes(issue.kind)) ? 1 : 0;
