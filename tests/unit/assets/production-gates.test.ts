import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { pendingMilestone } from '../../../tools/assets/milestone';
import { reviewErrors, needsHuman } from '../../../tools/assets/review';
import { fixture } from './fixture';

test('T-E17-09 @E17-AC09 production gate accepts integrated art and rejects missing exports', () => {
  const assets=manifest as AssetDef[];
  expect(pendingMilestone(assets,['char.survivor-female','inf.common-worker'])).toEqual([]);
  expect(pendingMilestone(assets,['util.radio','veh.fuel-truck'])).toEqual(['util.radio']);
  expect(pendingMilestone(assets,['veh.fire-engine'])).toEqual([]);
  expect(pendingMilestone(assets,['missing.asset'])).toEqual(['missing.asset']);
});
test('T-E17-10 @E17-AC10 final assets require a complete passing checklist and existing comparison', () => {
  const valid=readFileSync('assets/veh.fire-engine/review.md','utf8');
  expect(reviewErrors(valid,()=>true)).toEqual([]);
  expect(reviewErrors(valid,()=>false)).toContain('review comparison image missing');
  expect(reviewErrors(valid.replace('Verdict: PASS','Verdict: needs-human'),()=>true)).toContain('review verdict must be PASS');
  expect(reviewErrors(valid.replace(': PASS —',': FAIL —'),()=>true)).toContain('review must checklist incomplete/failed');
  expect(reviewErrors('Verdict: PASS',()=>true).length).toBeGreaterThan(0);
  for(const asset of manifest as AssetDef[])if(asset.status==='final')expect(reviewErrors(readFileSync(`assets/${asset.id}/review.md`,'utf8'))).toEqual([]);
  expect(Array.isArray(needsHuman(manifest as AssetDef[]))).toBe(true);
});
test('T-E17-11b @E17-AC11 infected validator rejects exports without hidden stump geometry', async () => {
  const { validateDocument }=await import('../../../tools/assets/validate');
  const {doc,def}=fixture();def.category='infected';
  expect(validateDocument(doc,def,0).errors).toContain('stump_armL: missing geometry');
  const body=doc.getRoot().listNodes()[0];
  for(const limb of ['head','armL','armR','foreArmL','foreArmR','legL','legR']) {
    const cap=doc.createNode(`stump_${limb}`).setMesh(body.getMesh()).setExtras({hidden:true});
    doc.getRoot().listScenes()[0].addChild(cap);
  }
  expect(validateDocument(doc,def,0).errors.filter(e=>e.startsWith('stump_'))).toEqual([]);
});
