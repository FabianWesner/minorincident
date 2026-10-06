import { describe, expect, test } from 'vitest';
import { L1ArcDirector } from '../../../src/audio/L1Arc';
import { audioCues, eventCues, l1AccidentCues, l1CalmCues, l1ChaosCues } from '../../../src/data/audioCues';
import { l1AccidentEvents } from '../../../src/sim/outbreak/types';
import { l1v2 } from '../../../src/data/l1v2';

/** Spearman rank correlation with average ranks for ties. */
function spearman(a: number[], b: number[]): number {
  const rank = (v: number[]) => v.map(x => { const lt = v.filter(y => y < x).length, eq = v.filter(y => y === x).length; return lt + (eq - 1) / 2; });
  const ra = rank(a), rb = rank(b), n = a.length, ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n;
  let c = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) { c += (ra[i] - ma) * (rb[i] - mb); va += (ra[i] - ma) ** 2; vb += (rb[i] - mb) ** 2; }
  return c / Math.sqrt(va * vb);
}

describe('L1 v2 sound arc', () => {
  test('T-E19-21 @E19 @E19-AC21 calm layer only before the accident, ringing/low-pass at the blast, calm -12 dB in 3 s, chaos layer correlates with infected count', () => {
    const arc = new L1ArcDirector(7);
    const played: { t: number; cue: string }[] = [];
    const step = 0.1;
    let ringingAt = -1, blastLowpass = 0;
    const blastAt = 20, fire = (name: string, t: number) => arc.event(name, t);
    const calmDb: Record<number, number> = {};
    const count: number[] = [], chaos: number[] = [];
    let infected = 0;
    for (let t = 0; t <= 120; t = Math.round((t + step) * 10) / 10) {
      for (const [i, name] of l1AccidentEvents.entries()) if (Math.abs(t - (blastAt - 1.5 + [0, 1.5, 1.7, 2.9, 3.5, 9][i])) < 1e-6) fire(name, t);
      if (t > blastAt + 9) infected = Math.min(30, Math.floor((t - blastAt - 9) / 3));
      const f = arc.update(t, infected, false);
      for (const p of f.plays) {
        played.push({ t, cue: p.cue });
        if (p.cue === 'l1.blast') blastLowpass = p.lowpass ?? 0;
      }
      if (f.ringing) ringingAt = t;
      calmDb[Math.round(t * 10)] = 20 * Math.log10(f.calmGain);
      if (t > blastAt + 12) { count.push(infected); chaos.push(f.chaosGain); }
    }
    // Before the accident only calm-layer cues play.
    const pre = played.filter(p => p.t < blastAt - 1.5);
    expect(pre.length).toBeGreaterThanOrEqual(3);
    for (const p of pre) expect(l1CalmCues as readonly string[]).toContain(p.cue);
    for (const p of played.filter(p => p.t >= blastAt - 1.5)) expect([...l1AccidentCues, ...l1ChaosCues, 'l1.scream'] as readonly string[]).toContain(p.cue);
    // Blast: muffled; ringing follows within the accident window and lasts ~1.2 s.
    expect(blastLowpass).toBeLessThanOrEqual(2000);
    expect(ringingAt).toBeCloseTo(blastAt + 0.2, 1);
    expect(audioCues['l1.ringing'].duration).toBeCloseTo(l1v2.accident.ringingS, 1);
    // Calm drops at least 12 dB within 3 s of the blast.
    expect(calmDb[Math.round(blastAt * 10)]).toBeCloseTo(0, 5);
    expect(calmDb[Math.round((blastAt + l1v2.sound.calmDropWithinS) * 10)]).toBeLessThanOrEqual(-l1v2.sound.calmDropDb + 0.01);
    // No calm one-shots after the accident starts.
    expect(played.filter(p => p.t > blastAt && (l1CalmCues as readonly string[]).includes(p.cue))).toHaveLength(0);
    // Chaos intensity follows the infected count.
    expect(spearman(count, chaos)).toBeGreaterThanOrEqual(l1v2.sound.chaosCorrelationMin);
  });

  test('T-E19-19 @E19 @E19-AC19 accident events map to distinct cues in the authored order', () => {
    expect(l1AccidentEvents).toEqual(['l1.flicker', 'l1.blast', 'l1.ringing', 'l1.smoke', 'l1.screams', 'l1.infectedExit']);
    const at = l1v2.accident.eventAtS, order = [at.flicker, at.blast, at.ringing, at.smoke, at.screams, at.infectedExit];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const type of l1AccidentEvents) expect(audioCues[eventCues[type]], type).toBeDefined();
    const arc = new L1ArcDirector(1), cues: string[] = [];
    l1AccidentEvents.forEach((type, i) => { arc.event(type, order[i]); for (let t = order[i]; t < (order[i + 1] ?? order[i] + 3); t += 0.05) cues.push(...arc.update(t, 0, false).plays.map(p => p.cue)); });
    expect(cues.indexOf('l1.flicker.buzz')).toBeLessThan(cues.indexOf('l1.blast'));
    expect(cues.indexOf('l1.blast')).toBeLessThan(cues.indexOf('l1.ringing'));
    expect(cues.indexOf('l1.ringing')).toBeLessThan(cues.indexOf('l1.bell'));
    expect(cues.indexOf('l1.bell')).toBeLessThan(cues.indexOf('l1.scream'));
  });

  test('T-E19-21b @E19 @E19-AC21 muffled interior only when requested and deterministic per seed', () => {
    const run = (seed: number) => { const a = new L1ArcDirector(seed), out: string[] = []; for (let t = 0; t < 30; t += 0.1) out.push(...a.update(t, 0, false).plays.map(p => `${p.cue}@${p.bearing?.toFixed(3)}`)); return out; };
    expect(run(3)).toEqual(run(3));
    expect(new L1ArcDirector(1).update(0, 0, true).muffled).toBe(true);
    expect(new L1ArcDirector(1).update(0, 0, false).muffled).toBe(false);
  });
});
