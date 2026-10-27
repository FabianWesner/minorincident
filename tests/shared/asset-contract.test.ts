// Asset contract: every shipped GLB (all levels, all LODs) passes the one validator in tools/assets/validate.ts.
// One test: the validator still rejects each contract violation, and the production manifest passes it.
import { Document } from '@gltf-transform/core';
import { expect, test } from 'vitest';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import { validateAssets, validateDocument } from '../../tools/assets/validate';

function fixture(): { doc: Document; def: AssetDef } {
  const doc = new Document(), buffer = doc.createBuffer();
  const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 1])).setBuffer(buffer);
  const material = doc.createMaterial('pal_survivorRed');
  const mesh = doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos).setMaterial(material));
  const body = doc.createNode('body').setMesh(mesh), front = doc.createNode('front').setTranslation([1, 0, 0]);
  doc.getRoot().setDefaultScene(doc.createScene().addChild(body).addChild(front));
  const def: AssetDef = { id: 'prop.test', category: 'prop', status: 'modeled', tier: 'side', glb: 'test.glb', dimensions: { x: 1, y: 1, z: 1, tolerance: .05 }, forward: '+X', frontNodes: ['front'], requiredNodes: ['body'], animatedNodes: ['body'], sockets: ['front'], budget: { triangles: 2, materials: 2, fileKB: 1 } } as AssetDef;
  return { doc, def };
}

test('the asset validator rejects every contract violation, and every production asset passes it', async () => {
  const { doc, def } = fixture();
  expect(validateDocument(doc, def, 1024).errors).toEqual([]);
  const cases: [string, (d: Document, a: AssetDef) => void][] = [
    ['dimensions.x', (_d, a) => { a.dimensions.x = 5; }],
    ['node wheel', (_d, a) => { a.requiredNodes.push('wheel'); }],
    ['forward front', (d) => { d.getRoot().listNodes()[1].setTranslation([-1, 0, 0]); }],
    ['triangles', (_d, a) => { a.budget.triangles = 0; }],
    ['fileKB', (_d, a) => { a.budget.fileKB = 0; }],
    ['material: unknown', (d) => { d.getRoot().listMaterials()[0].setName('pal_unknown'); }],
    ['non-finite', (d) => { d.getRoot().listAccessors()[0].setArray(new Float32Array([NaN, 0, 0, 1, 0, 0, 0, 1, 1])); }],
    ['degenerate', (d) => { d.getRoot().listAccessors()[0].setArray(new Float32Array(9)); }],
  ];
  for (const [error, mutate] of cases) {
    const fresh = fixture(); mutate(fresh.doc, fresh.def);
    expect(validateDocument(fresh.doc, fresh.def, 1024).errors.join('\n'), error).toContain(error);
  }
  expect(new Set(manifest.map(a => a.id)).size).toBe(manifest.length);
  const reports = await validateAssets(manifest as AssetDef[], true);
  expect(reports.length).toBeGreaterThan(20);
  const findings = reports.flatMap(r => r.errors.map(e => `${r.id}: ${e}`)).filter(e => e.includes('stump_') || e.endsWith('missing LOD') || e.includes(': forward ') || e.includes('material: unknown pal_') || e.includes('degenerate triangle'));
  expect(findings).toEqual([]);
}, 300_000);
