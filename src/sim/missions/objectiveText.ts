import type { Mission } from './Mission';
import { l3EvacuationText } from './LevelThreeCollapse';
import { cureFinaleText } from './LevelTenFinale';
import { LevelSixSubway } from './LevelSixSubway';
import { l4 } from '../../data/l4';
import { survivorName } from './survivorName';

const clock = (ticks: number) => {
  const seconds = Math.max(0, Math.ceil(ticks / 60));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
/** Both objective HUDs describe the same simulation conditions and deadlines. */
export function objectiveText(mission: Mission, fallback: string): string {
  const s = mission.state, w = mission.world;
  const override = l3EvacuationText(mission) ?? cureFinaleText(mission) ?? LevelSixSubway.text(mission);
  if (override) return override;
  if (s.l4?.phase === 'war') {
    const third = s.l4.director.lines[2];
    const end = Math.min(s.l4.warAt + l4.lineBreak.defenseS * 60, (third.brokeAt || s.l4.turnAt + l4.director.lines[2].dueS * 60) + l4.lineBreak.fallBackS * 60);
    // PO 10-23: the fight is at the wall. An Alpha battering a breach site, then the open breach, name the place.
    const b = s.l4.breaches ?? {}, open = (['west', 'north', 'south'] as const).filter(k => b[k]?.openAt).sort((p, q) => b[q]!.openAt - b[p]!.openAt)[0];
    const coming = (['west', 'north', 'south'] as const).find(k => b[k]?.announcedAt && !b[k]?.openAt);
    const text = open ? `Hold the ${open} breach` : coming ? `Alpha at the ${coming} wall` : fallback;
    return `${text} · ${clock(end - w.tick)} remaining`;
  }
  if (s.l4?.barredAt && s.steps.wait?.status === 'active') return `${fallback} · ${clock(s.l4.barredAt+l4.cellar.battleAfterBarredS*60-w.tick)} remaining`;
  if (s.l6) {
    const l6 = s.l6;
    if (l6.phase === 'shelter') return `${fallback} · rest while you can`;
    if (l6.phase === 'first' || l6.phase === 'fails') return `${fallback} · Retreat in ${clock(l6.breach2At+900-w.tick)}`;
    if (l6.phase === 'retreat') {
      const p = w.entities.get(1)!.transform;
      const gate = l6.gates.find(g => !g.closedAt && Math.hypot(p.x-LevelSixSubway.gateWait(g.x).x,p.z-LevelSixSubway.gateWait(g.x).z)<5);
      if (gate) return `${fallback} · ${mission.l6!.gateStatus(gate.id)}`;
    }
    if (l6.phase === 'exit') {
      const total=l6.survivors.filter(r=>r.status==='out'||r.status==='following').length;
      return `${fallback} · ${l6.survivors.filter(r=>r.status==='out').length}/${total} out`;
    }
  }
  const metro = mission.l5?.metroStatus();
  if (metro) return `${fallback} · ${metro}`;
  if (w.l7Encounters && s.steps.corridor?.status === 'active') {
    const group = w.l7Encounters.corridorGroup(), missing = group.missing[0];
    const name = missing && survivorName(w.entities.get(missing.id)!);
    return `${fallback} · Group ${group.near}/${group.total} nearby${name ? ` · Waiting for ${name}` : ''}`;
  }
  if (mission.def.l8) {
    const zoo=mission.l8!, seated=w.vehicles!.active===zoo.state.carId;
    // PO: the first minute is deliberate false safety with no immediate objective; the marker still shows the vehicle.
    if(!seated&&!zoo.state.breachedAt&&s.steps.escape?.status==='active')return 'Explore the sanctuary · the armored vehicle waits by the exit';
    if(seated&&!zoo.state.breachedAt)return `Waiting for departure · ${Math.max(0,Math.ceil((zoo.state.startedAt+3600-w.tick)/60))} s`;
    if(s.steps.depart?.status==='active') {
      const ids=zoo.passengers(),car=w.vehicles!.cars.get(zoo.state.carId)!.entity.vehicle!;
      const player=w.entities.get(1)!.transform;
      const distance=(id:number)=>{const p=w.entities.get(id)!.transform;return Math.hypot(p.x-player.x,p.z-player.z);};
      const missing=ids.filter(id=>!car.passengers?.some(p=>p.id===id&&p.phase==='seated')).sort((a,b)=>distance(a)-distance(b));
      const names=missing.map(id=>{const e=w.entities.get(id)!;return survivorName(e);});
      const text=seated?fallback:'Return to the armored vehicle and board';
      const waiting=names.length?` · ${names.slice(0,2).join(', ')} missing${names.length>2?` (+${names.length-2} others)`:''}`:'';
      return `${text} · ${ids.length-missing.length}/${ids.length} aboard${waiting}`;
    }
  }
  return fallback;
}
