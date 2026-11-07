import { armyLineVerdict } from '../threat/l3ArmyLine';
import { l3SeedVerdict } from '../threat/l3SeedVote';
import { loadL2, runL2 } from '../../sim-runner/l2Bots';
import { loadL3, runL3 } from '../../sim-runner/l3Bots';
import { l3, l3Street } from '../../../src/data/l3';
import { l3CourierFight } from '../../../src/sim/missions/LevelThreeCollapse';
import type { RunnerLevel } from '../../sim-runner/levels';
import type { Tier } from './probe';

type Add = (id: string, clause: string, value: unknown, target: string, pass: boolean | undefined) => void;
export function l3HumanCensus(humans: { archetype: string; speed: number }[]) {
  const count = humans.length, sprinters = humans.filter(e => e.archetype === 'infected.sprinter').length;
  const regularMax = Math.max(0, ...humans.filter(e => e.archetype === 'infected.runner').map(e => e.speed));
  return { count, sprinters, fraction: count ? sprinters / count : null, regularMax };
}
export const l3HumansPass = (census: ReturnType<typeof l3HumanCensus>) => census.count > 0 && census.regularMax <= 4 && census.fraction! <= .05;

/** PO 11-05: a real squad hit replaces the old kill-share floor; segment kills are not required. */
export function l3SegmentOnePass(report: Pick<ReturnType<typeof runL3>, 's1' | 'outcome' | 'deaths'>): boolean | undefined {
  return report.s1?.completed ? report.s1.officerHits > 0 && report.s1.damage < 100 : undefined;
}

/** Reuse the existing production-input batteries. Reports retain the policy and mortality setting;
 * a protected run never supplies a player-damage or low-health assertion. No renderer assertions. */
