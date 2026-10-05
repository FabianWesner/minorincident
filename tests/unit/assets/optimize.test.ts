import { expect, test } from 'vitest';
import { assetIO } from '../../../tools/assets/io';
import { optimizeDocument } from '../../../tools/assets/optimize';
import { fixture } from './fixture';

test('T-E17-03 @E17-AC03 join/quantize/meshopt preserve named parts and world pivots through roundtrip', async () => {
  const { doc, def } = fixture();
  const body = doc.getRoot().listNodes()[0];
  body.setTranslation([3.123, 2.234, -4.345]);
  const wheel = doc.createNode('wheel').setMesh(body.getMesh()).setTranslation([.31, .4, .52]);
  body.addChild(wheel);
  def.requiredNodes.push('wheel'); def.animatedNodes.push('wheel');
  const before = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n.getWorldTranslation()]));
  await optimizeDocument(doc, def);
  const io = await assetIO(), result = await io.readBinary(await io.writeBinary(doc));
  for (const [name, pivot] of before) {
    const nodes = result.getRoot().listNodes().filter((n) => n.getName() === name);
    expect(nodes).toHaveLength(1);
    expect(Math.hypot(...nodes[0].getWorldTranslation().map((v, i) => v - pivot[i]))).toBeLessThanOrEqual(.001);
  }
  expect(result.getRoot().listNodes().find((n) => n.getName() === 'wheel')!.listChildren().some((n) => !!n.getMesh())).toBe(true);
});
