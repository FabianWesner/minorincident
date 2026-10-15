import manifest from './manifest.json' with { type: 'json' };
import { compositions } from '../levels/compositions';
import type { DistrictLayout } from '../levels/districts/types';
import { assetUrl } from './assetUrl';
import { districtAssetUrls } from './DistrictAssets';
import { coreCivilianModels, l1Pedestrians, l3CivilianModels } from '../data/npcs';
import { l5Survivors } from '../data/l5';
import { l6CastModels } from '../data/l6';
import { l2Dressing } from '../levels/L2/layout';
import { l3Dressing } from '../levels/L3/layout';
import { l4Dressing } from '../levels/L4/layout';
import { l5Dressing, l5ShellAssets } from '../levels/L5/layout';
import { atLeast, type AssetDef } from './types';
import { l1AftermathDressing } from '../levels/continuity';
import { infectedDef } from '../data/infected';
import { catalog } from '../data/actions/catalog';
import civilianBakes from './civilianBakes.json';

const definitions = new Map((manifest as AssetDef[]).map(def => [def.id, def]));
const definition = (id: string): AssetDef => { const def = definitions.get(id); if (!def) throw new Error(`Unknown asset ID ${id}`); return def; };

/** Warm the HTTP cache with a level's district data (layout JSON + GLB, placement LOD2 models)
 * while the player is still in the menus. Low priority, a few requests at a time; the real load
 * then reads from the cache (or joins the in-flight response). Caller handles best-effort failures. */
export async function prefetchLevelAssets(level: string, concurrency: number, quality: 'high' | 'low'): Promise<void> {
  const composition = compositions[level];
  if (!composition) return;
  const get = (url: string) => fetch(assetUrl(url), { priority: 'low' } as RequestInit);
  const layouts = await Promise.all(composition.districts.map(async ({ id }) => (await get(`/assets/layouts/${id}.layout.json`)).json() as Promise<DistrictLayout>));
  const urls = new Set<string>(composition.districts.map(({ id }) => `/assets/layouts/${id}.base.glb`));
  const add = (id: string, decay?: string) => {
    try {
      for (const url of districtAssetUrls(id, definition, quality === 'low' ? ['lod1', 'lod2'] : ['lod2'], decay)) urls.add(url);
      const decal = definitions.get(id)?.decalTexture; if (decal) urls.add('/' + decal.replace(/^public\//, ''));
    } catch { /* unknown ids surface in the real load */ }
  };
  for (const layout of layouts) for (const placement of layout.placements) {
    if (placement.minTier > composition.tier || placement.maxTier < composition.tier) continue;
    // Both tiers initially draw LOD2 outside the spawn. Do not download never-drawn prop tiers.
    add(placement.assetId, level === 'L5' && l5ShellAssets.includes(placement.assetId) ? 'w5' : placement.decay);
  }
  // Read the authored asset lists directly. Building a dressed layout also performs expensive
  // collision/placement checks; those belong behind the transition card, never in HTTP prefetch.
  const dressing: readonly { assetId: string; decay?: string }[] = level === 'L2' ? [...l2Dressing, ...l1AftermathDressing] : level === 'L3' ? l3Dressing : level === 'L4' ? l4Dressing : level === 'L5' ? l5Dressing : [];
  for (const entry of dressing) add(entry.assetId, entry.decay);
  if (level === 'L2') add('bld.clinic-annex', 'burned');
  if (level === 'L5') add('decay.collapsed-facade');
  if (level === 'L3' || level === 'L5') add('decay.broken-glass');
  // L1's speculative view stages its cast around the spawn. Eager HTTP prefetch
  // must not pull the later story bakes back across the Begin frontier.
  const actors = new Set(level === 'L1' ? [] : level === 'L6' ? [...l6CastModels, ...l1Pedestrians.models] : [...(level === 'L3' ? l3CivilianModels : coreCivilianModels), ...(level === 'L5' ? l5Survivors.map(s => s.model) : [])]);
  actors.add('char.corgi'); actors.add(infectedDef('infected.runner').asset);
  for (const id of actors) {
    const def = definitions.get(id);
    for (const lod of quality === 'high' ? ['lod0', 'lod1', 'lod2'] as const : ['lod1', 'lod2'] as const) {
      const baked = (civilianBakes as Record<string, string>)[`${id}:${lod}`];
      // Shipped civilian bakes include the rig. Downloading their source GLB too
      // competes with the actual load without being used by the crowd.
      if (baked) { urls.add(baked); continue; }
      if (!def || !atLeast(def.status, 'integrated')) continue;
      const path = lod === 'lod0' ? def.glb : def.lods?.[lod] ?? def.glb;
      if (path) urls.add('/' + path.replace(/^public\//, ''));
    }
  }
  for (const variant of ['female', 'male']) {
    const def = definitions.get(`char.courier-${variant}`); if (def?.glb) urls.add('/' + def.glb.replace(/\.glb$/, '.skin.glb').replace(/^public\//, ''));
  }
  // Weapon/action view models load one after another in ActionView: warm them too.
  for (const def of Object.values(catalog)) {
    if (level === 'L1' && !['weapon.bat', 'weapon.crowbar', 'weapon.machete'].includes(def.id)) continue;
    const asset = definitions.get(def.viewAssetId); if (asset?.glb && atLeast(asset.status, 'integrated')) urls.add('/' + asset.glb.replace(/^public\//, ''));
  }
  // Consume responses natively: prefetch only warms HTTP cache and never needs
  // a copied JS ArrayBuffer for each multi-megabyte asset during gameplay.
  const queue = [...urls];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (let url = queue.shift(); url; url = queue.shift()) { try { await (await get(url)).blob(); } catch { /* best effort */ } }
  }));
}
