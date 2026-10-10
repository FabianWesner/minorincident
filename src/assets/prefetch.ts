import manifest from './manifest.json';
import { compositions } from '../levels/compositions';
import type { DistrictLayout } from '../levels/districts/types';
import { assetUrl } from './assetUrl';
import { districtAssetUrls } from './DistrictAssets';
import { coreCivilianModels, l1Pedestrians } from '../data/npcs';
import { l5Survivors } from '../data/l5';
import { l6CastModels } from '../data/l6';
import { l2Dressing } from '../levels/L2/layout';
import { l3Dressing } from '../levels/L3/layout';
import { l4Dressing } from '../levels/L4/layout';
import { l5Dressing, l5ShellAssets } from '../levels/L5/layout';
import { atLeast, variantPath, type AssetDef } from './types';
import { l1AftermathDressing } from '../levels/continuity';
import { infectedDef } from '../data/infected';
import { catalog } from '../data/actions/catalog';

const definitions = new Map((manifest as AssetDef[]).map(def => [def.id, def]));
const definition = (id: string): AssetDef => { const def = definitions.get(id); if (!def) throw new Error(`Unknown asset ID ${id}`); return def; };
const started = new Set<string>();

/** Warm the HTTP cache with a level's district data (layout JSON + GLB, placement LOD2 models)
 * while the player is still in the menus. Low priority, a few requests at a time; the real load
 * then reads from the cache (or joins the in-flight response). Never throws. */
export async function prefetchLevel(level: string, concurrency = 4, quality: 'high' | 'low' = 'high'): Promise<void> {
  const composition = compositions[level];
  const key = `${level}:${quality}`;
  if (!composition || started.has(key)) return;
  started.add(key);
  const get = (url: string) => fetch(assetUrl(url), { priority: 'low' } as RequestInit);
  try {
    const layouts = await Promise.all(composition.districts.map(async ({ id }) => (await get(`/assets/layouts/${id}.layout.json`)).json() as Promise<DistrictLayout>));
    const urls = new Set<string>(composition.districts.map(({ id }) => `/assets/layouts/${id}.base.glb`));
    const add = (id: string, decay?: string) => {
      try {
        for (const url of districtAssetUrls(id, definition, ['lod2'])) urls.add(variantPath(url, decay));
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
    const actors = new Set(level === 'L6' ? [...l6CastModels, ...l1Pedestrians.models] : [...coreCivilianModels, ...(level === 'L5' ? l5Survivors.map(s => s.model) : [])]);
    actors.add('char.corgi'); actors.add(infectedDef('infected.runner').asset);
    for (const id of actors) {
      const def = definitions.get(id); if (!def || !atLeast(def.status, 'integrated')) continue;
      for (const path of [def.lods?.lod1 ?? def.glb, def.lods?.lod2 ?? def.glb, ...(quality === 'high' ? [def.glb] : [])]) if (path) urls.add('/' + path.replace(/^public\//, ''));
    }
    for (const variant of ['female', 'male']) {
      const def = definitions.get(`char.courier-${variant}`); if (def?.glb) urls.add('/' + def.glb.replace(/\.glb$/, '.skin.glb').replace(/^public\//, ''));
    }
    // Weapon/action view models load one after another in ActionView: warm them too.
    for (const def of Object.values(catalog)) {
      if (level === 'L1' && !['weapon.bat', 'weapon.crowbar', 'weapon.machete'].includes(def.id)) continue;
      const asset = definitions.get(def.viewAssetId); if (asset?.glb && atLeast(asset.status, 'integrated')) urls.add('/' + asset.glb.replace(/^public\//, ''));
    }
    const queue = [...urls];
    await Promise.all(Array.from({ length: concurrency }, async () => {
      for (let url = queue.shift(); url; url = queue.shift()) { try { await (await get(url)).arrayBuffer(); } catch { /* best effort */ } }
    }));
  } catch { started.delete(key); /* best effort: allow a later attempt after a failed layout fetch */ }
}
