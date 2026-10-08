import { describe, expect, test } from 'vitest';
import { AmbienceSchedule } from '../../../src/audio/AmbienceSchedule';
import { L1ArcDirector } from '../../../src/audio/L1Arc';
import { ambienceTiers, audioCues, l1AccidentCues } from '../../../src/data/audioCues';
import { l1AccidentEvents } from '../../../src/sim/outbreak/types';

/** PO report: "an annoying Huhu all the time" in the calm morning. Cause: 2 s voice loops whose slice edges faded to silence,
 * so a crowd murmur pumped every 2 s. These guards keep scheduled cues sparse and loops long and seamless. */
const VOICED = /^(ambient\.(dog|shout|scream)|l1\.calm\.talk|l1\.scream|l1\.chaos\.(infected|distant))$/;
// Per-minute caps over a 3 min run and 5 seeds. Calm cues (the PO complaint) are held tight; chaos is dense by design. Calm schedules fire every 2-5 s (arc) and 3-8 s (ambience), chaos every 0.8-4 s;
// voiced cues (barks, talk, screams) get the tightest cap because they are what reads as a repeating "huhu".
const CAP = { voiced: 8, calmOther: 14, chaosOther: 40, accident: 6 };

function run(seed: number): { cue: string; t: number }[] {
  const arc = new L1ArcDirector(seed), ambience = new AmbienceSchedule(0, seed), plays: { cue: string; t: number }[] = [];
  const blastAt = 90;
  for (let t = 0; t <= 180; t = Math.round((t + 0.1) * 10) / 10) {
    for (const [i, name] of l1AccidentEvents.entries()) if (Math.abs(t - (blastAt - 1.5 + [0, 1.5, 1.7, 2.9, 3.5, 9][i])) < 1e-6) arc.event(name, t);
    const frame = arc.update(t, t > blastAt + 9 ? 30 : 0, false);
    for (const p of frame.plays) plays.push({ cue: p.cue, t });
    const ambient = frame.phase === 'calm' ? ambience.update(t) : null;
    if (ambient) plays.push({ cue: ambient.cue, t });
  }
  return plays;
}
function byCue(seed: number): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const p of run(seed)) map.set(p.cue, [...(map.get(p.cue) ?? []), p.t]);
  return map;
}
describe('L1 ambience guard (3 minutes: calm morning, then the accident)', () => {
  test('no scheduled cue exceeds its per-minute cap', () => {
    for (const seed of [1, 2, 3, 4, 5])
      for (const [cue, times] of byCue(seed))
        for (let minute = 0; minute < 3; minute++) {
          const n = times.filter(t => t >= minute * 60 && t < minute * 60 + 60).length;
          const cap = cue.startsWith('l1.chaos') || cue === 'l1.scream' ? CAP.chaosOther : VOICED.test(cue) ? CAP.voiced : (l1AccidentCues as readonly string[]).includes(cue) ? CAP.accident : CAP.calmOther;
          expect(n, `${cue} seed ${seed} minute ${minute}`).toBeLessThanOrEqual(cap);
        }
  });
  test('no cue repeats with a fixed period shorter than 8 s', () => {
    for (const seed of [1, 2, 3])
      for (const [cue, times] of byCue(seed)) {
        const gaps = times.slice(1).map((t, i) => t - times[i]);
        // A fixed period = three consecutive gaps equal within 0.25 s and below 8 s (a metronome, not a random schedule).
        for (let i = 0; i + 2 < gaps.length; i++)
          expect(gaps[i] < 8 && Math.abs(gaps[i] - gaps[i + 1]) < 0.25 && Math.abs(gaps[i] - gaps[i + 2]) < 0.25, `${cue} seed ${seed} gaps ${gaps.slice(i, i + 3).join(',')}`).toBe(false);
      }
  });
  test('looping calm beds (tier 0 beds + the crowd chatter layer) repeat no faster than every 8 s', () => {
    const loops = [...new Set([...ambienceTiers[0].beds.map(b => `bed.${b}`), 'l1.calm.chatter'])];
    for (const id of loops) {
      expect(audioCues[id].loop, id).toBe(true);
      expect(audioCues[id].duration, id).toBeGreaterThanOrEqual(8);
    }
  });
});
