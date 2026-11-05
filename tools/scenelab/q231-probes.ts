import { mkdirSync, writeFileSync } from 'node:fs';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { l1Pedestrians } from '../../src/data/npcs';
import { alphaLooks } from '../../src/data/alphaLooks';
import type { PaletteMaterial } from '../../src/render/PaletteMaterial';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer, writeJson } from './session';
import { measureLook } from './look';

/** Q-231 bounded visual probes, through the shared headless browser pool.
 * SCENE_PORT=4347 sh tools/e2e-lock.sh npx tsx tools/scenelab/q231-probes.ts l1 1|2|3 <out>
 * SCENE_PORT=4347 sh tools/e2e-lock.sh npx tsx tools/scenelab/q231-probes.ts l10 1|2|3 <out>
 * SCENE_PORT=4347 sh tools/e2e-lock.sh npx tsx tools/scenelab/q231-probes.ts palette 2|3 <out>
 * These are reproduction tools, not added test cases. Raw tick captures stay in test-results.
 */
const [mode, attemptText, out] = process.argv.slice(2), attempt = Number(attemptText);
if (!['l1', 'l10', 'palette'].includes(mode) || ![1, 2, 3].includes(attempt) || !out) throw new Error('usage: q231-probes.ts l1|l10|palette 1|2|3 <out>');
const session = new SceneSession({ tier: attempt === 3 ? 'high' : 'low', backend: 'webgl2' });

async function runtime() {
  return session.page.evaluate(() => {
    const a = window.__SS__!;
    return { tick: a.tick(),
      entities: a.query({}).filter(e => e.infected || e.civilian).map(e => ({ id: e.id, archetype: e.archetype,
        position: { ...e.transform }, health: { ...e.health }, appearance: e.appearance,
        model: e.civilian?.model, infected: e.infected ? { model: e.infected.model, variant: e.infected.variant, state: e.infected.state, deadAt: e.infected.deadAt, recoverAt: e.infected.recoverAt } : undefined,
        reaction: e.combat?.reaction })), figures: a.crowdFigures(), quality: a.getState().render.quality };
  });
}

async function capture(name: string, spec: SceneSpec, frames: number, tickShots: boolean) {
  const dir = `${out}/${name}`; mkdirSync(dir, { recursive: true });
  await session.load(spec);
  if (mode === 'l10') writeJson(`${dir}/surfaces.json`, await session.page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    const crowd = g.view as unknown as { crowd: { batches: Map<string, { asset: string; lod: string; mesh: import('three').Mesh }> } };
    return [...crowd.crowd.batches.values()].filter(b => b.asset.startsWith('inf.alpha')).map(b => {
      const material = b.mesh.material as PaletteMaterial;
      return { asset: b.asset, lod: b.lod, atlas: b.mesh.userData.crowdAtlas ?? null,
        figureFill: material.figureFill.value, figureRim: material.figureRim.value };
    });
  }));
  const samples = [], cells: { frame: number; jpeg: Buffer }[] = [];
  for (let frame = 0; frame <= frames; frame++) {
    if (frame) await session.step(1);
    const sample = await runtime(); samples.push(sample);
    if (tickShots || frame % 15 === 0 || frame === frames) {
      const jpeg = await session.snapshot();
      writeFileSync(`${dir}/tick-${String(frame).padStart(3, '0')}.jpg`, jpeg);
      if (frame % 6 === 0 || frame === frames) cells.push({ frame, jpeg });
    }
    if ([0, 18, 30, 60, frames].includes(frame)) await session.screenshot(`${dir}/frame-${frame}.png`);
  }
  await session.makeSheet(cells, `${dir}/sheet.jpg`, 420, 900);
  writeJson(`${dir}/receipt.json`, { attempt, spec, samples, metrics: await session.metrics(), look: mode === 'l1' ? undefined : await measureLook(session), consoleErrors: session.errors });
  console.log(JSON.stringify({ name, attempt, ticks: frames, errors: session.errors.length }));
}

