/** Pixel contrast at geometry-selected cap/lower-ground pairs from campaign-edges-capture. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { Box3, Frustum, Matrix4, PerspectiveCamera, Vector3 } from 'three';
interface Point { x: number; y: number }
interface Row {
  player: { x: number; y: number; z: number };
  referenceSurface?: string;
  name: string; light: string; spot: { level: string; name: string };
  probes: { fraction: number; cap: Point; lower: Point; capWorld: number[]; lowerWorld: number[] }[];
  figures: { x: number; y: number; z: number }[];
  camera: { position: number[]; target: number[]; fov: number };
}
const folder = 'test-results/edges-all/captures';
const rows = JSON.parse(readFileSync(`${folder}/evidence.json`, 'utf8')) as Row[];
const results = rows.map(row => {
  const png = PNG.sync.read(readFileSync(`${folder}/${row.name}.png`));
  const camera = new PerspectiveCamera(row.camera.fov, png.width / png.height, .1, 600);
  camera.position.fromArray(row.camera.position); camera.lookAt(new Vector3().fromArray(row.camera.target)); camera.updateMatrixWorld();
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const figureRects = row.figures.flatMap(f => {
    if (!frustum.intersectsBox(new Box3(new Vector3(f.x - .8, f.y - .72, f.z - .8), new Vector3(f.x + .8, f.y + 1.4, f.z + .8)))) return [];
    const centre = new Vector3(f.x, f.y + .2, f.z).project(camera);
    if (centre.z < -1 || centre.z > 1) return [];
    const pixels = [];
    for (const dx of [-.8, .8]) for (const dz of [-.8, .8]) for (const dy of [-.72, 1.4]) {
      const v = new Vector3(f.x + dx, f.y + dy, f.z + dz).project(camera); pixels.push({ x: (v.x + 1) * png.width / 2, y: (1 - v.y) * png.height / 2 });
    }
    return [{ minX: Math.min(...pixels.map(p => p.x)) - 2, maxX: Math.max(...pixels.map(p => p.x)) + 2, minY: Math.min(...pixels.map(p => p.y)) - 2, maxY: Math.max(...pixels.map(p => p.y)) + 2 }];
  });
  const revealPoints: Vector3[] = [], feet = row.player.y - .7;
  for (const dx of [-.55, .55]) for (const dz of [-.55, .55]) for (const dy of [0, 1.9]) revealPoints.push(new Vector3(row.player.x + dx, feet + dy, row.player.z + dz));
  const revealDepth = Math.min(...revealPoints.map(p => p.clone().applyMatrix4(camera.matrixWorldInverse).z)) - .05;
  const rp = revealPoints.map(p => p.clone().project(camera));
  const xs = rp.map(p => (p.x + 1) * png.width / 2), ys = rp.map(p => (1 - p.y) * png.height / 2);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  const reveal = { x: (left + right) / 2, y: (top + bottom) / 2, radius: Math.hypot(right - left, bottom - top) / 2 / .85 };
  const revealed = (p: Row['probes'][number]) => {
    const cap = new Vector3().fromArray(p.capWorld);
    return cap.y > feet + .3 && cap.applyMatrix4(camera.matrixWorldInverse).z > revealDepth && Math.hypot(p.cap.x - reveal.x, p.cap.y - reveal.y) < reveal.radius + 3;
  };
  const overlaid = (p: Point) => figureRects.some(r => p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY);
  const samples = (row.probes ?? []).filter(p => !overlaid(p.cap) && !overlaid(p.lower) && !revealed(p)).map(p => {
    const capLuminance = luminance(png, p.cap), lowerLuminance = luminance(png, p.lower);
    const ratio = (Math.max(capLuminance, lowerLuminance) + .05) / (Math.min(capLuminance, lowerLuminance) + .05);
    return { ...p, capLuminance, lowerLuminance, ratio };
  });
  const minimumRatio = samples.length ? Math.min(...samples.map(p => p.ratio)) : null;
  console.log(`${row.name}: ${minimumRatio?.toFixed(2) ?? 'unmeasured'} (${samples.length})`);
  return { name: row.name, level: row.spot.level, spot: row.spot.name, light: row.light, referenceSurface: row.referenceSurface ?? 'visible lower ground', minimumRatio, reveal, samples };
});
writeFileSync(`${folder}/contrast.json`, JSON.stringify({ method: 'Relative linear sRGB luminance; median 3x3 pixel patches at preselected world points. Visible cap and nearest lower ground selected by actual scene triangle raycasts (Northgate platform uses its continuous adjacent 0.6 m landing); conservative figure bounds and the bounded courier reveal disc excluded. No brightness-based sample selection.', results }, null, 2));
if (!process.argv.includes('--report-only')) for (const row of results.filter(r => r.light === 'night')) {
  assert.notEqual(row.minimumRatio, null, `${row.name}: no visible measurement`);
  assert.ok(row.minimumRatio! >= 2.5, `${row.name}: ${row.minimumRatio} < 2.5`);
}
function luminance(png: PNG, p: Point): number {
  const values: number[] = [], x = Math.round(p.x), y = Math.round(p.y);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const i = ((y + dy) * png.width + x + dx) * 4;
    const rgb = [0, 1, 2].map(c => { const v = png.data[i + c] / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    values.push(rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722);
  }
  return values.sort((a, b) => a - b)[4];
}
