import { readFileSync } from 'node:fs';
interface Figure { id: number; clip: string; phase: number; joints?: Record<string, number[]> }
interface Frame { figures: Figure[] }
const paths = process.argv.slice(2);
if (!paths.length) throw new Error('Usage: analyze.ts <frames.json> [...]');
for (const path of paths) {
  const frames = JSON.parse(readFileSync(path, 'utf8')) as Frame[];
  const actors = new Map<number, { samples: number; rootMaxM: number; pelvisMaxM: number; pawMaxM: number; worstFrame: number; transition: string }>();
  for (let i = 1; i < frames.length; i++) for (const current of frames[i].figures) {
    const previous = frames[i - 1].figures.find(f => f.id === current.id);
    const joints = current.joints, old = previous?.joints;
    if (!joints?.root || !old?.root) continue;
    const state = actors.get(current.id) ?? { samples: 0, rootMaxM: 0, pelvisMaxM: 0, pawMaxM: 0, worstFrame: 0, transition: '' };
    actors.set(current.id, state); state.samples++;
    const delta = joints.root.map((value, axis) => value - old.root[axis]);
    state.rootMaxM = Math.max(state.rootMaxM, Math.hypot(...delta));
    if (joints.hip && old.hip) state.pelvisMaxM = Math.max(state.pelvisMaxM, Math.abs(joints.hip[1] - old.hip[1] - delta[1]));
    for (const name of ['handL', 'handR', 'footL', 'footR']) {
      if (!joints[name] || !old[name]) continue;
      const step = Math.hypot(...joints[name].map((value, axis) => value - old[name][axis] - delta[axis]));
      if (step > state.pawMaxM) { state.pawMaxM = step; state.worstFrame = i; state.transition = `${previous!.clip}->${current.clip} (${name})`; }
    }
  }
  console.log(JSON.stringify({ path, frames: frames.length, actors: Object.fromEntries(actors) }, null, 2));
}
