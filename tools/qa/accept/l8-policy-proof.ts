import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PerspectiveCamera, Vector3, Frustum, Matrix4 } from 'three';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { provenance } from './probe';
import { atomicJson } from './report';

const identity = provenance(), before = process.argv.includes('--expect-invalid');
const botSha256 = createHash('sha256').update(readFileSync('src/debug/bot/LevelEightBot.ts')).digest('hex');
const rows = [];
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L8-default'); campaign.settings.quality = tier;
  const shots: { tick: number; target: number; allowed: boolean; minimumPlaneDistance: number; player: { x: number; z: number }; enemy: { x: number; y: number; z: number } }[] = [];
  let aim: typeof shots[number] | null = null;
  const camera = new PerspectiveCamera(25, 16/9, .1, 600), offset = new Vector3(), frustum = new Frustum(), point = new Vector3();
  const run = await runLevel('L8', 'complete', 1, undefined, 'auto', campaign, undefined, 0, { quality: tier, beforeBegin: w => {
    const apply = w.applyInput.bind(w);
    w.applyInput = (frame, scheme) => {
      aim = null;
      if (frame.right.held && frame.aimPoint) {
        const enemy = w.infected!.active.find(e => Math.hypot(e.transform.x-frame.aimPoint!.x,e.transform.z-frame.aimPoint!.z)<.01);
        if (enemy) {
          const p = w.entities.get(1)!.transform;
          offset.setFromSphericalCoords(19, Math.PI*.3, Math.PI/4);
          const y=Math.max(0,p.y-.72); camera.position.set(p.x+offset.x,y+offset.y,p.z+offset.z);camera.lookAt(p.x,y,p.z);camera.updateMatrixWorld(true);
          frustum.setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
          point.set(enemy.transform.x,enemy.transform.y+.35,enemy.transform.z);
          aim = { tick: w.tick, target: enemy.id, allowed: w.infected!.director.inPlayerView(enemy.transform,16,1,5), minimumPlaneDistance: Math.min(...frustum.planes.map(plane=>plane.distanceToPoint(point))),
            player: { x:p.x,z:p.z }, enemy: { x:enemy.transform.x,y:enemy.transform.y,z:enemy.transform.z } };
        }
      }
      apply(frame,scheme);
    };
    w.events.on('combat.attack', event => { if (event.type==='combat.attack'&&event.sourceId===1&&aim) shots.push({...aim}); });
  } });
  const invalid = shots.filter(shot=>!shot.allowed&&shot.minimumPlaneDistance < -5);
  if (!before) assert.equal(invalid.length,0,'all actual shots must respect the game camera plus5m');
  rows.push({tier,run,shots,invalidShots:invalid.length});
  console.log(`${tier}: ${shots.length} actual shots; ${invalid.length} beyond camera+5m`);
}
if (before) assert(rows.some(row=>row.invalidShots>0),'known native perception fault must reproduce');
atomicJson(`docs/reports/fix51-r5c/l8-policy-${before?'before':'after'}.json`,{...identity,botSha256,
  method:'Read-only interception of native input and actual combat.attack events. Independent perspective-camera frustum plane distances check the same25deg/radius19/polar0.3π/azimuthπ/4 camera as followFrustum; violations must be outside both the production camera+5m query and an independent5m plane expansion.',rows});
