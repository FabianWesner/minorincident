import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {runLevel} from '../../sim-runner/levels.ts';
import {preset} from '../../../src/sim/progression/Campaign.ts';
import {emptyInput} from '../../../src/input/InputFrame.ts';
import {stateHash} from '../../../src/sim/world/stateHash.ts';
import {validateSave} from '../../../src/sim/progression/Save.ts';
import {provenance} from './probe.ts';
const root=process.argv[2]??'docs/reports/fix72-c/L10-12',identity=provenance(),rows=[],sha=b=>createHash('sha256').update(b).digest('hex');mkdirSync(root,{recursive:true});
const simulationHash=()=>{const h=createHash('sha256');for(const file of execFileSync('git',['ls-files','-z','--','src','layouts','public/assets/layouts'],{encoding:'utf8'}).split('\0').filter(p=>p&&!p.startsWith('src/render/')).sort()){h.update(file);h.update('\0');h.update(readFileSync(file));}return h.digest('hex');};
for(const tier of ['low','high']){
 const control=JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L10-${tier}-stationary.json`));assert.equal(control.sourceHash,identity.sourceHash);const campaign=preset('L10-default');campaign.settings.quality=tier;let snapshot,finalHash='';
 const run=await runLevel('L10','complete',1,1800,'auto',campaign,undefined,0,{quality:tier,passive:true,passiveHoldSeconds:240,beforeBegin:w=>{const apply=w.applyInput.bind(w);w.applyInput=(frame,scheme)=>apply(w.missions.state.states['charge-active']?emptyInput():frame,scheme);const update=w.update.bind(w);w.update=()=>{update();if(!snapshot&&w.missions.state.states['charge-active']&&w.megaPursuit.distance()<=18)snapshot=w.missions.saveResume();};},beforeDispose:w=>finalHash=stateHash(w.getState())});assert.equal(run.outcome,'tick-budget');assert.equal(finalHash,control.nativeStateHash);assert(snapshot);
 const save=preset('L10-default');save.settings.quality=tier;assert(snapshot.current.arsenal);Object.assign(save,structuredClone(snapshot.current.arsenal));save.cureResume=structuredClone(snapshot);assert(validateSave(save));const file=`${root}/${tier}-close-save.json.gz`,bytes=gzipSync(JSON.stringify(save));writeFileSync(file,bytes);rows.push({tier,run,nativeStateHash:finalHash,controlIdentical:true,seeds:[{stage:'charge',file,sha256:sha(bytes),tick:snapshot.current.tick}]});console.log(tier,snapshot.current.tick);
}
writeFileSync(`${root}/close-prefix-proof.json`,JSON.stringify({...identity,simulationHash:simulationHash(),toolSha256:sha(readFileSync(new URL(import.meta.url))),method:'Read-only snapshot of canonical240s stationary native hold when persistent Mega naturally enters18m; full final state hash identical to independent native stationary control. Production saveResume plus exact arsenal, no actor writes or relocation. Subsequent browser input is physical.',rows},null,2)+'\n');
