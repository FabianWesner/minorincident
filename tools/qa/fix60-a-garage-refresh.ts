/** L1-14: ordinary input to the bat, then explicitly survival-protected mechanical garage observation. */
import { loadLevel } from '../sim-runner/levels';
import { runL1 } from '../sim-runner/l1Bots';
import { emptyInput } from '../../src/input/InputFrame';
import { readFileSync, writeFileSync } from 'node:fs';import{gzipSync,gunzipSync}from'node:zlib';import{provenance}from'./accept/probe';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
type Point = { x: number; z: number };
interface Body extends Point {
 id: number; mode?: string; target?: number; emerging: boolean; rising: boolean; toPlayer: number; toGarage: number;
 goal: { x?: number; z?: number };
}
interface Frame {
 tick: number; p: Point; toGarage: number; hp: number; house: (Point & { ids: number[] }) | null; globalLiving: number; actors: Body[];
}
interface Admission extends Point { id: number; tick: number; doorDistance: number; door: Point; emerging?: boolean }
function pursuesCourier(body: Body): boolean { return body.target === 1 && ['chase','bite'].includes(body.mode ?? '') && body.toPlayer <= 20; }
const out=process.env.GARAGE_PROOF_OUT??'docs/reports/fix60-a';
const runs=[];
const holdSeconds = 150;
for(const tier of ['low','high'] as const){
 const w=await loadLevel('L1',1,undefined,0,{quality:tier});
 try{
  const m=w.missions!,garage=m.def.anchors['garage-door'];let picked=0;const frames: Frame[]=[];const admission: Admission[]=[];const seen=new Set<number>();
  const set=w.setInput.bind(w);w.setInput=patch=>set(picked?emptyInput():patch);
  const damage=w.player!.damage.bind(w.player!);w.player!.damage=(...args)=>picked?0:damage(...args);
  const run=runL1(w,m,'complete',{maxSeconds:360,stopWhen:()=>!!picked&&w.tick>=picked+holdSeconds*60,onTick:()=>{
   if(!picked&&m.state.steps.weapon.status==='completed')picked=w.tick;
   const h=m.state.l1!.house,p=w.entities.get(1)!.transform;
   if(!picked&&!h)return;
   if(h)for(const id of h.ids){const e=w.entities.get(id)!;if(!e.hidden&&!e.pendingAdmission&&!seen.has(id)){seen.add(id);admission.push({id,tick:w.tick,x:e.transform.x,z:e.transform.z,doorDistance:Math.hypot(e.transform.x-h.x,e.transform.z-h.z),door:{x:h.x,z:h.z},emerging:e.emerging});}}
   const actors=w.infected!.active.filter(e=>e.health.current>0&&!e.hidden&&!e.pendingAdmission).map(e=>({id:e.id,x:e.transform.x,z:e.transform.z,mode:e.infected!.l1?.mode,target:e.infected!.l1?.targetId,emerging:!!e.emerging,rising:!!e.infectionRise,toPlayer:Math.hypot(e.transform.x-p.x,e.transform.z-p.z),toGarage:Math.hypot(e.transform.x-garage.x,e.transform.z-garage.z),goal:{x:e.infected!.l1?.goalX,z:e.infected!.l1?.goalZ}}));
   // Keep every authored resident and every actual courier pursuer each tick;
   // unrelated street actor trajectories do not qualify this row.
   frames.push({tick:w.tick,p:{x:p.x,z:p.z},toGarage:Math.hypot(p.x-garage.x,p.z-garage.z),hp:w.entities.get(1)!.health.current,house:h?{x:h.x,z:h.z,ids:[...h.ids]}:null,globalLiving:actors.length,actors:actors.filter(body=>h?.ids.includes(body.id)||pursuesCourier(body))});
  }});
  runs.push({tier,picked,method:`Ordinary completion input to bat; then empty input and incoming player damage suppression only for${holdSeconds}s mechanical garage observation (original90s plus60s stability). No teleport/spawn/AI edits/objective skips.`,run,admission,frames});console.log(tier,picked,admission.length,frames.length);
 }finally{w.dispose();}
}
writeFileSync(`${out}/L1-14-refresh-ledger.json.gz`,gzipSync(JSON.stringify({...provenance(),runs})));
function summarize(run: { tier: string; picked: number; frames: Frame[]; admission: Admission[] }) {
  const final = run.frames.at(-1)!, ids = new Set(final.house?.ids ?? []);
  const residents = final.actors.filter(body => ids.has(body.id));
  const waiting = residents.filter(body => !pursuesCourier(body));
  const stability = run.frames.filter(frame => frame.tick >= run.picked + 90 * 60).flatMap(frame => frame.actors.filter(body => ids.has(body.id) && !pursuesCourier(body)));
  return { tier: run.tier, holdTicks: final.tick - run.picked + 1, admitted: run.admission.length,
    maxDoorDistance: Math.max(...run.admission.map(body => body.doorDistance)),
    maxPursuers: Math.max(...run.frames.map(frame => frame.actors.filter(pursuesCourier).length)),
    livingResidents: residents.length, waitingResidents: waiting.length,
    minWaitingDistance: Math.min(...waiting.flatMap(body => [body.toGarage, body.toPlayer])),
    civilianChasers: waiting.filter(body => ['chase','bite'].includes(body.mode ?? '')).length,
    stabilitySamples: stability.length, stabilityMinDistance: stability.length ? Math.min(...stability.flatMap(body => [body.toGarage, body.toPlayer])) : null,
    finalResidents: residents };
}
const qualifies = (summary: ReturnType<typeof summarize>) => summary.holdTicks >= 5400 && summary.admitted >= 6 && summary.maxDoorDistance <= 3 && summary.maxPursuers <= 3 && summary.livingResidents >= 6 && summary.waitingResidents >= 3 && summary.minWaitingDistance >= 16 && !summary.civilianChasers;
const summaries = runs.map(summarize);
const baselinePath = 'docs/reports/sweep-a/L1-14-current-ledger.json.gz';
const baselineBytes = readFileSync(baselinePath);
const baseline = (JSON.parse(gunzipSync(baselineBytes).toString()) as { runs: Parameters<typeof summarize>[0][] }).runs.map(summarize);
const controls = baseline.map(summary => ({ name: `original ${summary.tier} wait failure detected`, pass: !qualifies(summary) && summary.minWaitingDistance < 16 }));
for (const [name, change] of Object.entries({ 'five residents': { admitted: 5 }, 'door beyond3m': { maxDoorDistance: 3.001 }, 'four pursuers': { maxPursuers: 4 }, 'waiting inside16m': { minWaitingDistance: 15.999 }, 'civilian chase': { civilianChasers: 1 }, 'short hold': { holdTicks: 5399 } })) controls.push({ name, pass: !qualifies({ ...summaries[0], ...change }) });
writeFileSync(`${out}/L1-14-refresh-measurement.json`, JSON.stringify({ ...provenance(), summaries, baseline: { file: baselinePath, sha256: createHash('sha256').update(baselineBytes).digest('hex'), summaries: baseline }, controls }, null, 2) + '\n');
console.log(JSON.stringify(summaries, (key, value: unknown) => key === 'finalResidents' ? undefined : value));
assert(controls.every(control => control.pass));
assert(summaries.every(summary => qualifies(summary) && summary.stabilitySamples > 0 && summary.stabilityMinDistance! >= 16));
