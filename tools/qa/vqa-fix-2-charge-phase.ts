/** Read-only witness for pre-physics versus actual mission-phase charge eligibility. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync}from'node:fs';
import {SimWorld}from'../../src/sim/world/SimWorld';
import {LevelTenFinale}from'../../src/sim/missions/LevelTenFinale';
import type {Mission}from'../../src/sim/missions/Mission';
import{probeLevel,provenance}from'./accept/probe';
const identity=provenance(),baseline=JSON.parse(readFileSync('docs/reports/fix51-verify/receipts/L10-high-complete.json','utf8'));
const sample=(w:SimWorld)=>{const m=w.missions!,p=w.entities.get(1)!,a=m.def.anchors['cure-console'],charge=m.state.counters['charge-ticks']??0,distance=a?Math.hypot(p.transform.x-a.x,p.transform.z-a.z):null;return{tick:w.tick,position:{...p.transform},hp:p.health.current,charge,active:!!m.state.states['charge-active'],hold:m.state.steps.hold?.status,distance,eligible:!!m.state.states['charge-active']&&m.state.steps.hold?.status==='active'&&p.health.current>0&&distance!==null&&distance<=25&&charge<3600};};
const before=new WeakMap<SimWorld,ReturnType<typeof sample>>(),mismatches:unknown[]=[],actualInvalid:unknown[]=[];
const update=SimWorld.prototype.update,finale=LevelTenFinale.prototype.update;
SimWorld.prototype.update=function(){before.set(this,sample(this));return update.call(this);};
LevelTenFinale.prototype.update=function(){const w=(this as unknown as{mission:Mission}).mission.world,phase=sample(w);finale.call(this);const after=w.missions!.state.counters['charge-ticks']??0;if(after>phase.charge){if(!phase.eligible)actualInvalid.push({phase,after});const pre=before.get(w)!;if(!pre.eligible)mismatches.push({beforeWorldUpdate:pre,atFinaleUpdate:phase,afterCharge:after});}};
try{
 const receipt=await probeLevel('L10','high','complete');assert.equal(receipt.nativeStateHash,baseline.nativeStateHash,'read-only wrappers must preserve the original full run');assert.equal(receipt.sourceHash,baseline.sourceHash);assert(mismatches.length>0);assert.equal(actualInvalid.length,0);assert.equal(receipt.observation!.charge.invalidIncrements,0);assert.equal(receipt.observation!.charge.eligibleTicks,3600);assert.equal(receipt.observation!.charge.incrementTicks,3600);
 writeFileSync('docs/reports/vqa-fix-2/L10-charge-phase-witness.json',JSON.stringify({...identity,method:'Same native high complete input and final state hash. Read-only wrappers sample courier/counter before world.update and exactly when LevelTenFinale evaluates its predicate; no gameplay writes.',originalStateHash:baseline.nativeStateHash,observedStateHash:receipt.nativeStateHash,mismatches,actualInvalid,originalObserverHash:baseline.observerHash,originalCharge:baseline.observation.charge,observedCharge:receipt.observation!.charge},null,2)+'\n');console.log(JSON.stringify({stateIdentical:true,mismatches,actualInvalid}));
}finally{SimWorld.prototype.update=update;LevelTenFinale.prototype.update=finale;}
