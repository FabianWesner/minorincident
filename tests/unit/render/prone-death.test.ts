import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { framesPerClip, infectedClips } from '../../../src/render/characters/bakeInfected';
import { groundDeathFeet, proneDeath, proneReach } from '../../../src/render/characters/proneDeath';
import type { CrowdClip } from '../../../src/assets/crowd';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { bakeInfected } from '../../../src/render/characters/bakeInfected';
import { alphaLookAssets } from '../../../src/data/alphaLooks';

// P1-117: Alphas fall onto their faces. A synthetic rig falls backward (+X) about its heels; joint heights in metres.
const parts = ['root', 'hip', 'torso', 'head', 'handL', 'handR', 'footL', 'footR'];
const rest: Record<string, [number, number, number]> = { root: [0, 0, 0], hip: [0, 1, 0], torso: [0, 1.4, 0], head: [0, 1.9, 0], handL: [0, 1, .5], handR: [0, 1, -.5], footL: [0, .1, .2], footR: [0, .1, -.2] };
function clip(): CrowdClip {
  const frames = infectedClips.length * framesPerClip, matrices = new Float32Array(frames * parts.length * 16);
  const first = infectedClips.indexOf('death-back') * framesPerClip, m = new Matrix4(), r = new Matrix4();
  for (let f = 0; f < frames; f++) {
    const s = f < first ? 0 : Math.min(1, (f - first) / (framesPerClip - 1));
    // Pitch backward to 90° about the heel (rotation about -Z tips +Y toward +X), resting on the back at 0.15 m.
    r.makeRotationZ(-Math.PI / 2 * s).premultiply(new Matrix4().makeTranslation(0, .15 * s, 0));
    parts.forEach((name, p) => { m.makeTranslation(...rest[name]).premultiply(r); m.toArray(matrices, (f * parts.length + p) * 16); });
  }
  return { parts, frames, duration: infectedClips.length, matrices };
}
const joint = (c: CrowdClip, frame: number, name: string) => { const o = (frame * c.parts.length + c.parts.indexOf(name)) * 16; return new Vector3(c.matrices[o + 12], c.matrices[o + 13], c.matrices[o + 14]); };

describe('prone Alpha death (P1-117)', () => {
  const first = infectedClips.indexOf('death-back') * framesPerClip, last = first + framesPerClip - 1;
  it('ends face down in front of the feet with the chest at the height the back had', () => {
    const before = clip(), after = clip(); proneDeath(after);
    expect(joint(before, last, 'head').x).toBeGreaterThan(1);
    expect(joint(after, last, 'head').x).toBeLessThan(-1);
    expect(joint(after, last, 'hip').y).toBeCloseTo(joint(before, last, 'hip').y, 2);
    expect(proneReach.get(after)!).toBeGreaterThan(1.5);
    // Standing start and every other clip are untouched; applying twice is a no-op.
    for (const name of parts) expect(joint(after, first, name).distanceTo(joint(before, first, name))).toBeLessThan(1e-5);
    expect(joint(after, first - 1, 'head').equals(joint(before, first - 1, 'head'))).toBe(true);
    const once = Float32Array.from(after.matrices); proneDeath(after); expect(after.matrices).toEqual(once);
  });
  it('falls continuously (no joint jumps between frames)', () => {
    const c = clip(); proneDeath(c);
    for (let f = first + 1; f <= last; f++) for (const name of parts) expect(joint(c, f, name).distanceTo(joint(c, f - 1, name))).toBeLessThan(.5);
  });
  it('keeps both boot soles level in the final prone pose and preserves standing orientation at the start', () => {
    const c = clip(); proneDeath(c);
    for (const name of ['footL', 'footR']) {
      const o = (last * c.parts.length + c.parts.indexOf(name)) * 16;
      expect(c.matrices[o + 5], name).toBeGreaterThan(.99);
      expect(joint(c, last, name).y).toBeLessThan(.2);
      const start = (first * c.parts.length + c.parts.indexOf(name)) * 16;
      expect(c.matrices.slice(start, start + 16)).toEqual(clip().matrices.slice(start, start + 16));
    }
  });
});

it('Q-124 delivered Alpha boots stay below 65 cm; Alpha and side-lying Mega boots keep level soles', async () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  for (const model of alphaLookAssets) {
    const bytes = readFileSync(`public/assets/models/${model}.glb`);
    const root = (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
    const baked = bakeInfected(root, [], false, undefined, undefined, true);
    const death = model.startsWith('inf.mega-alpha') ? 'death-side' : 'death-back';
    if (death === 'death-side') groundDeathFeet(baked.clip, death); else proneDeath(baked.clip);
    const frame = infectedClips.indexOf(death) * framesPerClip + framesPerClip - 1;
    const position = baked.geometry.getAttribute('position'), owner = baked.geometry.getAttribute('_part_index'), point = new Vector3();
    for (const name of ['footL', 'footR']) {
      const index = baked.clip.parts.indexOf(name), matrix = new Matrix4().fromArray(baked.clip.matrices, (frame * baked.clip.parts.length + index) * 16);
      const heights: number[] = [];
      for (let i = 0; i < position.count; i++) if (owner.getX(i) === index) heights.push(point.fromBufferAttribute(position, i).applyMatrix4(matrix).y);
      if (!model.startsWith('inf.mega-alpha')) expect(Math.max(...heights), `${model} ${name} top`).toBeLessThan(.65);
      expect(Math.max(...heights) - Math.min(...heights), `${model} ${name} vertical span`).toBeLessThan(.65);
      expect(Math.min(...heights), `${model} ${name} sole`).toBeGreaterThanOrEqual(-.05);
      expect(new Vector3().setFromMatrixColumn(matrix, 1).normalize().y, `${model} ${name} sole normal`).toBeGreaterThan(.98);
    }
    baked.geometry.dispose();
  }
});
