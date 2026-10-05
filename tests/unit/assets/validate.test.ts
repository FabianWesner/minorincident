import { expect, test } from 'vitest';
import type { Document } from '@gltf-transform/core';
import { fixture } from './fixture';
import { readFileSync } from 'node:fs';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { parseInventory } from '../../../tools/assets/inventory';
import { validateDocument, geometryHash, validateAssets } from '../../../tools/assets/validate';

test('T-E17-02 @E17-AC02 validates geometry and rejects independent contract violations', () => {
  const { doc, def } = fixture();
  expect(validateDocument(doc, def, 1024).errors).toEqual([]);
  const cases: [string, (d: Document, a: AssetDef) => void][] = [
    ['dimensions.x', (_d,a) => a.dimensions.x = 5],
    ['node wheel', (_d,a) => a.requiredNodes.push('wheel')],
    ['animated front', (_d,a) => a.animatedNodes.push('front')],
    ['socket body', (_d,a) => a.sockets.push('body')],
    ['forward front', (d) => d.getRoot().listNodes()[1].setTranslation([-1,0,0])],
    ['triangles', (_d,a) => a.budget.triangles = 0],
    ['materials', (_d,a) => a.budget.materials = 0],
    ['fileKB', (_d,a) => a.budget.fileKB = 0],
    ['material: unknown', (d) => d.getRoot().listMaterials()[0].setName('pal_unknown')],
    ['material: unknown', (d) => d.getRoot().listMaterials()[0].setName('pal_constructor')],
    ['non-finite', (d) => d.getRoot().listAccessors()[0].setArray(new Float32Array([NaN,0,0, 1,0,0, 0,1,1]))],
    ['degenerate', (d) => d.getRoot().listAccessors()[0].setArray(new Float32Array([0,0,0, 0,0,0, 0,0,0]))],
  ];
  for (const [error, mutate] of cases) {
    const fresh = fixture(); mutate(fresh.doc, fresh.def);
    expect(validateDocument(fresh.doc, fresh.def, 1024).errors.join('\n'), error).toContain(error);
  }
  expect(geometryHash(fixture().doc)).toEqual(geometryHash(doc));
  doc.getRoot().listNodes()[0].setTranslation([1,0,0]);
  expect(geometryHash(doc)).not.toEqual(geometryHash(fixture().doc));
});
test('T-E17-06 @E17-AC06 every inventory table status matches the manifest', () => {
  const inventory = parseInventory(readFileSync('specs/05-asset-inventory.md', 'utf8'));
  expect(inventory.size).toBeGreaterThan(100);
  for (const [id, status] of inventory) expect(manifest.find((a) => a.id === id)?.status, id).toBe(status);
  expect(new Set(manifest.map((a) => a.id)).size).toBe(manifest.length);
});
test('T-E17-02b @E17-AC02 production outputs satisfy orientation, palette, LOD and geometry contracts', async () => {
  const assets = manifest as AssetDef[];
  const reports = await validateAssets(assets, true);
  expect(reports.length).toBeGreaterThan(20);
  const findings = reports.flatMap(r => r.errors).filter(e => e === 'missing LOD' || e.startsWith('forward ') || e.startsWith('material: unknown pal_') || e.includes('degenerate triangle'));
  expect(findings).toEqual([]);
});
