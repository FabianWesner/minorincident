import { Rng } from '../core/Rng';
import { ambienceTiers } from '../data/audioCues';
/** One-shots never use wall time; a late update schedules one next event rather than a backlog. */
export class AmbienceSchedule {
    private readonly rng: Rng;
    private next: number;
    constructor(readonly tier: number, seed: number, epoch = 0) { this.rng = new Rng(seed, `audio-ambience-W${tier}`); this.next = epoch + 2 + this.rng.next() * 3; }
    update(time: number): {
        time: number;
        cue: string;
        x: number;
        z: number;
    } | null {
        if (time < this.next)
            return null;
        const table = ambienceTiers[this.tier], event = { time: this.next, cue: `ambient.${table.oneShots[Math.floor(this.rng.next() * table.oneShots.length)]}`, x: (this.rng.next() - 0.5) * 40, z: (this.rng.next() - 0.5) * 40 };
        this.next = Math.max(time + 0.01, this.next + 3 + this.rng.next() * 5);
        return event;
    }
}
