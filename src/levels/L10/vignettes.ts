import { worldAssets } from '../../assets/worldDefinitions';
import type { Placement, Point } from '../districts/types';
import { cure } from './district';
import { cureCrossingLines } from './crossingStories';
import { cureEncounters, cureEncounterSlots, cureMedkits } from './encounters';

export const cureVignetteCatalogue = [
  { id: 'last-stand', story: 'Dead defenders behind the sandbags; casings on their side.', pieces: ['prop.sandbag-pallet','decay.body-bag'] },
  { id: 'evacuation', story: 'The passengers left their luggage and never returned.', pieces: ['prop.crates','decay.dropped-belongings'] },
  { id: 'field-camp', story: 'A family camp was abandoned with its radio, cold fire and supplies.', pieces: ['prop.tent','util.radio'] },
  { id: 'triage', story: 'The field triage point ran out of help.', pieces: ['decay.body-bag','prop.medical-cooler'] },
  { id: 'quarantine', story: 'Cut tape marks a quarantine that failed from within.', pieces: ['prop.l10-quarantine-tape','decay.body-bag'] },
  { id: 'graves', story: 'A name board, shovel and the next body waiting for burial.', pieces: ['prop.l10-grave-cross','prop.l10-shovel'] },
  { id: 'livestock', story: 'Dead cattle beside the broken farm boundary.', pieces: ['prop.l10-cow-carcass','prop.picket-fence'] },
  { id: 'quarantine-execution', story: 'The dead were left on the wrong side of the wire.', pieces: ['prop.cure-quarantine-fence','prop.crates'] },
  { id: 'home-refuge', story: 'A painted plea on the final refuge that failed.', pieces: ['prop.privacy-fence','decay.dropped-belongings'] },
].map(v=>({...v,pieces:[...v.pieces,'prop.l10-corpse-back']}));
export const cureWallMessages = ['HELP','NO ROOM','WE WENT NORTH',"DON'T DRINK THE WATER",'SAM WAS HERE','KEEP THE GATE CLOSED','THEY ARE IN THE FIELDS','WAIT FOR THE TRUCK','DO NOT OPEN','WE TRIED',"WE'RE INSIDE",'CAMPUS →'] as const;
export interface CureVignetteScene { id:string; region:number; theme:string; story:string; route:string; at:Point; pieces:string[]; large:boolean }
export interface CureVignetteDecal { id:string; scene:string; cell:number; position:[number,number,number]; yaw:number; ground:boolean; size:[number,number]; highOnly?:boolean }
export interface CureVignetteSet { placements:Placement[]; scenes:CureVignetteScene[]; decals:CureVignetteDecal[]; missed:string[] }
export const cureVignetteRoutes = () => [
  ...cure.regions.map((r,i)=>({ id:`r${i+1}-road`,region:i,line:r.route })),
  ...cureCrossingLines.map((r,i)=>({ id:`crossing-${i}`,region:i===0?1:i===1?2:i===2?3:i<5?4:i===5?5:6,line:r.line })),
];
export function cureLineDistance(p:Point,line:readonly Point[]):number {
  return Math.min(...line.slice(1).map((b,i)=>{const a=line[i],dx=b[0]-a[0],dz=b[1]-a[1],d=dx*dx+dz*dz,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/d)):0;return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);}));
}
export const cureLineLength=(line:readonly Point[])=>line.slice(1).reduce((n,b,i)=>n+Math.hypot(b[0]-line[i][0],b[1]-line[i][1]),0);
function pose(line:readonly Point[],station:number) {
  for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(station>d){station-=d;continue;}const ux=(b[0]-a[0])/d,uz=(b[1]-a[1])/d;return {x:a[0]+ux*station,z:a[1]+uz*station,ux,uz};}
  return {x:line.at(-1)![0],z:line.at(-1)![1],ux:1,uz:0};
}
function make(id:string,assetId:string,x:number,z:number,yaw:number,highOnly=false,solid=false):Placement {
  const d=worldAssets[assetId]?.dimensions;if(!d)throw Error(`Unregistered L10 vignette asset ${assetId}`);
  const c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw)),hx=(c*d.x+s*d.z)/2,hz=(s*d.x+c*d.z)/2;
  return {id,assetId,position:[x,0,z],yaw,scale:[1,1,1],minTier:0,maxTier:6,allowRoad:false,lightGroup:'decor',decor:true,fixed:true,
    ...(highOnly?{highOnly:true}:{}),...(solid?{decorSolid:true}:{}),visualAabb:{min:[x-hx,0,z-hz],max:[x+hx,d.y,z+hz]}};
}
const body=(n:number)=>`prop.l10-corpse-${['back','side','crumple'][n%3]}`;

