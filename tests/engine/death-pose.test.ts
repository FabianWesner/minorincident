import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeCivilianBake } from '../../src/assets/civilianBakeData';
import { packCrowdParts } from '../../src/assets/crowdParts';
import { framesPerClip, infectedClips } from '../../src/render/characters/bakeInfected';
import { repairDeathPoses } from '../../src/render/characters/deathPose';
import { premultiplyRow, skinnedVertexMatrix } from '../../src/render/characters/skinnedCrowd';

// r2-corpse (G-14, L4-17): every humanoid death clip ends lying on the floor.
const deliveries = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8')) as Record<string, string>;
function load(model: string) {
  const bytes = gunzipSync(readFileSync(`public${deliveries[`${model}:lod0:infected`]}`));
  const baked = decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  packCrowdParts(baked.geometry);
  return baked;
}
/** Vertex height range of the last frame of a death clip (production skinning). */
function extent(baked: ReturnType<typeof load>, death: string) {
  const g = baked.geometry, p = g.getAttribute('position'), parts = g.getAttribute('_parts'), skin = g.getAttribute('_skin');
  const P = baked.clip.parts.length, offset = (infectedClips.indexOf(death as never) * framesPerClip + framesPerClip - 1) * P * 16;
  const pose = new Float32Array(P * 16), m = new Float32Array(16);
  premultiplyRow(baked.clip.matrices, pose, baked.clip.binds!, offset, P, 0);
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < p.count; i++) {
    if (parts.getZ(i) > 1.5 || parts.getW(i) >= 1024) continue;
    skinnedVertexMatrix(baked.clip, offset, parts, skin, i, m, pose);
    const y = m[1] * p.getX(i) + m[5] * p.getY(i) + m[9] * p.getZ(i) + m[13];
    min = Math.min(min, y); max = Math.max(max, y);
  }
  return { min, max };
}

describe('death poses', () => {
  it('lays an ordinary civilian zombie flat on the floor in all three death clips', () => {
    const baked = load('inf.common-worker');
    const before = extent(baked, 'death-back').max;
    expect(repairDeathPoses(baked.clip, baked.geometry)).toBe(true);
    for (const death of ['death-back', 'death-side', 'death-crumple']) {
      const { min, max } = extent(baked, death);
      expect(Math.abs(min)).toBeLessThan(.02);
      expect(max).toBeLessThan(.7);
    }
    expect(extent(baked, 'death-back').max).toBeLessThan(before);
  });
  it('lays the Alpha face down well under its old 1.5-1.9 m and is idempotent', () => {
    const baked = load('inf.alpha');
    expect(repairDeathPoses(baked.clip, baked.geometry, { prone: true })).toBe(true);
    const once = Array.from(baked.clip.matrices);
    expect(repairDeathPoses(baked.clip, baked.geometry, { prone: true })).toBe(true);
    expect(Array.from(baked.clip.matrices)).toEqual(once);
    for (const death of ['death-back', 'death-side', 'death-crumple']) expect(extent(baked, death).max).toBeLessThan(1.5);
  });
  it('keeps animal and crawler falls untouched', () => {
    for (const model of ['inf.dog', 'inf.crawler']) {
      const baked = load(model), before = Array.from(baked.clip.matrices);
      expect(repairDeathPoses(baked.clip, baked.geometry)).toBe(false);
      expect(Array.from(baked.clip.matrices)).toEqual(before);
    }
  });
});
