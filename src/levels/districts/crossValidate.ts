import type { NavGrid } from '../../sim/world/NavGrid';
import { inside, resolvePosition } from './validate';
import type { DistrictGameplay, DistrictLayout, Point, PositionRef } from './types';
/** Returns warnings separately; missing/outside/blocked gameplay locations are hard load errors. */
export function crossValidate(data:DistrictGameplay, layout:DistrictLayout, nav:NavGrid, origin:Point=[0,0]) {
  const errors:string[]=[],used=new Set<string>();
  let reached: Uint8Array=new Uint8Array(nav.cells.length);
  try {const p=resolvePosition(data.playerStart,layout);reached=nav.flood([p[0]+origin[0],p[1]+origin[1]]);}catch(e){errors.push(String(e));}
  const check=(ref:PositionRef,label:string,reachable=false)=>{
    if('anchor' in ref)used.add(ref.anchor);
    try {const p=resolvePosition(ref,layout), world:Point=[p[0]+origin[0],p[1]+origin[1]];
      if(!inside(p,layout.bounds))errors.push(`${label} outside bounds`);
      else if(!nav.walkable(world))errors.push(`${label} not walkable`);
      else if(reachable&&!reached[nav.index(...world)])errors.push(`${label} not reachable`);
    }catch(e){errors.push(String(e));}
  };
  check(data.playerStart,'player start');data.spawns.forEach((r)=>check(r,'spawn'));
  for(const v of data.spawnVolumes){check(v.center,'spawn volume');let p:Point;try{p=resolvePosition(v.center,layout);}catch{continue;}for(const dx of [-v.radius,v.radius])for(const dz of [-v.radius,v.radius])check({x:p[0]+dx,z:p[1]+dz},'spawn volume corner');}
  data.triggers.forEach((r)=>check(r.position,`trigger ${r.id}`,true));data.objectives.forEach((r)=>check(r.position,`objective ${r.id}`,true));data.interactables.forEach((r)=>check(r.position,`interactable ${r.id}`,true));
  data.civilianRoutes.flat().forEach((r)=>check(r,'civilian route',true));data.safePoints.forEach((r)=>check(r,'safe point',true));
  for(const spot of data.photoSpots)if('anchor' in spot.target){used.add(spot.target.anchor);try{resolvePosition(spot.target,layout);}catch(e){errors.push(String(e));}}
  for(const decay of data.decay)for(const fire of decay.fires) { if('anchor' in fire.position)used.add(fire.position.anchor);try{const p=resolvePosition(fire.position,layout);if(!inside(p,layout.bounds))errors.push('fire outside bounds');}catch(e){errors.push(String(e));}}
  return { errors,warnings:Object.keys(layout.anchors).filter((name)=>!used.has(name)).map((name)=>`Orphan anchor: ${layout.district}/${name}`) };
}
