import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { PerspectiveCamera, Vector3 } from 'three';
import { compositions } from '../../src/levels/compositions';
import { levelSevenLayouts } from '../../src/levels/L7/layout';
import { DistrictWorld } from '../../src/sim/world/DistrictWorld';
import type { DistrictLayout } from '../../src/levels/districts/types';
const stage = process.env.L7_STAGE ?? 'after', folder = `test-results/l7-readability/${stage}`;
const world = new DistrictWorld(compositions.L7, levelSevenLayouts([JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as DistrictLayout]), 2);
interface Figure { x: number; y: number; z: number }
interface Row { figures?: Figure[]; edge: { z: number; upperZ: number; outward: number; offsets: number[] }; overlays: { x: number; y: number; width: number; height: number }[]; name: string; player: Figure; camera: { position: number[]; target: number[]; fov: number } }
const rows = JSON.parse(readFileSync(`${folder}/evidence.json`, 'utf8')) as Row[];
const output = [];
for (const row of rows) {
  const png = PNG.sync.read(readFileSync(`${folder}/${row.name}.png`));
  const camera = new PerspectiveCamera(row.camera.fov, png.width / png.height, .1, 600);
  camera.position.fromArray(row.camera.position); camera.lookAt(new Vector3().fromArray(row.camera.target)); camera.updateMatrixWorld();
  const revealPoints: Vector3[] = [], feet = row.player.y - .7;
  for (const dx of [-.55, .55]) for (const dz of [-.55, .55]) for (const dy of [0, 1.9]) revealPoints.push(new Vector3(row.player.x + dx, feet + dy, row.player.z + dz));
  const revealDepth = Math.min(...revealPoints.map(p => p.clone().applyMatrix4(camera.matrixWorldInverse).z)) - .05;
  const revealPixels = revealPoints.map(p => p.clone().project(camera));
  const left = Math.min(...revealPixels.map(p => (p.x + 1) * png.width / 2)), right = Math.max(...revealPixels.map(p => (p.x + 1) * png.width / 2));
  const top = Math.min(...revealPixels.map(p => (1 - p.y) * png.height / 2)), bottom = Math.max(...revealPixels.map(p => (1 - p.y) * png.height / 2));
  const reveal = { x: (left + right) / 2, y: (top + bottom) / 2, radius: Math.hypot(right - left, bottom - top) / 2 / .85 };
  const figureRects = (row.figures ?? [row.player]).flatMap(figure => {
    const centre = new Vector3(figure.x, figure.y + .2, figure.z).project(camera);
    if (centre.z < -1 || centre.z > 1) return [];
    const points: Vector3[] = [];
    for (const dx of [-.8, .8]) for (const dz of [-.8, .8]) for (const dy of [-.72, 1.4]) points.push(new Vector3(figure.x + dx, figure.y + dy, figure.z + dz).project(camera));
    const xs = points.map(p => (p.x + 1) * png.width / 2), ys = points.map(p => (1 - p.y) * png.height / 2);
    const x = Math.min(...xs), y = Math.min(...ys); return [{ x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }];
  });
  row.overlays = [...row.overlays, ...figureRects];
  const samples = [];
  for (const dx of [...new Set(row.edge.offsets.flatMap(dx => [dx - .5, dx, dx + .5]))].sort((a, b) => a - b)) {
    const x = row.player.x + dx, edgeZ = row.edge.z, direction = row.edge.outward, upper = world.pavingHeight(x, row.edge.upperZ);
    if (upper - world.pavingHeight(x, edgeZ + direction * .08) <= .3) continue;
    const capWorld = new Vector3(x, upper + .025, edgeZ - direction * .12);
    const cutEligible = capWorld.y > feet + .3 && capWorld.clone().applyMatrix4(camera.matrixWorldInverse).z > revealDepth;
    const cap = capWorld.project(camera);
    const rim = [Math.round((cap.x + 1) * png.width / 2), Math.round((1 - cap.y) * png.height / 2)];
    if (!inFrame(rim, png) || overlaid(rim, row) || (cutEligible && Math.hypot(rim[0] - reveal.x, rim[1] - reveal.y) < reveal.radius + 3)) continue;
    // Choose the nearest lower ground actually visible from this camera. A
    // projected ground point behind the retaining face would measure the wall.
    let lower: number[] | undefined;
    for (let offset = .5; offset <= 20; offset += .25) {
      const z = edgeZ + direction * offset, height = world.pavingHeight(x, z);
      if (upper - height <= .3) continue;
      const point = new Vector3(x, height || (row.player.x < 85 ? .05 : -.12), z);
      let blocked = false;
      const distance = camera.position.distanceTo(point), steps = Math.ceil(distance / .1);
      for (let j = 1; j < steps; j++) {
        const t = j / steps, px = camera.position.x + (point.x - camera.position.x) * t, pz = camera.position.z + (point.z - camera.position.z) * t;
        const h = world.pavingHeight(px, pz), y = camera.position.y + (point.y - camera.position.y) * t;
        if (h > .3 && h + .3 > y) { blocked = true; break; }
      }
      if (blocked) continue;
      point.project(camera); const pixel = [Math.round((point.x + 1) * png.width / 2), Math.round((1 - point.y) * png.height / 2)];
      if (inFrame(pixel, png) && !overlaid(pixel, row)) { lower = pixel; break; }
    }
    if (!lower) continue;
    const upperLuminance = medianPatch(png, rim), lowerLuminance = medianPatch(png, lower);
    const ratio = (Math.max(upperLuminance, lowerLuminance) + .05) / (Math.min(upperLuminance, lowerLuminance) + .05);
    samples.push({ rim, lower, upperLuminance, lowerLuminance, ratio });
  }
  const min = samples.length ? Math.min(...samples.map(s => s.ratio)) : null;
  output.push({ name: row.name, minimumRatio: min, reveal, figureRects, samples, unmeasured: !samples.length ? 'Rim or exposed lower ground outside this close camera frame' : undefined });
  console.log(`${row.name}: ${min?.toFixed(2) ?? 'outside frame'} (${samples.length} samples)`);
}
writeFileSync(`${folder}/contrast.json`, JSON.stringify({ method: 'WCAG relative sRGB luminance, 3x3 median patches. Upper cap at authored world coordinates; nearest visible lower ground selected by the terrain height field, excluding points behind the retaining face and DOM overlays, conservative projected figure bounds and the courier reveal disc where its height/depth rule applies; probes stay laterally clear of the courier; world offsets and pixel coordinates are retained. Pixel coordinates retained for review.', results: output }, null, 2));
if (stage === 'after') for (const row of output) if (row.minimumRatio !== null) assert.ok(row.minimumRatio >= 2.5, `${row.name}: ${row.minimumRatio} < 2.5`);
function inFrame(p: number[], png: PNG): boolean { return p[0] > 2 && p[0] < png.width - 3 && p[1] > 2 && p[1] < png.height - 3; }
function medianPatch(png: PNG, p: number[]): number {
  const values = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const i = ((p[1] + dy) * png.width + p[0] + dx) * 4;
    const rgb = [0, 1, 2].map(c => { const v = png.data[i + c] / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    values.push(rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722);
  }
  return values.sort((a, b) => a - b)[4];
}

function overlaid(p: number[], row: Row): boolean { return row.overlays.some(r => p[0] >= r.x - 3 && p[0] <= r.x + r.width + 3 && p[1] >= r.y - 3 && p[1] <= r.y + r.height + 3); }
