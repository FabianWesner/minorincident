/** Bounded ordinary-input rows on native progressed preset saves.
 * runSession uses launchProfile from the shared browser pool. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preset, type ProgressionPreset } from '../../../src/sim/progression/Campaign';
import { SAVE_KEY, validateSave } from '../../../src/sim/progression/Save';
import { runSession } from '../../playtest/session';
import { provenance } from './probe';
import { browserHash } from './browser';
if (process.env.BROWSER_POOL === 'off') throw new Error('Shared browser pool is required');
const [level, tier] = process.argv.slice(2);
if (!['L4','L5','L6','L7'].includes(level) || !['low','high'].includes(tier)) throw new Error('Use L4|L5|L6|L7 low|high');
const identity = provenance(), hash = browserHash();
const built = JSON.parse(readFileSync('dist/.playtest-build.json','utf8'));
if (built.sourceHash !== identity.sourceHash) throw new Error('QA build differs from source');
const socket = createServer(); await new Promise<void>(done => socket.listen(0, '127.0.0.1', done));
const address = socket.address(); if (!address || typeof address === 'string' || address.port === 3300) throw new Error('Invalid private port');
const port = address.port; await new Promise<void>(done => socket.close(() => done()));
const origin = `http://127.0.0.1:${port}`, out = resolve(`test-results/fix53-b/full/${level}-${tier}`), profile = join(out,'profile');
mkdirSync(profile,{recursive:true});
const save = preset(`${level}-default` as ProgressionPreset); save.settings.quality = tier as 'low'|'high';
if (!validateSave(save)) throw new Error('Invalid progressed preset');
writeFileSync(join(profile,'pool-storage.json'), JSON.stringify({cookies:[],origins:[{origin,localStorage:[{name:SAVE_KEY,value:JSON.stringify(save)}]}]}));
writeFileSync(join(out,'seed-save.json'), JSON.stringify(save));
const server = spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner'],{stdio:'ignore'});
let result: Awaited<ReturnType<typeof runSession>> | null = null, error: string | null = null;
try {
  let ready = false;
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{/* preview starts */}await new Promise(done=>setTimeout(done,100));}
  if(!ready) throw new Error('Private preview failed to start');
  Object.assign(process.env,{PLAYTEST_BACKEND:'webgl2',PLAYTEST_GOD:'1',PLAYTEST_NO_FRAME_TIMING:'1',PLAYTEST_FRAME_GATE:'0',PLAYTEST_CPU_PROFILE:'0',PLAYTEST_ACCEPTANCE_LEDGER:'1',PLAYTEST_ACCEPTANCE_CAPTURES:'1',PLAYTEST_ACCEPTANCE_CAPTURE_TIERS:'single',PLAYTEST_AUDIO_CUES:'1',PLAYTEST_L5_TOUR:'1',PLAYTEST_L7_ESCORT_ROUTE:'1',PLAYTEST_METRO_AUDIT:'1',PLAYTEST_HANDOVER_AUDIT:'0'});
  result = await runSession({origin,out,levels:[level],quality:tier as 'low'|'high',zoom:1.5,heroine:'female',entry:'continue',profile,levelMinutes:8,stopAfterLevel:true,tag:'full',noSkip:true,sampleSeconds:480});
} catch(caught) { error = String(caught); }
finally { server.kill('SIGTERM'); }
writeFileSync(join(out,'receipt.json'),JSON.stringify({...identity,browserHash:hash,buildHash:built.buildHash,level,tier,port,seed:'Production preset saved to profile, normal unlocked menu entry; not a physical prior-level handover.',method:'Shared headless Metal WebGL2; physical WASD/mouse/E; protected courier; no objective skips or actor relocation; no frame timing; explicit authored-map assists in L5. Photos at0.5/1.5 pause and restore camera.',result,error},null,2)+'\n');
console.log(level,tier,JSON.stringify({result,error}));
process.exitCode=error?1:0;
