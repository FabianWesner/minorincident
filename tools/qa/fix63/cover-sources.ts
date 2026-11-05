/** Read-only exact-frustum audit of potential rear truck exit points. */
import { loadL3, runL3 } from '../../sim-runner/l3Bots';
import type { CoverWall } from '../../../src/sim/combat/HitQuery';
const {world,mission}=await loadL3(1,'high');
try {
  runL3(world,mission,'complete',{stopWhen:()=>!!mission.state.l3!.attackAt,maxSeconds:20});
  const cover=world.districts!.districts.flatMap(d=>d.layout.placements).find(p=>p.id==='l3-alarm-cover')!;
  const walls=(mission.l3 as unknown as {alarmCoverWalls:CoverWall[]}).alarmCoverWalls;
  const hits=[];
  for(let dx=-6;dx<=-3.5;dx+=.25)for(let dz=-2;dz<=1;dz+=.25){
    const p={x:cover.position[0]+dx,z:cover.position[2]+dz};
    if(world.infected!.nav.clear(p.x,p.z,.45)&&world.infected!.director.inFrame(p)&&world.infected!.director.occluded(p,walls))hits.push({dx,dz});
  }
  console.log(JSON.stringify({cover:cover.position,walls,hits}));
}finally{world.dispose();}
