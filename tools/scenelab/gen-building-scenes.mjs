// Writes specs/scenes/catalog/bld-<district>-<family>.json: one turntable scene per building family per district,
// from the shipped layouts (public/assets/layouts/*.layout.json). Re-run after a layout adds a building family:
//   node tools/scenelab/gen-building-scenes.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const out = 'specs/scenes/catalog';
mkdirSync(out, { recursive: true });
const r = n => Math.round(n * 10) / 10;
let written = 0;
for (const file of readdirSync('public/assets/layouts').filter(f => f.endsWith('.layout.json'))) {
  const layout = JSON.parse(readFileSync(`public/assets/layouts/${file}`, 'utf8')), district = layout.district;
  const seen = new Set();
  for (const p of layout.placements) {
    if (!p.assetId.startsWith('bld.') || seen.has(p.assetId)) continue;
    seen.add(p.assetId);
    const { min, max } = p.visualAabb, cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
    const w = max[0] - min[0], d = max[2] - min[2], h = max[1] - min[1], diag = Math.hypot(w, d);
    const kit = layout.placements.filter(k => k.assetId.startsWith('house.') && k.position[0] >= min[0] - 3 && k.position[0] <= max[0] + 3 && k.position[2] >= min[2] - 3 && k.position[2] <= max[2] + 3).map(k => k.id);
    const half = Math.max(w, d) / 2 + 4, family = p.assetId.slice(4), name = `bld-${district.slice(2).toLowerCase()}-${family}`;
    const spec = {
      name,
      note: `${district} ${p.assetId} (${p.id}) alone on its baked ground, game-camera turntable (one full turn in 6 s). Look for: missing walls or roof, floating or sunk parts, flat or boxy shells, wrong LOD swaps while the camera orbits.`,
      ground: 'district',
      layout: { district, bbox: [[r(cx - half), r(cz - half)], [r(cx + half), r(cz + half)]], ids: [p.id, ...kit] },
      camera: { mode: 'orbit', target: [r(cx), r(Math.min(h * 0.4, 4)), r(cz)], radius: r(Math.max(24, diag * 2)), azimuth: 45, polar: 54, spin: 60 },
      frames: 360, sheet: 30,
      clipping: { ignoreFoliage: true },
      expect: { consoleErrors: 0, clippingMax: 0 },
    };
    writeFileSync(`${out}/${name}.json`, JSON.stringify(spec, null, 1) + '\n');
    written++;
  }
}
console.log(`${written} building scenes`);
