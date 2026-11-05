import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { runSession } from '../../playtest/session';
import { provenance } from './probe';
import { browserHash } from './browser';
import { atomicJson } from './report';
import { gunzipSync } from 'node:zlib';
import { SAVE_KEY, validateSave } from '../../../src/sim/progression/Save';
import { weaponKey } from '../../../src/data/weaponKeys';

const [tierArg] = process.argv.slice(2), levelArg = 'L7';
assert(tierArg === 'low' || tierArg === 'high');
assert(['L7', 'L7,L8', 'L8', 'L10'].includes(levelArg));
const levels = levelArg.split(','), identity = provenance(), hash = browserHash();
const build = JSON.parse(readFileSync('dist/.qa-accept-build.json', 'utf8'));
assert.equal(build.sourceHash, identity.sourceHash); assert.equal(build.browserHash, hash);
const saveBytes=readFileSync(`docs/reports/fix51-r10c/L7-${tierArg}-carried-save.json.gz`), save=JSON.parse(gunzipSync(saveBytes).toString());
assert(validateSave(save));
const selections: {weapon:string; key:number; observed:string|null; tick:number}[]=[];
const cell = `L7-${tierArg}-arrival`, out = resolve(`test-results/fix51-r10c/${cell}-${Date.now()}`);
mkdirSync(out, { recursive: true });
const socket = createServer();
await new Promise<void>((ready, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', ready); });
const address = socket.address(); assert(address && typeof address !== 'string' && address.port !== 3300);
const port = address.port; await new Promise<void>(ready => socket.close(() => ready()));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const profile=join(out,'profile');mkdirSync(profile,{recursive:true});
writeFileSync(join(profile,'pool-storage.json'),JSON.stringify({cookies:[],origins:[{origin,localStorage:[{name:SAVE_KEY,value:JSON.stringify(save)}]}]}));
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
  process.env.PLAYTEST_VISIBLE_ONLY='1';
  process.env.PLAYTEST_ACCEPTANCE_LEDGER = '1'; process.env.PLAYTEST_ACCEPTANCE_CAPTURES = '1';
  process.env.PLAYTEST_HANDOVER_AUDIT = levels.includes('L8') ? '1' : '0';
  // runSession uses launchProfile through the shared headless browser pool.
  const control=join(out,'control.json');process.env.PLAYTEST_CONTROL_FILE=control;
  let finished=false;
  const live = runSession({ origin, out, levels, quality: tierArg, zoom: 1.5, heroine: 'female', entry: 'continue', profile, levelMinutes: 8,
    sampleSeconds: 120, stopAfterLevel: false, tag: 'arrival-input', noSkip: true }).finally(()=>{finished=true;});
  const weapons=['weapon.bat','weapon.fire-axe','weapon.handgun','weapon.shotgun','weapon.army-mg','weapon.rocket-launcher'];
  let sent=false;
  while(!finished){
    const latest=join(out,'latest.json');
    if(existsSync(latest)&&!existsSync(control)){
      let eye;try{eye=JSON.parse(readFileSync(latest,'utf8'));}catch{await delay(50);continue;}
      if(selections.length<6&&eye.phase==='playing'&&weapons.every(w=>eye.player?.weapons.includes(w))){
        if(sent){const weapon=weapons[selections.length],key=weaponKey(weapon)!,log=readFileSync(join(out,'log-arrival-input.jsonl'),'utf8');if(eye.player.current===weapon&&log.includes(`\"capture\":\"selected-${weapon}\"`)){selections.push({weapon,key,observed:eye.player.current,tick:eye.tick});sent=false;}else{await delay(100);continue;}}
        if(!sent&&selections.length<weapons.length){const weapon=weapons[selections.length];writeFileSync(control,JSON.stringify({manual:true,key:`Digit${weaponKey(weapon)}`,keys:[],ms:150,capture:`selected-${weapon}`}));sent=true;}
        else writeFileSync(control,JSON.stringify({manual:false}));
      }
    }
    await delay(250);
  }
  result=await live;assert.equal(selections.length,6,'all six physical selection observations required');
} catch (caught) { error = String(caught); }
finally { server.kill('SIGTERM'); rmSync(join(out, 'profile'), { recursive: true, force: true }); }
atomicJson(`docs/reports/fix51-r10c/${cell}-input.json`, { ...identity, browserHash: hash,
  seedArchiveSha256:createHash('sha256').update(saveBytes).digest('hex'),selections,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), out, levels, tier: tierArg,
  method: 'Actual native L5/L6 completion save through production Continue, six physical keyboard weapon selections observed in normal game state; no actor/arsenal writes. Shared headless Metal WebGL2, physical WASD/mouse/mission UI, production campaign handovers. Protected courier, no objective skips or actor relocation. Read-only acceptance ledger; no frame timing. Each capture pauses simulation and restores quality/zoom.', result, error });
console.log(cell, { result, error });
process.exitCode = error || result?.issues.some(issue => ['console-error', 'page-error', 'cannot-finish'].includes(issue.kind)) ? 1 : 0;
