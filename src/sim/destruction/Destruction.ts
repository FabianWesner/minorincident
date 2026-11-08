import { worldAssets } from '../../assets/worldDefinitions';
import { destructionDamage } from '../../data/destruction';
import { destructionClasses, destructionParts, partColliders, type DestructionPart } from '../../data/destructionModel';
import type { Aabb, Placement } from '../../levels/districts/types';
import type { SimWorld } from '../world/SimWorld';
import type { CoverWall } from '../combat/HitQuery';
import type { PushProp, PropPose } from '../interact/PropSystem';
export interface DamageMark { part: number; at: [number, number, number]; normal: [number, number, number]; kind: 'hole' | 'chip' | 'scorch' }
export interface ObjectDamage { hp: number[]; burning: number; fireClock: number; exploded: boolean; collapsed: boolean; revision: number; marks: DamageMark[] }
export interface DestructionObject { id: string; placement: Placement; parts: DestructionPart[]; state: ObjectDamage; home: PropPose; query: { part: number; box: Aabb }[]; protected: boolean }
interface Blocker { object: DestructionObject; part: number; box: Aabb; id: number; handle: number; wall: CoverWall; active: boolean }
export interface WorldHit { object: DestructionObject; part: number; distance: number; local: [number, number, number]; normal: [number, number, number] }
type Point = { x: number; y: number; z: number };
/** Quaternion rotation, shared with the view's local damage marks. No renderer in the sim. */
export function rotate(v: readonly number[], q: readonly number[]): [number, number, number] {
  const [x, y, z] = v, [qx, qy, qz, qw] = q, tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  return [x + qw * tx + qy * tz - qz * ty, y + qw * ty + qz * tx - qx * tz, z + qw * tz + qx * ty - qy * tx];
}
function rayBox(at: number[], way: number[], box: Aabb, range: number): { distance: number; normal: [number, number, number] } | null {
  let near = 0, far = range; const normal: [number, number, number] = [0, 1, 0];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(way[i]) < 1e-9) { if (at[i] < box.min[i] || at[i] > box.max[i]) return null; continue; }
    const a = (box.min[i] - at[i]) / way[i], b = (box.max[i] - at[i]) / way[i], entry = Math.min(a, b);
    if (entry > near) { near = entry; normal.fill(0); normal[i] = way[i] > 0 ? -1 : 1; }
    far = Math.min(far, Math.max(a, b)); if (near > far) return null;
  }
  return { distance: near, normal };
}
/** Placement-owned, fixed-tick destruction. Rendering and debris never decide damage, breaches or fire timing. */
export class Destruction {
  readonly objects: DestructionObject[] = [];
  private readonly blockers: Blocker[] = [];
  private readonly kicks: { id: string; at: number; strength: number }[] = [];
  private readonly propLinks = new Map<string, PushProp>();
  constructor(private readonly world: SimWorld) {
    for (const d of world.districts?.districts ?? []) for (const p of d.decay.placements) {
      if (!p.destruction) continue;
      const dims = worldAssets[p.assetId].dimensions;
      const parts: DestructionPart[] = p.destruction.indestructible ? [{ id: 'protected', role: 'structure', material: 'concrete', hp: 1,
        bounds: { min: [-dims.x/2,0,-dims.z/2], max: [dims.x/2,dims.y,dims.z/2] } }] : destructionParts(p);
      const id = `${d.id}/${p.id}`, query = p.destruction.indestructible ? [{part:0,box:parts[0].bounds}] : partColliders(p.assetId, parts);
      const object: DestructionObject = { id, placement: p, parts, query: [...query, ...parts.flatMap((part,i)=>part.role === 'structure' ? [] : [{part:i,box:part.bounds}])], protected: !!p.destruction.indestructible,
        home: { p: [p.position[0] + d.origin[0], p.position[1], p.position[2] + d.origin[1]], q: [0, Math.sin(p.yaw / 2), 0, Math.cos(p.yaw / 2)] }, state: { hp: parts.map(p => p.hp), burning: 0, fireClock: 0, exploded: false, collapsed: false, revision: 0, marks: [] } };
      this.objects.push(object);
      const prop = world.props?.items.find(item => item.id === id);
      if (prop) { this.propLinks.set(id, prop); world.entities.get(prop.entityId)!.environmentObject = id; }
      if (!prop && !object.protected) for (const { part, box } of query) this.blockers.push({ object, part, box, id: -1000000 - this.blockers.length, handle: -1, wall: this.wall(object, box), active: false });
    }
    this.reconcile();
  }
  /** Rebind after checkpoints or physics/tier replacement. Interactables rebuild their own wall list. */
  rebuild(worldReset = false): void {
    for (const b of this.blockers) {
      if (b.active && !worldReset) this.world.physics.removeBlocker(b.handle);
      const walls = this.world.interactables!.walls, index = walls.indexOf(b.wall);
      if (index >= 0) walls.splice(index, 1);
      this.world.districts!.nav.unblock(b.id); b.active = false;
    }
    this.propLinks.clear(); this.kicks.length=0;
    for (const o of this.objects) {
      const prop = this.world.props?.items.find(item => item.id === o.id);
      if (prop) { this.propLinks.set(o.id, prop); this.world.entities.get(prop.entityId)!.environmentObject = o.id; }
    }
    this.reconcile();
  }
  pose(object: DestructionObject): PropPose { return this.propLinks.get(object.id)?.pose ?? object.home; }
  private wall(o: DestructionObject, box: Aabb): CoverWall {
    const p = o.placement, c = Math.cos(p.yaw), s = Math.sin(p.yaw), x = (box.min[0] + box.max[0]) * .5 * p.scale[0], z = (box.min[2] + box.max[2]) * .5 * p.scale[2];
    const hx = (box.max[0] - box.min[0]) * .5 * p.scale[0], hz = (box.max[2] - box.min[2]) * .5 * p.scale[2];
    const wx = o.home.p[0] + c * x + s * z, wz = o.home.p[2] - s * x + c * z;
    return { x: wx, z: wz, y: o.home.p[1] + (box.min[1] + box.max[1]) * .5 * p.scale[1], halfX: Math.abs(c) * hx + Math.abs(s) * hz, halfZ: Math.abs(s) * hx + Math.abs(c) * hz, halfY: (box.max[1] - box.min[1]) * .5 * p.scale[1], navFootprint: { x: wx, z: wz, halfX: hx, halfZ: hz, yaw: p.yaw } };
  }
  private reconcile(): void {
    for (const b of this.blockers) {
      const active = b.object.state.hp[b.part] > 0; if (active === b.active) continue;
      b.active = active;
      if (active) {
        const w = b.wall;
        b.handle = this.world.physics.addStatic({ min: [w.x-w.halfX,w.y-w.halfY,w.z-w.halfZ], max: [w.x+w.halfX,w.y+w.halfY,w.z+w.halfZ], navFootprint: w.navFootprint }, [0,0]);
        this.world.interactables!.walls.push(w); if (w.y-w.halfY < 1.6) this.world.districts!.nav.block(b.id, w);
      } else { this.world.physics.removeBlocker(b.handle); const walls = this.world.interactables!.walls, index = walls.indexOf(b.wall); if (index >= 0) walls.splice(index, 1); this.world.districts!.nav.unblock(b.id); }
      if (b.wall.y-b.wall.halfY < 1.6) this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id: b.id, wall: b.wall, blocked: active });
    }
  }
  /** Nearest intact part, including moving/rotating parked vehicles. Query has no side effects. */
  trace(origin: Point, direction: Point, range: number): WorldHit | null {
    let nearest: WorldHit | null = null;
    for (const object of this.objects) {
      if (object.protected && !this.propLinks.has(object.id)) continue;
      const pose = this.pose(object), q = pose.q, inverse = [-q[0],-q[1],-q[2],q[3]], scale = object.placement.scale;
      const at = rotate([origin.x-pose.p[0],origin.y-pose.p[1],origin.z-pose.p[2]], inverse).map((v,i)=>v/scale[i]);
      const way = rotate([direction.x,direction.y,direction.z], inverse).map((v,i)=>v/scale[i]);
      for (const { part, box } of object.query) {
        if (object.state.hp[part] <= 0) continue;
        const hit = rayBox(at, way, box, nearest?.distance ?? range); if (!hit) continue;
        if (nearest && hit.distance >= nearest.distance - 1e-5) continue;
        nearest = { object, part, distance: hit.distance, local: at.map((v,i)=>v+way[i]*hit.distance) as [number,number,number], normal: hit.normal };
      }
    }
    return nearest;
  }
  /** Called at the actual hitscan/projectile impact; nearer actors and unrelated cover stop the shot. */
  strike(actionId: string, damage: number, origin: Point, direction: Point, range: number): boolean {
    const hit = this.trace(origin, direction, range); if (!hit) return false;
    const clear = this.world.combat?.query.clearDistance(origin, direction, range) ?? range;
    if (hit.distance > clear + .08) return false;
    this.damage(hit, actionId, damage); return true;
  }
  damage(hit: WorldHit, actionId: string, amount: number): void {
    const o = hit.object, state = o.state, part = o.parts[hit.part];
    if (o.protected || state.hp[hit.part] <= 0 || !Number.isFinite(amount) || amount <= 0) return;
    const fire = actionId === 'weapon.molotov' || actionId === 'weapon.flamethrower' || actionId === 'environment.fire';
    const value = fire ? part.material === 'wood' ? amount : part.material === 'metal' && o.placement.destruction!.class === 'vehicle' ? amount * .3 : 0 : destructionDamage(actionId, part.material, amount);
    state.hp[hit.part] = Math.max(0, state.hp[hit.part] - value); state.revision++;
    if (state.marks.length === 8) state.marks.shift();
    state.marks.push({ part: hit.part, at: [...hit.local], normal: [...hit.normal], kind: fire ? 'scorch' : actionId.includes('gun') || actionId.includes('pistol') || actionId.includes('rifle') ? 'hole' : 'chip' });
    if (fire && actionId !== 'environment.fire' && !state.burning && !state.exploded && destructionClasses[o.placement.destruction!.class].burnTicks) this.ignite(o);
    if (state.hp[hit.part] === 0) this.debris(o, hit.part, hit.local);
    const structural = o.parts.map((p,i)=>({p,i})).filter(({p})=>p.role === 'structure'), broken = structural.filter(({i})=>state.hp[i]===0).length;
    if (!state.collapsed && structural.length && broken / structural.length >= destructionClasses[o.placement.destruction!.class].collapse) {
      if (o.placement.destruction!.class === 'vehicle') this.ignite(o);
      else { state.collapsed = true; for (const [i,p] of o.parts.entries()) if (p.role === 'roof' && state.hp[i] > 0) { state.hp[i]=0; this.debris(o,i,p.bounds.min); } }
    }
    this.reconcile();
  }
  private debris(o: DestructionObject, part: number, local: number[]): void {
    const pose=this.pose(o), point=rotate(local.map((v,i)=>v*o.placement.scale[i]),pose.q);
    this.world.hazards?.debris.spawn(-1000-this.objects.indexOf(o), {x:pose.p[0]+point[0],z:pose.p[2]+point[2]}, this.world.tick, { y: pose.p[1]+point[1], material:o.parts[part].material, count: o.parts[part].role === 'door' ? 1 : 5, ...(o.parts[part].role === 'door' ? { half: [.45,.65,.07] as [number,number,number] } : {}) });
  }
  private ignite(o: DestructionObject): void {
    if (o.state.exploded || o.state.burning || o.state.fireClock > 0) return;
    o.state.burning=destructionClasses[o.placement.destruction!.class].burnTicks; if (!o.state.burning) return;
    o.state.revision++;
    const p=this.pose(o).p;
    this.world.hazards?.spawn('fire',{x:p[0],z:p[2]},{radius:o.placement.destruction!.class==='vehicle'?1.8:3,duration:o.state.burning/60+2});
  }
  /** Blast falloff measures to each part's closest point, so large buildings are hit at their facade. */
  blast(actionId:string, at: {x:number;z:number}, radius:number, damage:number, impulse=0): void {
    for (const o of this.objects) {
      if(o.protected) continue;
      const pose=this.pose(o),q=pose.q, local=rotate([at.x-pose.p[0],1-pose.p[1],at.z-pose.p[2]],[-q[0],-q[1],-q[2],q[3]]).map((v,i)=>v/o.placement.scale[i]);
      for(const [part,p] of o.parts.entries()) {
        if(o.state.hp[part]<=0) continue;
        const closest=local.map((v,i)=>Math.max(p.bounds.min[i],Math.min(p.bounds.max[i],v))) as [number,number,number];
        const distance=Math.hypot((closest[0]-local[0])*o.placement.scale[0],(closest[2]-local[2])*o.placement.scale[2]);
        if(distance>=radius) continue;
        this.damage({object:o,part,local:closest,distance,normal:[0,1,0]},actionId,damage*(1-distance/radius));
      }
      const prop=this.propLinks.get(o.id),distance=Math.hypot(pose.p[0]-at.x,pose.p[2]-at.z);
      if(prop&&!prop.fixed&&distance<radius&&impulse>0) { const strength=prop.mass*impulse*(1-distance/radius); this.kicks.push({id:o.id,at:this.world.tick+1,strength}); }
    }
  }
  update(): void {
    for (let i=this.kicks.length-1;i>=0;i--) { const k=this.kicks[i]; if(k.at>this.world.tick) continue;
      const prop=this.propLinks.get(k.id); prop?.body.applyTorqueImpulse({x:k.strength*.5,y:0,z:k.strength*.7},true); this.kicks.splice(i,1);
    }
    for(const o of this.objects) {
      if(o.protected) continue;
      const s=o.state;
      if(!s.burning) {
        const p=this.pose(o).p;
        for(const zone of this.world.combat?.effects.zones??[]) if(zone.kind==='fire'&&zone.expires>this.world.tick&&Math.hypot(zone.x-p[0],zone.z-p[2])<zone.radius+1) {this.ignite(o);break;}
        if(this.world.tick%30===0) for(const fire of this.world.entities.iterate()) if(fire.hazard?.kind==='fire'&&fire.hazard.activeUntil>this.world.tick&&Math.hypot(fire.transform.x-p[0],fire.transform.z-p[2])<fire.hazard.radius+1) {this.ignite(o);break;}
      }
      if(!s.burning) continue;
      s.burning--; s.fireClock++;
      if(s.fireClock%30===0) for(const [part,p] of o.parts.entries()) if(s.hp[part]>0) this.damage({object:o,part,distance:0,local:p.bounds.min,normal:[0,1,0]},'environment.fire',8);
      if(s.burning===0&&o.placement.destruction!.class==='vehicle'&&!s.exploded) {
        s.exploded=true;s.collapsed=true;s.hp.fill(0);s.revision++;
        const p=this.pose(o).p; this.debris(o,0,[0,1,0]);
        this.world.explosions?.blast('explosion.car',{x:p[0],z:p[2]});
        const prop=this.propLinks.get(o.id); if(prop&&!prop.fixed) prop.body.applyImpulse({x:0,y:prop.mass*5,z:0},true);
      }
    }
    this.reconcile();
  }
  snapshot() { return this.objects.filter(o=>!o.protected).map(o=>({id:o.id,state:structuredClone(o.state)})); }
  restore(snapshot:unknown):void {
    const saved=snapshot as ReturnType<Destruction['snapshot']>;
    for(const o of this.objects) {const entry=saved.find(s=>s.id===o.id); if(entry) o.state=structuredClone(entry.state);}
    this.reconcile();
  }
}
