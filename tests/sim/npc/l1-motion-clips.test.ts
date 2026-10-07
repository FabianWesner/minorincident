import { expect, test } from 'vitest';
import { infectedClip, locomotionClips } from '../../../src/render/npc/CivilianCrowd';
import { groveWorld, releaseFive, step } from './l1-grove';

/** The clip selection before the PO "skating" fix (attack pose at any speed, gait from 0.06 m/s). */
function legacyClip(state: string, speed: number, tier: 'frail' | 'average' | 'athletic', windup: boolean): string {
  if (state === 'dead') return 'death-back';
  if (state === 'attack') return windup ? 'windup' : 'swing';
  if (speed > 2.6) return infectedClip('chase', speed, tier, false);
  if (speed > .06) return infectedClip('chase', 1, tier, false);
  return 'infected-idle';
}
test('@E19 @E19-AC18 infected clip follows ground speed over a 60 s outbreak (no skating)', async () => {
  const counts = { samples: 0, before: 0, after: 0 };
  for (const seed of [1, 2]) {
    const { w } = await groveWorld(seed); step(w, 120); releaseFive(w);
    for (let t = 0; t < 3600; t++) {
      step(w, 1);
      for (const e of w.infected!.active) {
        if (e.health.current <= 0 || !e.appearance || !e.motion) continue;
        const b = e.infected!, reaction = e.combat?.reaction, reacting = !!reaction && (w.tick - reaction.started) / 60 < (reaction.heavy ? 1.34 : .43);
        if (reacting || e.hidden) continue; // knockback uses the stagger/slide poses by design
        const speed = e.motion.speed, windup = w.tick < b.until;
        // Skating = moving > 0.5 m/s without a locomotion clip; moon-walking = gait while standing.
        const bad = (clip: string) => speed > .5 && !locomotionClips.has(clip) || speed < .1 && locomotionClips.has(clip);
        counts.samples++;
        if (bad(legacyClip(b.state, speed, e.appearance.tier, windup))) counts.before++;
        if (bad(infectedClip(b.state, speed, e.appearance.tier, windup))) counts.after++;
      }
    }
    w.dispose();
  }
  console.log(`speed/clip mismatch over 2 x 60 s: before ${counts.before}/${counts.samples} (${(counts.before / counts.samples * 100).toFixed(2)} %), after ${counts.after}/${counts.samples} (${(counts.after / counts.samples * 100).toFixed(2)} %)`);
  expect(counts.samples).toBeGreaterThan(1000);
  expect(counts.after / counts.samples).toBeLessThan(.002);
}, 600_000);
