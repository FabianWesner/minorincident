/** Explicit arena mechanics fixtures. These inject setup and never count as walking-route evidence. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadLevel } from '../sim-runner/levels';
import { followTenFrustum } from '../sim-runner/l10';
import { emptyInput } from '../../src/input/InputFrame';
import type { EntitySnapshot } from '../../src/sim/world/types';
import { LevelTenBot } from '../../src/debug/bot/LevelTenBot';
import { actorRadius, solidLargeCorpse } from '../../src/sim/world/SolidRegistry';

const out = process.argv.find((arg, i) => process.argv[i - 1] === '--out') ?? 'test-results/l10-pacing/mega-mechanics.json';
const checks: { quality: string; name: string; pass: boolean; observed: unknown }[] = [];
const hash=createHash('sha256');
for(const path of execFileSync('git',['ls-files','src','layouts/D-CURE'],{encoding:'utf8'}).trim().split('\n').sort())hash.update(path).update(readFileSync(path));
const sourceHash=hash.digest('hex');
for (const quality of ['low','high'] as const) {
  const w = await loadLevel('L10', 42, undefined, 0, { quality }), m = w.missions!, ai = w.infected!, player = w.entities.get(1)!;
  const check = (name: string, pass: boolean, observed: unknown) => checks.push({ quality, name, pass, observed: structuredClone(observed) });
  const place = (e: EntitySnapshot, x: number, z: number, y = .7) => { Object.assign(e.transform,{x,y,z}); w.spatial.set(e.id,x,z); if(e.id===1){w.physics.playerBody!.setTranslation(e.transform,true);w.player!.locomotion.reset();w.chunks!.update();} };
  const advance = (ticks: number, observe = () => {}) => { for(let i=0;i<ticks;i++){followTenFrustum(w);w.applyInput(emptyInput(),'keyboard');w.update();observe();} };
  try {
    place(player,4002,-30);
    while(m.state.steps.hold.status!=='active')m.completeObjective();
    w.combat!.damage.god = true;
    const boss = w.entities.get(w.megaPursuit!.introduce({x:4002,z:-19}))!;
    advance(1);
    const reset = () => { ai.cancelSpecial(boss.id); boss.infected!.specialRecoveryUntil=w.tick;boss.infected!.cooldown=w.tick;boss.infected!.specialCooldowns={};boss.combat!.staggerUntil=w.tick;boss.combat!.statuses=[];boss.infected!.state='chase'; };
    let sequence=10000;
    const hit = (actionId: string, base: number, targetId=boss.id, type:'bullet'|'explosive'='bullet') => w.combat!.damage.apply({attackId:++sequence,actionId,sourceId:1,targetId,origin:{...player.transform},direction:{x:1,z:0},base,multiplier:1,type,knockback:0,stagger:0,permanent:true});
    reset();
    const charge = ai.startSpecial(boss.id,'alpha.charge',{id:1,x:4002,z:-30},{x:4002,z:-19,radius:1,dx:0,dz:-1});
    let weak=0,stun=0,chargeSeen=charge;
    advance(160,()=>{chargeSeen ||= boss.infected!.specialAttack?.move==='alpha.charge';weak=Math.max(weak,boss.infected!.megaWeakTicks??0);stun=Math.max(stun,boss.combat!.staggerUntil-w.tick);});
    check('machinery stops a real charge, exposes the back and stuns for 120 ticks',chargeSeen&&weak>=119&&stun===120,{explicitStart:charge,nativeChargeSeen:chargeSeen,weak,stun,at:{...boss.transform}});
    reset();boss.health.current=boss.health.max*.69;advance(1);boss.infected!.megaWeakTicks=0;
    place(player,boss.transform.x+5,boss.transform.z);boss.transform.yaw=0;
    const armour=hit('weapon.army-mg',100);
    check('70% threshold enters rage and intact plates reduce a frontal bullet to 35%',boss.infected!.megaPhase===2&&Math.abs(armour-35)<1e-6,{phase:boss.infected!.megaPhase,armour});
    reset();w.combat!.status.apply(boss,{kind:'burning',duration:3,maxStacks:1,dps:0,slow:0},1,'weapon.flamethrower',++sequence);
    advance(121);
    const opened=hit('weapon.army-mg',100);
    check('two seconds of flame burn off plates and restore full weapon damage',!!boss.infected!.megaArmourBroken&&opened===100,{burn:boss.infected!.megaBurnTicks,opened});
    const beforeFlash=boss.health.current;boss.infected!.megaStaggerReady=w.tick+120;
    w.combat!.status.apply(boss,{kind:'stunned',duration:3,maxStacks:1,dps:0,slow:0},1,'weapon.flashbang',++sequence);
    const afterFlash=boss.health.current,flashUntil=boss.combat!.staggerUntil;boss.infected!.megaStaggerReady=w.tick;hit('weapon.army-mg',10);
    check('flashbang interrupts for one second despite gun stagger cooldown, without HP damage or a later bullet shortening it',afterFlash===beforeFlash&&flashUntil>=w.tick+60&&boss.combat!.staggerUntil>=flashUntil,{beforeFlash,afterFlash,flashUntil,tick:w.tick,afterBullet:boss.combat!.staggerUntil});
    reset();place(boss,3985,-27);place(player,3990,-25);advance(1);reset();
    const corpseId=ai.spawn('infected.runner',{x:3982.5,z:-27});hit('weapon.rocket-launcher',1000,corpseId,'explosive');advance(180);reset();place(boss,3985,-27);place(player,3990,-25);
    const throwStarted=ai.startSpecial(boss.id,'alpha.grab-throw',{id:1,x:3990,z:-25},{x:3985,z:-27,radius:1,dx:1,dz:0});
    const picked=boss.infected!.specialAttack?.pickup?.objectId;
    let thrown=false,called=false;
    const stop=w.events.on('infected.prop-thrown',e=>{if(e.type==='infected.prop-thrown'&&e.sourceId===boss.id)thrown=true;});
    advance(160);stop();
    check('rage lifts and throws a retained world corpse',throwStarted&&picked===corpseId&&thrown,{throwStarted,picked,corpseId,thrown});
    reset();
    const stopCall=w.events.on('mission.signal',e=>{if(e.type==='mission.signal'&&e.name==='mega-escort-called')called=true;});
    const roar=ai.startSpecial(boss.id,'alpha.roar',{id:1,x:player.transform.x,z:player.transform.z},{x:boss.transform.x,z:boss.transform.z,radius:25,dx:1,dz:0});
    advance(160);stopCall();check('rage roar calls an escort wave through the normal admission gate',roar&&called,{roar,called,next:w.l10Encounters!.state.nextAssaultAt});
    reset();
    for(const other of ai.active)if(other.id!==boss.id&&other.health.current>0){other.health.current=0;ai.down(other,true);}
    place(boss,4002.2,-33);boss.health.current=boss.health.max*.69;
    const gun=w.mountedGun!;place(player,gun.placement.x-.78,gun.placement.z,gun.placement.y+.78);gun.mounted=true;
    let maxY=boss.transform.y;advance(900,()=>{maxY=Math.max(maxY,boss.transform.y);});gun.mounted=false;
    check('the same rage Mega climbs the actual platform stair',maxY>=3.6,{id:boss.id,maxY,at:{...boss.transform}});
    reset();place(boss,3982,-20);place(player,3980,-20);boss.health.current=boss.health.max*.34;advance(1);
    const before=Math.hypot(boss.transform.x-4002,boss.transform.z+27);advance(180);
    const after=Math.hypot(boss.transform.x-4002,boss.transform.z+27);
    check('35% threshold makes the Mega walk toward the console while courier is elsewhere',boss.infected!.megaPhase===3&&after<before-3,{phase:boss.infected!.megaPhase,before,after});
    const phaseHp=m.saveResume().checkpoint.entities.find(e=>e.id===boss.id)!.health.current;
    m.state.counters['charge-ticks']=1234;m.state.states['charge-active']=false;w.combat!.damage.god=false;
    w.combat!.damage.apply({attackId:++sequence,actionId:'infected.claw',sourceId:boss.id,targetId:1,origin:boss.transform,direction:{x:-1,z:0},base:1000,multiplier:1,type:'melee',knockback:0,stagger:0});
    advance(125);w.combat!.damage.god=true;
    const restored=w.megaPursuit!.entity();
    check('a real death restarts the phase with console charge retained',player.health.current>0&&restored?.infected?.megaPhase===3&&restored.health.current===phaseHp&&m.state.counters['charge-ticks']===1234,{hp:player.health.current,bossHp:restored?.health.current,phaseHp,charge:m.state.counters['charge-ticks'],phase:restored?.infected?.megaPhase});
    // Reproduce the high-tier native toy-route landing obstruction exactly.
    const fallen=w.megaPursuit!.entity()!;place(fallen,3995.8188,-33.1420,3.78);place(player,3994.5905,-34.4592,3.785);hit('weapon.army-mg',100000,fallen.id);advance(1);
    m.state.counters['charge-ticks']=3600;m.state.states['charge-active']=true;
    while(m.state.steps.release.status!=='active')m.completeObjective();
    const bot=new LevelTenBot(w);let lowest=player.transform.y;
    for(let i=0;i<600&&!m.state.states['cure-released'];i++){followTenFrustum(w);w.applyInput(bot.sample(),'keyboard');w.update();lowest=Math.min(lowest,player.transform.y);}
    check('ordinary inputs descend past a dead Mega on the landing and release the cure',!solidLargeCorpse(fallen)&&lowest<1&&m.state.states['cure-released'],{radius:actorRadius(fallen),solid:solidLargeCorpse(fallen),lowest,released:m.state.states['cure-released'],at:{...player.transform}});
  } catch(error){check('mechanics fixtures execute',false,String(error));}
  finally{w.dispose();}
}
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify({sourceHash,method:'Controlled production-world mechanics fixtures with explicit position, objective, HP and timer setup; no claims of native route delivery.',checks},null,2));
console.log(JSON.stringify(checks.map(({quality,name,pass})=>({quality,name,pass})),null,2));
if(checks.some(c=>!c.pass))process.exitCode=1;
