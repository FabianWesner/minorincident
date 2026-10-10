import { allyState, updateAlly } from '../outbreak/Allies';
import { Outbreak } from '../outbreak/Outbreak';
import { Rng } from '../../core/Rng';
import { l6, l6Doors, l6InjuryLines } from '../../data/l6';
import { l5Survivors } from '../../data/l5';
import type { EntitySnapshot } from '../world/types';
import type { Point } from '../npc/types';
import type { Mission } from './Mission';
const distance = (a: Point, b: Point) => Math.hypot(a.x-b.x,a.z-b.z);
const ticks = (s: number) => Math.round(s*60);
/** Beat controller; all mutable state is checkpointed on the mission. Infection remains the shared outbreak system. */
export class LevelSixSubway {
  constructor(private readonly mission: Mission) {}
  private get w() { return this.mission.world; }
  private snap(p:Point):Point {const nav=this.w.infected!.nav;for(let d=0;d<=8;d+=.5)for(let i=0;i<(d?16:1);i++){const at={x:p.x+Math.cos(i*Math.PI/8)*d,z:p.z+Math.sin(i*Math.PI/8)*d};if(nav.clear(at.x,at.z,.4))return at;}throw new Error(`No clear metro point ${p.x},${p.z}`);}
  private get s() { return this.mission.state.l6!; }
  prepare(): void {
    const w=this.w, rng=new Rng(w.seed,'l6-story'), start=w.tick;
    const breach1=start+ticks(30+rng.next()*10), breach2=breach1+ticks(20+rng.next()*10);
    this.mission.state.l6={phase:'shelter',startAt:start,breach1At:breach1,breach2At:breach2,abandonAt:0,nextWave:breach2+600,firstBang:false,secondBang:false,leaderX:6,leaderZ:-2,paused:false,survivors:[],gates:[],infectedIds:[],spawnLog:[],flashlight:false,mainPower:true,emergency:false,exitAt:0,gateAt:0,injuryLineAt:0,lastShot:0,mid:false,platform:false};
    w.npcs!.setAmbient(0);w.infected!.director.levelCap=60;w.infected!.director.strict=true;
    const o=w.npcs!.civilians.outbreak ?? new Outbreak(w,{refuges:[],tier:w.infected!.director.tier}); w.npcs!.civilians.outbreak=o; w.infected!.director.levelCap=60;
    const weapons=w.entities.get(1)!.weapons;if(weapons?.RIGHT.rack.some(s=>s.id==='weapon.army-mg')){weapons.selectedSide='RIGHT';weapons.RIGHT.index=weapons.RIGHT.rack.findIndex(s=>s.id==='weapon.army-mg');}
    const keys=w.progression?.campaign?.survivors??[];
    const count=w.infected!.director.tier==='low'?l6.shelter.low:l6.shelter.high;
    const all=[...Array.from({length:count},(_,i)=>`shelter-${i}`),...keys];
    all.forEach((key,i)=>{
      const injured=key!=='rosa'&&i>0&&i%5===0, routine=key==='rosa'?'treat':i===3&&keys.includes('rosa')?'talk':i===0?'guard':(['sit','talk','treat','rest','share'] as const)[(i-1)%5];
      const pair = routine==='treat' ? Math.min(all.length-1, i+2) : i;
      const base=pair>0&&pair%5===0?{x:18+Math.floor(pair/10)*2,z:pair%10===0?16:13.6}:{x:-8+(pair%8)*2.3,z:-3+Math.floor(pair/8)*2.5};
      const at=this.snap(key==='rosa'?{x:16.9,z:13.6}:routine==='treat'?{x:base.x-1.1,z:base.z}:base);
      const previous=l5Survivors.find(s=>s.key===key);
      const model=i===0?'npc.marcus.aftermath':previous?.model??(injured?'npc.shelter-survivor.bandaged':routine==='rest'?'npc.shelter-survivor.lying':routine==='sit'?'npc.shelter-survivor.sitting':i%2?'npc.civilian-man-b.aftermath':'npc.civilian-woman-b.aftermath');
      const id=o.spawnPedestrian(at,{model,role:'cashier',yaw:i%2?Math.PI:0,walkSpeed:injured?1.4:2.2,schedule:[{activity:routine==='talk'?'chat':routine==='sit'?'sit':'look',anchor:`l6/${routine}`,target:at,facing:{x:at.x+(i%2?-3:3),z:at.z},ticks:60*60*10}]});
      const e=w.entities.get(id)!; e.health={current:60,max:60};e.civilian!.survivor={key,mode:'follow',slot:i,leader:0,cover:false,waitAt:0,foundAt:start};
      e.civilian!.story={clip:routine==='sit'?'npc-sit':routine==='rest'?'death-side':routine==='talk'?'npc-gesture':routine==='treat'?'npc-cower':routine==='share'?'npc-give':'idle',start:start-i*13, ...(i===0?{prop:'pistol' as const}:{})};
      if(i===0){e.civilian!.ally=allyState('officer',at,true);e.civilian!.ally.gun={damage:20,shotS:.5,rangeM:16,nearM:16,hitNear:.5,hitFar:.5};e.civilian!.ally.weapon='pistol';}
      this.s.survivors.push({key,id,injured,routine,status:'shelter',straggler:false,collected:false,rejoined:false,hold:0});
    });
    for(const x of l6.gates){const id=w.barricades!.spawn({id:`l6-gate-${x}`,groupId:'l6-service',a:{x,z:13.9},b:{x,z:16.1},height:2.3,depth:.22});const e=w.entities.get(id)!;e.archetype='l6.service-gate';e.transform.y=.6;e.interactable!.enabled=false;this.s.gates.push({id,x,closedAt:0,hold:0});}
    for(const at of [{x:281,z:24},{x:286,z:5}]){const id=w.hazards!.spawn('fire',at,{radius:1.3,duration:7200});w.entities.get(id)!.transform.y=3.95;}
    this.power();this.mission.requestCheckpoint('shelter');
    this.say(this.s.survivors.find(r=>r.key==='rosa'||r.routine==='treat')!.id,l6InjuryLines.treatment);
    w.events.on('combat.attack',e=>{if(e.type==='combat.attack'&&e.sourceId===1&&e.actionId==='weapon.army-mg'&&w.tick-this.s.lastShot>=30){this.s.lastShot=w.tick;w.events.emit({type:'outbreak.distraction',tick:w.tick,id:500000+w.tick*64,kind:'gunfire',position:e.position,radius:30,until:w.tick+360});}});
  }
  private say(id: number,text: string):void {const e=this.w.entities.get(id);if(e){this.s.say={id,text,at:this.w.tick,until:this.w.tick+ticks(4.5)};this.w.events.emit({type:'story.say',tick:this.w.tick,id,text,position:e.transform});}}
  private power():void {
    const d=this.w.districts!.districts[0];d.decay.lights=['shelter-camp','self',...(this.s.mainPower?['metro-main']:[]),...(this.s.emergency?['metro-emergency']:[])];
    if(this.w.weather)this.w.weather.powerRevision++;
  }
  private bang(second: boolean):void {this.w.events.emit({type:'l6.bang',tick:this.w.tick,breach:second?2:1,position:l6Doors[second?1:0]});}
  private spawn(n:number,doors:number[],wave:number):void {
    const w=this.w,ai=w.infected!,o=w.npcs!.civilians.outbreak!;
    for(let i=0;i<n&&ai.director.count<ai.director.cap;i++){
      const door=doors[i%doors.length],base=l6Doors[door],at={x:base.x+(i%2)*.8,z:base.z-1.4};
      // Doorway arrivals are the maintenance source. Later side-passages only emerge outside the camera.
      if(wave>2&&!ai.director.offscreen(at))continue;
      const id=o.spawnPedestrian(this.snap(at),{model:l6.breach.model}),e=w.entities.get(id)!;o.turnNow(e);
      this.s.infectedIds.push(id);this.s.spawnLog.push({id,door,x:e.transform.x,z:e.transform.z,tick:w.tick,wave,offscreen:ai.director.offscreen(at)});
    }
  }
  private breach(second:boolean):void {
    const s=this.s,w=this.w;
    if(second){s.phase='fails';s.mainPower=false;s.emergency=true;s.flashlight=true;this.power();w.events.emit({type:'power.off',tick:w.tick,group:'metro-main'});this.spawn(8,[0,1],2);}
    else {s.phase='first';this.spawn(2,[0],1);this.mission.setState('breached',true);}
    w.events.emit({type:second?'l6.breach2':'l6.breach1',tick:w.tick});
  }
  private abandon():void {
    if(this.s.abandonAt)return;
    const s=this.s;s.abandonAt=this.w.tick;s.phase='retreat';
    for(const r of this.living()){r.status='following';this.w.entities.get(r.id)!.civilian!.story=null;}
    this.mission.setState('abandoned',true);this.w.events.emit({type:'l6.abandon',tick:this.w.tick});
    this.say(s.survivors[0].id,'Into the tunnel! Everybody, move!');this.mission.requestCheckpoint('abandon');
  }
  private living() {return this.s.survivors.filter(r=>r.status==='shelter'||r.status==='following');}
  /** Called by the shared follower before its L5 rules. Calm routines and group movement own live civilians only. */
  follower(e:EntitySnapshot):boolean {
    const s=this.s,r=s.survivors.find(r=>r.id===e.id);if(!r)return false;
    if(r.status==='out'){this.w.spatial.delete(e.id);return true;}
    if(r.routine==='guard'&&s.phase!=='shelter'&&e.civilian!.ally){const a=e.civilian!.ally;a.engaged=true;a.post={x:e.transform.x,z:e.transform.z};updateAlly(this.w,e,(from,to)=>this.w.infected!.nav.visible(from,to,0));}
    if(r.status==='shelter')return true;
    if(r.status!=='following')return false;
    const live=this.living(),slot=Math.max(0,live.findIndex(q=>q.id===e.id));
    const target=r.collected?this.w.entities.get(1)!.transform:{x:s.leaderX-Math.floor(slot/3)*1.4,z:s.leaderZ+(slot%3-1)*1.2};
    const goal=target.x<25?{x:target.x,z:target.z}: {x:target.x,z:target.x>=246&&target.x<258?14.1:15+(r.collected?0:(slot%3-1)*.75)};
    const reach=r.collected?1.8:.4;
    if(r.injured&&!r.collected&&s.leaderX<e.transform.x&&s.leaderX<25)return true;
    if(distance(e.transform,goal)>reach+.15)this.w.npcs!.move(e,goal,r.injured?1.4:2.2,e.civilian!,reach);
    this.w.spatial.set(e.id,e.transform.x,e.transform.z);return true;
  }
  update():void {
    const s=this.s,w=this.w,t=w.tick,p=w.entities.get(1)!.transform;
    if(s.phase==='shelter'&&t===s.startAt+300)this.say(s.survivors.find(r=>r.injured)!.id,l6InjuryLines.patient);
    for(const r of this.living()){const e=w.entities.get(r.id);if(!e||e.health.current<=0||e.civilian?.state==='finished')r.status='dead';else if(e.infection||e.infected)r.status='turned';}
    if(!s.firstBang&&t>=s.breach1At-120){s.firstBang=true;this.bang(false);}
    if(!s.secondBang&&t>=s.breach2At-120){s.secondBang=true;this.bang(true);}
    if(s.phase==='shelter'&&t>=s.breach1At)this.breach(false);
    if(s.phase==='first'&&t>=s.breach2At)this.breach(true);
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
      if(e.transform.x>=263){r.status='out';e.civilian!.survivor!.mode='hidden';}
    }
    if(t>=s.nextWave){s.nextWave=t+600;const sides=l6Doors.map((d,i)=>({d,i})).filter(({d,i})=>i>1&&d.x>tail-35&&d.x<s.leaderX+35).map(x=>x.i);this.spawn(3,[...(tail<80?[0,1]:[]),...sides].length?[...(tail<80?[0,1]:[]),...sides]:[0,1],3);}
    for(const gate of s.gates){const e=w.entities.get(gate.id)!;const crossed=live.every(r=>w.entities.get(r.id)!.transform.x>gate.x+2),near=distance(p,{x:gate.x+1.4,z:15})<1.7;
      e.interactable!.label=gate.closedAt?'Brace service gate':'Close service gate';e.interactable!.enabled=false;
      if(gate.closedAt&&near&&w.inputFrame.interact)w.barricades!.braceServiceGate(gate.id);
      if(!gate.closedAt&&crossed&&near&&(gate.hold>0||w.inputFrame.interact)){gate.hold++;if(gate.hold>=60){gate.closedAt=t;w.barricades!.closeServiceGate(gate.id,Math.round(w.barricades!.dps('infected.runner')*5*10));w.events.emit({type:'l6.gate-closed',tick:t,id:gate.id});}}else gate.hold=0;
    }
    if(!s.mid&&p.x>=150){s.mid=true;this.mission.requestCheckpoint('mid-tunnel');}
    if(!s.platform&&p.x>=240){s.platform=true;this.mission.requestCheckpoint('exit-platform');this.mission.setState('platform',true);s.phase='exit';}
    if(s.phase==='exit'&&p.x>=263){if(!s.exitAt){s.exitAt=t;this.mission.state.timeOfDay='L6';w.events.emit({type:'l6.exit',tick:t});}
      if(live.length===0){s.gateAt=t;const gate=w.barricades!.spawn({id:'l6-night-exit',groupId:'l6-exit',a:{x:258,z:12.85},b:{x:258,z:17.15},height:2.5,initialHp:10000});w.entities.get(gate)!.archetype='l6.service-gate';w.entities.get(gate)!.transform.y=3.9;s.phase='done';this.mission.setState('exited',true);}}
  }
  completed(id:string):void {if(id==='shelter'&&this.s.phase==='shelter')this.breach(false);if(id==='stop'&&!this.s.abandonAt){if(this.s.phase==='first')this.breach(true);this.abandon();}if(id==='retreat'){this.s.platform=true;this.mission.setState('platform',true);if(this.s.phase!=='done')this.s.phase='exit';}if(id==='exit'){this.s.phase='done';this.s.gateAt=this.w.tick;this.mission.state.timeOfDay='L6';}}
  advance():boolean{return false;}
  result(){const s=this.s;return {rescued:s.survivors.filter(r=>r.status==='out').length,survivors:s.survivors.filter(r=>r.status==='out').map(r=>r.key),survivorsIn:s.survivors.length};}
  restore(delta:number):void {const s=this.s;for(const key of ['startAt','breach1At','breach2At','abandonAt','nextWave','exitAt','gateAt','injuryLineAt','lastShot'] as const)if(s[key])s[key]+=delta;for(const g of s.gates)if(g.closedAt)g.closedAt+=delta;this.power();}
}
