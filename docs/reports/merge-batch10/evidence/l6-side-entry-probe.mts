import { loadL6 } from '../../../../tools/sim-runner/l6Bots';
import { l6Doors, l6Entries } from '../../../../src/data/l6';
const {world:w}=await loadL6(1);
try {
 const p=w.entities.get(1)!,nav=w.infected!.nav;
 const requested=l6Entries.map(entry=>({door:entry.door,x:l6Doors[entry.door].x-25,z:15}));
 const mask=requested.map(at=>({...at,mask:nav.mask?.(at.x,at.z),clear:nav.clear(at.x,at.z,.3)}));
 const start={...p.transform}; Object.assign(p.transform,requested[0]); w.physics.playerBody!.setTranslation(p.transform,true); w.update();
 const rawAfter={...p.transform};const relocated=w.solids.relocate(p,{x:requested[0].x,y:p.transform.y,z:15},'probe.l6-side-entry',2);
 console.log(JSON.stringify({start,requested:mask,rawAfter,relocated,relocatedPose:{...p.transform}}));
}finally{w.dispose();}
