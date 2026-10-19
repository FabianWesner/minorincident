import { expect, test } from 'vitest';
import { BufferGeometry, Color, InstancedBufferAttribute, InterleavedBufferAttribute, StreamDrawUsage } from 'three/webgpu';
import { CivilianCrowd } from '../../../src/render/npc/CivilianCrowd';
import { crowdVertexLayout, writeCrowdAppearance } from '../../../src/render/characters/CrowdAppearance';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

test('T-E18-instance-stream @E18-AC01 @E22-AC20 civilian streams preserve every float, slot and attribute location with one buffer', () => {
  const world = { scenario: 'L4', infected: { director: { tier: 'low' } } } as SimWorld;
  const crowd = new CivilianCrowd(world);
  type Batch = { frame: InterleavedBufferAttribute; tint: InterleavedBufferAttribute; overlay: InterleavedBufferAttribute };
  const batches = (crowd as unknown as { batches: Batch[] }).batches;
  try {
    expect(batches.length).toBeGreaterThan(0);
    for (const b of batches) {
      expect(b.frame.data).toBe(b.tint.data); expect(b.overlay.data).toBe(b.tint.data);
      expect(b.frame.data.stride).toBe(9); expect(b.frame.data.usage).toBe(StreamDrawUsage);
      expect(b.frame.count).toBe(350); expect(b.tint.count).toBe(350); expect(b.overlay.count).toBe(350);
    }
    const b = batches[0], size = b.frame.count;
    const frame = new InstancedBufferAttribute(new Float32Array(size), 1);
    const tint = new InstancedBufferAttribute(new Float32Array(size * 4), 4);
    const overlay = new InstancedBufferAttribute(new Float32Array(size * 4), 4);
    for (let i = 0; i < size; i++) {
      const shirt = new Color(i % 2 ? '#486e69' : '#b95862'), phase = i * .123;
      b.frame.setX(i, phase); frame.setX(i, phase);
      b.overlay.setXYZW(i, .4, i % 2, i / size, i + 4096); overlay.setXYZW(i, .4, i % 2, i / size, i + 4096);
      for (const attribute of [b.tint, tint]) writeCrowdAppearance(attribute, i, i + 5, shirt, phase, i % 16, i % 3 === 0);
    }
    for (let i = 0; i < size; i++) {
      expect(b.frame.getX(i)).toBe(frame.getX(i));
      expect([b.tint.getX(i), b.tint.getY(i), b.tint.getZ(i), b.tint.getW(i)]).toEqual([tint.getX(i), tint.getY(i), tint.getZ(i), tint.getW(i)]);
      expect([b.overlay.getX(i), b.overlay.getY(i), b.overlay.getZ(i), b.overlay.getW(i)]).toEqual([overlay.getX(i), overlay.getY(i), overlay.getZ(i), overlay.getW(i)]);
    }
    const packed = new BufferGeometry().setAttribute('_frame', b.frame).setAttribute('_variant', b.tint).setAttribute('_overlay', b.overlay);
    const separate = new BufferGeometry().setAttribute('_frame', frame).setAttribute('_variant', tint).setAttribute('_overlay', overlay);
    expect(crowdVertexLayout(separate).buffers).toBe(3); expect(crowdVertexLayout(packed).buffers).toBe(1);
    expect(crowdVertexLayout(packed).locations).toBe(crowdVertexLayout(separate).locations);
    b.frame.data.addUpdateRange(0, 21 * 9); b.frame.data.needsUpdate = true;
    expect(b.frame.data.updateRanges).toEqual([{ start: 0, count: 189 }]);
    expect(b.tint.data.version).toBe(1); expect(b.overlay.data.version).toBe(1);
    packed.dispose(); separate.dispose();
  } finally { crowd.dispose(); }
});
