import { preset } from '../../../src/sim/progression/Campaign';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { runLevel } from '../../sim-runner/levels';
import { ThreatObserver, type PhaseReceipt } from '../threat/observer';

export interface L6PressureSeed {
  seed: number; valid: boolean; outcome: string; seconds: number | null;
  playerRate: number | null; followerRate: number | null;
  arrivals: number; ahead: number; behind: number;
}

/** Count actual recurring admissions relative to the live column tail, without changing the route. */
export class L6Arrivals {
  private seen = 0;
  private arrivals = 0;
  private ahead = 0;
  private behind = 0;
  constructor(world: SimWorld) {
    world.events.on('sim.tick', () => {
      const state = world.missions?.state.l6;
      if (!state) return;
      if (state.spawnLog.length < this.seen) this.seen = state.spawnLog.length;
      for (const entry of state.spawnLog.slice(this.seen)) {
        if (state.phase !== 'retreat' || entry.wave !== 3) continue;
        this.arrivals++;
        const tail = state.tailX ?? state.leaderX;
        if (entry.x > tail) this.ahead++;
        else if (entry.x < tail) this.behind++;
      }
      this.seen = state.spawnLog.length;
    });
  }
  finish(seed: number, completed: boolean, outcome: string, phase?: PhaseReceipt): L6PressureSeed {
    return { seed, valid: completed && !!phase && phase.seconds > 0, outcome, seconds: phase?.seconds ?? null,
      playerRate: phase?.attacksPerMinute ?? null, followerRate: phase?.groupAttacksPerMinute ?? null,
      arrivals: this.arrivals, ahead: this.ahead, behind: this.behind };
  }
}

/** Additional ordinary complete routes; each uses the same observer and tier as seed 1. */
export async function extraL6PressureSeeds(tier: 'low' | 'high'): Promise<L6PressureSeed[]> {
  const rows: L6PressureSeed[] = [];
  for (const seed of [2, 3]) {
    const campaign = preset('L6-default'); campaign.seed = seed; campaign.settings.quality = tier;
    let observer: ThreatObserver | undefined, arrivals: L6Arrivals | undefined, phase: PhaseReceipt | undefined;
    try {
      const run = await runLevel('L6', 'complete', seed, 360, 'auto', campaign, undefined, 0, {
        quality: tier,
        beforeBegin: world => { observer = new ThreatObserver(world, 'L6'); arrivals = new L6Arrivals(world); },
        beforeDispose: () => { phase = observer?.finish().phases.find(row => row.key === 'step/retreat'); },
      });
      rows.push(arrivals?.finish(seed, run.completed, run.outcome, phase) ?? { seed, valid: false, outcome: run.outcome, seconds: null, playerRate: null, followerRate: null, arrivals: 0, ahead: 0, behind: 0 });
    } catch (error) {
      rows.push({ seed, valid: false, outcome: String(error), seconds: null, playerRate: null, followerRate: null, arrivals: 0, ahead: 0, behind: 0 });
    }
  }
  return rows;
}
