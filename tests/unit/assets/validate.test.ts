import { expect, test } from 'vitest';
import type { Document } from '@gltf-transform/core';
import { fixture } from './fixture';
import { readFileSync } from 'node:fs';
import manifest from '../../../src/assets/manifest.json';
import { atLeast, type AssetDef } from '../../../src/assets/types';
import { parseInventory } from '../../../tools/assets/inventory';
import { validateDocument, geometryHash, validateAssets, rigDrawErrors } from '../../../tools/assets/validate';
import { lodTriangleLimit } from '../../../tools/assets/delivery';

test('cheap LODs retain silhouettes while dense scenery still has a ratio budget', () => {
  expect(lodTriangleLimit(1800, 2)).toBe(1800);
  expect(lodTriangleLimit(12000, 2)).toBe(3000);
  expect(lodTriangleLimit(100000, 1)).toBe(15500);
  expect(lodTriangleLimit(100000, 2)).toBe(4500);
  const { def } = fixture(); def.id = 'wpn.test'; def.category = 'weapon';
  expect(lodTriangleLimit(5800, 1, def)).toBe(5800);
  expect(lodTriangleLimit(8000, 1, def)).toBe(3000);
});

test('living skins count animated materials and compare only their shipped group member', () => {
  const { doc, def } = fixture(), base = fixture().doc;
  def.category = 'character'; def.rigDrawBase = { id: 'npc.base', member: 'body' };
  const mesh = doc.getRoot().listMeshes()[0];
  expect(rigDrawErrors(doc, def, base)).toEqual([]);
  mesh.addPrimitive(mesh.listPrimitives()[0].clone());
  // A sibling in a group must not increase the selected adult's allowance.
  base.getRoot().listScenes()[0].addChild(base.createNode('other-adult').setMesh(base.getRoot().listMeshes()[0]));
  expect(rigDrawErrors(doc, def, base)).toEqual(['animated-owner drawCalls: 2 > shipped base 1']);
  expect(validateDocument(doc, def, 1024).errors).toContain('animated-owner drawCalls: 2 > 1');
  def.rigDrawBase.member = 'missing';
  expect(rigDrawErrors(doc, def, base)).toEqual(['rigDrawBase: missing member missing']);
});

test('living skins retain the base crowd animation and infection classifications', () => {
  const { doc, def } = fixture(), base = fixture().doc;
  base.getRoot().listNodes()[0].setName('torso');
  base.getRoot().listMaterials()[0].setName('pal_skinWarm');
  base.createMaterial('pal_eyeBrown');
  def.rigDrawBase = { id: 'npc.base' };
  expect(rigDrawErrors(doc, def, base)).toEqual([
    'living rig: added body node selects animal clips',
    'living rig: lost ^pal_skin material classification',
    'living rig: lost ^pal_eyeBrown$ material classification',
  ]);
  doc.getRoot().listNodes()[0].setName('torso');
  doc.getRoot().listMaterials()[0].setName('pal_skinWarm');
  doc.createMaterial('pal_eyeBrown');
  expect(rigDrawErrors(doc, def, base)).toEqual([]);
});

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
test('T-E17-06 @E17-AC06 current manifest status meets every inventory snapshot stage', () => {
  const inventory = parseInventory(readFileSync('specs/05-asset-inventory.md', 'utf8'));
  expect(inventory.size).toBeGreaterThan(100);
  for (const [id, status] of inventory) expect(atLeast(manifest.find((a) => a.id === id)!.status as AssetDef['status'], status), id).toBe(true);
  expect(new Set(manifest.map((a) => a.id)).size).toBe(manifest.length);
});
test('T-E17-02b @E17-AC02 production outputs satisfy orientation, palette, LOD, stump and geometry contracts', async () => {
  const assets = manifest as AssetDef[];
  const reports = await validateAssets(assets, true);
  expect(reports.length).toBeGreaterThan(20);
  const findings = reports.flatMap(r => r.errors).filter(e => e.includes('stump_') || e === 'missing LOD' || e.startsWith('forward ') || e.startsWith('material: unknown pal_') || e.includes('degenerate triangle'));
  expect(findings).toEqual([]);
}, 300_000); // Decode the complete production inventory on the shared build machine.

