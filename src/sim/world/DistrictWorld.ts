import type { DistrictLayout, LevelComposition, Point } from '../../levels/districts/types';
import { districtGameplay } from '../../levels/districts';
import { resolveDecay, resolvePosition, minimapData } from '../../levels/districts/validate';
import { crossValidate } from '../../levels/districts/crossValidate';
import { bakeNav } from './NavGrid';
/** Sim-side level assembly. Render consumes the same immutable loaded layouts/placements. */
export class DistrictWorld {
  readonly districts;
  readonly nav;
  readonly playerStart: Point;
  readonly warnings: string[]=[];
  readonly fires: { x:number;z:number;radius:number;damagePerSecond:number }[]=[];
  constructor(readonly composition:LevelComposition, layouts:DistrictLayout[], seed:number) {
    this.districts=composition.districts.map((d)=>{
      const layout=layouts.find((l)=>l.district===d.id);if(!layout)throw new Error(`Missing layout: ${d.id}`);
      const gameplay={...districtGameplay[d.id],...d.overrides},decay=resolveDecay(layout,composition.tier),gameplayLayers=gameplay.decay.filter((l)=>l.tier<=composition.tier);
      const off=new Set(gameplayLayers.flatMap((l)=>l.powerOut));decay.lights=decay.lights.filter((id)=>!off.has(id));
      return {...d,layout,gameplay,decay,blockers:gameplayLayers.flatMap((l)=>l.blockers)};
    });
    this.nav=bakeNav(this.districts.map((d)=>({layout:d.layout,origin:d.origin,colliders:d.decay.colliders.map((c)=>c.aabb).concat(d.blockers)})),seed);
    for(const d of this.districts){
      const result=crossValidate(d.gameplay,d.layout,this.nav,d.origin);if(result.errors.length)throw new Error(result.errors.join('\n'));this.warnings.push(...result.warnings);
      for(const layer of d.gameplay.decay)if(layer.tier<=composition.tier)for(const fire of layer.fires){const p=resolvePosition(fire.position,d.layout);this.fires.push({x:p[0]+d.origin[0],z:p[1]+d.origin[1],radius:fire.radius,damagePerSecond:fire.damagePerSecond});}
    }
    const d=this.districts[0],p=resolvePosition(d.gameplay.playerStart,d.layout);this.playerStart=[p[0]+d.origin[0],p[1]+d.origin[1]];
    const reached=this.nav.flood(this.playerStart);
    for(const d of this.districts)for(const obj of d.gameplay.objectives){const p=resolvePosition(obj.position,d.layout);if(!reached[this.nav.index(p[0]+d.origin[0],p[1]+d.origin[1])])throw new Error(`Unreachable level objective: ${d.id}/${obj.id}`);}
  }
  getState(){return {id:this.composition.id,tier:this.composition.tier,navHash:this.nav.hash,fireEmitters:this.fires.length,warnings:this.warnings,
    districts:this.districts.map((d)=>({id:d.id,origin:d.origin,propCount:d.decay.placements.length,wreckCount:d.decay.placements.filter((p)=>p.assetId==='veh.wreck').length,lightsOn:d.decay.lights,removed:d.decay.removed,minimap:minimapData(d.layout)}))};}
}
