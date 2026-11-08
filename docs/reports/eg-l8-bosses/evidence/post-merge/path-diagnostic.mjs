// Reproduce from the repo root: node --import tsx/esm --input-type=module < this-file
import { runLevel } from './tools/sim-runner/levels.ts';
import { preset } from './src/sim/progression/Campaign.ts';
import { SimPhase } from './src/core/EventBus.ts';
import { PathProbe } from './tools/qa/threat/observer.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
const campaign=preset('L8-default'); campaign.settings.quality='high';
const rows=[], paths=new PathProbe();
const result=await runLevel('L8','complete',1,undefined,'auto',campaign,undefined,0,{quality:'high',beforeBegin:w=>{
  w.events.on('sim.tick',()=>{
    if(w.tick<5000||w.tick%120)return;
    const e=w.entities.get(368),p=w.entities.get(1);
    if(!e?.infected||!p||e.health.current<=0)return;
    const native=w.infected.navigation,source=native.grid(e.transform),goal=native.target(e.transform,p.transform),r=e.combat.radius;
    const bounded=paths.query(source,e,p.transform,2.5),distance=paths.distance(source,e,p.transform);
    const cell=source.nearestCell(e.transform.x,e.transform.z,r),blocker=w.solids.blockingBody(e.id);
    rows.push({tick:w.tick,phase:w.missions.state.phase,at:{...e.transform},player:{...p.transform},hp:e.health.current,pending:e.pendingAdmission,bounded,distance:Number.isFinite(distance)?distance:null,direct:Math.hypot(e.transform.x-p.transform.x,e.transform.z-p.transform.z),goal,cell,cellAt:cell<0?null:{x:source.x(cell),z:source.z(cell)},clear:source.clear(e.transform.x,e.transform.z,r),locomotion:e.locomotion?{...e.locomotion}:null,brain:{state:e.infected.state,mode:e.infected.l1?.mode,targetId:e.infected.l1?.targetId,pathIndex:e.infected.pathIndex,path:e.infected.path.slice(0,8)},blocker:blocker?{id:blocker.id,archetype:blocker.archetype,at:{...blocker.transform}}:null,walls:source.walls.filter(q=>Math.abs(q.x-e.transform.x)<q.halfX+3&&Math.abs(q.z-e.transform.z)<q.halfZ+3).map(q=>({...q})),props:w.props.items.filter(q=>{const at=q.body.translation();return Math.hypot(at.x-e.transform.x,at.z-e.transform.z)<3}).map(q=>({id:q.id,asset:q.assetId,at:q.body.translation(),radius:q.radius}))});
  },SimPhase.cleanup+3);
}});
mkdirSync('test-results/l8-merge/path-diagnostic',{recursive:true});writeFileSync('test-results/l8-merge/path-diagnostic/high.json',JSON.stringify({revision:'63e60096',method:'Read-only ordinary high-tier native route, targeted actor 368; no fixture changes.',result,rows},null,2));console.log(JSON.stringify({outcome:result.outcome,rows:rows.length,blocked:rows.filter(r=>!r.bounded).map(r=>({tick:r.tick,at:r.at,pending:r.pending,distance:r.distance,cell:r.cell,clear:r.clear,blocker:r.blocker}))}));
