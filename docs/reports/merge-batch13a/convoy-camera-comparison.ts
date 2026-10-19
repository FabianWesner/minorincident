/** Copy to tools/qa/batch13-convoy-compare.ts. Isolate camera code; one scene, two zooms. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSync } from 'esbuild';
import { SceneSession, readSpec, stopServer } from '../../tools/scenelab/session';
import { runSpec } from '../../tools/scenelab/run';

const out = process.env.BATCH13_COMPARE_OUT!;
mkdirSync(out, { recursive: true });
const source = execFileSync('git', ['show', '2d5e0fb84:src/render/View.ts'], { encoding: 'utf8' });
const oldFraming = execFileSync('git', ['show', '2d5e0fb84:src/data/cameraFraming.ts'], { encoding: 'utf8' });
if (oldFraming !== readFileSync('src/data/cameraFraming.ts', 'utf8')) throw Error('Framing dependency differs from starting main');
const bundle = buildSync({ stdin: { contents: source + '\nexport { Box3, Vector3 };', resolveDir: resolve('src/render'), loader: 'ts' }, bundle: true, platform: 'browser', format: 'iife', globalName: 'Batch13OldCamera', write: false, minify: true }).outputFiles[0].text;
const records: unknown[] = [];
try {
for (const tier of ['high', 'low'] as const) {
const session = new SceneSession({ backend: 'webgpu', tier, viewport: { width: 960, height: 540 } });
try {
  await session.open();
  await session.page.addScriptTag({ content: bundle });
  for (const zoom of [1.5, 1]) for (const mode of ['old', 'new'] as const) {
    await session.page.evaluate(mode => {
      // Runtime diagnostic only: call the exact starting-main View.update on the
      // existing rig, retaining its camera references. Restore the legacy seated
      // convoy flag that GameView used to set before every update.
      const w = window as any, game = w.__SCENE__.game, rig = game.view.view;
      rig.batch13NewUpdate ??= rig.update;
      const old = new w.Batch13OldCamera.View();
      for (const key of Object.keys(old)) if (!(key in rig)) rig[key] = old[key];
      rig.clearLens = w.Batch13OldCamera.View.prototype.clearLens;
      rig.update = mode === 'new' ? rig.batch13NewUpdate : function (player: unknown, seconds: number) {
        this.convoy = !!game.world.missions?.state.l4?.seated;
        if (this.batch13OldDistricts !== game.world.districts) {
          this.cameraSolids.length = 0;
          for (const district of game.world.districts?.districts ?? []) if (district.id === 'D-FAIR') {
            for (const placement of district.decay.placements) if (placement.assetId.startsWith('bld.')) {
              const { min, max } = placement.visualAabb, [x, z] = district.origin, B = w.Batch13OldCamera;
              this.cameraSolids.push(new B.Box3(new B.Vector3(min[0] + x, min[1], min[2] + z), new B.Vector3(max[0] + x, max[1], max[2] + z)));
            }
          }
          this.batch13OldDistricts = game.world.districts;
        }
        return w.Batch13OldCamera.View.prototype.update.call(this, player, seconds);
      };
    }, mode);
    const spec = readSpec('tests/scenes/catalog/seethrough-scripted-convoy.json');
    spec.camera = { ...spec.camera!, zoom } as typeof spec.camera;
    const poses: unknown[] = [];
    const originalStep = session.step.bind(session);
    session.step = async frames => {
      const frame = await originalStep(frames);
      poses.push(await session.page.evaluate(frame => {
        const w = window as any, rig = w.__SCENE__.game.view.view, c = rig.getState();
        const delta = c.position.map((v: number, i: number) => v - c.target[i]);
        return { frame, ...c, actualPolarDeg: Math.acos(delta[1] / Math.hypot(...delta)) * 180 / Math.PI, seated: !!w.__SS__.missions.state().l4?.seated };
      }, frame));
      return frame;
    };
    const name = `${tier}-${mode}-z${zoom}`, dir = `${out}/${name}`;
    const result = await runSpec(session, spec, { out: dir, shots: [], sheet: spec.sheet });
    session.step = originalStep;
    const metrics = JSON.parse(readFileSync(`${dir}/metrics.json`, 'utf8'));
    const record = { name, tier, mode, zoom, source: mode === 'old' ? '2d5e0fb84 exact View.update, legacy seated convoy flag' : '14c0e973f merged View.update', renderer: '14c0e973f unchanged in both cases', pass: result.pass, checks: result.checks, cutSamples: metrics.seeThroughCutSamples, courierShares: metrics.courierShares, poses, sheet: `${name}/sheet.jpg` };
    records.push(record);
    writeFileSync(`${out}/comparison.json`, JSON.stringify(records, null, 2));
    rmSync(`${dir}/metrics.json`);
    console.log(JSON.stringify({ name, pass: result.pass, failed: result.failed, polarRange: [Math.min(...poses.map((p: any) => p.actualPolarDeg)), Math.max(...poses.map((p: any) => p.actualPolarDeg))] }));
  }
} finally {
  await session.close();
}
}
} finally { stopServer(); }
