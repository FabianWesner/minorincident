import { expect, test } from 'vitest';
import { NodeBuilder, WebGLCoordinateSystem } from 'three/webgpu';
import { uniform, vec2 } from 'three/tsl';
import { bloodSplatMask, cloudShadowMask } from '../../../src/render/SurfaceDetail';

interface SetupBuilder {
  setBuildStage(stage: 'setup'): void; setShaderStage(stage: 'fragment'): void;
  addStack(): void; removeStack(): void;
  nodes: Set<{ type: string }>;
}
const Builder = NodeBuilder as unknown as new (object: null, renderer: { coordinateSystem: number; hasCompatibility(): boolean }, parser: null) => SetupBuilder;
for (const strength of [0, 1]) for (const mask of ['blood', 'cloud'] as const) test(`PO #98 inactive ${mask} math stays behind a uniform branch (${strength})`, () => {
  const builder = new Builder(null, { coordinateSystem: WebGLCoordinateSystem, hasCompatibility: () => false }, null);
  builder.setBuildStage('setup'); builder.setShaderStage('fragment'); builder.addStack();
  try {
    const amount = uniform(strength), point = vec2(.1, .2);
    const node = mask === 'blood' ? bloodSplatMask({ coverage: amount, point }) : cloudShadowMask({ strength: amount, point });
    (node as unknown as { build(builder: SetupBuilder): void }).build(builder);
    const branches = [...builder.nodes].filter(n => n.type === 'ConditionalNode'); expect(branches).toHaveLength(1);
    const condition = (branches[0] as unknown as { condNode: { node: { op: string; aNode: { value: number }; bNode: { value: number } } } }).condNode.node;
    expect(condition.op).toBe('>'); expect(condition.aNode.value).toBe(strength); expect(condition.bNode.value).toBe(0);
  } finally { builder.removeStack(); }
});
