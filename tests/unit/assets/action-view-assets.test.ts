import { expect, test } from 'vitest';
import manifest from '../../../src/assets/manifest.json';
import { catalog } from '../../../src/data/actions/catalog';
import type { AssetDef } from '../../../src/assets/types';

// PO #43 (10-19): "[assets] ability.corgi-lure fell back to a PLACEHOLDER BOX (missing lod0). Never ship this."
// Every action view asset is either a deliberate non-model (abilities, UI) or an integrated asset with a GLB: never a placeholder box.
test('@E17 no action resolves to a placeholder box', () => {
  const defs = new Map((manifest as unknown as AssetDef[]).map(a => [a.id, a]));
  const bad = Object.values(catalog).filter(action => { const def = defs.get(action.viewAssetId); return !def || (!def.nonModel && !(def.glb && ['integrated', 'final'].includes(def.status))); }).map(action => `${action.id} -> ${action.viewAssetId}`);
  expect(bad).toEqual([]);
  for (const action of Object.values(catalog).filter(a => a.category === 'ability')) expect(defs.get(action.viewAssetId)?.nonModel, action.id).toBe('ability');
});
