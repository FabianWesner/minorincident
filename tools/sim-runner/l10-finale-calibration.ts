/** One seed, ordinary inputs after the rocket checkpoint fixture. No idle timing padding. */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadLevel } from './levels';
import { Walker } from '../../src/debug/bot/Walker';
import { cure } from '../../src/levels/L10/district';
import { emptyInput } from '../../src/input/InputFrame';
import { cureFinaleText } from '../../src/sim/missions/LevelTenFinale';
import type { EntitySnapshot } from '../../src/sim/world/types';
export async function runFinaleCalibration(tier: 'high' | 'low' = 'high') {
  const w = await loadLevel('L10', 32), m = w.missions!, walker = new Walker();
  try {
    w.chunks!.setQuality(tier);
    m.loadCheckpoint('cure-corridor');
    const p = w.entities.get(1)!;
    const checkpointAt = cure.anchors['cure-corridor'];
    Object.assign(p.transform, { x: checkpointAt[0], z: checkpointAt[1] });
    w.physics.playerBody!.setTranslation(p.transform, true); w.chunks!.update();
    // Authored checkpoint initial state; the boss then travels continuously with its stable ID.
    const boss = w.megaPursuit!; const bossId = boss.introduce({ x: p.transform.x - 80, z: p.transform.z });
    let bossIdChanged = false, bossStepMaxM = 0, bossApproachStepMaxM = 0;
    let bossStepPeak: { tick: number; mode: string; distance: number; hp: number; lastDamage: number | null } | null = null;
    const route = cure.regions.slice(5).flatMap(r => r.route).filter(([x]) => x >= p.transform.x);
    let waypoint = 0, peak = 0, arrival: number | null = null, activation: number | null = null, rocketHits = 0;
    let activationBoss: { x: number; z: number; distanceM: number } | null = null;
    let fullChargeBossGate = false, bossGatePursuitM = 0;
    let fullChargeBossGateText: string | null = null;
    const timeline: { id: string; seconds: number }[] = [];
    const regions: Record<string, { ticks: number; moving: number; pressure: number; fireIntent: number; charge: number; bossGate: number; quiet: number; metres: number; shots: number; kills: number }> = {};
    const region = () => p.transform.x < cure.anchors['cure-complex'][0] ? 'destroyed-corridor' : 'dispersal-complex';
    const telemetry = () => regions[region()] ??= { ticks: 0, moving: 0, pressure: 0, fireIntent: 0, charge: 0, bossGate: 0, quiet: 0, metres: 0, shots: 0, kills: 0 };
    w.events.on('objective.completed', e => { if (e.type === 'objective.completed') timeline.push({ id: e.id, seconds: w.tick / 60 }); });
    w.events.on('combat.hit', e => { if (e.type === 'combat.hit' && e.targetId === boss.state.id && e.actionId === 'weapon.rocket-launcher' && e.amount === 300) rocketHits++; });
    w.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1) telemetry().shots++; });
    w.events.on('combat.kill', e => { if (e.type === 'combat.kill' && e.sourceId === 1) telemetry().kills++; });
    const start = w.tick;
    for (let i = 0; i < 20 * 60 * 60 && !m.state.states['cure-released'] && p.health.current > 0; i++) {
      const f = emptyInput(), active = m.def.steps.find(s => m.state.steps[s.id].status === 'active');
      if (!active) break;
      // The separate boss objective points at the pursuer for HUD guidance.
      // This arrival fixture defends the console while that boss approaches;
      // chasing its moving marker would shorten the measured arrival and expose the courier.
      const anchor = m.def.anchors[active.id === 'mega' ? 'cure-console' : active.anchor];
      let goal = anchor;
      if (active.id === 'dispersal-complex' && waypoint < route.length) {
        const [x,z] = route[waypoint]; goal = { x,z,radius: 2 }; if (Math.hypot(p.transform.x-x,p.transform.z-z)<2) waypoint++;
      }
      f.move = walker.step(w, goal, active.id === 'hold' ? 1 : .8, `${active.id}-${waypoint}`) ?? f.move;
      f.interact = i % 60 < 45 && Math.hypot(p.transform.x-anchor.x,p.transform.z-anchor.z) <= anchor.radius;
      // Only the nearest visible enemy drives the inputs. Preserve stable-sort
      // ties while avoiding LOS queries for candidates farther than that enemy.
      let target: EntitySnapshot | undefined, nearestM = 30;
      for (const e of w.infected!.active) {
        if (e.health.current <= 0) continue;
        const d = Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z);
        if (d < nearestM && w.infected!.nav.visible(p.transform, e.transform, 0)) { target = e; nearestM = d; }
      }
      if (target) {
        const slot = p.weapons!.RIGHT.rack.findIndex(s => s.id === 'weapon.rocket-launcher');
        f.selectedSlot = { side: 'RIGHT', index: slot }; f.aimSource = 'keyboard';
        const dx=target.transform.x-p.transform.x,dz=target.transform.z-p.transform.z,d=Math.hypot(dx,dz);
        f.aim={x:dx/d,z:dz/d}; f.aimPoint={x:target.transform.x,z:target.transform.z}; f.right.held=true;
        if ((active.id === 'hold' || active.id === 'mega') && d < 10) f.move = walker.step(w, { x: 4002 + (i % 600 < 300 ? 18 : -18), z: -23 }, 1, 'dodge') ?? f.move;
      }
      const x = p.transform.x, z = p.transform.z, row = telemetry();
      const beforeBoss = { ...boss.entity()!.transform };
      w.applyInput(f,'keyboard'); w.update(); peak=Math.max(peak,w.infected!.director.count);
      bossIdChanged ||= boss.state.id !== bossId;
      const bossStep = Math.hypot(boss.entity()!.transform.x - beforeBoss.x, boss.entity()!.transform.z - beforeBoss.z);
      if (bossStep > bossStepMaxM) { bossStepMaxM = bossStep; bossStepPeak = { tick: w.tick, mode: boss.state.mode, distance: boss.distance(), hp: boss.entity()!.health.current, lastDamage: boss.state.lastDamage?.tick ?? null }; }
      // Route continuity ends at arena arrival; later rocket reactions and corpse
      // settling are combat/physics displacement, rather than pursuit travel.
      if (arrival === null) bossApproachStepMaxM = Math.max(bossApproachStepMaxM, bossStep);
      const metres = Math.hypot(p.transform.x - x, p.transform.z - z);
      row.ticks++; row.metres += metres; if (metres > .0001) row.moving++;
      if (target) row.pressure++; if (f.right.held) row.fireIntent++;
      if (m.state.states['charge-active'] && m.state.steps.hold.status === 'active') row.charge++;
      if (m.state.counters['charge-ticks'] === 3600 && boss.alive()) {
        row.bossGate++; fullChargeBossGate = true; bossGatePursuitM += bossStep;
        fullChargeBossGateText ??= cureFinaleText(m);
      }
      if (metres <= .0001 && !target && !f.right.held && !f.interact) row.quiet++;
      if (activation === null && m.state.states['charge-active']) {
        activation=w.tick/60;
        const t = boss.entity()!.transform; activationBoss = { x: t.x, z: t.z, distanceM: boss.distance() };
      }
      if (activation !== null && arrival === null && boss.distance()<=25) arrival=w.tick/60-activation;
    }
    const activity = Object.fromEntries(Object.entries(regions).map(([id, r]) => [id, { elapsedSeconds: r.ticks / 60, movingSeconds: r.moving / 60, pressureSeconds: r.pressure / 60, fireIntentSeconds: r.fireIntent / 60, holdSeconds: r.charge / 60, fullChargeBossGateSeconds: r.bossGate / 60, quietSeconds: r.quiet / 60, metres: r.metres, shots: r.shots, kills: r.kills }]));
    const result={seed:32,tier,bossId,bossIdChanged,bossStepMaxM,bossStepPeak,bossApproachStepMaxM,checkpoint:'cure-corridor',released:!!m.state.states['cure-released'],seconds:(w.tick-start)/60,hp:p.health.current,deaths:m.state.stats.deaths,peak,rocketHits,activation,activationBoss,fullChargeBossGate,fullChargeBossGateText,bossGatePursuitM,arrival,timeline,activity,activityCategoriesOverlap:true,active:m.def.steps.filter(s=>m.state.steps[s.id].status==='active').map(s=>s.id),player:p.transform,boss:boss.snapshot(),expectedRemainingMinutes:[13.5,18.5],withinRemainingBand:(w.tick-start)/60>=810 && (w.tick-start)/60<=1110};
    mkdirSync('test-results/epics/E32/E3',{recursive:true}); writeFileSync(`test-results/epics/E32/E3/calibration-seed-32${tier === 'low' ? '-low' : ''}.json`,JSON.stringify(result,null,2));
    return result;
  } finally { w.dispose(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await runFinaleCalibration()));