try {
  await session.open();
  if (mode === 'l1') {
    await session.inspectLevel('L1');
    await session.page.evaluate(() => window.__SS__!.pause());
    const cast = await runtime(); writeJson(`${out}/campaign-cast.json`, cast);
    const models = l1Pedestrians.models;
    for (const [index, model] of models.entries()) {
      const origin = cast.entities.filter(e => e.model === model)
        .sort((a, b) => Math.hypot(a.position.x + 74, a.position.z - 41) - Math.hypot(b.position.x + 74, b.position.z - 41))[0];
      const pedestrian = model.startsWith('npc.');
      const spec: SceneSpec = { name: `q231-l1-${attempt}-${model}`, seed: 1, ground: 'district', time: 'L1', dof: false, trace: true,
        layout: { level: 'L1', district: 'D-GROVE', bbox: [[-90, 30], [-60, 56]] },
        actors: [{ id: 'courier', kind: 'courier', at: [-76.16, 41.17], look: { model: 'male' }, loadout: ['weapon.bat', 'weapon.fists'], god: true },
          ...Array.from({ length: attempt - 1 }, (_, i) => ({ id: `id-padding-${i}`, kind: 'infected' as const, at: [-89 + i, 54] as [number, number], state: 'idle' as const })),
          { id: 'target', kind: pedestrian ? 'pedestrian' : 'infected', archetype: 'infected.runner', at: [-74.4, 40.9], yaw: attempt === 3 ? 135 : -45,
            look: { model, tint: origin?.appearance?.tint, accessories: origin?.appearance?.accessories ?? [], handProp: null }, state: 'idle' }],
        camera: { mode: 'game', target: [-75, .53, 41.2], zoom: attempt === 1 ? 1.5 : .5 },
        script: [...(pedestrian ? [{ frame: 1, actor: 'target', do: { infect: { instant: true } } }] : []),
          { frame: 5, actor: 'target', do: { hit: { from: attempt === 3 ? [-72, 42] : 'courier', amount: attempt === 2 ? 1 : 1000, heavy: true } } }],
      };
      writeJson(`${out}/${index}-${model}-campaign-origin.json`, origin ?? { model, note: 'regular infected asset, no matching initial campaign civilian' });
      await capture(`${index}-${model}`, spec, 90, true);
    }
  } else if (mode === 'palette') {
    for (const time of ['L10-night', 'L1'] as const) for (const representation of ['live', 'static'] as const) {
      const models = alphaLooks['inf.alpha'], at = (i: number): [number, number] => [-4 + i * 2, 4 - i * 2];
      const spec: SceneSpec = { name: `q231-palette-${representation}-${time}`, seed: 32, ground: 'asphalt', time, dof: false,
        actors: [{ id: 'courier', kind: 'courier', at: [-6, 6], god: true },
          ...(representation === 'live' ? models.map((model, i) => ({ id: model, kind: 'infected' as const, archetype: 'infected.alpha', at: at(i), yaw: 30, look: { model }, state: 'idle' as const })) : [])],
        props: representation === 'static' ? models.map((model, i) => ({ id: model, asset: model, at: at(i), yaw: 30 })) : [],
        camera: { mode: 'game', target: [0, .7, 0], zoom: 1.15 } };
      await capture(`${representation}-${time}`, spec, 1, false);
    }
  } else if (attempt === 1) {
    await capture('research-approach', { name: 'q231-research-approach', seed: 32, ground: 'district', time: 'L10-night', tier: 5, dof: false,
      cureEncounter: 'research-approach', layout: { district: 'D-CURE', bbox: [[2590, 20], [2645, 75]] },
      actors: [{ id: 'courier', kind: 'courier', at: [2615, 45], god: true, loadout: ['weapon.army-mg', 'weapon.fists'] }],
      camera: { mode: 'game', target: 'courier', zoom: 1.5 } }, 90, false);
  } else {
    for (const time of ['L10-night', 'L1'] as const) {
      const models = alphaLooks['inf.alpha'];
      const spec: SceneSpec = { name: `q231-l10-${attempt}-${time}`, seed: 32, ground: 'district', time, tier: 5, dof: false, trace: true,
        layout: { district: 'D-CURE', bbox: [[2590, 20], [2645, 75]] },
        actors: [{ id: 'courier', kind: 'courier', at: [2607, 48], god: true },
          ...models.map((model, i) => ({ id: model, kind: 'infected' as const, archetype: 'infected.alpha', at: [2601 + i * 2.5, 42] as [number, number], yaw: 30, look: { model }, state: 'idle' as const }))],
        props: models.map((model, i) => ({ id: `static-${model}`, asset: model, at: [2601 + i * 2.5, 36] as [number, number], yaw: 30 })),
        camera: { mode: 'game', target: [2606, .7, 40], zoom: .7 },
      };
      await capture(time, spec, 30, false);
    }
  }
  if (session.errors.length) throw new Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); }
