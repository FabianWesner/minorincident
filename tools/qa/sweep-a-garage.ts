/** L1-14: ordinary input to the bat, then explicitly survival-protected mechanical garage observation. */
import { loadLevel } from '../sim-runner/levels';
import { runL1 } from '../sim-runner/l1Bots';
import { emptyInput } from '../../src/input/InputFrame';
import { writeFileSync } from 'node:fs';import{gzipSync}from'node:zlib';import{provenance}from'./accept/probe';
type Point = { x: number; z: number };
interface Body extends Point {
 id: number; mode?: string; target?: number; emerging: boolean; rising: boolean; toPlayer: number; toGarage: number;
 goal: { x?: number; z?: number };
}
interface Frame {
 tick: number; p: Point; toGarage: number; hp: number; house: (Point & { ids: number[] }) | null; actors: Body[];
}
interface Admission extends Point { id: number; tick: number; doorDistance: number; door: Point; emerging?: boolean }
const runs=[];
for(const tier of ['low','high'] as const){
 const w=await loadLevel('L1',1,undefined,0,{quality:tier});
 try{
  const m=w.missions!,garage=m.def.anchors['garage-door'];let picked=0;const frames: Frame[]=[];const admission: Admission[]=[];const seen=new Set<number>();
  const set=w.setInput.bind(w);w.setInput=patch=>set(picked?emptyInput():patch);
  const damage=w.player!.damage.bind(w.player!);w.player!.damage=(...args)=>picked?0:damage(...args);
  const run=runL1(w,m,'complete',{maxSeconds:360,stopWhen:()=>!!picked&&w.tick>=picked+90*60,onTick:()=>{
   if(!picked&&m.state.steps.weapon.status==='completed')picked=w.tick;
   const h=m.state.l1!.house,p=w.entities.get(1)!.transform;
   if(!picked&&!h)return;
   if(h)for(const id of h.ids){const e=w.entities.get(id)!;if(!e.hidden&&!e.pendingAdmission&&!seen.has(id)){seen.add(id);admission.push({id,tick:w.tick,x:e.transform.x,z:e.transform.z,doorDistance:Math.hypot(e.transform.x-h.x,e.transform.z-h.z),door:{x:h.x,z:h.z},emerging:e.emerging});}}
   const actors=w.infected!.active.filter(e=>e.health.current>0&&!e.hidden&&!e.pendingAdmission).map(e=>({id:e.id,x:e.transform.x,z:e.transform.z,mode:e.infected!.l1?.mode,target:e.infected!.l1?.targetId,emerging:!!e.emerging,rising:!!e.infectionRise,toPlayer:Math.hypot(e.transform.x-p.x,e.transform.z-p.z),toGarage:Math.hypot(e.transform.x-garage.x,e.transform.z-garage.z),goal:{x:e.infected!.l1?.goalX,z:e.infected!.l1?.goalZ}}));
   frames.push({tick:w.tick,p:{x:p.x,z:p.z},toGarage:Math.hypot(p.x-garage.x,p.z-garage.z),hp:w.entities.get(1)!.health.current,house:h?{x:h.x,z:h.z,ids:[...h.ids]}:null,actors});
  }});
  runs.push({tier,picked,method:'Ordinary completion input to bat; then empty input and incoming player damage suppression only for90s mechanical garage observation. No teleport/spawn/AI edits/objective skips.',run,admission,frames});console.log(tier,picked,admission.length,frames.length);
 }finally{w.dispose();}
}
const out = process.env.SWEEP_GARAGE_OUT ?? 'docs/reports/sweep-a';
writeFileSync(`${out}/L1-14-current-ledger.json.gz`,gzipSync(JSON.stringify({...provenance(),runs})));
