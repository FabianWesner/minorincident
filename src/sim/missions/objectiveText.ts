import type { Mission } from './Mission';
import { l3EvacuationText } from './LevelThreeCollapse';
import { cureFinaleText } from './LevelTenFinale';
import { LevelSixSubway } from './LevelSixSubway';
import { l4 } from '../../data/l4';
import { l5Survivors } from '../../data/l5';

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
    return `${fallback} · ${clock(end - w.tick)} remaining`;
  }
  if (s.l4?.barredAt && s.steps.wait?.status === 'active') return `${fallback} · ${clock(s.l4.barredAt+l4.cellar.battleAfterBarredS*60-w.tick)} remaining`;
  if (s.l6) {
    const l6 = s.l6;
    if (l6.phase === 'shelter') return `${fallback} · ${clock(l6.breach1At-w.tick)} remaining`;
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
    const name = missing && (l5Survivors.find(s=>s.key===missing.key)?.name ?? `Survivor ${w.entities.get(missing.id)!.civilian!.survivor!.slot+1}`);
    return `${fallback} · Group ${group.near}/${group.total} nearby${name ? ` · Waiting for ${name}` : ''}`;
  }
  if (mission.def.l8 && s.steps.depart?.status === 'active') {
    const ids=mission.l8!.roster(),car=w.vehicles!.cars.get(mission.l8!.state.carId)!.entity.vehicle!;
    const text=w.vehicles!.active===mission.l8!.state.carId?fallback:'Return to the armored vehicle and board';
    return `${text} · ${ids.filter(id=>car.passengers?.some(p=>p.id===id&&p.phase==='seated')).length}/${ids.length} aboard`;
  }
  return fallback;
}
