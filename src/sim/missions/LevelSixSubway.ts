import { actorRadius } from '../world/SolidRegistry';
import { balancedCrowdModel } from '../../data/crowdAppearance';
import { readyCarriedAlly, allyState } from '../outbreak/Allies';
import { Outbreak } from '../outbreak/Outbreak';
import { Rng } from '../../core/Rng';
import { seatAnchor } from '../npc/seats';
import { leaveSeat } from '../npc/MorningRoutines';
import { l6, l6Entries, l6BreachModels, l6Doors, l6InjuryLines, l6HatchAlphas, l6SpawnCandidates, l6PressureExitDoor } from '../../data/l6';
import { l5Survivors } from '../../data/l5';
import type { EntitySnapshot } from '../world/types';
import type { Point } from '../npc/types';
import type { Mission } from './Mission';
import type { L6State } from './types';
import { survivorName } from './survivorName';
const distance = (a: Point, b: Point) => Math.hypot(a.x-b.x,a.z-b.z);
const ticks = (s: number) => Math.round(s*60);
/** Beat controller; all mutable state is checkpointed on the mission. Infection remains the shared outbreak system. */
export class LevelSixSubway {
  private readonly aroundCourier = new Map<number, Point>();
  constructor(private readonly mission: Mission) {
    for (const type of ['infected.attack', 'civilian.grabbed'] as const) mission.world.events.on(type, event => {
      if (event.type !== 'infected.attack' && event.type !== 'civilian.grabbed') return;
      const target = mission.world.entities.get(event.targetId), row = this.s?.survivors.find(r => r.id === target?.id && (r.status === 'following' || r.status === 'shelter'));
      if (target && row) this.alarm(target, 'attack');
    });
  }
  private alarm(e: EntitySnapshot, kind: 'attack' | 'lost'): void {
    const w = this.w, current = this.s.alarm;
    if (current && w.tick < current.until && current.kind === 'lost') return;
    if (current && w.tick < current.until && kind === 'attack') return;
    this.s.alarm = { key: `l6-${e.id}-${w.tick}`, id: e.id, x: e.transform.x, z: e.transform.z,
      text: kind === 'lost' ? 'Survivor lost!' : 'Survivor under attack! Turn back!', until: w.tick + 300, kind };
    w.events.emit({ type: 'l7.follower-alarm', tick: w.tick, id: e.id, kind, position: { x: e.transform.x, z: e.transform.z } });
  }
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
    // The metro's navOnly lane edges separated the side platforms from the
    // tracks for crowd routing. They are not gates: infected must enter the
    // connected tunnel floor unless the player closes an actual service gate.
    const crowdWalls = nav.walls as import('../ai/NavGrid').Wall[];
    for (let i=crowdWalls.length-1;i>=0;i--) if(crowdWalls[i].navOnly) crowdWalls.splice(i,1);
    nav.rebake();
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
    this.mission.state.l6={entries:l6Entries.map(e=>({door:e.door,warnedAt:0,remaining:e.count,nextAt:0})),phase:'shelter',startAt:start,breach1At:breach1,breach2At:breach2,abandonAt:0,nextWave:breach1,firstBang:false,secondBang:false,leaderX:6,leaderZ:-2,paused:false,survivors:[],gates:[],infectedIds:[],spawnLog:[],spawnRefusals:{cap:0,reserved:0,offscreen:0,snap:0},flashlight:false,mainPower:true,emergency:false,exitAt:0,gateAt:0,injuryLineAt:0,lastShot:0,mid:false,platform:false};
    w.npcs!.setAmbient(0);
    const o=w.npcs!.civilians.outbreak ?? new Outbreak(w,{refuges:[],tier:w.infected!.director.tier}); w.npcs!.civilians.outbreak=o;
    // Outbreak construction restores L1's cap, so apply L6's quality-scaled
    // pressure after creating/reusing it.
    w.infected!.director.levelCap=w.infected!.director.tier==='low'?l6.infected.low*2:l6.infected.high;w.infected!.director.strict=true;
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
        // Carry identity, appearance and health into the newly furnished
        // shelter; the L5 crowd's track positions and idle orders end here.
        Object.assign(e.transform, at, { y: 1.3 });
        e.civilian!.floorY=.6; e.civilian!.pauseUntil=0; e.civilian!.knockedUntil=0; e.civilian!.until=0; e.civilian!.entered=start;
        e.civilian!.state='calm';e.civilian!.goal=-1;e.civilian!.path.length=0;e.civilian!.pathIndex=0;
        e.civilian!.schedule=[{activity:routine==='talk'?'chat':routine==='sit'?'sit':'look',anchor:`l6/${routine}`,target:at,facing:{x:at.x+(i%2?-3:3),z:at.z},ticks:60*60*10}];
        e.civilian!.scheduleStep=0;e.civilian!.activityUntil=start+60*60*10;e.civilian!.activityStarted=start-60;
        if(e.combat){e.combat.staggerUntil=0;e.combat.attacking=false;delete e.combat.reaction;}
        w.entities.replace(e); w.spatial.set(e.id,e.transform.x,e.transform.z);
      } else {
        const spawned=o.spawnPedestrian(at,{model,role:'cashier',yaw:i%2?Math.PI:0,walkSpeed:l6.follow.speed,schedule:[{activity:routine==='talk'?'chat':routine==='sit'?'sit':'look',anchor:`l6/${routine}`,target:at,facing:{x:at.x+(i%2?-3:3),z:at.z},ticks:60*60*10}]});
        e=w.entities.get(spawned)!;
      }
      const id=e.id;
      e.health={current:60,max:60};e.civilian!.survivor={key,mode:'follow',slot:i,leader:0,cover:false,waitAt:0,foundAt:start};
      e.civilian!.story={clip:routine==='sit'?'npc-sit':routine==='rest'?'death-side':routine==='talk'?'npc-gesture':routine==='treat'?'npc-cower':routine==='share'?'npc-give':'npc-look-around',start:start-i*13, ...(i===0?{prop:'pistol' as const}:{})};
      if(resident){e.health={current:resident.health.max,max:resident.health.max};e.appearance=structuredClone(resident.appearance);}
      if(resident) readyCarriedAlly(e, start);
      if(e.civilian!.story?.clip==='npc-sit'){
        const district=w.districts!.districts[0], bench=district.layout.placements.filter(p=>p.assetId==='prop.bench')[Math.floor((i-1)/5)];
        const seat=bench&&seatAnchor(bench.assetId,bench.position,bench.yaw,bench.scale,{x:district.origin[0],z:district.origin[1]});
        if(seat){
          const front={x:Math.cos(bench.yaw),z:-Math.sin(bench.yaw)}, target=this.snap({x:seat.x+front.x*.9,z:seat.z+front.z*.9});
          Object.assign(e.transform,{...target,y:1.3,yaw:bench.yaw});w.spatial.set(e.id,target.x,target.z);
          e.civilian!.schedule=[{activity:'sit',anchor:'l6/sit',target,seat,seatLift:seat.lift,seatProp:`${district.id}/${bench.id}`,facing:{x:seat.x+front.x*3,z:seat.z+front.z*3},ticks:60*60*10}];
          e.civilian!.scheduleStep=0;e.civilian!.activityUntil=start+60*60*10;e.civilian!.activityStarted=start-60;
        }
      }
      if(i===0){e.civilian!.ally=allyState('officer',at,true);e.civilian!.ally.gun={damage:20,shotS:.5,rangeM:16,nearM:16,hitNear:.5,hitFar:.5};e.civilian!.ally.weapon='pistol';}
      this.s.survivors.push({key,id,injured,routine,status:'shelter',straggler:false,collected:false,rejoined:false,hold:0});
    });
    for(const x of l6.gates){const id=w.barricades!.spawn({id:`l6-gate-${x}`,groupId:'l6-service',a:{x,z:13.9},b:{x,z:16.1},height:2.3,depth:.22});const e=w.entities.get(id)!;e.archetype='l6.service-gate';e.transform.y=.6;e.interactable!.enabled=false;this.s.gates.push({id,x,closedAt:0,hold:0});}
    // PO 10-20 #64 "let me be able to close them to lock Zombies out": every tunnel entry hatch has a close prompt.
    for(const entry of this.s.entries??[]){const door=l6Doors[entry.door],id=w.interactables!.spawn('switch',{x:door.x,z:door.z<15?11.65+l6.hatch.standM:18.35-l6.hatch.standM},{radius:l6.hatch.promptM,holdTime:.3,label:'Close the hatch'});const e=w.entities.get(id)!;e.archetype='l6.entry-switch';e.transform.y=.9;e.interactable!.hint='E / middle-click · lock the infected out';entry.switchId=id;}
    for(const at of [{x:281,z:24},{x:286,z:5}]){const id=w.hazards!.spawn('fire',at,{radius:1.3,duration:7200});w.entities.get(id)!.transform.y=3.95;}
    const lampId=w.interactables!.spawn('switch',{x:1.5,z:-2},{radius:2,holdTime:.3,label:'Pick up headlamp'});
    const lamp=w.entities.get(lampId)!;lamp.archetype='pickup.headlamp';lamp.transform.y=.9;
    lamp.pickup={kind:'item',item:'headlamp',radius:1.5,collected:false};
    // Keep the authored pickup fixed for the companion, without an E/hold prompt.
    lamp.interactable!.enabled=false;
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
  /** Retry opening arrivals whose doorway was watched when the breach began. */
  private holdWaveInterval():number {return ticks(2.5);}
  /** Announced L6 cohorts outrank distant, idle ambient fillers when the authored cap is full. */
  private retireIdleFillers(capacity:number):void {
    const w=this.w,ai=w.infected!,player=w.entities.get(1)!.transform,group=this.s.survivors.filter(r=>r.status==='shelter'||r.status==='following').map(r=>w.entities.get(r.id)!).filter(Boolean);
    for(const e of [...ai.active]) {
      if(ai.director.count+ai.director.pendingTurns<capacity)return;
      const b=e.infected;
      // Keep authored and survivor identities while they can still pressure the column.
      const passed=distance(e.transform,{x:this.s.leaderX,z:15})>30&&group.every(member=>distance(e.transform,member.transform)>25);
      if(this.s.survivors.some(r=>r.id===e.id)||this.s.spawnLog.some(q=>q.id===e.id)&&!passed)continue;
      if(!b||e.health.current<=0||e.corpse||e.infectionRise||b.recoverAt>=0||b.state!=='idle'&&b.state!=='wander'||['chase','bite'].includes(b.l1?.mode??'')||e.combat?.attacking||b.specialAttack||
        distance(e.transform,player)<=25||!ai.director.offscreen(e.transform,e.transform.y-.7))continue;
      ai.release(e);
      this.s.distantRecycled=(this.s.distantRecycled??0)+1;
      if(ai.director.count+ai.director.pendingTurns<capacity)return;
    }
  }
  private spawn(n:number,doors:number[],wave:number):number {
    const w=this.w,ai=w.infected!,o=w.npcs!.civilians.outbreak!,player=w.entities.get(1)!.transform;let spawned=0;
    // Saves from before the hold telemetry do not contain this optional ledger.
    this.s.spawnRefusals??={cap:0,offscreen:0,snap:0};
    this.s.spawnRefusals.reserved??=0;
    for(let i=0;i<n;i++){
      let occupied=ai.director.count+ai.director.pendingTurns;
      // Reserve the authored side arrivals even while defending the shelter.
      // Downed infected retain their pool slots while waiting to recover.
      // An announced maintenance cohort owns its own reserved slots. Count the
      // other announced cohorts here, but do not reserve this cohort against
      // itself or it can sit forever at the cap with zero members spawned.
      const currentEntry=wave===4||wave===5?(this.s.entries??[]).find(entry=>entry.door===doors[0]):undefined;
      const liveEntries=(this.s.entries??[]).filter(e=>e.warnedAt&&e.remaining&&(!e.closedAt||e.brokenAt)&&
        (this.s.phase!=='retreat'&&this.s.phase!=='exit'||l6Doors[e.door].x>=this.s.leaderX-20&&l6Doors[e.door].x<=this.s.leaderX+40));
      const otherEntries=liveEntries.filter(entry=>entry!==currentEntry);
      // Reserve only announced hatches. Unannounced doors have no imminent
      // admission deadline, and passed hatches must not starve moving tunnel pressure.
      // Preserve other live announcements.
      const pressureReserve=wave===2||wave===3||wave===4||wave===5?0:l6.pressure.group;
      const reserved=(wave<=3?liveEntries:otherEntries).reduce((total,e)=>total+e.remaining,0)+(wave!==2?(this.s.arrivals?.remaining??(this.s.phase==='first'?10:0)):0)+pressureReserve;
      if(occupied>=ai.director.cap-reserved) { this.retireIdleFillers(ai.director.cap-reserved); occupied=ai.director.count+ai.director.pendingTurns; }
      if(occupied>=ai.director.cap-reserved){
        const refused=n-i;
        if(occupied<ai.director.cap)this.s.spawnRefusals.reserved=(this.s.spawnRefusals.reserved??0)+refused;
        else this.s.spawnRefusals.cap+=refused;
        break;
      }
      const requested=doors[i%doors.length];
      const courierApproach=wave===1||wave===4||wave===2&&requested%2===0;
      // A watched shelter doorway cannot pop an infected into view. Use a real
      // tunnel access instead, rotating the alternatives so breach two retains
      // at least two sources. Test the snapped pose, which is the actual spawn.
      // Tunnel pressure can route to another live service mouth when the
      // selected hatch is closed. Only the hatch's own announced arrivals
      // (wave 4) must wait for that particular door to break open.
      const candidates=l6SpawnCandidates(requested,wave,(this.s.entries??[]).filter(e=>e.closedAt&&!e.brokenAt).map(e=>e.door));
      if(!candidates.length){this.s.spawnRefusals.hatch=(this.s.spawnRefusals.hatch??0)+1;continue;}
      // Both tunnel walls emit inward. The old fixed -Z offset put north-side arrivals in the unbuilt void.
      const mouth=(index:number,breachOffset=20)=>{const base=index===8?{x:Math.min(l6PressureExitDoor.x,player.x+18),z:l6PressureExitDoor.z}:l6Doors[index];
        const rank=wave===4?this.s.spawnLog.filter(entry=>entry.wave===4&&entry.door===requested).length%2:0;
        const inward=wave===4?1.4+rank*1.4:1.4;
        return {x:base.x+(wave===4?[-3,3][rank]:(i%2)*.8),z:base.z+(wave===1||wave===2?breachOffset:index>1&&base.z<l6.tunnel.z?inward:-inward)};};
      let door:number|undefined,at:Point|undefined,snapped=false;
      for(const index of candidates){
      for(const offset of wave===1?[20,14,9]:wave===2?[20,14,9,5]:[20]){
          let candidate:Point;
          try{candidate=this.snap(mouth(index,offset),wave===4?w.entities.get(1)!.transform:undefined);snapped=true;}catch{continue;}
          if(ai.director.offscreen(candidate,.6)){door=index;at=candidate;break;}
        }
        if(door!==undefined)break;
      }
      if(door===undefined||!at){if(snapped)this.s.spawnRefusals.offscreen++;else this.s.spawnRefusals.snap++;continue;}
      const model=balancedCrowdModel(l6BreachModels,ai.active.filter(e=>e.health.current>0&&!e.hidden&&!e.infected?.hidden).map(e=>({model:e.appearance?.asset??e.infected!.variant,x:e.transform.x,z:e.transform.z})),at,w.entities.size);
      // Each shelter breach includes one catalog heavy. Without
      // that front member, sustained fire erased the entire second cohort
      // before it could engage. Keep the same finite cohort and cap slots.
      // Temporarily release the active cohort's own reserved slots while its
      // members are admitted. Keep reservations for every other announced
      // cohort and for the remaining authored arrivals.
      const held = ai.director.reserved;
      if (currentEntry||wave===2||wave===3) ai.director.reserved = Math.max(0, held -
        (wave===2?(this.s.arrivals?.remaining??0)+l6.pressure.group:wave===3?liveEntries.reduce((n,e)=>n+e.remaining,0)+l6.pressure.group:
          wave===4||wave===5?(currentEntry?.remaining??0)+l6.pressure.group:currentEntry?.remaining??0));
      // A catalog armored front member covers each hatch cohort against
      // the carried MG; its visible role and stats agree in every level.
      const hatchMembers = this.s.spawnLog.filter(entry=>entry.wave===4&&entry.door===requested).length;
      const hatchFront = wave === 4 && hatchMembers === 0;
      const front = wave === 1 && i === 1 || wave === 2 && !this.s.spawnLog.some(entry=>entry.wave===2)
        || hatchFront;
      // Shelter breach two retains a riot; hatch fronts use actual armored actors.
      let id:number;
      try {
        // r42 Alpha mix: the front member of the hatches at x 126 and x 198 is the level's Alpha (Screamer in the tunnel, Leaper
        // later); it takes the armored front's cohort and cap slot. The other hatches keep the catalog armored front.
        const alphaType=hatchFront?l6HatchAlphas[requested]:undefined;
        // Fast members lead the two announced breach cohorts so they stay with
        // the retreating courier instead of being absorbed into the shelter crowd.
      const breachMember = this.s.spawnLog.filter(entry=>entry.wave===2).length+i;
      const openingRunner = wave === 1 && i === 0 || wave === 2 && breachMember % 3 === 1 || wave === 3 && i % l6.pressure.group === 0;
        id=alphaType?ai.spawn('infected.alpha',at,{alphaType}):openingRunner?ai.spawn('infected.runner',at):front?ai.spawn(wave===1||hatchFront?'infected.armored':'infected.riot',at):o.spawnPedestrian(at,{model});
        const e=w.entities.get(id)!;
        if(!front&&!openingRunner)o.turnNow(e);
      }
      finally { ai.director.reserved = held; }
      const e=w.entities.get(id)!;
      // Opening arrivals converge on the protector from both accesses; later
      // arrivals take a short approach, then use ordinary human perception.
      const groupTarget=wave===3?this.s.survivors.filter(r=>r.status==='shelter'||r.status==='following').map(r=>w.entities.get(r.id)!).filter(Boolean)
        .sort((a,b)=>distance(a.transform,e.transform)-distance(b.transform,e.transform))[0]:undefined;
      const target=groupTarget??w.entities.get(1)!;
      const until=w.tick+ticks(wave===2||wave===3||wave===4?20:courierApproach?12:2);
      ai.press(id,target.id,until,4);
      ai.rush(id,target.transform,until,true);
      spawned++;this.s.infectedIds.push(id);this.s.spawnLog.push({id,door,x:e.transform.x,z:e.transform.z,tick:w.tick,wave,offscreen:ai.director.offscreen(at,.6)});
    }
    return spawned;
  }
  private breach(second:boolean):void {
    const s=this.s,w=this.w;
    if(second){s.phase='fails';s.mainPower=false;s.emergency=true;this.power();w.events.emit({type:'power.off',tick:w.tick,group:'metro-main'});s.arrivals={remaining:l6.breach.secondCount,door:0,nextAt:w.tick};}
    else {s.phase='first';this.spawn(l6.breach.firstCount,[0,1],1);s.nextWave=this.w.tick+this.holdWaveInterval();this.mission.setState('breached',true);}
    w.events.emit({type:second?'l6.breach2':'l6.breach1',tick:w.tick});
  }
  private abandon():void {
    if(this.s.abandonAt)return;
    const s=this.s;s.abandonAt=this.w.tick;s.phase='retreat';
    for(const r of this.living()){r.status='following';const e=this.w.entities.get(r.id)!,c=e.civilian!;leaveSeat(e);c.story=null;delete c.floorY;}
    this.mission.setState('abandoned',true);this.w.events.emit({type:'l6.abandon',tick:this.w.tick});
    this.say(s.survivors[0].id,'Into the tunnel! Everybody, move!');this.mission.requestCheckpoint('abandon');
  }
  private startWalking(r: L6State['survivors'][number]): void {
    const e=this.w.entities.get(r.id); if (!e?.civilian) return;
    r.status='following';
    e.hidden=false; e.civilian.survivor!.mode='follow';
    leaveSeat(e); e.civilian.story=null; delete e.civilian.floorY;
  }
  private living() {return this.s.survivors.filter(r=>r.status==='shelter'||r.status==='following');}
  /** A service gate can be closed once every living survivor is more than 2 m past its line (E24 §5: nobody trapped). */
  private closable(g:{x:number;closedAt:number}):boolean {return !g.closedAt&&this.living().every(r=>this.w.entities.get(r.id)!.transform.x>g.x+2);}
  /** Guide the retreat with fixed gates/platform destinations; only the objective wording reacts to separation. */
  private guide(p:Point):void {
    const s=this.s,m=this.mission,anchors=m.def.anchors,f=l6.follow;
    const walkers=this.living().filter(r=>r.status==='following').map(r=>({r,e:this.w.entities.get(r.id)!})).filter(({e})=>!e.hidden);
    if(!walkers.length){s.strayFlipAt=0;if(s.strayed){s.strayed=false;m.state.marker=s.phase==='exit'?'night-exit':'exit-platform';}return;}
    const near=Math.min(...walkers.map(({e})=>distance(e.transform,p)));
    // QA 10-21 #84: "objective text flaps ... every 1-3 s (53 flips) while the group is 20-35 m behind". The nearest
    // walker (fighting or fleeing infected) crosses the 10/15 m band in and out; the text changes only once the new
    // reading has held for strayDwellS, so it switches once per real change.
    s.strayed=!!s.strayed;const want=s.strayed?near>f.regroupM:near>f.strayM;
    if(want===!!s.strayed)s.strayFlipAt=0;
    else if(!s.strayFlipAt)s.strayFlipAt=this.w.tick;
    if(s.strayFlipAt&&this.w.tick-s.strayFlipAt>=ticks(f.strayDwellS)){s.strayed=want;s.strayFlipAt=0;}
    const at=(name:string,x:number,z:number,y=.6)=>{const a=anchors[name]??(anchors[name]={x,z,y,radius:2});a.x=x;a.z=z;a.y=y;};
    if(s.phase==='retreat'){
      // Q-305 + PO 10-31 ("Checkpoint should not move with me. Checkpoint should always be in places where I need to go to
      // reach the level end or trigger some action."): the ring never walks ahead of the group. It sits on the platform (the
      // retreat's destination) and moves onto a service gate's wait spot only while that gate can be closed (everyone through,
      // the courier still near it). The old walking waypoint left the gate exactly when the last survivor passed, so the
      // "E to close" prompt (tied to this waypoint) vanished at the moment the gate became closable.
      const gate=s.gates.find(g=>this.closable(g)&&p.x>=g.x-f.gateGroupM&&p.x<=g.x+f.columnM);
      const wait=gate&&LevelSixSubway.gateWait(gate.x),exit=anchors['exit-platform'];
      at('l6-next',wait?.x??exit.x,wait?.z??exit.z,exit.y??.6);
    }
    // PO 10-31: the marker is a fixed destination, never a moving group
    // or survivor position. Regroup/rescue wording stays in the objective;
    // navigation keeps the fixed platform or a gate the player can close.
    m.state.marker=s.phase==='retreat'?'l6-next':'night-exit';
  }
  /** Every movement mode must be able to bring a displaced follower off the walkable side floor. */
  navigationFor(e:EntitySnapshot) {
    const base=this.w.infected!.nav,r=this.s.survivors.find(r=>r.id===e.id),radius=actorRadius(e);
    if(r?.status!=='following'||e.transform.x<l6.tunnel.start||Math.abs(e.transform.z-l6.tunnel.z)<=1.8)return base;
    // Keep ordinary formation/combat steering until a body actually touches or
    // crosses an artificial lane edge. Collected walkers keep their return route.
    const side=e.transform.z-l6.tunnel.z;
    const acrossLane=base.walls.some(w=>(w as {navOnly?:boolean}).navOnly&&Math.abs(e.transform.x-w.x)<w.halfX+radius&&(w.z-l6.tunnel.z)*side>0&&Math.abs(side)>Math.abs(w.z-l6.tunnel.z)-w.halfZ-radius);
    if(!r.collected&&!r.rejoined&&!acrossLane)return base;
    const floor=base.forPlayer(radius);
    // Maintenance rooms extend beyond the courier floor; preserve their NPC route.
    return floor.contains(e.transform.x,e.transform.z)?floor:base;
  }
  /** Called by the shared follower before its L5 rules. Calm routines and group movement own live civilians only. */
  follower(e:EntitySnapshot):boolean {
    const s=this.s,r=s.survivors.find(r=>r.id===e.id);if(!r)return false;
    if(r.status==='out'){
      // Stay visible after crossing Northgate: walk clear of the mouth into
      // the night street, then remain with the rescued group for the end shot.
      const slot=e.civilian!.survivor!.slot;
      this.w.npcs!.move(e,{x:270+Math.floor(slot/6)*1.2,z:12+(slot%6)*1.2},l6.follow.speed,e.civilian!,.4,1600);
      this.w.spatial.delete(e.id);return true;
    }
    // The former shelter guard is now part of the moving column. Re-engaging its
    // stationary ally post here made it leave formation to fight tunnel infected.
    if(r.status==='shelter')return true;
    if(r.status!=='following')return false;
    const live=this.living(),column=e.civilian!.survivor!.slot%3;
    // Keep each survivor in the same lane as people leave. Compact that lane's queue without sending the remaining walkers across it.
    const row=Math.max(0,live.filter(q=>this.w.entities.get(q.id)!.civilian!.survivor!.slot%3===column).findIndex(q=>q.id===e.id));
    const target=r.collected?this.w.entities.get(1)!.transform:{x:s.leaderX-row*1.4,z:s.leaderZ+(column-1)*1.2};
    // Keep the authored tunnel approach until this walker reaches the platform; then align with the escalator.
    const goal=target.x<25?{x:target.x,z:target.z}: {x:target.x,z:target.x>=246&&target.x<258?(e.transform.x<246?l6.exit.approachZ:l6.tunnel.z):15+(r.collected?0:(column-1)*.725)};
    // Three 0.7 m bodies share the 2.2 m mouth with 2.5 cm between bodies and each barrier.
    const reach=r.collected?1.8:.4;
    if(r.injured&&!r.collected&&s.leaderX<e.transform.x&&s.leaderX<25)return true;
    let around=this.aroundCourier.get(e.id);
    const p=this.w.entities.get(1)!,dx=goal.x-e.transform.x,dz=goal.z-e.transform.z,len2=dx*dx+dz*dz;
    const opening=!r.collected&&Math.hypot(p.survivor!.velocity.x,p.survivor!.velocity.z)<.15&&s.gates.some(g=>!g.closedAt&&Math.abs(p.transform.x-g.x)<.75&&Math.abs(p.transform.z-15)<.8);
    if(around&&(!opening||distance(e.transform,around)<.15)){this.aroundCourier.delete(e.id);around=undefined;}
    const t=len2?((p.transform.x-e.transform.x)*dx+(p.transform.z-e.transform.z)*dz)/len2:0;
    const clearance=actorRadius(e)+actorRadius(p)+.025;
    if(opening&&!around&&distance(e.transform,p.transform)<2&&t>0&&t<1&&Math.hypot(e.transform.x+t*dx-p.transform.x,e.transform.z+t*dz-p.transform.z)<clearance){
      const length=Math.sqrt(len2),side=e.transform.z>=p.transform.z?1:-1;
      for(const sign of [side,-side]){
        const candidate={x:p.transform.x-sign*dz/length*clearance,z:p.transform.z+sign*dx/length*clearance};
        if(this.w.infected!.nav.clear(candidate.x,candidate.z,actorRadius(e),true)&&this.w.solids.clear({...candidate,y:e.transform.y},actorRadius(e),e.id)){
          around=candidate;this.aroundCourier.set(e.id,around);break;
        }
      }
    }
    // Crowd-only lane edges keep the column on the track. A follower displaced
    // onto a walkable side walkway uses the courier's route back across that edge.
    const side=Math.abs(e.transform.z-l6.tunnel.z),baseNav=this.w.infected!.nav;
    const nav=this.navigationFor(e),returning=side>1.8&&nav!==baseNav;
    if((around||distance(e.transform,goal)>reach+.15)&&!this.w.npcs!.move(e,around??goal,l6.follow.speed,e.civilian!,around ? .05 : reach,1600,nav)&&!around&&(returning||side>l6.tunnel.width/2))
      // A side room's long route can exceed the steering budget. Collected walkers
      // return to the nearby track; the unfetched group keeps its authored mouth approach.
      this.w.npcs!.move(e,{x:returning?Math.max(l6.tunnel.start,Math.min(e.transform.x,l6.tunnel.end)):l6.tunnel.start,z:l6.tunnel.z},l6.follow.speed,e.civilian!,reach,1600,nav);
    this.w.spatial.set(e.id,e.transform.x,e.transform.z);return true;
  }
  update():void {
    const s=this.s,w=this.w,t=w.tick,p=w.entities.get(1)!.transform;
    s.flashlight=this.mission.state.items.includes('headlamp');
    // Bites use this same reservation as the authored spawns. Turning a
    // bystander must not steal a slot promised to the next breach or hatch.
    w.infected!.director.reserved=(s.entries??[]).reduce((n,e)=>n+(e.warnedAt&&(!e.closedAt||e.brokenAt)&&
      (s.phase!=='retreat'&&s.phase!=='exit'||l6Doors[e.door].x>=s.leaderX-20&&l6Doors[e.door].x<=s.leaderX+40)?e.remaining:0),0)+(s.arrivals?.remaining??(s.phase==='shelter'||s.phase==='first'?10:0));
    if(s.phase==='retreat'||s.phase==='exit')w.infected!.director.reserved+=l6.pressure.group;
    let turning=0;for(const e of w.entities.iterate())if(e.infection&&!e.infected)turning++;
    w.infected!.director.pendingTurns=turning;
    // A retry can restore a checkpoint captured on the transition tick. Keep the
    // phase and roster invariant aligned: once retreat has begun, no survivor is
    // allowed to remain in the shelter-only follower state.
    if(s.phase==='retreat'||s.phase==='exit') for(const r of s.survivors) if(r.status==='shelter') this.startWalking(r);
    if(s.phase==='shelter'&&t===s.startAt+300)this.say(s.survivors.find(r=>r.injured)!.id,l6InjuryLines.patient);
    for(const r of this.living()){const e=w.entities.get(r.id);if(!e||e.health.current<=0||e.civilian?.state==='finished'){r.status='dead';if(e)this.alarm(e,'lost');}else if(e.infection||e.infected){r.status='turned';this.alarm(e,'lost');}}
    if(!s.firstBang&&t>=s.breach1At-120){s.firstBang=true;this.bang(false);}
    if(!s.secondBang&&t>=s.breach2At-120){s.secondBang=true;this.bang(true);}
    if(s.phase==='shelter'&&t>=s.breach1At)this.breach(false);
    if(s.phase==='first'&&t>=s.breach2At)this.breach(true);
    if(s.arrivals && t>=s.arrivals.nextAt){const a=s.arrivals;if(this.spawn(1,[a.door++%2],2)){a.remaining--;a.nextAt=t+ticks(.75);}else a.nextAt=t+15;if(!a.remaining)delete s.arrivals;}
    if(s.phase==='fails'&&(t>=s.breach2At+900||s.survivors.filter(r=>r.status==='turned'||r.status==='dead').length>=3))this.abandon();
    // A watched doorway can refuse part of the opening cohort. Keep trying
    // until its eight arrivals have reached a valid off-screen entrance.
    if((s.phase==='first'||s.phase==='fails')&&t>=s.nextWave){
      const door=Math.floor(t/ticks(1))%2;
      if(s.spawnLog.filter(e=>e.wave===1).length>=l6.breach.firstCount||this.spawn(1,[door],1))s.nextWave=t+this.holdWaveInterval();
      else s.nextWave=t+15;
    }
    // A hatch closed before the retreat also shuts off fallback breach spawns.
    for(const entry of s.entries??[]){
      const door=l6Doors[entry.door],sw=entry.switchId===undefined?undefined:w.entities.get(entry.switchId);
      if(sw?.interactable&&!entry.closedAt&&!entry.brokenAt&&sw.interactable.completed){entry.closedAt=t;entry.hits=l6.hatch.hits;entry.nextAt=t+ticks(l6.hatch.safeS);w.events.emit({type:'barricade.sound',tick:t,sourceId:sw.id,position:{x:door.x,y:1.2,z:door.z},phase:'brace',hp:l6.hatch.hits,maxHp:l6.hatch.hits});}
      if(sw?.interactable){sw.interactable.enabled=!entry.closedAt&&!entry.brokenAt;sw.interactable.label=entry.brokenAt?'Hatch broken':entry.closedAt?'Hatch closed':'Close the hatch';}
    }
    if(s.phase!=='retreat'&&s.phase!=='exit')return;
    // QA 10-21 #83: the rear is the walking column's (healthy walkers within columnM of the leader). One healthy survivor
    // fighting far back made the whole group wait and sent the courier 70-80 m back through the horde, over and over.
    const live=this.living(),healthy=live.filter(r=>!r.injured).map(r=>w.entities.get(r.id)!),column=healthy.filter(e=>e.transform.x>=s.leaderX-l6.follow.columnM);
    const tail=column.length?Math.min(...column.map(e=>e.transform.x)):healthy.length?Math.min(...healthy.map(e=>e.transform.x)):s.leaderX;
    const head=column.length?Math.max(s.leaderX,...column.map(e=>e.transform.x)):s.leaderX;
    const hot=w.infected!.active.some(e=>e.health.current>0&&distance(e.transform,{x:tail,z:15})<20);
    const atGate=l6.gates.some(x=>Math.abs(s.leaderX-x)<2);
    const rear=hot&&distance(p,{x:tail,z:15})>12,behind=live.find(r=>r.straggler&&!r.rejoined&&w.entities.get(r.id)!.transform.x<tail-4);
    const uncovered=hot&&p.x<s.leaderX&&distance(p,{x:s.leaderX,z:s.leaderZ})>12;
    s.paused=uncovered||atGate&&(rear||!!behind);
    // QA 10-21 #83: a paused group names its reason and the ring leads to it (an injured straggler to fetch, or the rear to cover).
    // QA 10-21 #88: the held-group reason flipped 3x in 3 s (rear cover as infected crossed the 20 m band). Like `strayed`
    // (#84) the shown reason changes only once the new one has held for strayDwellS. The first reason, and fetch -> bring
    // of the same survivor (the courier reached them), show at once.
    const want:L6State['waitFor']=!s.paused?undefined:behind?{kind:behind.collected?'bring':'fetch',id:behind.id}:{kind:'rear',id:0};
    const same=(a:L6State['waitFor'],b:L6State['waitFor'])=>a?.kind===b?.kind&&a?.id===b?.id;
    if(same(want,s.waitFor)||!s.waitFor||(want?.kind==='bring'&&s.waitFor.kind==='fetch'&&s.waitFor.id===want.id)){s.waitFor=want;s.waitFlipAt=0;}
    else if(!s.waitFlipAt)s.waitFlipAt=t;
    else if(t-s.waitFlipAt>=ticks(l6.follow.strayDwellS)){s.waitFor=want;s.waitFlipAt=0;}
    s.tailX=tail;
    if(!s.paused){if(s.leaderZ<15)s.leaderZ=Math.min(15,s.leaderZ+2.2/60);else s.leaderX=Math.min(276,s.leaderX+2.2/60);}
    if(!s.injuryLineAt&&s.leaderX>34){s.injuryLineAt=t;this.say(1,l6InjuryLines.retreat);}
    for(const r of live){const e=w.entities.get(r.id)!;
      if(r.straggler&&!r.rejoined&&!r.collected&&distance(e.transform,p)<=3){r.collected=true;this.say(1,l6InjuryLines.rejoin);w.events.emit({type:'l6.collected',tick:t,id:r.id});}
      // Inside the real column counts too. Combat can displace its head beyond a leader held at the gate:
      // using that scripted leader as the upper bound kept a returned survivor attached for the next fetch.
      if(r.collected&&e.transform.x>tail-l6.follow.rejoinM&&e.transform.x<head+l6.follow.rejoinM){r.collected=false;r.rejoined=true;w.events.emit({type:'l6.rejoined',tick:t,id:r.id});}
      if(e.transform.x>=263){r.status='out';w.spatial.delete(e.id);}
    }
    this.guide(p);
    // Telegraph a fixed entrance before the courier reaches it. Two arrivals together,
    // from one side/ahead; the opposite escape lane stays open.
    for(const entry of s.entries??[]){
      const door=l6Doors[entry.door];
      if(!entry.warnedAt&&p.x>=door.x-28&&p.x<door.x+8){entry.warnedAt=t;entry.nextAt=t+120;w.events.emit({type:'l6.bang',tick:t,breach:entry.door+1,position:door});}
      const sw=entry.switchId===undefined?undefined:w.entities.get(entry.switchId);
      if(entry.warnedAt&&(entry.remaining||entry.closedAt&&!entry.brokenAt)&&t>=entry.nextAt){
        // Arrivals behind a closed hatch bash it once per second (telegraphed rattle and impact) and break through at zero.
        if(entry.closedAt&&!entry.brokenAt){
          entry.hits=(entry.hits??l6.hatch.hits)-1;entry.hitAt=t;entry.nextAt=t+ticks(l6.hatch.hitS);
          w.events.emit({type:'barricade.sound',tick:t,sourceId:sw?.id??0,position:{x:door.x,y:1.2,z:door.z},phase:entry.hits>0?'hit':'break',hp:Math.max(0,entry.hits),maxHp:l6.hatch.hits});
          if(entry.hits<=0){entry.brokenAt=t;entry.reopenRemaining=entry.remaining===0?1:0;entry.remaining=Math.max(entry.remaining,1);entry.nextAt=t;w.events.emit({type:'l6.hatch-broken',tick:t,door:entry.door});}
        }
        else { const wave=entry.reopenRemaining?5:4,spawned=this.spawn(entry.remaining,[entry.door],wave); if(spawned){entry.remaining-=spawned;if(wave===5)entry.reopenRemaining=Math.max(0,(entry.reopenRemaining??0)-spawned);entry.nextAt=t+360;}else entry.nextAt=t+15; }
      }
    }
    if(t>=s.nextWave){
      s.nextWave=t+ticks(l6.pressure.intervalS);
      const pressureDoors=[...l6Doors.map((d,i)=>({d,i})),{d:{x:Math.min(l6PressureExitDoor.x,p.x+18),z:l6PressureExitDoor.z},i:8}];
      const ahead=pressureDoors.filter(({d,i})=>i>1&&d.x>=s.leaderX+l6.pressure.aheadM).sort((a,b)=>a.d.x-b.d.x)[0];
      const fallback=pressureDoors.filter(({i})=>i>1).sort((a,b)=>Math.abs(a.d.x-s.leaderX)-Math.abs(b.d.x-s.leaderX))[0];
      // Replenishing pressure comes from ahead when possible. Sending every
      // other cohort behind a same-speed retreating group created safe gaps;
      // the Northgate mouth becomes the ahead source at the final platform.
      const source=ahead??fallback;
      const sources=source?Array.from({length:l6.pressure.group},()=>source.i):[];
      if(sources.length){const admitted=this.spawn(sources.length,sources,3);if(admitted<sources.length)s.nextWave=t+ticks(5);}
    }
    if(s.phase==='exit'&&s.survivors.some(r=>r.status==='out')){
      // Keep the escape leg legible while the column passes the open gate one by one.
      this.mission.state.subtitle={id:'l6-survivors-safe',text:'The survivors are safe.',until:t+120};
    }
    if(!s.pushHintShown&&w.props?.items.some(q=>q.assetId==='prop.crates'&&q.awake&&distance(p,{x:q.pose.p[0],z:q.pose.p[2]})<2)){s.pushHintShown=true;this.say(1,'Push the glowing crates onto the line, then press E to brace the gate.');}
    for(const gate of s.gates){const e=w.entities.get(gate.id)!;const crossed=this.closable(gate);
      // Q-305: a click on the gate (or its wait spot) asks to close it; the courier closes it on arrival from the far side.
      const click=w.inputFrame.mouseAttack?w.inputFrame.aimPoint??null:null;
      if(!gate.closedAt&&click&&(Math.abs(click.x-gate.x)<1.6&&Math.abs(click.z-15)<1.8||distance(click,LevelSixSubway.gateWait(gate.x))<1.7))gate.requested=crossed;
      else if(click||gate.closedAt||!crossed)gate.requested=false;
      const near=distance(p,LevelSixSubway.gateWait(gate.x))<1.7||!!gate.requested&&p.x>gate.x+.6&&p.x<gate.x+3.4&&Math.abs(p.z-15)<2.6;
      e.interactable!.label=gate.closedAt?'Brace service gate':'Close service gate';e.interactable!.enabled=false;
      if(gate.closedAt&&near&&w.inputFrame.interact)w.barricades!.braceServiceGate(gate.id);
      if(!gate.closedAt&&crossed&&near&&(gate.hold>0||gate.requested||w.inputFrame.interact)){gate.hold++;if(gate.hold>=60&&w.npcs!.companion.insideBeforeClosing({x:gate.x,z:15},{x:gate.x+2,z:15})){gate.closedAt=t;w.barricades!.closeServiceGate(gate.id,Math.round(w.barricades!.dps('infected.runner')*5*10));w.events.emit({type:'l6.gate-closed',tick:t,id:gate.id});}}else gate.hold=0;
    }
    // QA 10-21 #87: once the walking column (its healthy tail, #83) is through a gate, a death restarts there with the
    // surviving group (as L7's corridor checkpoints do), not at the shelter with the whole retreat to replay. A healthy
    // survivor left outside the walking column is restored where they were without withholding the checkpoint.
    // `abandon` stays the retry point for the shelter-to-first-gate leg. The respawn anchor is the gate's wait spot.
    // An injured straggler before this gate withholds its snapshot. Once they are through, falling behind the later
    // column must not withhold the gate already passed (fists trace: everyone east of 94, leader at 148, retry at shelter).
    // Fists playtest 10-21 (after gate 150): with 2 left alive, one through and one 50 m back outside the column, the
    // checkpoint was taken; every respawn at 152 had the ring lead 40 m back to that survivor through the horde and the
    // courier died again (~30 s loop). More than half of the living group must be through as well.
    const through=(x:number)=>live.filter(r=>w.entities.get(r.id)!.transform.x>x+2).length*2>live.length;
    for(const gate of s.gates){
      const behindGate=live.some(r=>r.straggler&&!r.rejoined&&w.entities.get(r.id)!.transform.x<=gate.x+2);
      if(!gate.passed&&s.leaderZ>=l6.tunnel.z&&healthy.length&&tail>gate.x+2&&!behindGate&&through(gate.x)){gate.passed=true;this.mission.requestCheckpoint(`gate-${gate.x}`,LevelSixSubway.gateWait(gate.x));}
    }
    // Fists playtest 10-21: the courier ran ahead to x 150 with the group 25+ m behind and an injured straggler out at
    // x 125; every death restored that snapshot (horde between courier and group) and respawned at 152, ~18 s apart.
    // The chokepoint checkpoint is taken once the courier is there with the walking column and nobody is out behind.
    if(!s.mid&&p.x>=150&&tail>=p.x-l6.follow.columnM&&!behind&&through(p.x-l6.follow.columnM)){s.mid=true;this.mission.requestCheckpoint('mid-tunnel');}
    const exitThrough=(x:number)=>live.length===0||live.filter(r=>w.entities.get(r.id)!.transform.x>x+2).length*2>live.length;
    const exitBehind=live.some(r=>w.entities.get(r.id)!.transform.x<=240+2);
    if(!s.platform&&p.x>=240&&!exitBehind&&exitThrough(240)){s.platform=true;this.mission.requestCheckpoint('exit-platform');this.mission.setState('platform',true);s.phase='exit';}
    if(s.phase==='exit'&&p.x>=263){if(!s.exitAt){s.exitAt=t;this.mission.state.timeOfDay='L6';w.events.emit({type:'l6.exit',tick:t});}
      const streetClear=s.survivors.filter(r=>r.status==='out').every(r=>w.entities.get(r.id)!.transform.x>=266);
      if(live.length===0&&streetClear){s.gateAt=t;const gate=w.barricades!.spawn({id:'l6-night-exit',groupId:'l6-exit',a:{x:258,z:l6.exit.centerZ-2.15},b:{x:258,z:l6.exit.centerZ+2.15},height:2.5,initialHp:10000});w.entities.get(gate)!.archetype='l6.service-gate';s.phase='done';this.mission.setState('exited',true);}}
  }
  completed(id:string):void {if(id==='shelter'&&this.s.phase==='shelter')this.breach(false);if(id==='stop'&&!this.s.abandonAt){if(this.s.phase==='first')this.breach(true);this.abandon();}if(id==='retreat'){this.s.platform=true;this.mission.setState('platform',true);if(this.s.phase!=='done')this.s.phase='exit';}if(id==='exit'){this.s.phase='done';this.s.gateAt=this.w.tick;this.mission.state.timeOfDay='L6';}}
  advance():boolean{return false;}
  result(){
    const s=this.s,out=s.survivors.filter(r=>r.status==='out');
    const escapedSurvivors=out.map(r=>{
      const e=structuredClone(this.w.entities.get(r.id)!);
      if(e.civilian?.survivor)e.civilian.survivor.injured=r.injured;
      return e;
    });
    return {rescued:out.length,survivors:out.map(r=>r.key),survivorsIn:s.survivors.length,survivorsLost:s.survivors.filter(r=>r.status==='dead'||r.status==='turned').length,escapedSurvivors};
  }
  /** Locate a regroup or exit-blocking follower without moving the fixed mission destination. */
  static regroupTarget(mission: Mission | null | undefined): EntitySnapshot | undefined {
    const s=mission?.state.l6;
    if(!mission||!s||(s.phase!=='retreat'&&s.phase!=='exit'))return;
    const p=mission.world.entities.get(1)!.transform;
    const platform=mission.def.anchors['exit-platform'];
    const destination=mission.def.anchors[s.phase==='retreat'?'exit-platform':'night-exit'];
    const atDestination=distance(p,destination)<=3;
    if(!s.strayed&&!atDestination)return;
    let nearest:EntitySnapshot|undefined;
    for(const r of s.survivors){
      const e=mission.world.entities.get(r.id);
      if(r.status!=='following'||!e||e.hidden||e.health.current<=0)continue;
      if(atDestination&&s.phase==='retreat'&&e.transform.x>platform.x)continue;
      if(e.id===s.alarm?.id)return e;
      if(!nearest||(atDestination?e.transform.x<nearest.transform.x:distance(e.transform,p)<distance(nearest.transform,p)))nearest=e;
    }
    return nearest;
  }
  static text(mission: Mission | null | undefined): string | null {
    const s=mission?.state.l6;
    if(!s||(s.phase!=='retreat'&&s.phase!=='exit'))return null;
    const target=LevelSixSubway.regroupTarget(mission);
    if(target){
      const p=mission.world.entities.get(1)!.transform;
      return `Rejoin ${survivorName(target)} · ${Math.ceil(distance(target.transform,p))} m`;
    }
    if(s.strayed)return 'Stay with the group';
    const wait=s.phase==='retreat'?s.waitFor:undefined;
    return wait?.kind==='fetch'?'The group waits: help the injured survivor who fell behind'
      :wait?.kind==='bring'?'Bring the injured survivor back to the group'
      :wait?.kind==='rear'?'The group waits: cover the rear from the infected':null;
  }
  /** Stand beyond and beside the 2.2 m opening, leaving both follower lanes clear. */
  static gateWait(x:number):Point{return {x:x+2.4,z:17.3};}
  gateStatus(id:number):string {
    const gate=this.s.gates.find(g=>g.id===id);if(!gate)return '';
    const live=this.living(),through=live.filter(r=>this.w.entities.get(r.id)!.transform.x>gate.x+2).length;
    return through<live.length?`Let everyone pass · ${through}/${live.length} through`:`Everyone through · E or click the gate to close it`;
  }
  restore(delta:number):void {
    this.aroundCourier.clear();const s=this.s;
    // Npcs.restore shifts the actor timers but not these L1 directive clocks.
    // Preserve the remaining assignment/approach duration when rewinding L6.
    for(const id of s.infectedIds){
      const brain=this.w.entities.get(id)?.infected?.l1;
      if(brain){if(brain.focusUntil)brain.focusUntil+=delta;if(brain.search.until>0)brain.search.until+=delta;}
    }
    for(const r of s.survivors){r.straggler=false;r.collected=false;r.rejoined=true;}
    if(s.phase==='retreat'||s.phase==='exit') for(const r of s.survivors) if(r.status==='shelter') this.startWalking(r);
    if(s.waitFor?.kind==='fetch'||s.waitFor?.kind==='bring'){delete s.waitFor;s.waitFlipAt=0;}
    for(const e of s.entries??[]){if(e.warnedAt)e.warnedAt+=delta;if(e.nextAt)e.nextAt+=delta;if(e.closedAt)e.closedAt+=delta;if(e.hitAt)e.hitAt+=delta;if(e.brokenAt)e.brokenAt+=delta;}
    if(s.arrivals)s.arrivals.nextAt+=delta;
    if(s.alarm)s.alarm.until+=delta;
    for(const key of ['startAt','breach1At','breach2At','abandonAt','nextWave','exitAt','gateAt','injuryLineAt','lastShot'] as const)if(s[key])s[key]+=delta;
    for(const g of s.gates)if(g.closedAt)g.closedAt+=delta;this.power();
  }
}
