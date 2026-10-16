import { basename } from 'node:path';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { PNG } from 'pngjs';
import { SceneSession, encodeWebm, evaluate, writeJson, type Backend } from './session';
import { canvasFrame, canvasFrameChecks } from '../../tests/e2e/canvas-frame';
import { canvasEdgeNoise } from './edge-noise';
import { measureContrast, type ContrastResult } from './contrast';

/** One scene run, shared by the CLI (cli.ts), the catalog (catalog.ts) and MCP `run_scene`:
 * load, step in batches, capture shots / video / contact sheet, write metrics.json, evaluate the gates. */
export interface RunOptions { file?: string; out: string; frames?: number; shots?: number[]; video?: number; sheet?: number; openMs?: number; inspect?: boolean }
export const maxSheetCells = 24;
type RevealDisc = { center: number[]; radius: number; strength: number };
const changedPixel = (a: PNG, b: PNG, i: number) => Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) >= 36;
/** Count body pixels with the exact same optional reveal-disc exclusion for both reference models. */
export function bodyPixels(a: PNG, b: PNG, hole?: RevealDisc): number {
  let n = 0;
  for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
    if (hole && hole.strength > 0 && Math.hypot(x + .5 - hole.center[0] * a.width, y + .5 - hole.center[1] * a.height) <= hole.radius * a.height + 1.5) continue;
    if (changedPixel(a, b, (y * a.width + x) * 4)) n++;
  }
  return n;
}
/** The production renderer names its WebGL2 backend `webgl`; catalog requests use `webgl2`. */
export function matchesBackend(actual: string, requested: Backend): boolean { return actual === (requested === 'webgl2' ? 'webgl' : 'webgpu'); }

/** Frames of the contact sheet: every `sheet` frames from 0, thinned evenly to at most 24 cells. */
export function sheetFrames(sheet: number, frames: number): number[] {
  const all: number[] = []; for (let f = 0; f <= frames; f += Math.max(1, Math.round(sheet))) all.push(f);
  if (all.length <= maxSheetCells) return all;
  return Array.from({ length: maxSheetCells }, (_, i) => all[Math.round(i * (all.length - 1) / (maxSheetCells - 1))]);
}

/** Cut-pixel gate (PO 10-14): the frame as played against the same frame with the solid-occluder cut forced off. Pixels that differ outside the
 * hole disc around the courier are buildings or vehicles opened with nothing in the way; inside the disc a real occluder must differ. */
export async function measureCut(session: SceneSession) {
  // The sim is paused, but presentation easing (gate hinges, ...) still moves a little with every redraw. Let it converge first so both captures
  // show the same state and only the cut itself can differ.
  for (let i = 0; i < 20; i++) await session.ready();
  const cut = PNG.sync.read(await session.page.screenshot({ type: 'png' }));
  const hole = await session.page.evaluate(() => window.__SCENE__!.cutProbe(true));
  await session.ready();
  const full = PNG.sync.read(await session.page.screenshot({ type: 'png' }));
  await session.page.evaluate(() => window.__SCENE__!.cutProbe(false));
  if (!hole || cut.width !== full.width || cut.height !== full.height) return { outside: Infinity, inside: 0, strength: 0, cover: 0, occluder: '' };
  const cx = hole.center[0] * cut.width, cy = hole.center[1] * cut.height, radius = hole.solidRadius * cut.height;
  let outside = 0, inside = 0;
  for (let y = 0; y < cut.height; y++) for (let x = 0; x < cut.width; x++) {
    const i = (y * cut.width + x) * 4;
    if (Math.abs(cut.data[i] - full.data[i]) + Math.abs(cut.data[i + 1] - full.data[i + 1]) + Math.abs(cut.data[i + 2] - full.data[i + 2]) < 36) continue;
    // The dither rim reaches full opacity exactly at the radius: a pixel whose centre lies within 1.5 px (one diagonal) of it is the disc edge, not a stray cut.
    if (Math.hypot(x + .5 - cx, y + .5 - cy) <= radius + 1.5) inside++; else outside++;
  }
  return { outside, inside, strength: hole.strength, cover: hole.cover, occluder: hole.occluder };
}

/** Same-frame redraws: courier visible share against her unobstructed silhouette; boss bodies compared with the courier hidden,
 * outside her intended reveal disc. No sim step, so pose and the boss hole's dither pattern stay identical. */
