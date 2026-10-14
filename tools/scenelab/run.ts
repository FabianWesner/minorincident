import { basename } from 'node:path';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { PNG } from 'pngjs';
import { SceneSession, encodeWebm, evaluate, writeJson, type Backend } from './session';
import { canvasFrame, canvasFrameChecks } from '../../tests/e2e/canvas-frame';

/** One scene run, shared by the CLI (cli.ts), the catalog (catalog.ts) and MCP `run_scene`:
 * load, step in batches, capture shots / video / contact sheet, write metrics.json, evaluate the gates. */
export interface RunOptions { file?: string; out: string; frames?: number; shots?: number[]; video?: number; sheet?: number; openMs?: number; inspect?: boolean }
export const maxSheetCells = 24;
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
  await session.ready();
  const cut = PNG.sync.read(await session.page.screenshot({ type: 'png' }));
  const hole = await session.page.evaluate(() => window.__SCENE__!.cutProbe(true));
  await session.step(1); await session.ready();
  const full = PNG.sync.read(await session.page.screenshot({ type: 'png' }));
  await session.page.evaluate(() => window.__SCENE__!.cutProbe(false));
  if (!hole || cut.width !== full.width || cut.height !== full.height) return { outside: Infinity, inside: 0, strength: 0, cover: 0, occluder: '' };
  const cx = hole.center[0] * cut.width, cy = hole.center[1] * cut.height, radius = hole.solidRadius * cut.height * (hole.cover > .5 ? 100 : 1);
  let outside = 0, inside = 0;
  for (let y = 0; y < cut.height; y++) for (let x = 0; x < cut.width; x++) {
    const i = (y * cut.width + x) * 4;
    if (Math.abs(cut.data[i] - full.data[i]) + Math.abs(cut.data[i + 1] - full.data[i + 1]) + Math.abs(cut.data[i + 2] - full.data[i + 2]) < 36) continue;
    if (Math.hypot(x - cx, y - cy) <= radius) inside++; else outside++;
  }
  return { outside, inside, strength: hole.strength, cover: hole.cover, occluder: hole.occluder };
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
  const pixels: { frame: number; pixels: Awaited<ReturnType<typeof canvasFrame>> }[] = [];
  for (const stop of [...stops].sort((a, b) => a - b)) {
    if (stop > frames) break;
    if (stop > frame) frame = await session.step(stop - frame);
    pixels.push({ frame: stop, pixels: await canvasFrame(session.page) });
    if (shots.includes(stop)) { const path = `${out}/shot-${String(stop).padStart(4, '0')}.png`; await session.screenshot(path); written.push(path); }
    if (sheetAt.has(stop)) cells.push({ frame: stop, jpeg: await session.snapshot() });
    if (video && stop <= video * 60 && stop % 3 === 0) jpegs.push(await session.page.screenshot({ type: 'jpeg', quality: 80 }));
  }
  if (frame < frames) await session.step(frames - frame);
  if (!pixels.some(p => p.frame === frames)) pixels.push({ frame: frames, pixels: await canvasFrame(session.page) });
  if (jpegs.length) { const path = `${out}/video.webm`; encodeWebm(jpegs, path); written.push(path); }
  let sheetInfo: { path: string; cells: number; kb: number } | undefined;
  if (cells.length) { sheetInfo = await session.makeSheet(cells, `${out}/sheet.jpg`); written.push(sheetInfo.path); }
  const cutExpected = spec.expect?.seeThroughCutPixelsMax !== undefined || spec.expect?.seeThroughCutInsideMin !== undefined;
  const cutPixels = cutExpected ? await measureCut(session) : null;
  const clipping = await session.clipping(), metrics = await session.metrics(), errors = session.errors.slice(errorsBefore);
  const result = evaluate(spec, metrics, clipping, errors);
  if (cutPixels) {
    if (spec.expect?.seeThroughCutPixelsMax !== undefined) result.checks.push({ name: 'seeThroughCutPixelsOutside', pass: cutPixels.outside <= spec.expect.seeThroughCutPixelsMax, value: cutPixels.outside, limit: spec.expect.seeThroughCutPixelsMax });
    if (spec.expect?.seeThroughCutInsideMin !== undefined) result.checks.push({ name: 'seeThroughCutPixelsInside', pass: cutPixels.inside >= spec.expect.seeThroughCutInsideMin, value: cutPixels.inside, limit: spec.expect.seeThroughCutInsideMin });
  }
  result.checks.push(...pixels.flatMap(p => canvasFrameChecks(p.pixels, `canvas.f${p.frame}`)));
  // Renderer telemetry calls the WebGL2 fallback `webgl`; CLI uses the explicit API version.
  const requestedBackend = session.options.backend === 'webgl2' ? 'webgl' : 'webgpu';
  result.checks.push({ name: 'requestedBackend', pass: metrics.backend === requestedBackend, value: Number(metrics.backend === requestedBackend), limit: 1 });
  result.pass = result.checks.every(c => c.pass);
  const timing = { openMs: o.openMs ?? 0, loadMs, runMs: Date.now() - t0 - loadMs, sceneMs: Date.now() - t0 };
  writeJson(`${out}/metrics.json`, { spec: o.file, backend: metrics.backend, requestedBackend: session.options.backend, tier: session.options.tier, frames: metrics.frame, timing, checks: result, seeThroughCut: cutPixels, pixels, consoleErrors: errors, scene, metrics, clipping });
  written.push(`${out}/metrics.json`);
  return { name, pass: result.pass, checks: result.checks, backend: metrics.backend, frames: metrics.frame, seconds: timing.sceneMs / 1000, failed: result.checks.filter(c => !c.pass), clipping: clipping.summary, sheet: sheetInfo?.path, sheetKb: sheetInfo?.kb, files: written, consoleErrors: errors };
}
