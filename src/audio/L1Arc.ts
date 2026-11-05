import { Rng } from '../core/Rng';
import { l1v2 } from '../data/l1v2';

export interface ArcPlay { cue: string; gain?: number; rate?: number; lowpass?: number; range?: [number, number]; ring?: boolean;
  /** Seeded placement relative to the listener, filled from `range`. */
  bearing?: number; distance?: number }
export interface ArcFrame {
  phase: 'calm' | 'accident' | 'chaos';
  calmGain: number;
  chaosGain: number;
  /** Fire-station interior: ambience is muffled. */
  muffled: boolean;
  /** Cues due this update, in order. `range` = [min, max] metres around the listener (omitted: non-spatial). */
  plays: ArcPlay[];
  /** True on the frame the ringing starts (service applies the low-pass dip). */
  ringing: boolean;
}
const dbGain = (db: number): number => 10 ** (db / 20);
const sound = l1v2.sound;

/** Pure sound-arc logic (specs/epic-19 5.12). Driven by audio time, the L1 accident events and the live infected
 * count; the AudioService maps its output onto buses and loops. No Web Audio here, so it is unit-testable. */
export class L1ArcDirector {
  phase: ArcFrame['phase'] = 'calm';
  private blastAt: number | null = null;
  private screamsAt: number | null = null;
  chaos = 0;
  private lastTime: number | null = null;
  private nextCalm: number;
  private nextChaos = 0;
  private readonly queue: { at: number; play: ArcPlay }[] = [];
  private readonly rng: Rng;
  constructor(seed: number, epoch = 0) { this.rng = new Rng(seed, 'l1-arc'); this.nextCalm = epoch + 1.5; }

  private placed(p: ArcPlay): ArcPlay { return { ...p, bearing: this.rng.next() * Math.PI * 2, distance: p.range![0] + this.rng.next() * (p.range![1] - p.range![0]) }; }
  /** Calm bed attenuation in dB: -12 dB at 3 s after the blast, then faded out. */
  calmDb(time: number): number {
    if (this.blastAt === null) return 0;
    const dt = Math.max(0, time - this.blastAt);
    return dt <= sound.calmDropWithinS ? -sound.calmDropDb * dt / sound.calmDropWithinS : Math.max(-40, -sound.calmDropDb - (dt - sound.calmDropWithinS) * 4);
  }
  event(type: string, time: number): void {
    const at = (delay: number, play: ArcPlay): void => { this.queue.push({ at: time + delay, play }); };
    if (type === 'l1.flicker') {
      if (this.phase === 'calm') this.phase = 'accident';
      at(0, { cue: 'l1.flicker.buzz' });
    }
    else if (type === 'l1.blast') {
      this.blastAt = time;
      if (this.phase === 'calm') this.phase = 'accident';
      at(0, { cue: 'l1.blast', lowpass: 1800 });
      at(0.12, { cue: 'l1.glass.rattle' });
      at(0.4, { cue: 'l1.crash', range: [8, 20] });
      at(0.9, { cue: 'l1.glass.rattle', gain: 0.6 });
    } else if (type === 'l1.ringing') at(0, { cue: 'l1.ringing', ring: true });
    else if (type === 'l1.smoke') at(0, { cue: 'l1.bell' });
    else if (type === 'l1.screams') {
      this.screamsAt = time;
      for (let i = 0; i < 3; i++) at(i * 0.35, { cue: 'l1.scream', rate: 0.9 + this.rng.next() * 0.3, range: [6, 22] });
      at(1.2, { cue: 'l1.crash', range: [10, 25] });
    } else if (type === 'l1.infectedExit') {
      if (this.screamsAt === null) this.screamsAt = time;
      at(0, { cue: 'l1.chaos.infected', range: [6, 18] });
      at(0.3, { cue: 'l1.crash', range: [6, 18] });
    }
    this.queue.sort((a, b) => a.at - b.at);
  }
  /** `infected` = live infected count; `interior` = listener is in the fire station. */
  update(time: number, infected: number, interior: boolean): ArcFrame {
    const dt = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime);
    this.lastTime = time;
    const plays: ArcPlay[] = [];
    let ringing = false;
    while (this.queue.length && this.queue[0].at <= time) {
      const { play: queued } = this.queue.shift()!;
      const play = queued.range ? { ...queued, bearing: this.rng.next() * Math.PI * 2, distance: queued.range[0] + this.rng.next() * (queued.range[1] - queued.range[0]) } : queued;
      plays.push(play);
      ringing ||= !!play.ring;
    }
    // Chaos intensity: monotone in the infected count, smoothed with a ~1 s time constant. Silent before the screams.
    const target = this.screamsAt === null ? 0 : Math.pow(Math.min(1, infected / sound.chaosMaxInfected), 0.7);
    this.chaos += (target - this.chaos) * (1 - Math.exp(-dt / 1));
    if (this.screamsAt !== null && this.phase !== 'chaos') this.phase = 'chaos';
    if (this.phase === 'calm') {
      if (time >= this.nextCalm) {
        const pool = ['l1.calm.talk', 'l1.calm.traffic', 'l1.calm.bike-tick', 'l1.calm.birds'];
        plays.push(this.placed({ cue: pool[Math.floor(this.rng.next() * pool.length)], range: [5, 25] }));
        this.nextCalm = time + 2 + this.rng.next() * 3;
      }
    } else if (this.phase === 'chaos' && this.chaos > 0.05 && time >= this.nextChaos) {
      const pool = this.chaos > 0.5 ? ['l1.scream', 'l1.chaos.infected', 'l1.chaos.run', 'l1.chaos.run', 'l1.chaos.fall', 'l1.chaos.distant', 'l1.chaos.car-alarm'] : ['l1.chaos.distant', 'l1.chaos.infected', 'l1.chaos.run', 'l1.chaos.fall'];
      plays.push(this.placed({ cue: pool[Math.floor(this.rng.next() * pool.length)], range: [10, 32], gain: 0.5 + this.chaos * 0.5 }));
      this.nextChaos = time + 4 - 3.2 * this.chaos + this.rng.next();
    }
    return { phase: this.phase, calmGain: dbGain(this.calmDb(time)), chaosGain: this.chaos, muffled: interior, plays, ringing };
  }
}
