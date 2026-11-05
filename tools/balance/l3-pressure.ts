import { mkdirSync, writeFileSync } from 'node:fs';
import { l3 } from '../../src/data/l3';
import { loadL3, runL3, followFrustum, inL3GameView } from '../sim-runner/l3Bots';
import { emptyInput } from '../../src/input/InputFrame';
const tag = process.argv[2] ?? 'after';
const dir = 'test-results/epics/E21/horde';
mkdirSync(dir, { recursive: true });
const { world: w, mission: m } = await loadL3(1);
runL3(w, m, 'complete', { stopWhen: mm => !!mm.state.l3!.attackAt });
const alarmTick = w.tick;
let firstVisible = -1, firstContact = -1, peak = 0, maxLosses = 0;
const grabbed = new Set<number>();
const grabsByWave = [new Set<number>(), new Set<number>(), new Set<number>()];
w.events.on('civilian.grabbed', e => { if (e.type === 'civilian.grabbed' && m.state.l3!.officerIds.includes(e.targetId)) { firstContact = firstContact < 0 ? w.tick : firstContact; grabbed.add(e.targetId); const wave=m.state.l3!.waves.find(q=>q.id===e.sourceId)?.wave; if(wave!==undefined)grabsByWave[wave].add(e.targetId); } });
const reached = [new Set<number>(), new Set<number>(), new Set<number>()];
w.events.on('combat.hit', e => { if (e.type === 'combat.hit' && m.state.l3!.officerIds.includes(e.targetId) && firstContact < 0) firstContact = w.tick; });
for (let i = 0; i < 105 * 60; i++) {
  followFrustum(w); w.applyInput(emptyInput(), 'keyboard'); w.update();
  const s = m.state.l3!; peak = Math.max(peak, w.infected!.director.count);
  maxLosses = Math.max(maxLosses,s.officerIds.filter(id=>{const e=w.entities.get(id);return !e?.civilian?.ally||e.health.current<=0||e.infection;}).length);
  for (const q of s.waves) { const e = w.entities.get(q.id); if (!e || e.health.current <= 0) continue;
    if (firstVisible < 0 && !w.infected!.director.offscreen(e.transform)) firstVisible = w.tick;
    if (s.officerIds.some(id => { const a = w.entities.get(id); return a?.civilian?.ally && Math.hypot(a.transform.x-e.transform.x,a.transform.z-e.transform.z)<3; })) reached[q.wave].add(q.id);
  }
}
const s = m.state.l3!;
const idle = { firstVisibleS: firstVisible < 0 ? null : (firstVisible-alarmTick)/60, firstContactS: firstContact < 0 ? null : (firstContact-alarmTick)/60, peak, maxLosses, grabbed: grabbed.size, grabsByWave: grabsByWave.map(s=>s.size), deaths:m.state.stats.deaths, reached: reached.map(a=>a.size), fallbackS:(s.fallbackAt-s.attackAt)/60, losses:s.officerIds.filter(id=>{const e=w.entities.get(id);return !e?.civilian?.ally || e.health.current<=0 || e.infection;}).length, playerHP:w.entities.get(1)!.health.current, spawned:s.waves.filter(q=>q.id).length };
w.dispose();
const run = await loadL3(1); const rw = run.world, rm = run.mission;
let firstArmyFire = 0, lastArmyFire = 0, maxAlive = 0, firstVisibleArmyFire = 0, lastVisibleArmyFire = 0, activeFightTicks = 0, lastVisiblePursuit = 0;
const reach = new Set<number>(), line = new Set<number>(); let maxX = 0; const surges: number[] = [];
const kills: Record<string, number> = {};
rw.events.on('combat.kill', e => { if (e.type === 'combat.kill' && rw.entities.get(1)!.transform.x >= 174 && e.position.x > 150) { const src = rm.state.l3!.soldierIds.includes(e.sourceId) ? 'army' : rm.state.l3!.officerIds.includes(e.sourceId) ? 'police' : e.sourceId === 1 ? 'player' : 'other'; const k = `${Math.floor(e.position.x / 2) * 2}:${src}`; kills[k] = (kills[k] ?? 0) + 1; } });
rw.events.on('l3.surge', e => { if (e.type === 'l3.surge') surges.push(e.count); });
const barrierX = l3.finale.barrierX;
rw.events.on('ally.attack', e => { if (e.type==='ally.attack' && rm.state.l3!.soldierIds.includes(e.sourceId)) { firstArmyFire ||= rw.tick; lastArmyFire=rw.tick; const target=rw.entities.get(e.targetId); if(rw.entities.get(1)!.transform.x>=174 && target && inL3GameView(rw,target.transform)){firstVisibleArmyFire ||= rw.tick;lastVisibleArmyFire=rw.tick;} } });
const samples: unknown[] = [];
const observe = () => {
  maxAlive=Math.max(maxAlive,rw.infected!.director.count);
  const s=rm.state.l3!;
  if(rw.entities.get(1)!.transform.x>=174) {
    if(rw.tick%6===0 && rw.infected!.active.some(e=>e.health.current>0 && inL3GameView(rw,e.transform))) {activeFightTicks+=6;lastVisiblePursuit=rw.tick;}
    for(const e of rw.infected!.active) if(e.health.current>0 && e.transform.y<2.5) maxX=Math.max(maxX,e.transform.x);
    for(const e of rw.infected!.active) if(e.health.current>0 && e.transform.x>=barrierX-3 && e.transform.y<2.5) line.add(e.id);
    for(const e of rw.infected!.active) if(e.health.current>0 && [...s.officerIds,...s.soldierIds].some(id=>{const a=rw.entities.get(id);return a?.civilian?.ally && Math.abs(e.transform.y-a.transform.y)<2 && Math.hypot(e.transform.x-a.transform.x,e.transform.z-a.transform.z)<3;})) reach.add(e.id);
    if(rw.tick%600===0) samples.push({tick:rw.tick,hist:Object.entries(rw.infected!.active.filter(e=>e.health.current>0).reduce((h,e)=>{const k=`${Math.floor(e.transform.x/10)*10}:${e.infected!.l1?.mode}`;h[k]=(h[k]??0)+1;return h;},{} as Record<string,number>)).sort(),p:{...rw.entities.get(1)!.transform},alive:rw.infected!.director.count,packs:[...(s.finalePacks??[])],closed:s.barrierClosedAt,foes:rw.infected!.active.filter(e=>e.health.current>0 && Math.hypot(e.transform.x-rw.entities.get(1)!.transform.x,e.transform.z-rw.entities.get(1)!.transform.z)<30).map(e=>({id:e.id,p:{...e.transform},visible:inL3GameView(rw,e.transform),mode:e.infected!.l1?.mode})),police:s.officerIds.map(id=>{const a=rw.entities.get(id);return {id,x:a?.transform.x,z:a?.transform.z,hp:a?.health.current,human:!!a?.civilian?.ally};})});
  }
  return false;
};
const travel = runL3(rw,rm,'complete',{maxSeconds:500,stopWhen:()=>{observe();return rw.entities.get(1)!.transform.x>=224.5;}});
const idleAt = rw.tick;
const idleStartHP = rw.entities.get(1)!.health.current;
for(let i=0;i<120*60 && rm.state.phase==='playing' && !rm.state.l3!.barrierClosedAt;i++) { observe(); followFrustum(rw); rw.applyInput(emptyInput(),'keyboard');rw.update(); }
const idleFinale = { durationS:(rw.tick-idleAt)/60, startHP:idleStartHP,endHP:rw.entities.get(1)!.health.current, playerShots:rw.events.events(idleAt).filter(e=>e.type==='combat.attack'&&e.sourceId===1).length,closed:rm.state.l3!.barrierClosedAt??0 };
const finish=runL3(rw,rm,'complete',{maxSeconds:120,stopWhen:observe});
const complete={...finish,travel};
const rs=rm.state.l3!;
const finale={firstVisibleArmyFireS:firstVisibleArmyFire/60,lastVisibleArmyFireS:lastVisibleArmyFire/60,visibleFightSpanS:firstVisibleArmyFire?((rs.barrierClosedAt||lastVisibleArmyFire)-firstVisibleArmyFire)/60:null,activeFightS:activeFightTicks/60,lastPursuitBeforeGateS:rs.barrierClosedAt?(rs.barrierClosedAt-lastVisiblePursuit)/60:null,firstArmyFireS:firstArmyFire/60,lastArmyFireS:lastArmyFire/60,durationS:firstArmyFire ? ((rs.barrierClosedAt||lastArmyFire)-firstArmyFire)/60 : null,streamDurationS:rs.finaleAt&&rs.barrierClosedAt?(rs.barrierClosedAt-rs.finaleAt)/60:null,reached:reach.size,lineReached:line.size,maxX,surges,kills:Object.entries(kills).sort(),peak:maxAlive,policeLost:rs.officerIds.filter(id=>{const e=rw.entities.get(id);return !e?.civilian?.ally||e.health.current<=0||e.infection;}).length,soldiersLost:rs.soldierIds.filter(id=>{const e=rw.entities.get(id);return !e?.civilian?.ally||e.health.current<=0||e.infection;}).length,finalPlayer:rw.entities.get(1)!.transform,packs:rs.finalePacks,group:[1,...rs.officerIds,...[...rw.entities.iterate()].filter(e=>e.companion).map(e=>e.id)].map(id=>{const e=rw.entities.get(id);return {id,x:e?.transform.x,z:e?.transform.z,hp:e?.health.current,human:!!e?.civilian?.ally||id===1||!!e?.companion};}),samples};
writeFileSync(`${dir}/${tag}.json`,JSON.stringify({idle,complete,finale,idleFinale},null,2));
console.log(JSON.stringify({tag,idle,idleFinale,complete:{outcome:complete.outcome,time:complete.simSeconds,deaths:complete.deaths,density:complete.density},finale:{...finale,samples:undefined}},null,2));
rw.dispose();
