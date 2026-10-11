import { writeFileSync } from 'node:fs';
import { loadL3, runL3 } from '../sim-runner/l3Bots';
const {world,mission} = await loadL3(1);
const samples:{t:number;x:number;y:number;z:number;squad:number;infectedNear:number}[]=[];
let maxQuietWalkM=0, quietWalkM=0, walkedM=0, previous:{x:number;z:number}|null=null;
world.events.on('sim.tick',()=>{
  const p=world.entities.get(1)!.transform,s=mission.state.l3!;
  const near=world.infected!.active.filter(e=>e.health.current>0&&Math.hypot(e.transform.x-p.x,e.transform.z-p.z)<=18).length;
  if(s.fallbackAt&&previous) {
    const step=Math.hypot(p.x-previous.x,p.z-previous.z);
    if(step<1) {walkedM+=step;quietWalkM=near?0:quietWalkM+step;maxQuietWalkM=Math.max(maxQuietWalkM,quietWalkM);}
  }
  previous={x:p.x,z:p.z};
  if(world.tick%120===0) samples.push({t:world.tick/60,x:p.x,y:p.y,z:p.z,squad:s.squad.length,infectedNear:near});
});
try {
  const report=runL3(world,mission,'complete',{seed:1,maxSeconds:600});
  const result={...report,walkedM,maxQuietWalkM,samples,plannedHomes:mission.state.l3!.pending.map(q=>q.home)};
  writeFileSync('docs/reports/l3-route/complete-seed-1.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({outcome:report.outcome,simSeconds:report.simSeconds,deaths:report.deaths,damage:report.damage,squad:report.squad,walkedM,maxQuietWalkM,audit:report.audit}));
  if(report.outcome!=='complete') process.exitCode=1;
} finally {world.dispose();}
