import { cureEscapeGaps, cureHangar, cureHangarConversation, insideCureHangar } from '../../data/l10Story';
import { cure } from '../../levels/L10/district';
import { allyState } from '../outbreak/Allies';
import { l4 } from '../../data/l4';
import type { EntitySnapshot } from '../world/types';
import type { Mission } from './Mission';
import { cureFinaleCheckpoints } from '../../levels/L10/mission';
import { cureEncounterSlots, curePaceEncounters, cureWeaponPickups } from '../../levels/L10/encounters';

/** Exact scripted dialogue, continuity and the safe-hangar cast. All progress lives in the mission snapshot. */
export class LevelTenStory {
  private previous: { x: number; z: number };
  constructor(private readonly mission: Mission) { this.previous = { ...mission.world.entities.get(1)!.transform }; }
  private savedSam(): EntitySnapshot | undefined {
    const save = this.mission.world.progression?.campaign;
    const research = save?.crossingHandover?.researchCompanion;
    if (research) return research.civilian?.survivor?.key === 'sam' && research.health.current > 0 && !research.infection && !research.infected ? research : undefined;
    const roster = save?.crossingHandover?.shelteredPassengers ?? save?.results?.L8?.escapedSurvivors ?? save?.results?.L7?.escapedSurvivors ?? [];
    return roster.find(e => e.civilian?.survivor?.key === 'sam' && e.health.current > 0 && !e.infection && !e.infected);
  }
  private say(id: string, duration = 300): void {
    const { state, world } = this.mission;
    this.mission.radio(!state.states['sam-alive'] && ['L10.farmstead', 'L10.hide-gap', 'L10.armory', 'L10.sam-coming', 'L10.sam-delivery'].includes(id) ? `${id}.reyes` : id);
    if (state.subtitle) state.subtitle.until = world.tick + duration;
  }
  update(): void {
    const { state, world } = this.mission, p = world.entities.get(1)!;
    if (state.phase !== 'playing' || p.health.current <= 0 || state.states['cure-released']) return;
    const mega = world.megaPursuit?.entity();
    // The reveal is keyed to the first actual camera sighting, not the offscreen spawn.
    // Its complete/duration flags live in MissionState, so later checkpoint restores cannot replay it.
    if (!state.states['mega-reveal-seen'] && mega && mega.health.current > 0 && !mega.infected?.hidden
      && Math.hypot(mega.transform.x - p.transform.x, mega.transform.z - p.transform.z) <= 40
      && world.infected?.director.inFrame(mega.transform, 1, true)) {
      state.states['mega-reveal-seen'] = true;
      state.states['mega-reveal-active'] = true;
      state.counters['mega-reveal-ticks'] = 0;
      this.say('L10.mega-roar', 120);
      world.events.emit({ type: 'mega.cue', tick: world.tick, sourceId: mega.id, kind: 'roar', band: world.megaPursuit!.band()! });
    }
    if (state.states['mega-reveal-active']) {
      const elapsed = ++state.counters['mega-reveal-ticks'];
      if (elapsed === 120) this.say('L10.mega-identity', 180);
      if (elapsed >= 300) state.states['mega-reveal-active'] = false;
    }
    if (!state.states['story-initialized']) {
      state.states['story-initialized'] = true;
      state.states['sam-alive'] = !!this.savedSam();
      this.say('L10.farmstead', 360);
    }
    for (const find of cureWeaponPickups) if ([...(p.weapons?.LEFT.rack ?? []), ...(p.weapons?.RIGHT.rack ?? [])].some(slot => slot.id === find.action)) state.states[`found-${find.id}`] = true;
    // Checkpoints follow the region crossed, independently of the story objective and optional weapon finds.
    for (let i = 1; i <= 4; i++) if (state.counters['story-region'] < i && p.transform.x >= cure.regions[i].envelope[0][0]) {
      state.counters['story-region'] = i;
      this.mission.requestCheckpoint(cure.regions[i].checkpoint);
    }
    this.previous = { x: p.transform.x, z: p.transform.z };
    // The finale road uses four authored recovery points. A named point is
    // committed only after its set-piece cohort has been admitted and cleared.
    const setPieces = [
      { flag: 'l10-gate-checkpoint', x: 3030, group: 'setpiece-quarantine-gate', id: cureFinaleCheckpoints[0] },
      { flag: 'l10-convoy-checkpoint', x: 3290, group: 'setpiece-burning-convoy', id: cureFinaleCheckpoints[1] },
      { flag: 'l10-hospital-checkpoint', x: 3530, group: 'setpiece-field-hospital', id: cureFinaleCheckpoints[2] },
    ];
    for (const beat of setPieces) {
      if (state.states[beat.flag] || p.transform.x < beat.x) continue;
      const group = curePaceEncounters.find(encounter => encounter.id === beat.group)!;
      const spawned = world.l10Encounters?.state.spawned ?? {};
      // Admission is paced in waves. A temporary lull between waves must not
      // commit the recovery point while members are still waiting to arrive.
      const slots = cureEncounterSlots(group, world.infected!.director.tier);
      if (slots.some(slot => spawned[`${slot.key}:0`] === undefined)) continue;
      // A downed cohort has lost the fight even if its members may later
      // recover. Their bodies and recovery timers remain in the world.
      if (slots.some(slot => (world.entities.get(spawned[`${slot.key}:0`])?.health.current ?? 0) > 0)) continue;
      state.states[beat.flag] = true;
      this.mission.requestCheckpoint(beat.id);
    }
    if (!state.states['hangar-radio'] && p.transform.x >= 2300) { state.states['hangar-radio'] = true; this.say('L10.armory'); }
    if (!state.states['gap-hint'] && cureEscapeGaps.some(gap => Math.hypot(p.transform.x - gap.x, p.transform.z - gap.z) < 5)) { state.states['gap-hint'] = true; this.say('L10.hide-gap'); }
    const finaleLines: readonly [number, string][] = [
      [2750, 'L10.finale-0'], [2800, 'L10.finale-1'], [3010, 'L10.finale-2'],
      [3076, 'L10.finale-3'], [3150, 'L10.finale-4'], [3260, 'L10.finale-5'],
      [3340, 'L10.finale-6'], [3390, 'L10.finale-7'], [3502, 'L10.finale-8'], [3550, 'L10.finale-9'],
    ];
    const nextFinaleLine = finaleLines.findIndex(([x], index) => !state.states[`l10-finale-beat-${index}`] && p.transform.x >= x);
    if (nextFinaleLine >= 0) {
      const [x, id] = finaleLines[nextFinaleLine];
      const index = nextFinaleLine;
      const key = `l10-finale-beat-${index}`;
      if (!state.states[key] && p.transform.x >= x) {
        state.states[key] = true;
        if (index === 2) state.counters['l10-reyes-loop-ticks'] = world.tick + 360;
        this.say(id, 300);
      }
    }
    // Reyes's handset repeats while the courier is within range, just as the
    // abandoned field radio was recorded; this remains a captioned, moving
    // radio cue and does not take control of the player.
    if (p.transform.x >= 3010 && p.transform.x < 3076 && world.tick >= state.counters['l10-reyes-loop-ticks']) {
      state.states['l10-finale-beat-2'] = true;
      state.counters['l10-reyes-loop-ticks'] = world.tick + 360;
      this.say('L10.finale-2', 240);
    }
    // Older saves infer this one-shot in the save migration. During live play,
    // keep retrying until the authored throw starts; passing the underpass must
    // never silently count as a successful spectacle.
    if (state.states['l10-finale-beat-6'] && !state.states['l10-overpass-mega'] && p.transform.x >= 3340 && p.transform.x < 3380) {
      const pursuit = world.megaPursuit;
      const id = pursuit?.state.id ? pursuit.state.id : pursuit?.introduce({ x: 3330, z: 111 });
      const alpha = id ? world.entities.get(id) : undefined;
      if (alpha?.infected) {
        // Stage once in the courier's current camera view. Repeating this setup
        // every tick cancels the telegraph and continually restarts the Alpha's
        // special cooldown before the throw can resolve.
        if (!state.states['l10-overpass-mega-staged']) {
          const at = { x: p.transform.x - 2.7, z: p.transform.z };
          alpha.transform.x = at.x; alpha.transform.z = at.z;
          alpha.transform.y = (world.districts?.groundHeight(at.x, at.z) ?? 0) + .7;
          alpha.infected.hidden = false;
          world.spatial?.set(alpha.id, at.x, at.z);
          alpha.infected.megaPhase = 2;
          alpha.infected.specialAttack = undefined;
          alpha.infected.state = 'chase';
          alpha.infected.until = 0;
          if (alpha.combat) alpha.combat.attacking = false;
          alpha.infected.specialCooldowns ??= {};
          alpha.infected.specialCooldowns['alpha.grab-throw'] = world.tick;
          alpha.infected.specialRecoveryUntil = 0;
          alpha.infected.cooldown = world.tick;
          alpha.infected.alphaSpecialStarted = world.tick - 180;
          if (alpha.combat) { alpha.combat.attacking = false; alpha.combat.staggerUntil = world.tick; alpha.combat.statuses.length = 0; }
          state.states['l10-overpass-mega-staged'] = true;
        }
        const dx = p.transform.x - alpha.transform.x, dz = p.transform.z - alpha.transform.z, distance = Math.hypot(dx, dz) || 1;
        const thrown = world.infected!.startSpecial(alpha.id, 'alpha.grab-throw', { id: p.id, x: p.transform.x, z: p.transform.z }, {
          x: alpha.transform.x, z: alpha.transform.z, radius: 4, dx: dx / distance, dz: dz / distance,
        });
        if (!thrown) return;
        state.counters['l10-overpass-mega-attack'] = alpha.infected.specialAttack?.attackId ?? -1;
        state.states['l10-overpass-mega'] = true;
        world.l10Encounters?.callWave();
      }
    }
    if (!state.states['l10-final-call'] && p.transform.x >= 3650) {
      state.states['l10-final-call'] = true;
      world.l10Encounters?.callWave();
    }
    if (!state.states['hangar-cast'] && Math.abs(p.transform.x - cureHangar.centre.x) < 120 && world.chunks?.resident(cureHangar.centre.x, cureHangar.centre.z)) this.spawnCast();
    if (state.steps.research?.status !== 'active' || !insideCureHangar(p.transform)) return;
    const index = state.counters['hangar-line'], line = cureHangarConversation[index];
    if (!line) { state.states['hangar-dialogue-done'] = true; return; }
    if (!state.counters['hangar-line-ticks'] || !state.subtitle || state.subtitle.until <= world.tick) this.say(line[0], line[1] - state.counters['hangar-line-ticks']);
    if (++state.counters['hangar-line-ticks'] >= line[1]) { state.counters['hangar-line']++; state.counters['hangar-line-ticks'] = 0; }
  }
  private spawnCast(): void {
    const { world, state } = this.mission;
    if (!world.npcs || !world.infected) return;
    const cast = [
      ['voss', 'npc.lab-tech-b', 2699, 69], ['ruiz', 'npc.national-guard', 2717, 64],
      ['researcher', 'npc.lab-tech-a', 2718, 69], ['sam', state.states['sam-alive'] ? this.savedSam()?.civilian?.model ?? 'npc.civilian-man-a' : 'npc.national-guard', 2712, 73],
      ['guard-west', 'npc.lab-guard', 2703, 56], ['guard-east', 'npc.lab-guard', 2711, 56],
    ] as const;
    // Chunk residency can precede the navigation rebuild by a tick. Wait for
    // every position before spawning so a streaming transition cannot leave
    // a partial cast or abort the level.
    if (cast.some(([, , x, z]) => !world.infected!.nav.clear(x, z, .35))) return;
    for (const [key, model, x, z] of cast) {
      if (state.actors[`hangar-${key}`]) continue;
      const at = { x, z };
      const id = world.npcs.civilians.spawn('resident', at, { model, waypoints: [at] });
      state.actors[`hangar-${key}`] = id;
      const e = world.entities.get(id)!;
      if (key === 'sam') e.health.current = Math.max(1, Math.round(e.health.max * .4));
      e.civilian!.pauseUntil = world.tick + 216000;
      e.civilian!.story = { clip: key === 'sam' ? 'npc-cower' : 'idle', start: world.tick };
      if (key.startsWith('guard')) e.civilian!.ally = { ...allyState('soldier'), post: at, hold: true, engaged: true, weapon: 'rifle', gun: { ...l4.soldiers.rifle }, range: 20 };
    }
    state.states['hangar-cast'] = true;
  }
}