export async function measureCourierShare(session: SceneSession, compareAlpha = false) {
  await session.ready();
  const hole = await session.page.evaluate(() => window.__SCENE__!.bossRevealProbe());
  const shot = async (courier: boolean, crowd: boolean, environment = false) => {
    const d = await session.page.evaluate(([c, w, e]) => window.__SCENE__!.hideProbe(c, w, e, true), [courier, crowd, environment] as [boolean, boolean, boolean]);
    // Read the render canvas directly: DOM roster/minimap updates between redraws are not body pixels.
    const png = await session.page.evaluate(async () => { await window.__SCENE__!.ready(); return document.querySelector('canvas')!.toDataURL('image/png'); });
    return { d, png: PNG.sync.read(Buffer.from(png.slice(png.indexOf(',') + 1), 'base64')) };
  };
  const all = await shot(false, false), noCourier = await shot(true, false), clear = await shot(false, true, true), none = await shot(true, true, true);
  const noBodies = await shot(true, true);
  await session.page.evaluate(() => window.__SCENE__!.hideProbe(false, false));
  // Count visible pixels only inside the unobstructed subject silhouette: ground shadows and HUD changes are not body pixels.
  let visible = 0, reference = 0;
  for (let i = 0; i < clear.png.data.length; i += 4) {
    if (!changedPixel(clear.png, none.png, i)) continue;
    reference++; if (changedPixel(all.png, noCourier.png, i)) visible++;
  }
  const mega = bodyPixels(noCourier.png, noBodies.png, hole);
  // The old viewport-area minimum forced the boss to be wider than the PO allows.
  // Compare identical camera distance, pose and lighting instead; never enlarge the asset to pass.
  let alphaPixels = 0, alphaBodyPixels = 0;
  if (compareAlpha && all.d <= 6) {
    try {
      await session.page.evaluate(() => window.__SCENE__!.alphaReferenceProbe(true));
      const alpha = await shot(true, false), alphaBackground = await shot(true, true);
      // Its animated head moves the world-space health bar. Use this model's
      // own hidden-crowd background so bar movement is never counted as body pixels.
      alphaPixels = bodyPixels(alpha.png, alphaBackground.png, hole);
      alphaBodyPixels = bodyPixels(alpha.png, alphaBackground.png);
      if (!alphaBodyPixels) {
        // Foreground scenery can hide the entire reference at contact. Prove the model actually drew before accepting an empty outside-disc comparison.
        const unoccluded = await shot(true, false, true), background = await shot(true, true, true);
        alphaBodyPixels = bodyPixels(unoccluded.png, background.png);
      }
    } finally {
      await session.page.evaluate(() => window.__SCENE__!.alphaReferenceProbe(false));
      await session.ready();
    }
  }
  // At contact the whole regular Alpha can lie inside the excluded disc. A real reference must still have been drawn;
  // outside it, the comparison is mega >= 0.9 * alpha, which holds when alpha has no remaining pixels.
  return { alphaPixels, alphaBodyPixels, bossReveal: hole, megaAlphaRatio: alphaPixels > 0 ? mega / alphaPixels : alphaBodyPixels > 0 ? 1 : 0, megaM: all.d, visible, reference, share: reference > 0 ? Math.min(1, visible / reference) : 0, megaPixels: mega, megaShare: mega / (all.png.width * all.png.height) };
}

