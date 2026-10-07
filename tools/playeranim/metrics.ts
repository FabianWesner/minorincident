import { readFileSync, writeFileSync } from 'node:fs';
import { Quaternion, Vector3 } from 'three';
import type { Frame, Recording } from './record';

const out = process.argv[2] ?? 'test-results/player-anim';
const read = (label: string, variant: string, scenario: string) => JSON.parse(readFileSync(`${out}/${label}/${variant}-${scenario}.json`, 'utf8')) as Recording;
const distance = (a: number[], b: number[]) => new Vector3().fromArray(a).distanceTo(new Vector3().fromArray(b));
const percentile = (a: number[], p: number) => a.slice().sort((a, b) => a - b)[Math.floor((a.length - 1) * p)];
function measure(data: Recording) {
  const frames = data.frames, steady = frames.filter(f => f.tick > 90 && f.tick < 290);
  const angular: number[] = [], angularStep: number[] = [], pelvisSteps: number[] = [], stanceDrift: number[] = [], cadence: number[] = [];
  const previousOmega: Record<string, number> = {};
  let last: Frame | undefined;
  const plants = [null, null] as (number[] | null)[], drift = [0, 0];
  for (const f of steady) {
    const blend = Math.max(0, Math.min(1, (f.speed - 1.9) / 1.4)), run = blend * blend * (3 - 2 * blend);
    const stance = data.label === 'before' ? data.skin ? .55 - .31 * run : .6 - .1 * run : .5 - .28 * run;
    for (let i = 0; i < 2; i++) {
      const p = (f.phase + i * .5) % 1;
      if (p <= stance && f.speed > .2) {
        if (!plants[i]) plants[i] = f.ankles[i];
        drift[i] = Math.max(drift[i], distance(plants[i]!, f.ankles[i]));
      } else if (plants[i]) { stanceDrift.push(drift[i]); plants[i] = null; drift[i] = 0; }
    }
    if (last) {
      cadence.push(((f.phase - last.phase + 1) % 1) * 60);
      pelvisSteps.push(Math.abs(f.pelvis[1] - last.pelvis[1]));
      for (const name of ['legL', 'shinL', 'legR', 'shinR']) {
        const omega = new Quaternion().fromArray(last.joints[name], 3).angleTo(new Quaternion().fromArray(f.joints[name], 3)) * 180 / Math.PI * 60;
        angular.push(omega);
        if (previousOmega[name] !== undefined) angularStep.push(Math.abs(omega - previousOmega[name]));
        previousOmega[name] = omega;
      }
    }
    last = f;
  }
  const pelvis = steady.map(f => f.pelvis[1]);
  return { skin: data.skin, kneeMaxDeg: Math.max(...steady.flatMap(f => f.knees)), kneeP95Deg: percentile(steady.flatMap(f => f.knees), .95),
    stanceCount: stanceDrift.length, stanceDriftMaxCm: Math.max(0, ...stanceDrift) * 100, stanceDriftP95Cm: stanceDrift.length ? percentile(stanceDrift, .95) * 100 : null,
    pelvisRangeCm: (Math.max(...pelvis) - Math.min(...pelvis)) * 100, pelvisFrameStepMaxCm: Math.max(...pelvisSteps) * 100,
    legAngularSpeedMaxDegS: Math.max(...angular), legAngularSpeedP95DegS: percentile(angular, .95), angularSpeedChangeMaxDegS: Math.max(...angularStep),
    cadenceMaxHz: Math.max(...cadence), cpuMsP95: percentile(steady.map(f => f.cpuMs), .95) };
}
const results = Object.fromEntries(['before', 'after'].map(label => [label, Object.fromEntries(['female', 'male'].map(variant => [variant,
  Object.fromEntries(['walk', 'run', 'start-stop', 'turn90', 'turn180', 'unarmed', 'bat', 'hurt', 'bike'].map(scenario => [scenario, measure(read(label, variant, scenario))]))]))]));
writeFileSync(`${out}/metrics.json`, JSON.stringify({ method: '60 Hz recorded production poses. Tick 91–289; complete steady gait stance displacement, actual joint flex (0° straight), local joint angular speed. Stance drift only meaningful for straight walk/run; turns explicitly release contacts. CPU excludes skeleton update (see separate profile). Male before is rigid because pilot had no male skin.', results }, null, 2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([label, variants]) => [label, Object.fromEntries(Object.entries(variants).map(([variant, scenes]) => [variant, { walk: scenes.walk, run: scenes.run }]))])), null, 2));