export async function batteryFixtures(level: RunnerLevel, tier: Tier, add: Add, observations: Record<string, unknown>): Promise<void> {
  if (level === 'L2') {
    for (const profile of ['no-axe', 'idle', 'aggressive'] as const) {
      const { world, mission } = await loadL2(1, tier);
      try {
        const bench = mission.state.l2!.benchIds.filter(id => !!world.entities.get(id)?.civilian).length;
        const opening = { at: null as { x: number; z: number } | null };
        const roster = { ids: [1, ...mission.state.l2!.crewIds], rideTicks: 0, unseatedTicks: 0, allOutAt: null as number | null, controlAt: null as number | null };
        if (profile === 'no-axe') world.events.on('sim.tick', () => {
          const state = mission.state.l2!;
          if (state.phase === 'ride') {
            roster.rideTicks++;
            if (!state.seated || roster.ids.some(id => !world.entities.get(id)?.hidden)) roster.unseatedTicks++;
          }
          if (!state.arrivedAt) return;
          if (roster.allOutAt === null && roster.ids.every(id => world.entities.get(id)?.hidden === false)) roster.allOutAt = world.tick;
          if (roster.controlAt === null && !state.seated) roster.controlAt = world.tick;
        });
        world.events.on('l2.doorsOpen', () => { opening.at = { ...world.entities.get(1)!.transform }; });
        const report = runL2(world, mission, profile, {
          maxSeconds: profile === 'no-axe' ? 600 : 240,
          god: profile !== 'aggressive', stopAfterPlayerDeath: profile === 'aggressive',
          stopWhen: profile === 'idle' ? m => !!m.state.l2?.doorsOpenAt && world.tick - m.state.l2.doorsOpenAt > 120 * 60 : undefined,
        });
        observations[`L2/${profile}`] = { protected: profile !== 'aggressive', benchIdentityCensus: bench, report };
        if (profile === 'no-axe') {
          add('L2-02', 'native no-axe completion (rack pixels remain open)', { outcome: report.outcome, axe: report.axe, protected: true }, 'complete without collecting axe; rack pixels remain open', !report.axe && report.outcome === 'complete');
          const calm = report.calm;
          add('L2-01', 'calm combat and alarm/crew clocks', calm, '0 infected/combat; alarm20–30s; crew seated≤8s later', calm ? calm.infectedMax === 0 && calm.combatEvents === 0 && calm.alarmS >= 20 && calm.alarmS <= 30 && calm.crewAtTruckS !== null && calm.crewAtTruckS <= 8 : undefined);
          add('L2-01', 'initial bench civilian identity census (seat geometry unreviewed)', bench, '4 bench civilians', bench === 4);
          const ride = report.ride;
          add('L2-03', 'native ride seating and timing', ride, '15–25s; all seated; exits≤4s; control≤0.5s', ride ? ride.passenger && ride.seatedEveryTick && ride.seconds >= 15 && ride.seconds <= 25 && ride.crewExitS >= 0 && ride.crewExitS <= 4 && ride.controlS >= 0 && ride.controlS <= .5 : undefined);
          const arrivedAt = mission.state.l2!.arrivedAt;
          const allOutS = roster.allOutAt === null ? null : (roster.allOutAt - arrivedAt) / 60;
          const controlS = roster.controlAt === null ? null : (roster.controlAt - arrivedAt) / 60;
          add('L2-03', 'native seven-person seated roster and complete exit/control clocks', { ...roster, arrivedAt, allOutS, controlS },
            '7 distinct identities;900–1500 seated ticks;0 unseated ticks;all7 out≤4s;control≤0.5s',
            new Set(roster.ids).size === 7 && roster.rideTicks >= 900 && roster.rideTicks <= 1500 && roster.unseatedTicks === 0 &&
            allOutS !== null && allOutS >= 0 && allOutS <= 4 && controlS !== null && controlS >= 0 && controlS <= .5);
          const doors = report.doors, times = report.timeline;
          const ordered = ['l2.truckArrived', 'l2.crewExit', 'l2.firefightersAtDoors', 'l2.doorsOpen'].map(type => times.find(e => e.type === type)?.t ?? null);
          add('L2-04', 'door order and four-second forcing clock', { order: ordered, nearBefore: doors?.nearBefore }, 'ordered arrival→exit→atDoors→open;4s force;0 infected within40m', ordered.every(t => t !== null) && doors ? ordered.every((t, i) => i === 0 || t! >= ordered[i - 1]!) && Math.abs(ordered[3]! - ordered[2]! - 4) <= 1 / 60 + 1e-6 && doors.nearBefore === 0 : undefined);
          add('L2-05', 'first trapped civilian outside footprint', doors?.firstCivOutS ?? null, '≤1s after doorsOpen; panic pixels remain open', doors?.firstCivOutS !== null && doors?.firstCivOutS !== undefined ? doors.firstCivOutS <= 1 : undefined);
          const counts = new Map<string, number>();
          for (const q of mission.state.l2!.ambush) if (q.id > 0) counts.set(q.door, (counts.get(q.door) ?? 0) + 1);
          const sources = [...counts].map(([door, count]) => {
            const at = mission.def.anchors[door], p = opening.at;
            return { door, count, x: at.x, z: at.z, angle: p ? Math.atan2(at.z - p.z, at.x - p.x) : null };
          });
          const angles = sources.flatMap((a, i) => sources.slice(i + 1).map(b => a.angle === null || b.angle === null ? null : Math.abs(Math.atan2(Math.sin(a.angle - b.angle), Math.cos(a.angle - b.angle))) * 180 / Math.PI));
          add('L2-06', 'native admitted ambush source counts and angular separation', { playerAtOpening: opening.at, sources, angles }, '3 admitted doors×8; pairwise source directions≥60deg from courier at opening; first pixel visibility remains separate', sources.length === 3 && sources.every(s => s.count === 8) && angles.every(a => a !== null && a >= 60));
          add('L2-11', 'native ordinary-route bridge-start population and route singles', { radio: report.radio, scatteredSingleAdmissions: report.scatteredSingleAdmissions },
            '≥25 living escape-area infected;≥3 admitted groups of≥4;≤20% chasing; low≥4 / high≥6 distinct scattered singles along the walk',
            report.radio ? report.radio.escapeArea >= 25 && report.radio.groupsOf4 >= 3 && report.radio.chasingFraction <= .2 && report.scatteredSingleAdmissions.length >= (tier === 'low' ? 4 : 6) : undefined);
          add('L2-15', 'gate close and post-close infected crossings', report.gate, 'close≤1.5s;0 infected cross the gate after closure', report.gate ? report.gate.closeS >= 0 && report.gate.closeS <= 1.5 && report.gate.crossingsAfterClosure.length === 0 : undefined);
        }
        if (profile === 'idle') {
          const at60 = report.infectedAt[60], at120 = report.infectedAt[120];
          add('L2-08', 'idle snowball live infected census', { at60, at120, protected: true }, '≥20 at+60s;≥30 at+120s', at60 && at120 ? at60.all >= 20 && at120.all >= 30 : undefined);
          add('L2-08', 'idle firefighter combat and turns', { hits: report.firefighterHits, turnedBy90: report.firefightersTurnedBy90, turns: report.crewTurns }, '≥1 firefighter hit;≥2 turn by90s', report.firefighterHits >= 1 && report.firefightersTurnedBy90 >= 2);
          add('L2-08', 'idle every firefighter has no story immunity after doors open', report.crewExposure,
            'all6 crew observed alive after opening; zero protected ticks', report.crewExposure.length === 6 && report.crewExposure.every(crew => crew.samples > 0 && crew.protectedTicks === 0));
        }
        if (profile === 'aggressive') {
          add('L2-09', 'mortal aggressive axe lesson death', { axe: report.axe, diedBy120: report.diedBy120, firstDeathS: report.firstDeathS, infectedAt: report.infectedAt, deathsAt: report.deathsAt }, 'player reaches0HP within120s after doors', report.axe ? report.diedBy120 : undefined);
          const early = report.infectedAt[10], late = report.infectedAt[90];
          add('L2-09', 'mortal aggressive live census at10/90s', { early, late, stoppedAtFirstDeath: true }, '+90s live infected≥+10s; missing post-death observation stays open', early && late ? late.all >= early.all : undefined);
        }
      } finally { world.dispose(); }
    }
    // A mortal first-death trial cannot supply the later +90s census. Keep
    // this protected count-only trial distinct; never use it to assert death.
    const { world, mission } = await loadL2(1, tier);
    try {
      const route = { samples: 0, maxDoorDistanceM: 0, outside15mTicks: 0 };
      const doors = ['l2-door-front', 'l2-door-loading'].map(key => mission.def.anchors[key]);
      world.events.on('sim.tick', () => {
        if (!mission.state.l2!.doorsOpenAt) return;
        const player = world.entities.get(1)!;
        const distance = Math.min(...doors.map(door => Math.hypot(player.transform.x - door.x, player.transform.z - door.z)));
        route.samples++; route.maxDoorDistanceM = Math.max(route.maxDoorDistanceM, distance);
        if (distance > 15) route.outside15mTicks++;
      });
      const report = runL2(world, mission, 'aggressive', { god: true, maxSeconds: 180,
        stopWhen: m => !!m.state.l2?.doorsOpenAt && world.tick - m.state.l2.doorsOpenAt > 90 * 60 });
      const early = report.infectedAt[10], late = report.infectedAt[90];
      const qualified = report.axe && report.deaths === 0 && route.samples >= 90 * 60 && !route.outside15mTicks && report.timeline.filter(event => event.type === 'l2.doorsOpen').length === 1;
      observations['L2/aggressive-uninterrupted-census'] = { protected: true, countOnly: true, qualified, route, report };
      add('L2-09', 'uninterrupted protected aggressive live census at10/90s', { early, late, protected: true, countOnly: true, qualified, route, deaths: report.deaths },
        '+90s live infected≥+10s; one unrestarted opening; axe policy stays within15m; protection is count-only', qualified && early && late ? late.all >= early.all : undefined);
      const scatterRoute = observations['L2/no-axe'] as { report: typeof report } | undefined;
      const scattered = scatterRoute?.report.scatteredSingleAdmissions ?? [];
      add('L2-11', 'native axe-route bridge-start escape-area census, groups, chase share and scattered singles', { radio: report.radio, scatteredSingleAdmissions: scattered },
        '≥25 living escape-area infected;≥3 admitted groups of≥4;≤20% chasing; low≥4 / high≥6 distinct scattered singles along the walk',
        report.radio ? report.radio.escapeArea >= 25 && report.radio.groupsOf4 >= 3 && report.radio.chasingFraction <= .2 && scattered.length >= (tier === 'low' ? 4 : 6) : undefined);
    } finally { world.dispose(); }
    for (const opening of ['side', 'alarm'] as const) {
      const { world, mission } = await loadL2(1, tier);
      try {
        const trace: { tick: number; x: number; z: number }[] = [], alarms: { tick: number; sourceId: number; x: number; z: number }[] = [];
        const car = mission.def.anchors['l2-cluster-alarm'];
        world.events.on('sim.tick', () => { if (mission.state.l2!.radioAt && world.tick % 60 === 0) { const p = world.entities.get(1)!.transform; trace.push({ tick: world.tick, x: p.x, z: p.z }); } });
        world.events.on('noise', event => { if (event.type === 'noise' && event.actionId === 'hazard.car-alarm' && Math.hypot(event.position.x - car.x, event.position.z - car.z) <= 4) alarms.push({ tick: event.tick, sourceId: event.sourceId, x: event.position.x, z: event.position.z }); });
        const report = runL2(world, mission, 'complete', { opening, god: false, maxSeconds: 600 });
        const visitedSide = trace.some(p => p.x > 10 && p.x < 82 && p.z > 45);
        const ratio = report.clusterSize ? report.clusterKilled / report.clusterSize : null;
        const qualified = report.outcome === 'complete' && report.deaths === 0 && !!report.cluster && ratio !== null && (opening === 'side' ? visitedSide : alarms.length > 0);
        observations[`L2/${opening}-approach`] = { protected: false, trace, alarms, visitedSide, report };
        add('L2-14', `native ${opening} approach completion and cluster kill share`, { protected: false, qualified, outcome: report.outcome, deaths: report.deaths, cluster: report.cluster, size: report.clusterSize, killed: report.clusterKilled, ratio, visitedSide, alarms }, 'complete without deaths;cluster12–16;kill≤50%;side path visited / actual Elm car alarm emitted', qualified ? report.cluster!.atApproach >= 12 && report.cluster!.atApproach <= 16 && ratio! <= .5 : undefined);
      } finally { world.dispose(); }
    }
  }
  if (level === 'L3') {
    for (const profile of ['complete', 'newbie', 'idle'] as const) {
      const { world, mission } = await loadL3(1, tier);
      try {
        const waveAdmissions: { wave: number; dir: string; source: string; id: number; archetype: string; appearance: string | null }[] = [];
        if (profile === 'complete') {
          const spawnMetadata = new Map<number, { archetype: string; appearance: string | null }>();
          const outbreak = world.npcs!.civilians.outbreak!;
          const originalSpawn = outbreak.spawnPedestrian.bind(outbreak);
          outbreak.spawnPedestrian = (...args: Parameters<typeof originalSpawn>) => {
            const id = originalSpawn(...args), entity = world.entities.get(id);
            if (entity) spawnMetadata.set(id, { archetype: entity.archetype, appearance: entity.appearance?.asset ?? null });
            return id;
          };
          const originalUpdate = world.update.bind(world), recorded = new Set<number>();
          world.update = () => {
            originalUpdate();
            for (const [index, wave] of mission.state.l3!.waves.entries()) {
              if (wave.id <= 0 || recorded.has(index)) continue;
              recorded.add(index);
              const metadata = spawnMetadata.get(wave.id);
              if (metadata) waveAdmissions.push({ wave: wave.wave, dir: wave.dir, source: wave.source ?? wave.dir, id: wave.id, ...metadata });
            }
          };
        }
        const medkits = { blvd: 0, commerce: 0, oak: 0 };
        for (const id of mission.state.l3!.medkitIds) {
          const entity = world.entities.get(id); if (entity) medkits[l3Street(entity.transform.z)]++;
        }
        // Checkpoint restores reuse numeric IDs. Count admission transactions, not a
        // cross-retry ID map that would overwrite earlier regular/sprinter samples.
        const humans: { archetype: string; speed: number }[] = [];
        const inspect = (id: number) => { const e = world.entities.get(id); if (e?.infected && ['infected.runner', 'infected.sprinter'].includes(e.archetype)) humans.push({ archetype: e.archetype, speed: e.infected.speed }); };
        for (const e of world.infected!.active) inspect(e.id);
        const spawn = world.infected!.spawn.bind(world.infected!);
        world.infected!.spawn = (...args: Parameters<typeof spawn>) => { const id = spawn(...args); inspect(id); return id; };
        const fallbackBoundary: { tick: number; firstEligibleTick: number; expectedCause: string; actualCause: string; inside: number; turned: number; elapsed: number }[] = [];
        let delayedFallback = false;
        if (profile === 'idle') {
          const controller = mission.l3! as unknown as { checkFallback(): void };
          const check = controller.checkFallback.bind(controller);
          let attackAt = -1, eligibleAt: number | null = null;
          controller.checkFallback = () => {
            const state = mission.state.l3!;
            if (state.attackAt !== attackAt) { attackAt = state.attackAt; eligibleAt = null; }
            const station = new Set(state.waves.filter(wave => wave.dir === 'station' && wave.id).map(wave => wave.id));
            const yard = l3.map.yard;
            const inside = world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !station.has(e.id) && e.transform.x > yard.x0 && e.transform.x < yard.x1 && e.transform.z > yard.z0 && e.transform.z < yard.z1 && !l3CourierFight(world, e)).length;
            const turned = state.turnedOfficers.length, elapsed = world.tick - state.attackAt;
            const expectedCause = turned >= 3 ? 'turned' : inside >= 8 ? 'inside' : elapsed >= 60 * 60 ? 'time' : '';
            if (expectedCause) eligibleAt ??= world.tick;
            check();
            if (state.phase === 'fallback') fallbackBoundary.push({ tick: world.tick, firstEligibleTick: eligibleAt ?? -1, expectedCause, actualCause: state.fallbackCause, inside, turned, elapsed });
            else if (expectedCause) delayedFallback = true;
          };
        }
        const report = runL3(world, mission, profile, { maxSeconds: profile === 'idle' ? 110 : 600, god: false });
        observations[`L3/${profile}`] = { protected: false, medkits, report };
        if (profile === 'complete') {
          const expected = tier === 'low' ? [15, 30, 50] : [30, 60, 100];
          const waveCensus = expected.map((total, wave) => {
            const admitted = waveAdmissions.filter(entry => entry.wave === wave);
            const byDirection = Object.fromEntries(['river', 'blvd', 'oak', 'commerce', 'station'].map(dir => [dir, admitted.filter(entry => entry.dir === dir).length]));
            const bySpecies = Object.fromEntries([...new Set(admitted.map(entry => entry.archetype))].sort().map(archetype => [archetype, admitted.filter(entry => entry.archetype === archetype).length]));
            const station = admitted.filter(entry => entry.source === 'station');
            const bySource = Object.fromEntries([...new Set(admitted.map(entry => entry.source))].sort().map(source => [source, admitted.filter(entry => entry.source === source).length]));
            return { wave, expected: total, admitted: admitted.length, byDirection, bySource, bySpecies, stationPoliceLook: station.filter(entry => entry.appearance === 'npc.police-officer').length, station: station.length,
              missingAppearance: admitted.filter(entry => entry.appearance === null).length };
          });
          observations['L3/wave-source-species-direction-census'] = waveCensus;
          add('L3-02', 'actual wave source, species, direction and police-look census', waveCensus,
            'each tier wave has exact expected total; all five directions represented; exactly20% station-door admissions retain police look',
            report.outcome === 'complete' ? waveCensus.every(row => row.admitted === row.expected && Object.values(row.byDirection).every(count => count > 0) && row.station === row.expected / 5 && row.stationPoliceLook === row.station && row.missingAppearance === 0) : undefined);
          const census = l3HumanCensus(humans);
          add('L3-09', 'native L3 human speed and admitted sprinter fraction', { ...census, outcome: report.outcome, counting: 'spawn transactions; checkpoint-reused IDs are separate admissions' }, 'regular≤4m/s; sprinters≤5% of actual admissions', census.regularMax > 4 ? false : census.count && report.outcome === 'complete' ? l3HumansPass(census) : undefined);
          const density = report.density;
          add('L3-08', 'authored segment populations before admission/death relief', density.prepopulated, '250/625/1000 each±20%; these are pending population slots, not simultaneous live entities', density.prepopulated.every(n => n > 0) ? density.prepopulated.every((n, i) => Math.abs(n - [250, 625, 1000][i]) <= [250, 625, 1000][i] * .2) : undefined);
          // fix66-a: one pushable bag shifts the squad's losses between seeds, so the "<= 2 at the army line" clause is measured on
          // three seeds (1 = the run above, 2 and 3 = extra complete runs) and passes when at least two of the three agree (median).
          const seedRuns: { seed: number; outcome: string; deaths: number; atFallback: number | null; atCheckpoint: number | null; segmentEnds: number[]; losses: { cause: string }[] }[] = [];
          const measurementRuns = [{ seed: 1, report }];
          const squadRow = (seed: number, r: typeof report) => ({ seed, outcome: r.outcome, deaths: r.deaths, atFallback: r.squad?.atFallback ?? null, atCheckpoint: r.squad?.atCheckpoint ?? null, segmentEnds: r.squad?.segmentEnds ?? [], losses: r.squad?.losses ?? [] });
          seedRuns.push(squadRow(1, report));
          for (const seed of [2, 3]) {
            const extra = await loadL3(seed, tier);
            try {
              const extraReport = runL3(extra.world, extra.mission, 'complete', { seed, maxSeconds: 600, god: false });
              measurementRuns.push({ seed, report: extraReport }); seedRuns.push(squadRow(seed, extraReport));
            } finally { extra.world.dispose(); }
          }
          observations['L3/squad-3-seeds'] = seedRuns;
          const valid = (r: typeof seedRuns[number]) => r.outcome === 'complete' && r.atCheckpoint !== null && r.atCheckpoint >= 0;   // a death only restores the checkpoint; it is reported per seed
          const seedOk = (r: typeof seedRuns[number]) => r.atFallback !== null && r.atFallback >= 3 && r.atFallback <= 4 && r.segmentEnds.every((n, i, a) => n >= 0 && n <= (i ? a[i - 1] : r.atFallback!)) && r.losses.every(loss => ['bite', 'kill', 'separated'].includes(loss.cause));
          const army = armyLineVerdict(seedRuns.map(r => ({ seed: r.seed, valid: valid(r), army: r.atCheckpoint })));
          const armyOk = army.within, measured = army.measured;
          add('L3-06', 'native squad cardinality and loss causes (formation/teleport review open)', { seeds: seedRuns.map(r => ({ seed: r.seed, outcome: r.outcome, deaths: r.deaths, atFallback: r.atFallback, atCheckpoint: r.atCheckpoint, segmentEnds: r.segmentEnds, lossCauses: r.losses.map(l => l.cause) })), atArmyAtMost2: `${armyOk}/${measured}` }, 'forms3–4;nonincreasing;≤2 atcheckpoint;loss causes bite/kill/separation (three seeds, at least two agree on the army line)', army.pass === undefined ? undefined : seedRuns.filter(valid).every(seedOk) && army.pass);
          const s1Votes = measurementRuns.map(({ seed, report: r }) => ({ seed, valid: r.outcome === 'complete' && !!r.s1?.completed, pass: r.s1?.completed ? r.s1.officerHits > 0 && r.s1.damage < 100 : null }));
          const s1Vote = l3SeedVerdict(s1Votes);
          add('L3-07', 'mortal segment1 officers land hits and player damage', { seeds: measurementRuns.map(({ seed, report: r }) => ({ seed, outcome: r.outcome, ...r.s1, deaths: r.deaths })), vote: `${s1Vote.within}/${s1Vote.measured}` }, 'officers land at least one hit and player damage<100HP; 2 of 3 valid seeds pass', s1Vote.pass);
          const densityVotes = measurementRuns.map(({ seed, report: r }) => {
            const d = r.density, pass = r.outcome === 'complete' ? d.near30[0] < d.near30[1] && d.near30[1] < d.near30[2] && d.maxConcurrent <= (tier === 'low' ? 100 : 200) : null;
            return { seed, valid: r.outcome === 'complete', pass, density: d };
          });
          const densityVote = l3SeedVerdict(densityVotes);
          add('L3-08', 'median live within30m by traversed segment and concurrent cap', { seeds: densityVotes.map(({ seed, density }) => ({ seed, ...density })), vote: `${densityVote.within}/${densityVote.measured}` }, `medianS1<S2<S3;max≤${tier === 'low' ? 100 : 200}; 2 of 3 valid seeds pass`, densityVote.pass);
          const followRange = report.squad?.followRange ?? [];
          add('L3-06', 'calm squad following distance by member', followRange, 'every sampled living officer follows 3–6 m from the courier outside combat', report.squad && report.outcome === 'complete' && followRange.length > 0 ? followRange.every(member => member.samples > 0 && member.within3to6 === member.samples) : undefined);
          add('L3-11', 'initial authored medkit entities by street', medkits, '≥2 perstreet;≥7total', Object.values(medkits).every(n => n >= 2) && Object.values(medkits).reduce((a, b) => a + b, 0) >= 7);
          add('L3-01', 'actual first handgun acquisition clock', report.handgunS, '≤40s', report.handgunS !== null ? report.handgunS <= 40 : undefined);
        }
        if (profile === 'newbie') {
          const newbieSeeds = [{ seed: 1, outcome: report.outcome, share: report.lowHpShare }];
          for (const seed of [2, 3]) {
            const extra = await loadL3(seed, tier);
            try {
              const r = runL3(extra.world, extra.mission, 'newbie', { seed, maxSeconds: 600, god: false });
              newbieSeeds.push({ seed, outcome: r.outcome, share: r.lowHpShare });
            } finally { extra.world.dispose(); }
          }
          const vote = l3SeedVerdict(newbieSeeds.map(row => ({ seed: row.seed, valid: row.outcome === 'complete', pass: row.outcome === 'complete' ? row.share <= .1 : null })));
          add('L3-11', 'mortal newbie time below20percent HP', { seeds: newbieSeeds, vote: `${vote.within}/${vote.measured}`, deaths: report.deaths, simulatedSeconds: report.simSeconds }, '≤10% of alive samples; fullroute completed; 2 of 3 valid seeds pass', vote.pass);
        }
        if (profile === 'idle') {
          const attack = report.attack;
          observations['L3/fallback-boundary'] = { fallbackBoundary, delayedFallback };
          add('L3-04', 'exact first-of fallback boundary and cause', { fallbackBoundary, delayedFallback }, 'first eligible tick; priority: 3 turned, 8 inside, 60 seconds; no delayed fallback', fallbackBoundary.length ? !delayedFallback && fallbackBoundary.every(row => row.tick === row.firstEligibleTick && row.actualCause === row.expectedCause) : undefined);
          add('L3-04', 'idle fallback deadline and officer identity/uniform', attack, 'fallback≤60s afterattack;≥1 officer turns;uniform retained', attack && attack.fallbackAfterS >= 0 ? attack.fallbackAfterS <= 60 + 1 / 60 && attack.turnedDuring >= 1 && attack.sameLook : undefined);
        }
      } finally { world.dispose(); }
    }
  }
}