export async function runSpec(session: SceneSession, spec: SceneSpec, o: RunOptions) {
  const name = spec.name ?? (o.file ? basename(o.file, '.json') : 'scene'), out = o.out;
  const video = o.video ?? spec.video ?? 0, sheet = o.sheet ?? spec.sheet ?? 0;
  const shots = (o.shots ?? spec.shots ?? [0]).filter(Number.isFinite).sort((a, b) => a - b);
  const frames = Math.max(o.frames ?? spec.frames ?? 120, video * 60, ...shots);
  const errorsBefore = session.errors.length, t0 = Date.now();
  const scene = await session.load(spec);
  if (o.inspect) await session.page.evaluate(() => {
    window.__SS__!.inspect.enable(true, { courier: 'unchanged' });
    window.__SS__!.inspect.setCamera({ position: [9, 8, 12], target: [0, .7, 0] });
  });
  const loadMs = Date.now() - t0, written: string[] = [], jpegs: Buffer[] = [], cells: { frame: number; jpeg: Buffer }[] = [];
  const sheetAt = new Set(sheet ? sheetFrames(sheet, frames) : []);
  // Step in batches inside the page; stop only where a capture happens.
  const stops = new Set([...shots, ...sheetAt]);
  if (video) for (let f = 0; f <= video * 60; f += 3) stops.add(f);
  let frame = 0;
  const shares: ({ frame: number } & Awaited<ReturnType<typeof measureCourierShare>>)[] = [];
  const cutExpected = spec.expect?.seeThroughCutPixelsMax !== undefined || spec.expect?.seeThroughCutInsideMin !== undefined || spec.expect?.seeThroughCutInsideMax !== undefined;
  const cuts: ({ frame: number } & Awaited<ReturnType<typeof measureCut>>)[] = [];
  const contrast: { frame: number; result: ContrastResult }[] = [], measure = async (f: number) => {
    if (spec.expect?.courierVisibleShareMin !== undefined || spec.expect?.megaAlphaVisibleRatioMin !== undefined) shares.push({ frame: f, ...await measureCourierShare(session, spec.expect?.megaAlphaVisibleRatioMin !== undefined) });
    if (cutExpected) cuts.push({ frame: f, ...await measureCut(session) });
    if (!spec.contrast || f === 0) return; // frame 0: the follow camera has not settled on a driven vehicle yet
    const result = await measureContrast(session.page, spec); if (result) contrast.push({ frame: f, result }); };
  const pixels: { frame: number; pixels: Awaited<ReturnType<typeof canvasFrame>> }[] = [];
  const edgeSamples: ({ frame: number } & Awaited<ReturnType<typeof canvasEdgeNoise>>)[] = [];
  for (const stop of [...stops].sort((a, b) => a - b)) {
    if (stop > frames) break;
    if (stop > frame) frame = await session.step(stop - frame);
    pixels.push({ frame: stop, pixels: await canvasFrame(session.page) });
    if (spec.edgeNoise) edgeSamples.push({ frame: stop, ...await canvasEdgeNoise(session.page, spec.edgeNoise.rect) });
    if (shots.includes(stop)) { const path = `${out}/shot-${String(stop).padStart(4, '0')}.png`; await session.screenshot(path); written.push(path); }
    if (sheetAt.has(stop)) { cells.push({ frame: stop, jpeg: await session.snapshot() }); await measure(stop); }
    if (video && stop <= video * 60 && stop % 3 === 0) jpegs.push(await session.page.screenshot({ type: 'jpeg', quality: 80 }));
  }
  if (frame < frames) await session.step(frames - frame);
  if (!sheetAt.has(frames)) await measure(frames);
  if (!pixels.some(p => p.frame === frames)) pixels.push({ frame: frames, pixels: await canvasFrame(session.page) });
  if (spec.edgeNoise && !edgeSamples.some(s => s.frame === frames)) edgeSamples.push({ frame: frames, ...await canvasEdgeNoise(session.page, spec.edgeNoise.rect) });
  if (jpegs.length) { const path = `${out}/video.webm`; encodeWebm(jpegs, path); written.push(path); }
  let sheetInfo: { path: string; cells: number; kb: number } | undefined;
  if (cells.length) { sheetInfo = await session.makeSheet(cells, `${out}/sheet.jpg`); written.push(sheetInfo.path); }
  const cutPixels = cuts.length ? { ...cuts[0], outside: Math.max(...cuts.map(c => c.outside)), inside: Math.min(...cuts.map(c => c.inside)), insideMax: Math.max(...cuts.map(c => c.inside)) } : null;
  const clipping = await session.clipping(), metrics = await session.metrics(), errors = session.errors.slice(errorsBefore);
  const actualTier = await session.page.evaluate(() => window.__SS__!.getState().render.quality);
  const result = evaluate(spec, metrics, clipping, errors);
  const ring = spec.megaHud ? await session.page.evaluate(megaId => {
    const ring = document.querySelector<HTMLElement>('[data-testid="mega-distance-ring"]');
    const label = document.querySelector<HTMLElement>('[data-testid="mega-distance-label"]');
    const map = document.querySelector<HTMLElement>('[data-testid="minimap"]');
    const r = ring?.getBoundingClientRect(), m = map?.getBoundingClientRect();
    const visible = !!ring && !ring.hidden && !!r?.width && getComputedStyle(ring).visibility === 'visible';
    return { visible, labelVisible: !!label && !label.hidden && !!label.getBoundingClientRect().width && getComputedStyle(label).visibility === 'visible', band: ring?.dataset.band, text: label?.textContent,
      centerErrorPx: r && m ? Math.hypot(r.x + r.width / 2 - m.x - m.width / 2, r.y + r.height / 2 - m.y - m.height / 2) : Infinity,
      exactPins: [...document.querySelectorAll<HTMLElement>('[data-testid="minimap"] [data-entity-id]')].filter(p => !p.hidden && p.dataset.entityId === String(megaId)).length,
      coordinates: !!ring && ['data-world-x', 'data-world-z', 'data-entity-id'].some(a => ring.hasAttribute(a)) };
  }, scene.actors.find(a => a.id === (spec.megaAlpha?.id ?? 'mega'))?.entity) : null;
  if (ring) {
    const band = metrics.megaAlpha?.samples.at(-1)?.band;
    const correctBand = band ? ring.visible && ring.labelVisible && ring.band === band && ring.text === `Mega Alpha: ${band}` : !ring.visible && !ring.labelVisible;
    result.checks.push(
      { name: 'megaRingBandAndText', pass: correctBand, value: Number(correctBand), limit: 1 },
      { name: 'megaRingPlayerCentered', pass: !band || ring.centerErrorPx <= 1, value: band ? ring.centerErrorPx : 0, limit: 1 },
      { name: 'megaRingNoExactMarker', pass: !ring.exactPins && !ring.coordinates, value: ring.exactPins + Number(ring.coordinates), limit: 0 },
    );
  }
  if (spec.edgeNoise) {
    const value = Math.max(...edgeSamples.map(s => s.edges >= 20 ? s.extremeEdgeShare : Infinity));
    result.checks.push({ name: 'alphaSilhouetteBlackWhiteEdgeNoise', pass: value <= spec.edgeNoise.extremeEdgeShareMax, value, limit: spec.edgeNoise.extremeEdgeShareMax });
    if (spec.edgeNoise.silhouetteRoughnessMax !== undefined) { const rough = Math.max(...edgeSamples.map(s => s.edges >= 20 ? s.silhouetteRoughness : Infinity)); result.checks.push({ name: "alphaSilhouetteRoughness", pass: rough <= spec.edgeNoise.silhouetteRoughnessMax, value: rough, limit: spec.edgeNoise.silhouetteRoughnessMax }); }
  }
  if (spec.contrast) {
    const worst = (pick: (r: ContrastResult) => number | undefined) => { const v = contrast.map(c => pick(c.result)).filter((x): x is number => x !== undefined && Number.isFinite(x)); return v.length ? Math.min(...v) : 0; };
    const e = spec.expect ?? {}, gate = (name: string, value: number, min: number | undefined) => { if (min !== undefined) result.checks.push({ name, pass: value >= min, value, limit: min }); };
    // Typical view (median of the per-frame medians) must reach the AC; no single frame may fall below the floor (a black stretch of road reads ~1.1).
    const typical = (pick: (r: ContrastResult) => number | undefined) => { const v = contrast.map(c => pick(c.result)).filter((x): x is number => x !== undefined && Number.isFinite(x)).sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : 0; };
    gate('navContrastMin', typical(r => r.median), e.navContrastMin); gate('navContrastFloor', worst(r => r.median), e.navContrastFloor); gate('playerContrastMin', worst(r => r.player), e.playerContrastMin); gate('landmarkContrastMin', worst(r => r.landmarks), e.landmarkContrastMin);
    // At the closest zoom (< 1) the verge is off screen, so there is nothing to compare: the zoom 1 and 1.5 rows carry the gate.
    if ((spec.camera as { zoom?: number } | undefined)?.zoom === undefined || (spec.camera as { zoom: number }).zoom >= 1) result.checks.push({ name: 'contrastSampled', pass: contrast.length > 0, value: contrast.length, limit: 1 });
    else for (const name of ['navContrastMin', 'navContrastFloor', 'playerContrastMin', 'landmarkContrastMin']) { const i = result.checks.findIndex(c => c.name === name); if (i >= 0 && !contrast.length) result.checks.splice(i, 1); }
  }
  if (shares.length) {
    const near = spec.megaAlpha ? shares.filter(s => s.megaM <= 14) : shares, contact = shares.filter(s => s.megaM <= 6);
    if (spec.expect?.courierVisibleShareMin !== undefined) result.checks.push({ name: 'courierVisibleShare', pass: near.every(s => s.share >= spec.expect!.courierVisibleShareMin!), value: near.length ? Math.min(...near.map(s => +s.share.toFixed(3))) : 1, limit: spec.expect.courierVisibleShareMin });
    if (spec.expect?.megaAlphaVisibleRatioMin !== undefined) result.checks.push({ name: 'megaAlphaVisibleRatio', pass: contact.length > 0 && contact.every(s => s.alphaBodyPixels > 0 && s.megaPixels >= spec.expect!.megaAlphaVisibleRatioMin! * s.alphaPixels), value: contact.length ? Math.min(...contact.map(s => +s.megaAlphaRatio.toFixed(4))) : 0, limit: spec.expect.megaAlphaVisibleRatioMin });
    result.checks.push({ name: spec.megaAlpha ? 'courierShareSampledNearMega' : 'courierShareSampled', pass: near.length > 0, value: near.length, limit: 1 });
  }
  if (cutPixels) {
    if (spec.expect?.seeThroughCutInsideMax !== undefined) result.checks.push({ name: 'seeThroughCutPixelsInsideMax', pass: cutPixels.insideMax <= spec.expect.seeThroughCutInsideMax, value: cutPixels.insideMax, limit: spec.expect.seeThroughCutInsideMax });
    if (spec.expect?.seeThroughCutPixelsMax !== undefined) result.checks.push({ name: 'seeThroughCutPixelsOutside', pass: cutPixels.outside <= spec.expect.seeThroughCutPixelsMax, value: cutPixels.outside, limit: spec.expect.seeThroughCutPixelsMax });
    if (spec.expect?.seeThroughCutInsideMin !== undefined) result.checks.push({ name: 'seeThroughCutPixelsInside', pass: cutPixels.inside >= spec.expect.seeThroughCutInsideMin, value: cutPixels.inside, limit: spec.expect.seeThroughCutInsideMin });
  }
  result.checks.push(...pixels.flatMap(p => canvasFrameChecks(p.pixels, `canvas.f${p.frame}`)));
  // Renderer telemetry calls the WebGL2 fallback `webgl`; CLI uses the explicit API version.
  const requestedBackend = session.options.backend === 'webgl2' ? 'webgl' : 'webgpu';
  result.checks.push({ name: 'requestedBackend', pass: metrics.backend === requestedBackend, value: Number(metrics.backend === requestedBackend), limit: 1 });
  result.checks.push({ name: 'requestedQuality', pass: actualTier === session.options.tier && metrics.quality === actualTier, value: Number(actualTier === session.options.tier && metrics.quality === actualTier), limit: 1 });
  result.pass = result.checks.every(c => c.pass);
  const timing = { openMs: o.openMs ?? 0, loadMs, runMs: Date.now() - t0 - loadMs, sceneMs: Date.now() - t0 };
  writeJson(`${out}/metrics.json`, { spec: o.file, backend: metrics.backend, requestedBackend: session.options.backend, tier: session.options.tier, actualTier, frames: metrics.frame, timing, checks: result, seeThroughCut: cutPixels, seeThroughCutSamples: cuts, courierShares: shares, pixels, edgeSamples, ring, contrast: contrast.map(c => ({ frame: c.frame, candidates: c.result.candidates, pairs: c.result.pairs, median: +c.result.median.toFixed(2), wcag05: +c.result.wcag.toFixed(2), min: +c.result.min.toFixed(2), routeL: +c.result.routeL.toFixed(4), vergeL: +c.result.vergeL.toFixed(4), player: c.result.player && +c.result.player.toFixed(2), landmarks: c.result.landmarks && +c.result.landmarks.toFixed(2) })), consoleErrors: errors, scene, metrics, clipping });
  written.push(`${out}/metrics.json`);
  return { name, pass: result.pass, checks: result.checks, backend: metrics.backend, actualTier, frames: metrics.frame, seconds: timing.sceneMs / 1000, failed: result.checks.filter(c => !c.pass), clipping: clipping.summary, sheet: sheetInfo?.path, sheetKb: sheetInfo?.kb, files: written, consoleErrors: errors };
}