// Absolute caps must survive permissive manifest budgets and authored ratios.
test.each([['veh.test', 'vehicle', 1, 6000], ['veh.test', 'vehicle', 2, 2000], ['bld.house-test', 'building', 1, 12000], ['bld.house-test', 'building', 2, 4000], ['house.test', 'building', 2, 4000], ['bld.safe-house', 'building', 1, 12000]] as const)('distance cap for %s LOD%d cannot be relaxed by the manifest', (id, category, lod, cap) => {
  const { doc, def } = fixture();
  def.id = id; def.category = category; def.budget.triangles = 100000;
  def.authoredLodTriangles = { lod1: 100000, lod2: 100000 };
  const buffer = doc.getRoot().listBuffers()[0];
  const primitive = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const indices = doc.createAccessor().setType('SCALAR').setBuffer(buffer);
  primitive.setIndices(indices);
  indices.setArray(Uint16Array.from({ length: cap * 3 }, (_, i) => i % 3));
  expect(validateDocument(doc, def, 1024, lod).errors.some(e => e.startsWith('delivery: LOD'))).toBe(false);
  indices.setArray(Uint16Array.from({ length: (cap + 1) * 3 }, (_, i) => i % 3));
  expect(validateDocument(doc, def, 1024, lod).errors).toContain(`delivery: LOD${lod} triangles ${cap + 1} > ${cap}`);
});

test('@E17-AC02 decay caps apply to variants without changing the integrated base budget', async () => {
  const original = manifest.find(a => a.id === 'veh.sedan-red')! as AssetDef;
  const reports = await validateAssets([{ ...original, decayBudget: { triangles: 0, materials: 0, drawCalls: 0 } }]);
  expect(reports.filter(r => r.id.startsWith('veh.sedan-red:')).flatMap(r => r.errors)).toEqual([]);
  const variants = reports.filter(r => r.id.startsWith('veh.sedan-red.wrecked:'));
  expect(variants).toHaveLength(3);
  for (const report of variants) {
    expect(report.errors.some(e => e.startsWith('materials:'))).toBe(true);
    expect(report.errors.some(e => e.startsWith('static drawCalls:'))).toBe(true);
  }
  expect(variants.filter(r => r.id.endsWith(':lod0')).every(r => r.errors.some(e => e.startsWith('triangles:')))).toBe(true);
});

test('@E17-AC02 burned budgets reject oversized siblings without altering existing wreck limits', async () => {
  const original = manifest.find(a => a.id === 'veh.sedan-red')! as AssetDef;
  const reports = await validateAssets([{ ...original, decayBudgets: { burned: { materials: 0, drawCalls: 0 } } }]);
  expect(reports.filter(r => !r.id.includes('.burned:')).flatMap(r => r.errors)).toEqual([]);
  const burned = reports.filter(r => r.id.includes('.burned:'));
  expect(burned).toHaveLength(3);
  for (const report of burned) {
    expect(report.errors.some(e => e.startsWith('materials:'))).toBe(true);
    expect(report.errors.some(e => e.startsWith('static drawCalls:'))).toBe(true);
  }
});

test('living skins count animated material draws and reject duplicate attachment batches', () => {
  const { doc, def } = fixture();
  def.category = 'character';
  def.rigidDrawBase = 'npc.civilian-man-a';
  def.animatedNodes = ['body'];
  def.budget.drawCalls = 1;
  const first = validateDocument(doc, def, 1024);
  expect(first.animatedDrawCalls).toBe(1);
  expect(first.errors).toEqual([]);
  const owner = doc.getRoot().listNodes().find(node => node.getName() === 'body')!;
  owner.addChild(doc.createNode('bandage').setMesh(owner.getMesh()));
  const attached = validateDocument(doc, def, 1024);
  expect(attached.animatedDrawCalls).toBe(2);
  expect(attached.errors).toContain('drawCalls including animated owners: 2 > 1');
  expect(attached.errors.join('\n')).toContain('static attachments must share their owner material batch');
});
// Animated attachments used to bypass the static draw gate entirely.
test('living adult draw cap counts geometry under animated owners', () => {
  const { doc, def } = fixture();
  def.category = 'character'; def.animatedDrawBase = 'npc.civilian-man-a';
  expect(validateDocument(doc, def, 1024).errors).toEqual([]);
  const body = doc.getRoot().listNodes().find(n => n.getName() === 'body')!;
  body.addChild(doc.createNode('bandage').setMesh(body.getMesh()));
  def.budget.triangles = 10;
  expect(validateDocument(doc, def, 1024).errors).toContain('animated-owner drawCalls: 2 > 1');
});