/** Atomic three-piece scenes on both the authored road and the measured walking crossings. Small props and frozen bodies
 * use DistrictView's existing instancing/LOD path. Key pieces are fixed, and rejected stations are exposed to QA. */
export function cureVignetteSet(occupied:readonly Placement[]):CureVignetteSet {
  const out:CureVignetteSet={placements:[],scenes:[],decals:[],missed:[]},routes=cureVignetteRoutes();
  const lines=[...routes.map(r=>r.line),...cure.detours.map(r=>r.route)];
  const anchors=[...Object.values(cure.anchors),...cureMedkits.map(m=>m.at)];
  const slots=cureEncounters.filter(e=>!e.assault).flatMap(e=>(['high','low'] as const).flatMap(t=>cureEncounterSlots(e,t).map(s=>[s.x,s.z] as Point)));
  const consoleAt=cure.anchors['cure-console'];
  const grid=new Map<string,Placement[]>(),cell=20;
  const index=(p:Placement)=>{const a=p.visualAabb;for(let x=Math.floor(a.min[0]/cell);x<=Math.floor(a.max[0]/cell);x++)for(let z=Math.floor(a.min[2]/cell);z<=Math.floor(a.max[2]/cell);z++){const key=`${x}:${z}`,row=grid.get(key)??[];row.push(p);grid.set(key,row);}};
  occupied.forEach(index);
  const fits=(p:Placement,line:readonly Point[],own:readonly Placement[]=[],clearance=5.4)=>{
    const a=p.visualAabb,[x,,z]=p.position;
    if(Math.hypot(x-consoleAt[0],z-consoleAt[1])<60+Math.hypot(a.max[0]-x,a.max[2]-z)||cureLineDistance([x,z],line)>20)return false;
    const corners:Point[]=[[a.min[0],a.min[2]],[a.min[0],a.max[2]],[a.max[0],a.min[2]],[a.max[0],a.max[2]]];
    if(corners.some(q=>lines.some(r=>cureLineDistance(q,r)<clearance)))return false;
    const near=(q:Point,r:number)=>q[0]>a.min[0]-r&&q[0]<a.max[0]+r&&q[1]>a.min[2]-r&&q[1]<a.max[2]+r;
    if(anchors.some(q=>near(q,8))||slots.some(q=>near(q,4)))return false;
    const nearby=new Set(own);
    for(let xx=Math.floor((a.min[0]-.2)/cell);xx<=Math.floor((a.max[0]+.2)/cell);xx++)for(let zz=Math.floor((a.min[2]-.2)/cell);zz<=Math.floor((a.max[2]+.2)/cell);zz++)for(const q of grid.get(`${xx}:${zz}`)??[])nearby.add(q);
    return [...nearby].every(q=>{let b=q.visualAabb;if(q.assetId==='prop.tree'||q.assetId==='prop.street-tree')b={min:[q.position[0]-.3,0,q.position[2]-.3],max:[q.position[0]+.3,2,q.position[2]+.3]};return a.min[0]>=b.max[0]+.2||a.max[0]<=b.min[0]-.2||a.min[2]>=b.max[2]+.2||a.max[2]<=b.min[2]-.2;});
  };
  const commit=(scene:CureVignetteScene,ps:Placement[])=>{out.scenes.push(scene);out.placements.push(...ps);ps.forEach(index);};
  const addScene=(route:typeof routes[number],station:number,n:number,primary?:string,large=false)=>{
    let theme=cureVignetteCatalogue[(route.region*3+n*5+Math.floor(n/3))%cureVignetteCatalogue.length];
    if(large)theme=cureVignetteCatalogue[primary==='prop.cure-iso-tent'?3:0];
    if(theme.id==='home-refuge'&&out.scenes.some(s=>s.region===route.region&&s.theme==='home-refuge'))theme=cureVignetteCatalogue[5];
    const id=`decor-cure-vignette-${route.id}-${n}`,length=cureLineLength(route.line);
    const assets=[primary??theme.pieces[0],body(n+route.region),theme.pieces[1]];
    const laterals=route.region>=5?[7,8,9,11,13,15,17,19]:[9,11,13,15,17,19];
    for(const shift of [0,-4,4,-8,8,-12,12])for(const side of [n%2?1:-1,n%2?-1:1])for(const lateral of laterals){
      const q=pose(route.line,Math.max(1,Math.min(length-1,station+shift))),x=q.x-q.uz*side*lateral,z=q.z+q.ux*side*lateral,yaw=-Math.atan2(q.uz,q.ux)+(n%5-2)*.13,ps:Placement[]=[];
      for(const [i,asset]of assets.entries()){
        let found:Placement|undefined;
        for(const along of i===0?[0]:large?[3,-3,5,-5,7,-7,9,-9]:[2.5,-2.5,4,-4,5.5,-5.5]){
          for(const outward of i===0?[0]:[0,1.7,-1.7,3.2]){
            const p=make(`${id}-${i}`,asset,x+q.ux*along-q.uz*side*outward,z+q.uz*along+q.ux*side*outward,yaw+i*.43,false,large&&i===0);
            if(fits(p,route.line,ps,large?8.5:5.4)){found=p;break;}
          }
          if(found)break;
        }
        if(!found)break;ps.push(found);
      }
      if(ps.length!==3)continue;
      const scene={id,region:route.region,theme:theme.id,story:theme.story,route:route.id,at:[x,z] as Point,pieces:ps.map(p=>p.id),large};commit(scene,ps);return scene;
    }
    return undefined;
  };
  for(const route of routes.filter(r=>r.id.endsWith('-road'))){
    const length=cureLineLength(route.line);
    for(let s=15,n=0;s<length-8;s+=46+(n*17+route.region*11)%7,n++){
      if(route.region===6&&s>length-70)break;
      if(!addScene(route,s+(route.region===6&&n===5?12:0),n))out.missed.push(`${route.id}:${Math.round(s)}`);
    }
  }
  // Existing crossing scenes already supply their tall landmarks; add remains to those exact compositions.
  const groups=new Map<string,Placement[]>();
  for(const p of occupied){const m=/^(decor-cure-cross-\d+-\d+)-/.exec(p.id);if(m){const row=groups.get(m[1])??[];row.push(p);groups.set(m[1],row);}}
  for(const [id,base]of groups){
    const li=Number(id.split('-')[3]),n=Number(id.split('-')[4]),route=routes.find(r=>r.id===`crossing-${li}`)!;if(!route)continue;
    const anchor=base[0],ps:Placement[]=[];
    for(const [i,asset]of [n%3!==1?body(n+li):'prop.l10-grave-cross',n%2?'decay.body-bag':'prop.l10-quarantine-tape'].entries()){
      let found=false;
      for(const dx of [-3,3,-5,5,0]){
        for(const dz of [-2,2,-4,4,0]){const p=make(`${id}-remains-${i}`,asset,anchor.position[0]+dx,anchor.position[2]+dz,anchor.yaw+i*.71);if(fits(p,route.line,ps)){ps.push(p);found=true;break;}}
        if(found)break;
      }
    }
    if(base.length+ps.length>=3)commit({id,region:route.region,theme:'crossing-remains',story:'The abandoned crossing shows who was left behind.',route:route.id,at:[anchor.position[0],anchor.position[2]],pieces:[...base,...ps].map(p=>p.id),large:base.some(p=>p.id.includes('-hero-'))},ps);
  }
  // Existing crossing generators leave some later stations empty. Fill those gaps on the actual walking line,
  // particularly the close-framed R7 approach; the winding road is a different route choice.
  for(const route of routes.filter(r=>r.id.startsWith('crossing-'))){
    const length=cureLineLength(route.line);
    for(let s=15,n=400;s<length-8;s+=46,n++){
      const q=pose(route.line,s);
      if(out.scenes.some(scene=>scene.route===route.id&&Math.hypot(scene.at[0]-q.x,scene.at[1]-q.z)<23))continue;
      if(Math.hypot(q.x-consoleAt[0],q.z-consoleAt[1])<72)continue;
      if(!addScene(route,s,n))out.missed.push(`${route.id}:${Math.round(s)}`);
    }
  }
  // A fallen checkpoint on the first straight R6 crossing closes the last measured 10-second gap.
  if(!addScene(routes.find(r=>r.id==='crossing-5')!,135,950,'prop.l10-quarantine-tape'))out.missed.push('r6-water-warning');
  // A 128 m evacuation jam: unequal gaps, mixed wrecks, open doors and a burned bus.
  const jam:Placement[]=[],jamRoute=routes[1],jamId='decor-cure-vignette-evacuation-jam';
  for(const [i,station]of [150,170,193,219,248,278].entries()){
    const asset=i===5?'veh.evac-bus':i%2?'prop.l10-abandoned-sedan-blue':'prop.l10-abandoned-sedan-white';let found:Placement|undefined;
    for(const shift of [0,-4,4,-8,8])for(const side of [1,-1])for(const lateral of [13,15,17,19]){
      if(found)break;const q=pose(jamRoute.line,station+shift),p=make(`${jamId}-${i}`,asset,q.x-q.uz*side*lateral,q.z+q.ux*side*lateral,-Math.atan2(q.uz,q.ux)+(i%3-1)*.23,false,true);
      if(i===5)p.decay='burned';if(fits(p,jamRoute.line,jam,8.5))found=p;
    }
    if(found)jam.push(found);
  }
  if(jam.length>=5){
    const car=jam[0],p=make(`${jamId}-passenger`,body(0),car.position[0],car.position[2],car.yaw+Math.PI/2);
    p.position[1]=.48;p.visualAabb.min[1]+=.48;p.visualAabb.max[1]+=.48;jam.push(p);
    commit({id:jamId,region:1,theme:'evacuation-jam',story:'A 128 m evacuation column, doors open, luggage left on the road and a passenger in the first wreck.',route:jamRoute.id,at:[car.position[0],car.position[2]],pieces:jam.map(p=>p.id),large:true},jam);
  }else out.missed.push('r2-evacuation-jam');
  for(const [ri,region]of cure.regions.entries()){
    const route=routes[ri];
    for(const [i,t]of [.25,.73].entries()){
      if(out.scenes.filter(s=>s.region===ri&&s.large).length>=2)break;
      if(!addScene(route,cureLineLength(region.route)*t,200+i,i?'prop.cure-iso-tent':ri===0?'veh.pickup-red':'veh.military-truck',true))out.missed.push(`large-r${ri+1}-${i}`);
    }
  }
  let helicopter:CureVignetteScene|undefined;
  for(const station of [430,380,480,330,530,580,630]){helicopter=addScene(routes[3],station,900,'prop.l10-crashed-helicopter',true);if(helicopter)break;}
  if(helicopter){helicopter.theme='helicopter-crash';helicopter.story='A downed army helicopter and the crew who never reached the checkpoint.';}else out.missed.push('r4-helicopter');
  // The residential refuge belongs to a real house, not an isolated fence on a lawn.
  for(const scene of out.scenes.filter(s=>s.theme==='home-refuge')){
    const house=occupied.filter(p=>p.assetId.startsWith('bld.house-')).sort((a,b)=>Math.hypot(a.position[0]-scene.at[0],a.position[2]-scene.at[1])-Math.hypot(b.position[0]-scene.at[0],b.position[2]-scene.at[1]))[0];
    if(scene.region!==1||!house||Math.hypot(house.position[0]-scene.at[0],house.position[2]-scene.at[1])>35){scene.theme='painted-warning';scene.story='A painted plea marks a failed boundary.';continue;}
    scene.pieces.push(house.id);scene.story='A painted refuge gate, broken furniture and a dead defender in front of the house.';
    for(const dx of [4,-4,6,-6]){
      const p=make(`${scene.id}-broken-door`,'decay.furniture-barricade',scene.at[0]+dx,scene.at[1]+3,.4);
      if(fits(p,routes[1].line)){out.placements.push(p);index(p);scene.pieces.push(p.id);break;}
    }
  }
  // Five separate painted walls per region, distributed across the road scenes rather than a row of signs.
  for(let ri=0;ri<7;ri++){
    const scenes=out.scenes.filter(s=>s.region===ri&&s.route.endsWith('-road')),used=new Set<string>();
    for(let m=0;m<5;m++){
      let done=false;const start=Math.floor((m+.5)*scenes.length/5);
      for(let attempt=0;attempt<scenes.length&&!done;attempt++){
        const scene=scenes[(start+attempt)%scenes.length];if(used.has(scene.id))continue;
        let wall=out.placements.find(p=>scene.pieces.includes(p.id)&&p.assetId==='prop.privacy-fence');
        for(const dx of [-3,3,-5,5,0]){
          for(const dz of [-2,2,-4,4,0]){if(wall)break;const p=make(`${scene.id}-message-wall`,'prop.privacy-fence',scene.at[0]+dx,scene.at[1]+dz,-Math.PI/4+((ri+m)%3-1)*.18);if(fits(p,routes[ri].line)){wall=p;out.placements.push(p);index(p);scene.pieces.push(p.id);}}
          if(wall)break;
        }
        if(!wall)continue;
        const yaw=wall.yaw;
        wall.paintedMessage=(ri*3+m)%12;
        out.decals.push({id:`l10-message-r${ri+1}-${m}`,scene:scene.id,cell:wall.paintedMessage,position:[wall.position[0]+Math.cos(yaw)*.151,1.05,wall.position[2]-Math.sin(yaw)*.151],yaw:Math.PI/2+yaw,ground:false,size:[2.35,.58]});
        used.add(scene.id);done=true;
      }
      if(!done)out.missed.push(`message-r${ri+1}-${m}`);
    }
  }
  // Loose scatter is authored in complete pairs. The low tier omits precisely the second member.
  for(const [n,scene]of out.scenes.entries()){
    const route=routes.find(r=>r.id===scene.route)!;
    for(const dx of [-4.5,4.5,-6,6]){
      const pair=[0,1].map(i=>make(`${scene.id}-scatter-${i}`,'decay.dropped-belongings',scene.at[0]+dx+i*1.6,scene.at[1]+2.5,(n*.73+i*.48)%Math.PI,i===1));
      if(pair.every((p,i)=>fits(p,route.line,pair.slice(0,i)))){out.placements.push(...pair);pair.forEach(index);break;}
    }
    if(n%3===0||scene.theme==='last-stand'||scene.large){const p=out.placements.find(p=>scene.pieces.includes(p.id));if(p)p.shellCasings=true;}
    if(scene.theme==='field-camp'){const p=out.placements.find(p=>scene.pieces.includes(p.id));if(p)p.coldCampfire=true;}
  }
  out.decals=cureVignetteDecals(out.placements);
  return out;
}
export function cureVignettes(occupied:readonly Placement[]):Placement[]{return cureVignetteSet(occupied).placements;}
export function cureVignetteDecals(placements:readonly Placement[]):CureVignetteDecal[]{
  const out:CureVignetteDecal[]=[];
  for(const p of placements){
    const [x,y,z]=p.position;
    if(p.paintedMessage!==undefined)out.push({id:`${p.id}-paint`,scene:p.id,cell:p.paintedMessage,position:[x+Math.cos(p.yaw)*.151,y+1.05,z-Math.sin(p.yaw)*.151],yaw:Math.PI/2+p.yaw,ground:false,size:[2.35,.58]});
    if(p.shellCasings)for(let i=0;i<2;i++)out.push({id:`${p.id}-casings-${i}`,scene:p.id,cell:12,position:[x-1.2+i*1.5,y+.025,z+.7],yaw:p.yaw+i,ground:true,size:[1.2,.75],...(i?{highOnly:true}:{})});
    if(p.coldCampfire)out.push({id:`${p.id}-cold-fire`,scene:p.id,cell:13,position:[x-1.5,y+.025,z-1.4],yaw:p.yaw,ground:true,size:[1.2,1.2]});
  }
  return out;
}
