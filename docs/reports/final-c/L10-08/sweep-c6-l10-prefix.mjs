import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {runLevel} from '../../sim-runner/levels.ts';
import {preset} from '../../../src/sim/progression/Campaign.ts';
import {stateHash} from '../../../src/sim/world/stateHash.ts';
import {validateSave} from '../../../src/sim/progression/Save.ts';
import {provenance} from './probe.ts';
const root='docs/reports/final-c/L10-08',identity=provenance(),rows=[],sha=b=>createHash('sha256').update(b).digest('hex');mkdirSync(root,{recursive:true});
for(const tier of ['low','high']){
 const control=JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L10-${tier}-complete.json`));assert.equal(control.sourceHash,identity.sourceHash);const campaign=preset('L10-default');campaign.settings.quality=tier;const snapshots={};let finalHash='';
 const run=await runLevel('L10','complete',1,undefined,'auto',campaign,undefined,0,{quality:tier,beforeBegin:w=>{const update=w.update.bind(w);w.update=()=>{update();const s=w.missions.state;for(const [name,x]of [['road1',600],['road2',980],['road3',1500],['road4',2100],['road5',2630]])if(!snapshots[name]&&w.entities.get(1).transform.x>=x)snapshots[name]=w.missions.saveResume();if(s.states['charge-active']&&!snapshots.charge)snapshots.charge=w.missions.saveResume();if(s.states['mega-dead']&&!s.states['cure-released']&&!snapshots.release)snapshots.release=w.missions.saveResume();};},beforeDispose:w=>finalHash=stateHash(w.getState())});assert(run.completed);assert.equal(finalHash,control.nativeStateHash);assert(snapshots.charge&&snapshots.release);
 const seeds=[];for(const [stage,snapshot]of Object.entries(snapshots)){const save=preset('L10-default');save.settings.quality=tier;assert(snapshot.current.arsenal);Object.assign(save,structuredClone(snapshot.current.arsenal));save.cureResume=structuredClone(snapshot);assert(validateSave(save));const file=`${root}/${tier}-${stage}-save.json.gz`,bytes=gzipSync(JSON.stringify(save));writeFileSync(file,bytes);seeds.push({stage,file,sha256:sha(bytes),tick:snapshot.current.tick,states:snapshot.current.state.states});}
 rows.push({tier,run,nativeStateHash:finalHash,controlIdentical:true,seeds});console.log(tier,seeds.map(s=>({stage:s.stage,tick:s.tick})));
}
writeFileSync(`${root}/prefix-proof.json`,JSON.stringify({...identity,toolSha256:sha(readFileSync(new URL(import.meta.url))),method:'Read-only snapshots of normal native complete InputFrame route, exact canonical final state hash preserved. Unmodified production saveResume plus actual arsenal, loaded normally for subsequent physical-input qualification. This is a native prefix, not claimed as physical whole-route evidence.',rows},null,2)+'\n');
