import { cureHangar, cureHangarConversation, insideCureHangar } from '../../data/l10Story';
import { cure } from '../../levels/L10/district';
import { allyState } from '../outbreak/Allies';
import { l4 } from '../../data/l4';
import type { EntitySnapshot } from '../world/types';
import type { Mission } from './Mission';
import { curePaceCheckpoints } from '../../levels/L10/mission';

/** Exact scripted dialogue, continuity and the safe-hangar cast. All progress lives in the mission snapshot. */
export class LevelTenStory {
  constructor(private readonly mission: Mission) {}
  private savedSam(): EntitySnapshot | undefined {
    const save = this.mission.world.progression?.campaign;
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
    if (!state.states['story-initialized']) {
      state.states['story-initialized'] = true;
      state.states['sam-alive'] = !!this.savedSam();
      this.say('L10.farmstead', 360);
    }
    // Checkpoints follow the region crossed, independently of the story objective and optional weapon finds.
    for (let i = 1; i <= 4; i++) if (state.counters['story-region'] < i && p.transform.x >= cure.regions[i].envelope[0][0]) {
      state.counters['story-region'] = i;
      this.mission.requestCheckpoint(cure.regions[i].checkpoint);
    }
    // The first recovery point is 120 m from the crash; subsequent points are
    // 200 m apart along this eastbound route (well inside the 250 m limit).
    const paceIndex = p.transform.x < 667 ? 0 : Math.min(curePaceCheckpoints.length, 1 + Math.floor((p.transform.x - 667) / 200));
    if (paceIndex > (state.counters['pace-checkpoint'] ?? 0)) {
      state.counters['pace-checkpoint'] = paceIndex;
      this.mission.requestCheckpoint(curePaceCheckpoints[paceIndex - 1]);
    }
    if (!state.states['gap-hint'] && p.transform.x >= 937) { state.states['gap-hint'] = true; this.say('L10.hide-gap'); }
    if (!state.states['hangar-radio'] && p.transform.x >= 2300) { state.states['hangar-radio'] = true; this.say('L10.armory'); }
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
    for (const [key, model, x, z] of cast) {
      if (state.actors[`hangar-${key}`]) continue;
      const at = { x, z };
      if (!world.infected.nav.clear(x, z, .35)) throw new Error(`Blocked hangar actor: ${key}`);
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
