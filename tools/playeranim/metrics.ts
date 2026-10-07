import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Quaternion, Vector3 } from 'three';
import type { Frame, Recording } from './record';

const out = process.argv[2] ?? 'test-results/player-anim';
const read = (label: string, variant: string, scenario: string) => {
  const path = `${out}/${label}/${variant}-${scenario}.json`;
  return JSON.parse((existsSync(path) ? readFileSync(path) : gunzipSync(readFileSync(`${path}.gz`))).toString()) as Recording;
};
const distance = (a: number[], b: number[]) => new Vector3().fromArray(a).distanceTo(new Vector3().fromArray(b));
const percentile = (a: number[], p: number) => a.slice().sort((a, b) => a - b)[Math.floor((a.length - 1) * p)];
/** Model-free contact metrics from heel/toe world points: a foot is grounded while its lowest
 * sole point is within 1.2 cm of the floor; the grounded point must not translate (slide) and the
 * foot must not yaw while grounded. Works for the rigid and the skinned figure alike. */
function contacts(data: Recording) {
  const frames = data.frames.filter(f => f.feet);
  if (!frames.length) return null;
  const floor = Math.min(...frames.flatMap(f => f.feet!.flatMap(c => [c.heel[1], c.toe[1]])));
  const slides: number[] = [], drifts: number[] = [], lifts: number[] = [];
  let bothAirWalking = 0, bothAirFrames = 0;
  for (let i = 0; i < 2; i++) {
    let slide = 0, drift = 0, startYaw: number | undefined, previous: (typeof frames)[number] | undefined;
    for (const f of frames) {
      const c = f.feet![i], lowest = Math.min(c.heel[1], c.toe[1]), grounded = lowest < floor + .012;
      lifts.push(lowest - floor);
      if (grounded) {
        if (startYaw === undefined) startYaw = c.yaw;
        else if (previous) {
          const pc = previous.feet![i];
          // Rolling heel to toe keeps the toe fixed; take the point grounded in both frames.
          const toeGrounded = c.toe[1] < floor + .012 && pc.toe[1] < floor + .012;
          const a = toeGrounded ? c.toe : c.heel, b = toeGrounded ? pc.toe : pc.heel;
          slide += Math.hypot(a[0] - b[0], a[2] - b[2]);
          drift = Math.max(drift, Math.abs(Math.atan2(Math.sin(c.yaw - startYaw), Math.cos(c.yaw - startYaw))) * 180 / Math.PI);
        }
        previous = f;
      } else if (startYaw !== undefined) { slides.push(slide); drifts.push(drift); slide = 0; drift = 0; startYaw = undefined; previous = undefined; }
    }
    if (startYaw !== undefined) { slides.push(slide); drifts.push(drift); }
  }
  for (const f of frames) {
    const air = f.feet!.every(c => Math.min(c.heel[1], c.toe[1]) >= floor + .012);
    if (air) { bothAirFrames++; if (f.speed < 2.5 && f.speed > .05) bothAirWalking++; }
  }
  return { contactCount: slides.length, slideMaxCm: Math.max(0, ...slides) * 100, slideP95Cm: slides.length ? percentile(slides, .95) * 100 : null, yawDriftMaxDeg: Math.max(0, ...drifts), yawDriftP95Deg: drifts.length ? percentile(drifts, .95) : null,
    liftMaxCm: Math.max(...lifts) * 100, bothFeetAirborneFrames: bothAirFrames, bothFeetAirborneWalkingFrames: bothAirWalking };
}
function measure(data: Recording) {
  const frames = data.frames, steady = frames.filter(f => f.tick > 90 && f.tick < 290);
  const angular: number[] = [], angularStep: number[] = [], pelvisSteps: number[] = [], stanceDrift: number[] = [], cadence: number[] = [];
  const previousOmega: Record<string, number> = {};
  let last: Frame | undefined;
  const plants = [null, null] as (number[] | null)[], drift = [0, 0];
  for (const f of steady) {
    const blend = Math.max(0, Math.min(1, (f.speed - 1.9) / 1.4)), run = blend * blend * (3 - 2 * blend);
    const stance = data.gaitSupport ? data.gaitSupport[0] + (data.gaitSupport[1] - data.gaitSupport[0]) * run : data.label === 'before' ? data.skin ? .55 - .31 * run : .6 - .1 * run : .5 - .28 * run;
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
  const legSteps = frames.slice(1).flatMap((f, i) => ['legL', 'shinL', 'legR', 'shinR'].map(n => ({ clip: f.clip, degrees: new Quaternion().fromArray(frames[i].joints[n], 3).angleTo(new Quaternion().fromArray(f.joints[n], 3)) * 180 / Math.PI })));
  return { skin: data.skin,
    posture: { chestMinDeg: Math.min(...frames.map(f => f.chestPitch)), chestMaxDeg: Math.max(...frames.map(f => f.chestPitch)), headMinDeg: Math.min(...frames.map(f => f.headPitch)),
      steadyChestMinDeg: Math.min(...steady.map(f => f.chestPitch)), steadyChestMaxDeg: Math.max(...steady.map(f => f.chestPitch)),
      elbowMinDeg: Math.min(...frames.flatMap(f => f.elbows ?? [])), elbowMaxDeg: Math.max(...frames.flatMap(f => f.elbows ?? [])) },
    fullSequenceLegStepMaxDeg: Math.max(...legSteps.map(s => s.degrees)), kneeStrikeStepMaxDeg: Math.max(0, ...legSteps.filter(s => s.clip === 'unarmed-knee').map(s => s.degrees)), kneeMaxDeg: Math.max(...steady.flatMap(f => f.knees)), kneeP95Deg: percentile(steady.flatMap(f => f.knees), .95),
    stanceCount: stanceDrift.length, stanceDriftMaxCm: Math.max(0, ...stanceDrift) * 100, stanceDriftP95Cm: stanceDrift.length ? percentile(stanceDrift, .95) * 100 : null,
    pelvisRangeCm: (Math.max(...pelvis) - Math.min(...pelvis)) * 100, pelvisFrameStepMaxCm: Math.max(...pelvisSteps) * 100,
    legAngularSpeedMaxDegS: Math.max(...angular), legAngularSpeedP95DegS: percentile(angular, .95), angularSpeedChangeMaxDegS: Math.max(...angularStep),
    cadenceMaxHz: Math.max(...cadence), cpuMsP95: percentile(steady.map(f => f.cpuMs), .95), contacts: contacts(data) };
}
const labels = process.argv.slice(3).filter(a => !a.startsWith('--'));
const results = Object.fromEntries((labels.length ? labels : ['before', 'after']).map(label => [label, Object.fromEntries(['female', 'male'].map(variant => [variant,
  Object.fromEntries([...(existsSync(`${out}/${label}/${variant}-idle.json`) || existsSync(`${out}/${label}/${variant}-idle.json.gz`) ? ['idle'] : []), 'walk', 'run', 'start-stop', 'turn90', 'turn180', 'pivot180', 'run-turn180', 'unarmed', 'bat', 'hurt', 'bike'].filter(scenario => existsSync(`${out}/${label}/${variant}-${scenario}.json`) || existsSync(`${out}/${label}/${variant}-${scenario}.json.gz`)).map(scenario => [scenario, measure(read(label, variant, scenario))]))]))]));
writeFileSync(`${out}/metrics.json`, JSON.stringify({ method: '60 Hz recorded production poses. Tick 91–289; complete steady gait stance displacement, actual joint flex (0° straight), local joint angular speed. Stance drift only meaningful for straight walk/run; turns explicitly release contacts. Posture and per-frame joint steps cover the entire sequence, including all transitions; steady metrics use ticks 91–289. Posture is the signed hip-to-shoulder-midpoint/head-joint angle against the actor forward axis, positive forward. Skin and support fractions come from each recording. CPU excludes skeleton update (see separate profile).', results }, null, 2));
for (const [label, variants] of Object.entries(results)) for (const [variant, scenes] of Object.entries(variants)) for (const [scenario, m] of Object.entries(scenes)) {
  const c = m.contacts;
  console.log(`${label.padEnd(13)} ${variant.padEnd(6)} ${scenario.padEnd(11)} slideMax ${c?.slideMaxCm.toFixed(2).padStart(6)} cm  p95 ${String(c?.slideP95Cm?.toFixed(2)).padStart(6)}  yawDriftMax ${c?.yawDriftMaxDeg.toFixed(1).padStart(5)}°  lift ${c?.liftMaxCm.toFixed(1).padStart(5)} cm  bothAirWalk ${String(c?.bothFeetAirborneWalkingFrames).padStart(3)}  chestMin ${m.posture.chestMinDeg.toFixed(1).padStart(5)}°  knee ${m.kneeMaxDeg.toFixed(0).padStart(3)}°  legStep ${m.fullSequenceLegStepMaxDeg.toFixed(1).padStart(5)}°  cpu ${m.cpuMsP95.toFixed(3)}`);
}
