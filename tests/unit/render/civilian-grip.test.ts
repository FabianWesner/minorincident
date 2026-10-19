import { readFileSync } from 'node:fs';
import { CylinderGeometry, Matrix4, Vector3, type InstancedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { simplifyCrowdLod } from '../../../src/render/characters/crowdLodGeometry';
import { MeshoptDecoder } from 'meshoptimizer';
import { expect, test } from 'vitest';
import { bakeInfected, civilianClips, framesPerClip } from '../../../src/render/characters/bakeInfected';
import { CrowdGunAim } from '../../../src/render/characters/GunAim';
import { handTriangles, prepareGrip, removeAuthoredCane, gripReach, uprightHand } from '../../../src/render/npc/civilianGrip';
import { RoutineProps, cupSocket } from '../../../src/render/npc/RoutineProps';
import { boxOf, staticClipping, type TriangleSet } from '../../../src/debug/scenelab/geometry';
import type { CivilianProp } from '../../../src/sim/npc/types';

const models = ['man-a', 'man-b', 'woman-a', 'woman-b', 'elderly'];
for (const lod of [0, 1, 2]) for (const model of models) test(`@E08 @E30-AC19 native ${model} lod=${lod} fingers clear all routine props`, async () => {
  const bytes = readFileSync(`public/assets/models/npc.civilian-${model}${lod ? `.lod${lod}` : ''}.glb`);
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  if (model === 'elderly') removeAuthoredCane(scene);
  const baked = bakeInfected(scene, [], false, civilianClips);
  prepareGrip(baked.geometry, baked.clip.parts.indexOf('handR'));
  const indexed = mergeVertices(baked.geometry); baked.geometry.dispose(); baked.geometry = indexed;
  await simplifyCrowdLod(baked.geometry, lod === 2 ? .01 : .005, lod === 2 ? .35 : .5);
  const hand = handTriangles(baked.geometry, baked.clip.parts.indexOf('handR'));
  const props = new RoutineProps(), matrix = new Matrix4(), point = new Vector3();
  for (const prop of ['coffee', 'phone', 'bag', 'cane', 'watering-can', 'parcel'] as CivilianProp[]) {
    props.begin(); props.held(prop, matrix, 1, hand, gripReach(hand));
    const mesh = props.children.find(m => (m as InstancedMesh).count > 0) as InstancedMesh;
    const propMatrix = new Matrix4(); mesh.getMatrixAt(0, propMatrix);
    const positions = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
    const tris = new Float32Array((index?.count ?? positions.count) * 3);
    for (let i = 0; i < tris.length / 3; i++) point.fromBufferAttribute(positions, index ? index.getX(i) : i).applyMatrix4(propMatrix).toArray(tris, i * 3);
    if (prop === 'phone') expect(boxOf(tris).min[0] - boxOf(hand).max[0]).toBeCloseTo(.001, 5);
    const sets: TriangleSet[] = [{ id: 'hand', assetId: model, tris: hand, box: boxOf(hand) }, { id: prop, assetId: prop, tris, box: boxOf(tris) }];
    expect(staticClipping(sets), `${model}/${prop}`).toEqual([]);
  }
  const native = handTriangles(baked.geometry, baked.clip.parts.indexOf('handR'), false);
  const oldCup = new CylinderGeometry(.07, .055, .16, 12).translate(0, .025, 0).toNonIndexed();
  const cup = oldCup.getAttribute('position').array as Float32Array;
  expect(staticClipping([{ id: 'native', assetId: model, tris: native, box: boxOf(native) }, { id: 'old-cup', assetId: 'coffee', tris: cup, box: boxOf(cup) }]).length).toBeGreaterThan(0);
  oldCup.dispose();
  props.dispose(); baked.geometry.dispose();
});

/**
 * PO 2026-10-12 "The way the guy holds the cup is strange": a held mug is gripped by its handle, upright, with the elbow bent and the
 * hand at chest or waist height in front of the body (a sipping idle raises it to the mouth), instead of hanging at the hip on a straight arm.
 */
for (const model of ['man-a', 'woman-b', 'elderly']) test(`@E08 ${model} holds the mug by the handle, upright, elbow bent, at chest/waist height`, async () => {
  const bytes = readFileSync(`public/assets/models/npc.civilian-${model}.glb`);
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  if (model === 'elderly') removeAuthoredCane(scene);
  const baked = bakeInfected(scene, [], false, civilianClips);
  const parts = baked.clip.parts, part = (name: string) => parts.indexOf(name), count = parts.length;
  const aim = new CrowdGunAim(scene, parts);
  const frame = civilianClips.indexOf('npc-carry') * framesPerClip + 3;
  const position = (pose: Float32Array, name: string) => new Vector3().setFromMatrixPosition(new Matrix4().fromArray(pose, part(name) * 16));
  for (const sip of [0, 1]) {
    const pose = Float32Array.from((baked.clip.matrices as Float32Array).subarray(frame * count * 16, (frame + 1) * count * 16));
    const straight = position(pose, 'handR').y;
    aim.hold(pose, sip, cupSocket);
    const hand = new Matrix4();
    uprightHand(pose, part('handR'), hand);
    const shoulder = position(pose, 'armR'), elbow = position(pose, 'foreArmR'), wrist = position(pose, 'handR'), hip = position(pose, 'hip'), head = position(pose, 'head');
    // Elbow bent: the wrist is clearly closer to the shoulder than the arm is long, and above where the straight arm hung.
    const upper = shoulder.distanceTo(elbow), lower = elbow.distanceTo(wrist);
    expect(shoulder.distanceTo(wrist), `${model} sip ${sip} arm straight`).toBeLessThan((upper + lower) * .92);
    expect(wrist.y, `${model} hand not raised`).toBeGreaterThan(straight + .02);
    if (sip === 0) { expect(wrist.y).toBeGreaterThan(hip.y); expect(wrist.y).toBeLessThan(shoulder.y); }
    else expect(wrist.y, `${model} sip hand near the mouth`).toBeGreaterThan(head.y - .22);
    // The cup sits in front of the body (+X is forward in the rig) and on the hand matrix, whose rotation is stripped: the mug axis is the figure's up.
    expect(wrist.x, `${model} cup in front of the body`).toBeGreaterThan(hip.x);
    const props = new RoutineProps(); props.begin(); props.held('coffee', hand, 1);
    const mesh = props.children.find(m => (m as InstancedMesh).count > 0) as InstancedMesh, m = new Matrix4(); mesh.getMatrixAt(0, m);
    const up = new Vector3(0, 1, 0).transformDirection(m), tilt = Math.acos(Math.min(1, up.y)) * 180 / Math.PI;
    expect(tilt, `${model} mug tilt`).toBeLessThanOrEqual(15);
    // The handle (top bar, prop-local) lies in the palm: within 10 cm of the wrist joint.
    const handle = new Vector3(.035, -.045, 0).applyMatrix4(m);
    expect(handle.distanceTo(wrist), `${model} handle away from the hand`).toBeLessThanOrEqual(.1);
    // PO 10-15 "still wrong": the mug body is inboard of the right hand (+Z is the figure's right) and the handle loop outboard,
    // so the fingers pass through the handle and the hand is beside the mug, not hidden behind it.
    const body = new Vector3(...cupSocket).applyMatrix4(m), loop = new Vector3(.035, -.1075, .065).applyMatrix4(m);
    expect(body.z, `${model} mug body inboard of the hand`).toBeLessThan(wrist.z - .08);
    expect(loop.z, `${model} handle loop outboard of the hand`).toBeGreaterThan(wrist.z);
    expect(body.z, `${model} mug in front of the right chest, not beyond the shoulder`).toBeLessThan(shoulder.z);
    props.dispose();
  }
  baked.geometry.dispose();
});
