import { Document } from '@gltf-transform/core';
import type { AssetDef } from '../../../src/assets/types';
export function fixture(): { doc: Document; def: AssetDef } {
  const doc = new Document(), buffer = doc.createBuffer();
  const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,0, 1,0,0, 0,1,1])).setBuffer(buffer);
  const material = doc.createMaterial('pal_survivorRed');
  const mesh = doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos).setMaterial(material));
  const body = doc.createNode('body').setMesh(mesh), front = doc.createNode('front').setTranslation([1,0,0]);
  const scene = doc.createScene().addChild(body).addChild(front);
  doc.getRoot().setDefaultScene(scene);
  const def: AssetDef = { id: 'prop.test', category: 'prop', status: 'modeled', tier: 'side', glb: 'test.glb', dimensions: { x: 1, y: 1, z: 1, tolerance: .05 }, forward: '+X', frontNodes: ['front'], requiredNodes: ['body'], animatedNodes: ['body'], sockets: ['front'], budget: { triangles: 2, materials: 1, fileKB: 2, drawCalls: 1 }, decayVariants: [] };
  return { doc, def };
}
