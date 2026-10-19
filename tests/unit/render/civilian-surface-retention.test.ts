import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Vector3, type BufferGeometry } from 'three';
import { loadCivilianSource, disposeCivilianSource } from '../../../src/assets/civilianSource';
import { bakeInfected, civilianClips } from '../../../src/render/characters/bakeInfected';
import { prepareCivilianGeometry, prepareCivilianRig } from '../../../src/render/npc/prepareCivilianGeometry';

function areas(geometry: BufferGeometry, channel: string): Map<number, number> {
  const positions = geometry.getAttribute('position'), parts = geometry.getAttribute(channel), index = geometry.index;
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), result = new Map<number, number>();
  for (let j = 0; j < (index?.count ?? positions.count); j += 3) {
    const i = index ? [index.getX(j), index.getX(j + 1), index.getX(j + 2)] : [j, j + 1, j + 2];
    const owner = parts.getX(i[0]);
    a.fromBufferAttribute(positions, i[0]); b.fromBufferAttribute(positions, i[1]).sub(a); c.fromBufferAttribute(positions, i[2]).sub(a);
    result.set(owner, (result.get(owner) ?? 0) + b.cross(c).length() / 2);
  }
  return result;
}
for (const [id, lod] of [['npc.civilian-man-a', 'lod1'], ['npc.civilian-man-a', 'lod2'], ['npc.national-guard', 'lod1']] as const) test(`PO #29 @E18 ${id} ${lod} reduction retains each visible body surface`, async () => {
  const model = await loadCivilianSource(id, lod, async url => {
    const bytes = readFileSync(`public${url}`); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  });
  prepareCivilianRig(model, id);
  const authored = bakeInfected(model.clone(true), [], false, civilianClips);
  const prepared = await prepareCivilianGeometry(model, id, lod === 'lod2');
  try {
    const before = areas(authored.geometry, '_part_index'), after = areas(prepared.geometry, '_parts');
    for (const name of ['torso', 'head', 'armL', 'armR', 'legL', 'legR']) {
      const part = authored.clip.parts.indexOf(name); if (part < 0) continue;
      expect(after.get(part)! / before.get(part)!, name).toBeGreaterThanOrEqual(.9799);
    }
  } finally { authored.geometry.dispose(); prepared.geometry.dispose(); disposeCivilianSource(model); }
});
