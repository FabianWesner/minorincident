import { balancedCrowdModel } from '../../data/crowdAppearance';
import { allyState, updateAlly } from '../outbreak/Allies';
import { Outbreak } from '../outbreak/Outbreak';
import { Rng } from '../../core/Rng';
import { l6, l6Entries, l6BreachModels, l6Doors, l6InjuryLines } from '../../data/l6';
import { l5, l5Survivors } from '../../data/l5';
import type { EntitySnapshot } from '../world/types';
import type { Point } from '../npc/types';
import type { Mission } from './Mission';
const distance = (a: Point, b: Point) => Math.hypot(a.x-b.x,a.z-b.z);
const ticks = (s: number) => Math.round(s*60);
/** Beat controller; all mutable state is checkpointed on the mission. Infection remains the shared outbreak system. */
export class LevelSixSubway {
  private readonly aroundCourier = new Map<number, Point>();
  constructor(private readonly mission: Mission) {}
  private get w() { return this.mission.world; }
  /** Nearest clear crowd point; `toward` breaks ties within a ring (a tunnel entry opens on the courier's side of its pier). */
  private snap(p:Point,toward?:Point):Point {const nav=this.w.infected!.nav;for(let d=0;d<=8;d+=.5){let best:Point|null=null;for(let i=0;i<(d?16:1);i++){const at={x:p.x+Math.cos(i*Math.PI/8)*d,z:p.z+Math.sin(i*Math.PI/8)*d};if(nav.clear(at.x,at.z,.4)){if(!toward)return at;if(!best||distance(at,toward)<distance(best,toward))best=at;}}if(best)return best;}throw new Error(`No clear metro point ${p.x},${p.z}`);}
  private get s() { return this.mission.state.l6!; }
  prepare(): void {
    const w=this.w, rng=new Rng(w.seed,'l6-story'), start=w.tick;
    // The courier needs the authored floor boundary for physical/click routes.
    // Applying it to the shared crowd grid changes pursuit and strands the
    // retreat; keep the existing actor domain and its maintenance approaches.
    const nav = w.infected!.nav, previousMask = nav.mask;
    // Subway exclusions are axis-aligned rectangles. Index their exact bounds
    // by x so every 20 cm steering sample checks only its neighbouring strips.
    const excluded = new Map<number, { x0: number; x1: number; z0: number; z1: number }[]>();
    for (const d of w.districts!.districts) for (const area of d.layout.walkable.excluded) {
      const x0 = Math.min(...area.map(p => p[0])) + d.origin[0], x1 = Math.max(...area.map(p => p[0])) + d.origin[0];
      const z0 = Math.min(...area.map(p => p[1])) + d.origin[1], z1 = Math.max(...area.map(p => p[1])) + d.origin[1];
      for (let x = Math.floor(x0 / 4); x <= Math.floor(x1 / 4); x++) {
        let bucket = excluded.get(x); if (!bucket) excluded.set(x, bucket = []);
        bucket.push({ x0, x1, z0, z1 });
      }
    }
    const playerMask = (x: number, z: number) => {
      if (previousMask && !previousMask(x, z)) return false;
      for (const area of excluded.get(Math.floor(x / 4)) ?? []) if (x >= area.x0 && x < area.x1 && z >= area.z0 && z < area.z1) return false;
      return true;
    };
    nav.setPlayerMask(playerMask);
    w.player!.locomotion.movementMask = playerMask;
    const breach1=start+ticks(30+rng.next()*10), breach2=breach1+ticks(20+rng.next()*10);
    this.mission.state.l6={entries:l6Entries.map(e=>({door:e.door,warnedAt:0,remaining:e.count,nextAt:0})),phase:'shelter',startAt:start,breach1At:breach1,breach2At:breach2,abandonAt:0,nextWave:breach2+600,firstBang:false,secondBang:false,leaderX:6,leaderZ:-2,paused:false,survivors:[],gates:[],infectedIds:[],spawnLog:[],flashlight:false,mainPower:true,emergency:false,exitAt:0,gateAt:0,injuryLineAt:0,lastShot:0,mid:false,platform:false};
    w.npcs!.setAmbient(0);w.infected!.director.levelCap=60;w.infected!.director.strict=true;
    const o=w.npcs!.civilians.outbreak ?? new Outbreak(w,{refuges:[],tier:w.infected!.director.tier}); w.npcs!.civilians.outbreak=o; w.infected!.director.levelCap=60;
    const weapons=w.entities.get(1)!.weapons;if(weapons?.RIGHT.rack.some(s=>s.id==='weapon.army-mg')){weapons.selectedSide='RIGHT';weapons.RIGHT.index=weapons.RIGHT.rack.findIndex(s=>s.id==='weapon.army-mg');}
    const keys=w.progression?.campaign?.survivors??[];
    const carried=w.progression?.campaign?.stationOccupants;
    const count=carried?.length ?? (w.infected!.director.tier==='low'?l6.shelter.low:l6.shelter.high);
    const all=[...Array.from({length:count},(_,i)=>`shelter-${i}`),...keys];
    all.forEach((key,i)=>{
      const injured=key!=='rosa'&&i>0&&i%5===0, routine=key==='rosa'?'treat':i===3&&keys.includes('rosa')?'talk':i===0?'guard':(['sit','talk','treat','rest','share'] as const)[(i-1)%5];
      const pair = routine==='treat' ? Math.min(all.length-1, i+2) : i;
      const base=pair>0&&pair%5===0?{x:18+Math.floor(pair/10)*2,z:pair%10===0?8:5.6}:{x:-8+(pair%8)*2.3,z:-11+Math.floor(pair/8)*2.5};
      const at=this.snap(key==='rosa'?{x:16.9,z:5.6}:routine==='treat'?{x:base.x-1.1,z:base.z}:base);
      const previous=l5Survivors.find(s=>s.key===key);
      const model=i===0?'npc.marcus.aftermath':previous?.model??(injured?'npc.shelter-survivor.bandaged':routine==='rest'?'npc.shelter-survivor.lying':routine==='sit'?'npc.shelter-survivor.sitting':i%2?'npc.civilian-man-b.aftermath':'npc.civilian-woman-b.aftermath');
      const resident = carried?.[i] ?? w.progression?.campaign?.rescuedSurvivors?.find(e=>e.civilian?.survivor?.key===key);
      let e: EntitySnapshot;
      if (resident) {
        e=structuredClone(resident);
        if(i<count){e.transform.x-=l5.metro.stationX; e.transform.z-=l5.metro.stationZ; e.transform.y+=.45;}
        else {e.transform.x=at.x;e.transform.z=at.z;e.transform.y=1.3;}
        e.civilian!.floorY=.6; e.civilian!.pauseUntil=0; e.civilian!.knockedUntil=0; e.civilian!.until=0; e.civilian!.entered=start;
        if(e.combat){e.combat.staggerUntil=0;e.combat.attacking=false;delete e.combat.reaction;}
        w.entities.replace(e); w.spatial.set(e.id,e.transform.x,e.transform.z);
      } else {
        const spawned=o.spawnPedestrian(at,{model,role:'cashier',yaw:i%2?Math.PI:0,walkSpeed:injured?1.4:2.2,schedule:[{activity:routine==='talk'?'chat':routine==='sit'?'sit':'look',anchor:`l6/${routine}`,target:at,facing:{x:at.x+(i%2?-3:3),z:at.z},ticks:60*60*10}]});
        e=w.entities.get(spawned)!;
      }
      const id=e.id;
      e.health={current:60,max:60};e.civilian!.survivor={key,mode:'follow',slot:i,leader:0,cover:false,waitAt:0,foundAt:start};
      e.civilian!.story={clip:routine==='sit'?'npc-sit':routine==='rest'?'death-side':routine==='talk'?'npc-gesture':routine==='treat'?'npc-cower':routine==='share'?'npc-give':'idle',start:start-i*13, ...(i===0?{prop:'pistol' as const}:{})};
      if(resident){e.health={current:resident.health.max,max:resident.health.max};e.appearance=structuredClone(resident.appearance);if(i<count)e.civilian!.story=structuredClone(resident.civilian!.story);}
      if(i===0){e.civilian!.ally=allyState('officer',at,true);e.civilian!.ally.gun={damage:20,shotS:.5,rangeM:16,nearM:16,hitNear:.5,hitFar:.5};e.civilian!.ally.weapon='pistol';}
      this.s.survivors.push({key,id,injured,routine,status:'shelter',straggler:false,collected:false,rejoined:false,hold:0});
    });
    for(const x of l6.gates){const id=w.barricades!.spawn({id:`l6-gate-${x}`,groupId:'l6-service',a:{x,z:13.9},b:{x,z:16.1},height:2.3,depth:.22});const e=w.entities.get(id)!;e.archetype='l6.service-gate';e.transform.y=.6;e.interactable!.enabled=false;this.s.gates.push({id,x,closedAt:0,hold:0});}
    // PO 10-20 #64 "let me be able to close them to lock Zombies out": every tunnel entry hatch has a close prompt.
    for(const entry of this.s.entries??[]){const door=l6Doors[entry.door],id=w.interactables!.spawn('switch',{x:door.x,z:door.z<15?11.65+l6.hatch.standM:18.35-l6.hatch.standM},{radius:l6.hatch.promptM,holdTime:.3,label:'Close the hatch'});const e=w.entities.get(id)!;e.archetype='l6.entry-switch';e.transform.y=.9;e.interactable!.hint='E / middle-click · lock the infected out';entry.switchId=id;}
    for(const at of [{x:281,z:24},{x:286,z:5}]){const id=w.hazards!.spawn('fire',at,{radius:1.3,duration:7200});w.entities.get(id)!.transform.y=3.95;}
    const lampId=w.interactables!.spawn('switch',{x:1.5,z:-2},{radius:2,holdTime:.3,label:'Pick up headlamp'});
    const lamp=w.entities.get(lampId)!;lamp.archetype='pickup.headlamp';lamp.transform.y=.9;
    lamp.pickup={kind:'item',item:'headlamp',radius:2,collected:false};
    lamp.interactable!.hint='E / middle-click · wear the headlamp';
    // Initial shelter power (emergency off until the second breach) is level setup, not a failure: apply it silently
    // (as a tier change does) so the first LightPower sync emits no power.off / lamp.power-off cue at tick 1.
    this.power();this.w.lightPower?.install(this.w.districts!);this.mission.requestCheckpoint('shelter');
    this.say(this.s.survivors.find(r=>r.key==='rosa'||r.routine==='treat')!.id,l6InjuryLines.treatment);
    w.events.on('combat.attack',e=>{if(e.type==='combat.attack'&&e.sourceId===1&&e.actionId==='weapon.army-mg'&&w.tick-this.s.lastShot>=30){this.s.lastShot=w.tick;w.events.emit({type:'outbreak.distraction',tick:w.tick,id:500000+w.tick*64,kind:'gunfire',position:e.position,radius:30,until:w.tick+360});}});
  }
  private say(id: number,text: string):void {const e=this.w.entities.get(id);if(e){this.s.say={id,text,at:this.w.tick,until:this.w.tick+ticks(4.5)};this.w.events.emit({type:'story.say',tick:this.w.tick,id,text,position:e.transform});}}
  private power():void {
    const d=this.w.districts!.districts[0];d.decay.lights=['shelter-camp','self',...(this.s.mainPower?['metro-main']:[]),...(this.s.emergency?['metro-emergency']:[])];
    if(this.w.weather)this.w.weather.powerRevision++;
  }
  private bang(second: boolean):void {this.w.events.emit({type:'l6.bang',tick:this.w.tick,breach:second?2:1,position:l6Doors[second?1:0]});}
  private spawn(n:number,doors:number[],wave:number):number {
    const w=this.w,ai=w.infected!,o=w.npcs!.civilians.outbreak!;let spawned=0;
    for(let i=0;i<n&&ai.director.count<ai.director.cap;i++){
      // Keep the low-tier pool available for upcoming side entrances; distant
      // pursuers behind closed gates must not consume the whole route budget.
      const reserved=(this.s.entries??[]).reduce((total,e)=>total+e.remaining,0);
      if(wave===3&&ai.director.count>=ai.director.cap-reserved)break;
      const requested=doors[i%doors.length];
      // A watched shelter doorway cannot pop an infected into view. Use a real
      // tunnel access instead, rotating the alternatives so breach two retains
      // at least two sources. Test the snapped pose, which is the actual spawn.
      const candidates=wave<=2?[requested,...[2,3,4,5,6,7].map((_,j)=>2+(j+requested)%6)]:[requested];
      const door=candidates.find(index=>{const base=l6Doors[index];return ai.director.offscreen(this.snap({x:base.x+(i%2)*.8,z:base.z-1.4},wave===4?w.entities.get(1)!.transform:undefined),.6);});
      if(door===undefined)continue;
      const base=l6Doors[door],at=this.snap({x:base.x+(i%2)*.8,z:base.z-1.4},wave===4?w.entities.get(1)!.transform:undefined);
      const model=balancedCrowdModel(l6BreachModels,ai.active.filter(e=>e.health.current>0&&!e.hidden&&!e.infected?.hidden).map(e=>({model:e.appearance?.asset??e.infected!.variant,x:e.transform.x,z:e.transform.z})),at,w.entities.size);
      const id=o.spawnPedestrian(at,{model}),e=w.entities.get(id)!;o.turnNow(e);
      spawned++;this.s.infectedIds.push(id);this.s.spawnLog.push({id,door,x:e.transform.x,z:e.transform.z,tick:w.tick,wave,offscreen:ai.director.offscreen(at,.6)});
    }
    return spawned;
  }
  private breach(second:boolean):void {
    const s=this.s,w=this.w;
    if(second){s.phase='fails';s.mainPower=false;s.emergency=true;this.power();w.events.emit({type:'power.off',tick:w.tick,group:'metro-main'});s.arrivals={remaining:8,door:0,nextAt:w.tick};}
    else {s.phase='first';this.spawn(2,[0],1);this.mission.setState('breached',true);}
    w.events.emit({type:second?'l6.breach2':'l6.breach1',tick:w.tick});
  }
  private abandon():void {
    if(this.s.abandonAt)return;
    const s=this.s;s.abandonAt=this.w.tick;s.phase='retreat';
    for(const r of this.living()){r.status='following';const c=this.w.entities.get(r.id)!.civilian!;c.story=null;delete c.floorY;}
    this.mission.setState('abandoned',true);this.w.events.emit({type:'l6.abandon',tick:this.w.tick});
    this.say(s.survivors[0].id,'Into the tunnel! Everybody, move!');this.mission.requestCheckpoint('abandon');
  }
  private living() {return this.s.survivors.filter(r=>r.status==='shelter'||r.status==='following');}
  /**
   * PO 10-20 #65 "I walk right so didn't find them": during the retreat the ring sits on the group's next
   * route waypoint (the next gate or the platform, at most aheadM in front of the walking head). When the
   * courier is more than strayM from every walking survivor, the objective reads "Stay with the group" and
   * the ring moves onto the group; within regroupM it switches back.
   */
  private guide(p:Point):void {
    const s=this.s,m=this.mission,anchors=m.def.anchors,f=l6.follow;
    const walkers=this.living().filter(r=>r.status==='following').map(r=>({r,e:this.w.entities.get(r.id)!})).filter(({e})=>!e.hidden);
    if(!walkers.length){if(s.strayed){s.strayed=false;m.state.marker=s.phase==='exit'?'night-exit':'exit-platform';}return;}
    const near=Math.min(...walkers.map(({e})=>distance(e.transform,p)));
    s.strayed=s.strayed?near>f.regroupM:near>f.strayM;
    // The group is its walking body; a straggler who fell behind is the courier's own errand.
    const core=walkers.filter(({r})=>!r.straggler||r.rejoined||r.collected),group=core.length?core:walkers;
    const gx=group.reduce((t,{e})=>t+e.transform.x,0)/group.length,gz=group.reduce((t,{e})=>t+e.transform.z,0)/group.length;
    const at=(name:string,x:number,z:number,y=.6)=>{const a=anchors[name]??(anchors[name]={x,z,y,radius:2});a.x=x;a.z=z;a.y=y;};
    at('l6-group',gx,gz,gx>=258?3.9:.6);
    if(s.phase==='retreat'){
      // Shelter leg: the group first walks onto the track at the leader's x. Tunnel leg: gates, then the platform.
      const route=[l6.tunnel.start,...l6.gates,anchors['exit-platform'].x];
      const next=route.find(x=>x>s.leaderX+1)??route[route.length-1];
      const gate=s.gates.find(g=>!g.closedAt&&s.leaderZ>=l6.tunnel.z&&s.leaderX>=g.x-3&&s.leaderX<=g.x+3);
      const wait=gate&&LevelSixSubway.gateWait(gate.x);
      at('l6-next',wait?.x??(s.leaderZ<l6.tunnel.z?s.leaderX:Math.min(next,s.leaderX+f.aheadM)),wait?.z??l6.tunnel.z);
    }
    m.state.marker=s.strayed?'l6-group':s.phase==='retreat'?'l6-next':'night-exit';
  }
  /** Called by the shared follower before its L5 rules. Calm routines and group movement own live civilians only. */
  follower(e:EntitySnapshot):boolean {
    const s=this.s,r=s.survivors.find(r=>r.id===e.id);if(!r)return false;
    if(r.status==='out'){this.w.spatial.delete(e.id);return true;}
    if(r.routine==='guard'&&s.phase!=='shelter'&&e.civilian!.ally){const a=e.civilian!.ally;a.engaged=true;a.post={x:e.transform.x,z:e.transform.z};updateAlly(this.w,e,(from,to)=>this.w.infected!.nav.visible(from,to,0));}
    if(r.status==='shelter')return true;
    if(r.status!=='following')return false;
    const live=this.living(),slot=Math.max(0,live.findIndex(q=>q.id===e.id));
    const target=r.collected?this.w.entities.get(1)!.transform:{x:s.leaderX-Math.floor(slot/3)*1.4,z:s.leaderZ+(slot%3-1)*1.2};
    // Keep the authored tunnel approach until this walker reaches the platform; then align with the escalator.
    const goal=target.x<25?{x:target.x,z:target.z}: {x:target.x,z:target.x>=246&&target.x<258?(e.transform.x<246?l6.exit.approachZ:l6.tunnel.z):15+(r.collected?0:(slot%3-1)*.75)};
    const reach=r.collected?1.8:.4;
    if(r.injured&&!r.collected&&s.leaderX<e.transform.x&&s.leaderX<25)return true;
    let around=this.aroundCourier.get(e.id);
    if(around&&distance(e.transform,around)<.15){this.aroundCourier.delete(e.id);around=undefined;}
    const p=this.w.entities.get(1)!,dx=goal.x-e.transform.x,dz=goal.z-e.transform.z,len2=dx*dx+dz*dz;
    const t=len2?((p.transform.x-e.transform.x)*dx+(p.transform.z-e.transform.z)*dz)/len2:0;
    const clearance=(e.combat?.radius??.35)+(p.combat?.radius??.35)+.15;
    if(!around&&distance(e.transform,p.transform)<2&&t>0&&t<1&&Math.hypot(e.transform.x+t*dx-p.transform.x,e.transform.z+t*dz-p.transform.z)<clearance){
      const length=Math.sqrt(len2),side=e.transform.z>=p.transform.z?1:-1;
      for(const sign of [side,-side]){
        const candidate={x:p.transform.x-sign*dz/length*clearance,z:p.transform.z+sign*dx/length*clearance};
        if(this.w.infected!.nav.clear(candidate.x,candidate.z,.35)&&this.w.solids.clear({...candidate,y:e.transform.y},e.combat?.radius??.35,e.id)){
          around=candidate;this.aroundCourier.set(e.id,around);break;
        }
      }
    }
    if(around||distance(e.transform,goal)>reach+.15)this.w.npcs!.move(e,around??goal,r.injured?1.4:2.2,e.civilian!,around ? .05 : reach);
    this.w.spatial.set(e.id,e.transform.x,e.transform.z);return true;
  }
  update():void {
    const s=this.s,w=this.w,t=w.tick,p=w.entities.get(1)!.transform;
    s.flashlight=this.mission.state.items.includes('headlamp');
    if(s.phase==='shelter'&&t===s.startAt+300)this.say(s.survivors.find(r=>r.injured)!.id,l6InjuryLines.patient);
    for(const r of this.living()){const e=w.entities.get(r.id);if(!e||e.health.current<=0||e.civilian?.state==='finished')r.status='dead';else if(e.infection||e.infected)r.status='turned';}
    if(!s.firstBang&&t>=s.breach1At-120){s.firstBang=true;this.bang(false);}
    if(!s.secondBang&&t>=s.breach2At-120){s.secondBang=true;this.bang(true);}
    if(s.phase==='shelter'&&t>=s.breach1At)this.breach(false);
    if(s.phase==='first'&&t>=s.breach2At)this.breach(true);
    if(s.arrivals && t>=s.arrivals.nextAt){const a=s.arrivals;this.spawn(1,[a.door++%2],2);a.remaining--;a.nextAt=t+4;if(!a.remaining)delete s.arrivals;}
    if(s.phase==='fails'&&(t>=s.breach2At+900||s.survivors.filter(r=>r.status==='turned').length>=3))this.abandon();
    if(s.phase!=='retreat'&&s.phase!=='exit')return;
    const live=this.living(),healthy=live.filter(r=>!r.injured).map(r=>w.entities.get(r.id)!),tail=healthy.length?Math.min(...healthy.map(e=>e.transform.x)):s.leaderX;
    const hot=w.infected!.active.some(e=>e.health.current>0&&distance(e.transform,{x:tail,z:15})<20);
    const atGate=l6.gates.some(x=>Math.abs(s.leaderX-x)<2);
    s.paused=atGate&&((hot&&distance(p,{x:tail,z:15})>12)||live.some(r=>r.straggler&&!r.rejoined&&w.entities.get(r.id)!.transform.x<tail-4));
    if(!s.paused){if(s.leaderZ<15)s.leaderZ=Math.min(15,s.leaderZ+2.2/60);else s.leaderX=Math.min(276,s.leaderX+2.2/60);}
    if(!s.injuryLineAt&&s.leaderX>34){s.injuryLineAt=t;this.say(1,l6InjuryLines.retreat);}
    for(const r of live){const e=w.entities.get(r.id)!;
      if(r.injured&&!r.straggler&&tail-e.transform.x>15){r.straggler=true;w.events.emit({type:'l6.straggler',tick:t,id:r.id});this.say(r.id,l6InjuryLines.straggler);}
      if(r.straggler&&!r.rejoined&&!r.collected&&distance(e.transform,p)<=3){r.collected=true;this.say(1,l6InjuryLines.rejoin);w.events.emit({type:'l6.collected',tick:t,id:r.id});}
      if(r.collected&&Math.abs(tail-e.transform.x)<5){r.collected=false;r.rejoined=true;w.events.emit({type:'l6.rejoined',tick:t,id:r.id});}
      if(e.transform.x>=263){r.status='out';e.civilian!.survivor!.mode='hidden';e.hidden=true;w.spatial.delete(e.id);}
    }
    this.guide(p);
    // Telegraph a fixed entrance before the courier reaches it. Two arrivals only,
    // six seconds apart, from the side/ahead; never fill both escape lanes.
    for(const entry of s.entries??[]){
      const door=l6Doors[entry.door];
      if(!entry.warnedAt&&p.x>=door.x-26&&p.x<door.x+8){entry.warnedAt=t;entry.nextAt=t+120;w.events.emit({type:'l6.bang',tick:t,breach:entry.door+1,position:door});}
      const sw=entry.switchId===undefined?undefined:w.entities.get(entry.switchId);
      if(sw?.interactable&&!entry.closedAt&&!entry.brokenAt&&sw.interactable.completed){entry.closedAt=t;entry.hits=l6.hatch.hits;w.events.emit({type:'barricade.sound',tick:t,sourceId:sw.id,position:{x:door.x,y:1.2,z:door.z},phase:'brace',hp:l6.hatch.hits,maxHp:l6.hatch.hits});}
      if(sw?.interactable){sw.interactable.enabled=!entry.closedAt&&!entry.brokenAt;sw.interactable.label=entry.brokenAt?'Hatch broken':entry.closedAt?'Hatch closed':'Close the hatch';}
      if(entry.warnedAt&&entry.remaining&&t>=entry.nextAt){
        // Arrivals behind a closed hatch bash it once per second (telegraphed rattle and impact) and break through at zero.
        if(entry.closedAt&&!entry.brokenAt){
          entry.hits=(entry.hits??l6.hatch.hits)-1;entry.hitAt=t;entry.nextAt=t+ticks(l6.hatch.hitS);
          w.events.emit({type:'barricade.sound',tick:t,sourceId:sw?.id??0,position:{x:door.x,y:1.2,z:door.z},phase:entry.hits>0?'hit':'break',hp:Math.max(0,entry.hits),maxHp:l6.hatch.hits});
          if(entry.hits<=0){entry.brokenAt=t;entry.nextAt=t;w.events.emit({type:'l6.hatch-broken',tick:t,door:entry.door});}
        }
        else if(this.spawn(1,[entry.door],4)){entry.remaining--;entry.nextAt=t+360;}
        else entry.nextAt=t+15;
      }
    }
    if(t>=s.nextWave){s.nextWave=t+600;const sides=l6Doors.map((d,i)=>({d,i})).filter(({d,i})=>i>1&&d.x>tail-35&&d.x<s.leaderX+35).map(x=>x.i);this.spawn(1,[...(tail<80?[0,1]:[]),...sides].length?[...(tail<80?[0,1]:[]),...sides]:[0,1],3);}
    if(!s.pushHintShown&&w.props?.items.some(q=>q.assetId==='prop.crates'&&q.awake&&distance(p,{x:q.pose.p[0],z:q.pose.p[2]})<2)){s.pushHintShown=true;this.say(1,'Push the glowing crates onto the line, then press E to brace the gate.');}
    for(const gate of s.gates){const e=w.entities.get(gate.id)!;const crossed=live.every(r=>w.entities.get(r.id)!.transform.x>gate.x+2),near=distance(p,LevelSixSubway.gateWait(gate.x))<1.7;
      e.interactable!.label=gate.closedAt?'Brace service gate':'Close service gate';e.interactable!.enabled=false;
      if(gate.closedAt&&near&&w.inputFrame.interact)w.barricades!.braceServiceGate(gate.id);
      if(!gate.closedAt&&crossed&&near&&(gate.hold>0||w.inputFrame.interact)){gate.hold++;if(gate.hold>=60&&w.npcs!.companion.insideBeforeClosing({x:gate.x,z:15},{x:gate.x+2,z:15})){gate.closedAt=t;w.barricades!.closeServiceGate(gate.id,Math.round(w.barricades!.dps('infected.runner')*5*10));w.events.emit({type:'l6.gate-closed',tick:t,id:gate.id});}}else gate.hold=0;
    }
    if(!s.mid&&p.x>=150){s.mid=true;this.mission.requestCheckpoint('mid-tunnel');}
    if(!s.platform&&p.x>=240){s.platform=true;this.mission.requestCheckpoint('exit-platform');this.mission.setState('platform',true);s.phase='exit';}
    if(s.phase==='exit'&&p.x>=263){if(!s.exitAt){s.exitAt=t;this.mission.state.timeOfDay='L6';w.events.emit({type:'l6.exit',tick:t});}
      if(live.length===0){s.gateAt=t;const gate=w.barricades!.spawn({id:'l6-night-exit',groupId:'l6-exit',a:{x:258,z:l6.exit.centerZ-2.15},b:{x:258,z:l6.exit.centerZ+2.15},height:2.5,initialHp:10000});w.entities.get(gate)!.archetype='l6.service-gate';w.entities.get(gate)!.transform.y=3.9;s.phase='done';this.mission.setState('exited',true);}}
  }
  completed(id:string):void {if(id==='shelter'&&this.s.phase==='shelter')this.breach(false);if(id==='stop'&&!this.s.abandonAt){if(this.s.phase==='first')this.breach(true);this.abandon();}if(id==='retreat'){this.s.platform=true;this.mission.setState('platform',true);if(this.s.phase!=='done')this.s.phase='exit';}if(id==='exit'){this.s.phase='done';this.s.gateAt=this.w.tick;this.mission.state.timeOfDay='L6';}}
  advance():boolean{return false;}
  result(){
    const s=this.s,out=s.survivors.filter(r=>r.status==='out');
    const escapedSurvivors=out.map(r=>{
      const e=structuredClone(this.w.entities.get(r.id)!);
      // Carried shelter residents can retain their earlier routine walk speed;
      // serialize the injury speed actually used by the L6 group follower.
      if(r.injured&&e.civilian?.l1)e.civilian.l1.walkSpeed=Math.min(e.civilian.l1.walkSpeed,1.4);
      return e;
    });
    return {rescued:out.length,survivors:out.map(r=>r.key),survivorsIn:s.survivors.length,escapedSurvivors};
  }
  /** PO 10-20 #65: objective text while the courier is away from the retreating group. */
  static text(mission: Pick<Mission,'state'> | null | undefined): string | null {
    const s=mission?.state.l6;
    return s?.strayed&&(s.phase==='retreat'||s.phase==='exit')?'Stay with the group':null;
  }
  /** Stand beyond and beside the 2.2 m opening, leaving both follower lanes clear. */
  static gateWait(x:number):Point{return {x:x+2.4,z:17.3};}
  gateStatus(id:number):string {
    const gate=this.s.gates.find(g=>g.id===id);if(!gate)return '';
    const live=this.living(),through=live.filter(r=>this.w.entities.get(r.id)!.transform.x>gate.x+2).length;
    return through<live.length?`Let everyone pass · ${through}/${live.length} through`:`${through}/${live.length} through · E to close the gate`;
  }
  restore(delta:number):void {const s=this.s;for(const e of s.entries??[]){if(e.warnedAt)e.warnedAt+=delta;if(e.nextAt)e.nextAt+=delta;if(e.closedAt)e.closedAt+=delta;if(e.hitAt)e.hitAt+=delta;if(e.brokenAt)e.brokenAt+=delta;}if(s.arrivals)s.arrivals.nextAt+=delta;for(const key of ['startAt','breach1At','breach2At','abandonAt','nextWave','exitAt','gateAt','injuryLineAt','lastShot'] as const)if(s[key])s[key]+=delta;for(const g of s.gates)if(g.closedAt)g.closedAt+=delta;this.power();}
}
