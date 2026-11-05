import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
import type { DistrictView } from '../../src/render/DistrictView';
const identity = provenance();
const out = 'test-results/fix51-r7b/story'; mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
const backend = process.env.R7B_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
try {
  for (const tier of ['low', 'high'] as const) {
    const s = new SceneSession({ backend, tier, query: { profile: '0' } });
    try {
      await s.open(); await s.page.evaluate('globalThis.__name = fn => fn');
      await s.page.evaluate(async () => {
        const a = window.__SS__!; await a.loadLevel('L1', { seed: 1 }); a.pause(); a.missions.begin(); a.inspect.enable(false); a.camera.zoom(1.5);
        const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
        const p = game.world.missions!.def.anchors['parcel-counter']; a.teleport(1, p); a.missions.completeObjective('pickup');
      });
      for (const stage of ['pickup', 'handover']) {
        if (stage === 'handover') await s.page.evaluate(async () => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
          a.teleport(1, g.world.missions!.def.anchors['lab-door']); a.input.set({ interact: true }); await a.step(1); a.input.set({ interact: false });
        });
        const captured = new Set<string>();
        const ledger = []; let clearedAt = -1;
        for (let frame = 0; frame < (stage === 'pickup' ? 720 : 1080); frame++) {
          const state = await s.page.evaluate(async () => {
            const a = window.__SS__!; await a.step(1);
            const g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game, w = g.world, l = w.missions!.state.l1!;
            const c = w.entities.get(l.clerkId ?? 0), t = w.entities.get(l.techId), p = w.entities.get(1)!;
            return { tick: w.tick, phase: l.phase, beat: l.beat?.id, clerkId: l.clerkId, clerkHidden: c?.hidden, carrying: l.carrying,
              player: { ...p.transform }, playerParcel: !!p.survivor?.carrying, clerkParcel: c?.civilian?.story?.prop === 'parcel', techParcel: t?.civilian?.story?.prop === 'parcel',
              tech: t && { ...t.transform, hidden: t.hidden, clip: t.civilian?.story?.clip }, clerk: c && { ...c.transform, clip: c.civilian?.story?.clip },
              doors: (g.view as unknown as { districts?: DistrictView }).districts?.doorState().filter(d => ['bld.courier-depot','bld.clinic-annex'].includes(d.assetId)) };
          });
          ledger.push(state);
          if (stage === 'pickup' && !state.clerkId && clearedAt < 0) clearedAt = frame;
          let label = stage === 'pickup'
            ? frame === 0 ? 'start' : frame === 90 ? 'out' : state.playerParcel && state.clerkParcel === false && !captured.has('received') ? 'received' : state.clerk?.clip === 'npc-walk' && state.playerParcel && !captured.has('return') ? 'return' : !state.clerkId && frame > 200 && !captured.has('inside') ? 'inside' : frame === 719 ? 'end' : ''
            : frame === 0 ? 'start' : state.tech?.clip === 'npc-sign' && !captured.has('sign') ? 'sign' : state.techParcel && !captured.has('received') ? 'received' : state.tech?.clip === 'npc-carry' && !captured.has('return') ? 'return' : state.phase === 'calm' && !captured.has('inside') ? 'inside' : '';
          if (stage === 'pickup' && clearedAt >= 0 && [6,12,18,24].includes(frame - clearedAt)) label = `close-${frame-clearedAt}`;
          if (label) {
            captured.add(label); await s.page.evaluate(async () => window.__SS__!.screenshotReady());
            await s.page.screenshot({ path: `${out}/${backend}-${tier}-${stage}-${label}.png` });
          }
          if (stage === 'handover' && state.phase === 'calm') break;
        }
        if (stage === 'pickup' && ledger.at(-1)?.doors?.find(d => d.assetId === 'bld.courier-depot')?.open !== 0) throw new Error('Depot failed to close');
        if (stage === 'handover' && ledger.some(s => s.phase === 'handover' && Number(s.playerParcel) + Number(s.techParcel) !== 1)) throw new Error('Parcel ownership gap or duplicate');
        const runtime = await s.page.evaluate(() => { const r = window.__SS__!.getState().render; return { backend: r.backend, quality: r.quality, camera: r.camera }; });
        rows.push({ sourceHash: identity.sourceHash, backend, tier, stage, runtime, ledger, errors: s.errors });
        writeFileSync(`${out}/ledger-${backend}.json`, JSON.stringify(rows, null, 2));
      }
      await s.page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L2', { seed: 1, progression: 'L2-default' }); a.pause(); a.missions.begin(); a.inspect.enable(false); await a.step(31 * 60); });
      for (const zoom of [.5, 1.5]) {
        await s.page.evaluate(async zoom => { const a = window.__SS__!; a.camera.zoom(zoom); await a.step(1); await a.screenshotReady(); }, zoom);
        await s.page.screenshot({ path: `${out}/${backend}-${tier}-L2-optional-axe-z${zoom}.png` });
      }
      const optionalAxe = await s.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game, m = g.world.missions!; return { axe: m.state.l2!.axe, phase: m.state.l2!.phase, alarmAt: m.state.l2!.alarmAt, marker: m.state.marker, steps: m.state.steps, backend: window.__SS__!.getState().render.backend }; });
      await s.page.evaluate(async () => { const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game; a.teleport(1, g.world.missions!.def.anchors['l2-axe-rack']); a.input.set({ interact: true }); await a.step(37); a.input.set({ interact: false }); await a.step(120); a.camera.zoom(.5); await a.step(1); await a.screenshotReady(); if (!g.world.missions!.state.l2!.axe) throw new Error('Optional rack pickup failed'); });
      await s.page.screenshot({ path: `${out}/${backend}-${tier}-L2-axe-picked-up.png` });
      rows.push({ sourceHash: identity.sourceHash, backend, tier, stage: 'L2', optionalAxe, pickedUpAfter: true, errors: s.errors });
      await s.page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L9', { seed: 1, progression: 'L9-default' }); a.pause(); a.missions.begin(); a.inspect.enable(false); a.camera.zoom(1.5); await a.step(30); await a.screenshotReady(); });
      const crossing = await s.page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game, w = g.world, carId = w.missions!.l9!.state.carId;
        const dog = [...w.entities.iterate()].find(e => e.companion)!;
        return { carId, dog: { id: dog.id, passengerOf: dog.passengerOf, hidden: dog.hidden }, passengers: w.entities.get(carId)!.vehicle!.passengers, render: window.__SS__!.getState().render.vehicles };
      });
      if (crossing.dog.passengerOf !== crossing.carId || !crossing.dog.hidden || !crossing.passengers?.some(p => p.id === crossing.dog.id && p.phase === 'seated')) throw new Error('L9 corgi did not board');
      await s.page.screenshot({ path: `${out}/${backend}-${tier}-L9-seated.png` });
      rows.push({ sourceHash: identity.sourceHash, backend, tier, stage: 'L9', crossing, errors: s.errors });
      writeFileSync(`${out}/ledger-${backend}.json`, JSON.stringify(rows, null, 2));
    } finally { await s.close(); }
  }
} finally { stopServer(); if (provenance().sourceHash !== identity.sourceHash) throw new Error('Source changed during capture'); }
