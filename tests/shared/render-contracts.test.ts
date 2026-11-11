// Shared render contracts: every crowd figure, corpse and prop in all levels goes through these paths. The compiled-program
// GPU-limit ground truth is tests/e2e/crowd-gpu-limits.spec.ts; these node tests pin the CPU-side layouts and math it relies on.
import { BufferAttribute, Float32BufferAttribute, BufferGeometry, BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, Color, DataTexture, FloatType, Frustum, InstancedBufferAttribute, InstancedInterleavedBuffer, InterleavedBufferAttribute, Matrix4, OrthographicCamera, Quaternion, RGBAFormat, Vector3 } from 'three';
import { Box3, MeshLambertNodeMaterial, NodeFrame, PerspectiveCamera, Scene, TextureNode, type InstancedMesh } from 'three/webgpu';
import { float, vec3 } from 'three/tsl';
import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { staticBatch } from '../../src/assets/staticBatch';
import { gunzipSync } from 'node:zlib';
import { decodeCivilianBake } from '../../src/assets/civilianBakeData';
import { deathReach, registerDeathPoseRepair, repairDeathPoses } from '../../src/render/characters/deathPose';
import { packCrowdParts } from '../../src/assets/crowd';
import { bakeInfected, framesPerClip, infectedClips } from '../../src/render/characters/bakeInfected';
import { crowdVertexLayout, resolveCrowdAppearance, markCrowdAppearance } from '../../src/render/characters/CrowdAppearance';
import { createSkinnedCrowdFixture } from '../fixtures/skinnedCrowd';
import { packSkin, premultiplyRow, restInverses, skinnedVertexMatrix } from '../../src/render/characters/skinnedCrowd';
import { StaticCorpses } from '../../src/render/characters/StaticCorpses';
import { CrowdPosePalette } from '../../src/render/characters/CrowdPosePalette';
import { PickBodies } from '../../src/render/characters/PickBodies';
import { CrowdView } from '../../src/render/CrowdView';
import { VehicleView } from '../../src/render/VehicleView';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { Lighting } from '../../src/render/Lighting';
import { LightField } from '../../src/render/LightField';
import { corpseLod, crowdLod, pickLod, propLod } from '../../src/render/lodPolicy';
import { Materials } from '../../src/render/Materials';
import type { PaletteMaterial } from '../../src/render/PaletteMaterial';
import { installTextureRanges } from '../../src/render/TextureRanges';
import { uploadFloatTexture, type FloatUploadDevice } from '../../src/render/TextureUpload';
import { weatherMaterialFlags } from '../../src/render/WeatherView';
import { civilianMaterial } from '../../src/render/npc/CivilianMaterial';
import { RoutineProps } from '../../src/render/npc/RoutineProps';
import { crowdGunHolds, longGunHolds } from '../../src/render/characters/GunAim';
import type { EntitySnapshot } from '../../src/sim/world/types';
import { crowdWeaponGeometry, crowdWeaponAssets } from '../../src/render/npc/crowdWeapons';
import { isCrowdVariant, registerCrowdModel } from '../../src/render/crowdModels';
import { Renderer, installTextureBindingIdentity } from '../../src/render/Renderer';
import { crowdSurfaceBindings, crowdTextureForDraw } from '../../src/render/characters/crowdTexture';
import { addHighwayRailJoints } from '../../src/assets/highwayRailJoints';
import { InstancedGroup } from '../../src/render/InstancedGroup';
import { batchPerimeterPosts } from '../../src/render/PerimeterPosts';
import { CrowdAccessories } from '../../src/render/characters/CrowdAccessories';
import { skinnedBrow } from '../../src/render/characters/headMeasurements';
import { characterNodes } from '../../src/data/survivor';
import { alphaCrowdClips } from '../../src/render/characters/crowdClipNames';
import { AlphaMoves } from '../../src/render/characters/AlphaMoves';
import { AnimalMoves } from '../../src/render/characters/AnimalMoves';
import { InfectedMoves } from '../../src/render/characters/InfectedMoves';
import { airborneFootTrack, summarizeMotion } from '../../src/debug/scenelab/motion';
import { LimbIK } from '../../src/render/characters/LimbIK';
import { retargetClip, skinClips } from '../../src/render/characters/clips';
import { alphaTypes } from '../../src/data/alphaTypes';
import { alphaLooks } from '../../src/data/alphaLooks';
import { courierForegroundWanted, crowdSurroundsCourier, megaOccludesCourier } from '../../src/render/courierForeground';
import { DistrictOcclusion } from '../../src/render/district/DistrictOcclusion';
import { isStructuralOccluder } from '../../src/assets/worldDefinitions';
import { isUncutProp } from '../../src/assets/DistrictAssets';
import { EntityAssets } from '../../src/render/EntityAssets';
import { VehicleOccupant } from '../../src/render/characters/VehicleOccupant';
import { createSurvivorPlaceholder } from '../../src/render/characters/placeholder';
import { prepareTransportModel } from '../../src/render/transportModel';
import { vehicleDef } from '../../src/data/vehicles';
import type { AssetRegistry } from '../../src/assets/registry';
import { GroundContacts } from '../../src/render/characters/GroundContacts';
import { resolveRig, disposeCharacter } from '../../src/render/characters/rig';
import { heroineStandingHeight } from '../../src/render/npc/figureHeight';
import { CorpseLayout } from '../../src/render/characters/CorpseLayout';
import { Vfx } from '../../src/render/vfx/Vfx';

async function checkWarmPipelineDraws(): Promise<void> {
  {

  const object = { pipeline: {} }, submitted: typeof object[] = [];
  let created = false, linked = false, release!: () => void;
  const link = new Promise<void>(resolve => { release = () => { linked = true; resolve(); }; });
  const backend = {
    createRenderPipeline(_object: typeof object, promises: Promise<unknown>[] | null) {
      expect(promises).not.toBeNull(); created = true; promises!.push(link);
    },
    draw(value: typeof object) { expect(linked).toBe(true); submitted.push(value); },
  };
  const create = backend.createRenderPipeline, draw = backend.draw, nextNodeFrame = vi.fn();
  const renderer = { backend, nextNodeFrame } as unknown as Renderer;
  const warming = Renderer.prototype.prepareWarmRender.call(renderer, () => {
    if (!created) backend.createRenderPipeline(object, null);
    backend.draw(object);
  });
  expect(submitted).toEqual([]);
  expect(backend.createRenderPipeline).toBe(create); expect(backend.draw).toBe(draw);
  release(); await warming;
  expect(submitted).toEqual([object]); expect(nextNodeFrame).toHaveBeenCalledTimes(2);
  expect(backend.createRenderPipeline).toBe(create); expect(backend.draw).toBe(draw);
  }
  {

  const backend = { createRenderPipeline: vi.fn(), draw: vi.fn() }, create = backend.createRenderPipeline, draw = backend.draw;
  const renderer = { backend, nextNodeFrame: vi.fn() } as unknown as Renderer;
  await expect(Renderer.prototype.prepareWarmRender.call(renderer, () => { throw new Error('failed draw'); })).rejects.toThrow('failed draw');
  expect(backend.createRenderPipeline).toBe(create); expect(backend.draw).toBe(draw);
  }
}

/** r32-alphas: every humanoid Alpha look ships the authored move set, each move visibly moves the body, and each type maps to its own clip. */
function checkAlphaMoveSet(): void {
  const deliveries = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8')) as Record<string, string>;
  for (const look of alphaLooks['inf.alpha']) for (const lod of ['lod0', 'lod2']) {
    const bytes = gunzipSync(readFileSync(`public${deliveries[`${look}:${lod}:infected`]}`));
    const clip = decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)).clip;
    expect(clip.frames).toBe(alphaCrowdClips.length * framesPerClip);
    const P = clip.parts.length, at = (name: string, phase: number, part: string) => {
      const row = (alphaCrowdClips.indexOf(name as typeof alphaCrowdClips[number]) * framesPerClip + Math.round(phase * (framesPerClip - 1))) * P + clip.parts.indexOf(part);
      return new Vector3().setFromMatrixPosition(new Matrix4().fromArray(clip.matrices, row * 16));
    };
    // Rake: the right hand travels forward from the coil to the strike; slam: fists overhead, then at the ground.
    expect(at('alpha-strike', .62, 'handR').x - at('alpha-strike', .5, 'handR').x).toBeGreaterThan(.25);
    expect(at('alpha-slam', .5, 'handL').y).toBeGreaterThan(at('alpha-slam', .5, 'head').y);
    expect(at('alpha-slam', .7, 'handL').y).toBeLessThan(at('alpha-slam', .7, 'hip').y);
    // Pounce coil sits low; the heave lifts the load overhead; the bash drives the hip forward.
    expect(at('alpha-pounce', .45, 'hip').y).toBeLessThan(at('alpha-pounce', 0, 'hip').y - .12);
    expect(at('alpha-heave', .55, 'handR').y).toBeGreaterThan(at('alpha-heave', .55, 'head').y);
    expect(at('alpha-bash', .7, 'hip').x).toBeGreaterThan(at('alpha-bash', .5, 'hip').x + .1);
  }
  const moves = new AlphaMoves(), entity = (type: keyof typeof alphaTypes, extra: object) => ({ id: 9, archetype: 'infected.alpha', health: { current: 300 }, infected: { alphaType: type, state: 'chase', until: 0, ...extra } }) as unknown as EntitySnapshot;
  const clips = new Set<string>();
  for (const [type, definition] of Object.entries(alphaTypes) as [keyof typeof alphaTypes, typeof alphaTypes.brute][]) {
    const own = new Set(definition.moves.map(move => moves.sample(entity(type, { specialAttack: { move, stage: 'telegraph', startTick: 100, activeTick: 160, recoveryUntil: 0 } }), 130, .5, 0)!.clip));
    for (const clip of own) { expect(clips.has(clip)).toBe(false); clips.add(clip); }
  }
  expect(clips.size).toBe(7); // brute: charge, slam, grab; thrower: heave; screamer: roar; leaper: pounce; armoured: bash
  // The ordinary strike keeps playing after the sim's strike tick, and an interrupted inhale reels instead of roaring.
  expect(moves.sample(entity('brute', { state: 'attack', until: 200 }), 190, .5, 0)).toEqual({ clip: 'alpha-strike', phase: expect.closeTo(1 / 3, 3) });
  expect(moves.sample(entity('brute', { state: 'chase', until: 200 }), 210, .5, 2)?.clip).toBe('alpha-strike');
  expect(moves.sample(entity('brute', { state: 'chase', until: 200 }), 240, .5, 2)).toBeUndefined();
  expect(moves.sample(entity('screamer', { specialAttack: { move: 'alpha.roar', stage: 'recovery', startTick: 100, activeTick: 160, recoveryUntil: 178 } }), 140, .5, 0)?.clip).toBe('stagger-left');
}
/** s34-zombiehits: ordinary attacks persist through a render-only recovery and one-tick gun reactions remain visible. */
function checkOrdinaryInfectedPresentation(): void {
  const root = new Group(), upper = new Object3D(), middle = new Object3D(), end = new Object3D();
  root.add(upper); upper.add(middle); middle.add(end);
  middle.position.set(0, -.4, 0); end.position.set(0, -.3, 0);
  const ik = new LimbIK(upper, middle, end);
  // Retargeted animation changes a joint offset after solver construction.
  middle.position.set(.03, -.38, -.09); end.position.set(.01, -.28, -.03);
  root.updateMatrixWorld(true);
  const target = new Vector3(.1, -.5, .1);
  ik.solve(target, new Vector3(1, 0, 0), new Quaternion());
  expect(end.getWorldPosition(new Vector3()).distanceTo(target)).toBeLessThan(1e-5);
  const contact = (frame: number, x: number, clip = 'idle') => ({ frame, clip, floor: 0, feet: [{ heel: [x, 0, 0], toe: [x + .1, 0, 0], yaw: 0 }] });
  expect(summarizeMotion([contact(1, 0), contact(2, .01)]).slideMaxCm).toBe(1);
  expect(summarizeMotion([contact(1, 0), contact(2, .01)]).slideP95Cm).toBe(1);
  expect(summarizeMotion([contact(1, 0), contact(2, 1, 'knockdown'), contact(3, 2)]).slideMaxCm).toBe(0);
  const flight = [contact(1, 0), contact(2, 3)].map(f => ({ ...f, feet: f.feet.map(p => ({ ...p, heel: [p.heel[0], .5, 0], toe: [p.toe[0], .5, 0] })) }));
  expect(airborneFootTrack(flight, 2, 1)).toEqual({ complete: true, clearanceMinCm: 50, travelMinM: 3 });
  expect(airborneFootTrack(flight.slice(1), 2, 1).complete).toBe(false);
  expect(airborneFootTrack(flight, 2, 2).complete).toBe(false);
  expect(airborneFootTrack([contact(1, 0), contact(2, 3)], 2, 1).clearanceMinCm).toBe(0);
  const moves = new InfectedMoves();
  const entity = (state: string, reaction?: object) => ({
    id: 44, archetype: 'infected.runner', health: { current: 60 },
    infected: { state, until: 130, legLost: false },
    combat: { reaction },
  }) as unknown as EntitySnapshot;
  const windup = moves.sample(entity('attack'), 'attack', 130, .5, 115, 0, 2.4, 'infected-lurch');
  expect(windup.layers.attack).toBeCloseTo(.25);
  expect(windup.layers.attackStyle).toBe(0);
  expect(moves.sample(entity('chase'), 'chase', 130, .5, 129.25, 0, 2.4, 'infected-lurch').layers.attack).toBe(.5);
  const strike = moves.sample(entity('chase'), 'chase', 130, .5, 140, 0, 2.4, 'infected-lurch');
  expect(strike.layers.attack).toBeGreaterThan(.5);
  const dogs = new AnimalMoves(), dog = { ...entity('attack'), archetype: 'infected.dog' };
  dogs.sample(dog, 129, 0, 0);
  const recoveringDog = { ...dog, infected: { ...dog.infected!, state: 'chase' as const } };
  dogs.sample(recoveringDog, 129.25, 0, 0); expect(dogs.dogPhase).toBeCloseTo(.4);
  dogs.sample(recoveringDog, 140, 0, 0); expect(dogs.dogPhase).toBeGreaterThan(.4);
  const flamingos = new AnimalMoves(), flamingo = { ...entity('chase'), archetype: 'infected.flamingo' };
  expect(flamingos.sample(flamingo, 129, 1.2, 0)).toBeUndefined();
  expect(flamingos.lift).toBe(0);
  const reaction = { index: 0, started: 100, until: 101, direction: { x: 1, z: 0 }, from: { x: 0, z: 0 }, to: { x: 0, z: 0 }, heavy: false };
  expect(InfectedMoves.flinch(entity('chase', reaction), 101)).toBeGreaterThan(.4);
  expect(InfectedMoves.flinch(entity('chase', reaction), 110)).toBeGreaterThan(.5);
  expect(InfectedMoves.flinch(entity('chase', reaction), 120)).toBe(0);
  expect(InfectedMoves.staggerClip(entity('chase', reaction), 104, 0)).toBeUndefined();
  expect(InfectedMoves.staggerClip(entity('chase', { ...reaction, until: 115, direction: { x: 0, z: -1 } }), 104, 0)).toBe('stagger-left');
  expect(InfectedMoves.staggerClip(entity('chase', { ...reaction, until: 115, direction: { x: 0, z: 1 } }), 104, 0)).toBe('stagger-right');
  const repeat = entity('chase', { ...reaction, started: 106, until: 107 });
  expect(InfectedMoves.flinch(repeat, 107)).toBeLessThan(InfectedMoves.flinch(repeat, 109));
  expect(InfectedMoves.flinch(repeat, 116)).toBeLessThan(InfectedMoves.flinch(repeat, 109));
}
/** r39-l10nan: the in-place hit/attack clips that carry a crowd gaitShape (hurt, windup, swing, stagger-*) have no stride. Baking
 * them as a planted walk cycle made every leg/hip track NaN: the courier's first 'hurt' drew her invisible for the rest of the
 * level and NaN'd her gun muzzle (one RangeError per shot). Every retargeted clip must stay finite, rigid and skinned. */
function checkFiniteActionClips(): void {
  const rig = new Group(), node = (name: string, parent: Object3D, x: number, y: number, z: number) => { const n = new Object3D(); n.name = name; n.position.set(x, y, z); parent.add(n); return n; };
  const hip = node('hip', rig, 0, .705, 0), torso = node('torso', hip, 0, .1, 0);
  for (const [side, z] of [['L', .15], ['R', -.15]] as const) node(`hand${side}`, node(`foreArm${side}`, node(`arm${side}`, torso, 0, .3, z), 0, -.2, 0), 0, -.2, 0);
  for (const [side, z] of [['L', .09], ['R', -.09]] as const) node(`foot${side}`, node(`shin${side}`, node(`leg${side}`, hip, 0, -.05, z), 0, -.3, 0), 0, -.3, 0);
  for (const source of [undefined, skinClips]) for (const name of ['hurt', 'windup', 'swing', 'stagger-left', 'stagger-right', ...source ? [] : ['walk', 'run']]) {
    const clip = retargetClip(rig, name, false, source);
    for (const track of clip.tracks) expect(Array.from(track.values).every(Number.isFinite), `${source ? 'skin' : 'rigid'} ${name} ${track.name}`).toBe(true);
  }
}
function checkFractionalCrowdPicking(): void {
  const matrices = new Float32Array(32);
  new Matrix4().toArray(matrices, 0);
  new Matrix4().makeTranslation(4, 2, 0).toArray(matrices, 16);
  const palette = new CrowdPosePalette({ parts: ['root'], frames: 2, duration: 1, matrices, binds: new Float32Array(new Matrix4().elements) }, 1);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute('_parts', new Float32BufferAttribute(new Float32Array(12), 4));
  geometry.setAttribute('_skin', new Float32BufferAttribute(new Float32Array(12), 4));
  const bodies = new PickBodies();
  try {
    for (const frame of [0, .3, .7, 1]) {
      bodies.begin(); bodies.add(16, new Matrix4(), palette, frame, frame, 1, geometry);
      const box = bodies.bounds(16, new Box3());
      expect(box).not.toBeNull();
      expect(box!.min.toArray()).toEqual([expect.closeTo(4 * frame, 5), expect.closeTo(2 * frame, 5), 0]);
      expect(box!.max.toArray()).toEqual([expect.closeTo(4 * frame + 1, 5), expect.closeTo(2 * frame + 1, 5), 0]);
      expect(bodies.top(16, new Matrix4())).toBeCloseTo(2 * frame + 1, 5);
      const pose = palette.pose(frame, frame, 1);
      expect([...pose].every(Number.isFinite)).toBe(true);
      expect(pose[12]).toBeCloseTo(4 * frame, 5);
      expect(pose[13]).toBeCloseTo(2 * frame, 5);
    }
  } finally { geometry.dispose(); palette.texture.dispose(); }
}

function checkChangingSupport(): void {
  const model = createSurvivorPlaceholder('female'), rig = resolveRig(model);
  const contacts = new GroundContacts(rig);
  try {
    for (const phase of [.1, .4, .7, .9, .1, .58]) {
      model.position.x += .02;
      contacts.update(phase, .4, 0, 1, .6);
    }
    const plant = contacts.contact(0)!.target.clone();
    model.position.x += .02;
    // The previous phase exceeds the new stance, although it was planted last frame.
    contacts.update(.61, .4, 0, 1, .55);
    const swing = contacts.contact(0)!.target;
    expect(Math.hypot(swing.x - plant.x, swing.z - plant.z)).toBeLessThan(1e-6);
    expect(swing.y).toBeGreaterThan(plant.y);
  } finally { disposeCharacter(model); }
}

async function checkSeatedBodyFrame(): Promise<void> {
  const source = createSurvivorPlaceholder('male'); source.scale.setScalar(1.8);
  const standingHeight = new Box3().setFromObject(source).getSize(new Vector3()).y;
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting);
  const registry = { loadAsset: async () => source } as unknown as AssetRegistry;
  const occupant = await VehicleOccupant.load(registry, 4, 'npc.civilian-man-a', materials);
  const hull = new Group(); prepareTransportModel(hull, vehicleDef('vehicle.military-apc')); hull.add(occupant);
  try {
    expect(occupant.model.scale.x / 1.8).toBeCloseTo(heroineStandingHeight / standingHeight, 6);
    for (let index = 0; index < 6; index++) {
      const seat = hull.getObjectByName(`passenger${index}`)!;
      occupant.pose(seat); hull.updateMatrixWorld(true);
      expect(occupant.model.getObjectByName('hip')!.getWorldPosition(new Vector3()).distanceTo(seat.getWorldPosition(new Vector3()))).toBeLessThan(1e-6);
      const forward = new Vector3(1, 0, 0).applyQuaternion(occupant.quaternion);
      expect(forward.x).toBeCloseTo(0, 6);
      expect(forward.z * seat.position.z).toBeLessThan(0);
    }
    const cast = new Map([
      [1, { id: 1, survivor: { variant: 'female' }, health: { current: 100 } }],
      [2, { id: 2, civilian: { model: 'npc.civilian-man-a' }, health: { current: 100 } }],
      [3, { id: 3, civilian: { model: 'amb.monkey', zooAnimal: 'monkey' }, health: { current: 100 } }],
      [4, { id: 4, civilian: { model: 'amb.lioness', zooAnimal: 'lioness' }, health: { current: 100 } }],
    ]);
    const world = { entities: { get: (id: number) => cast.get(id), iterate: () => cast.values() }, vehicles: { cars: new Map([[7, { entity: { id: 7 } }]]) }, missions: { state: {}, l8: { state: { carId: 7 } } } } as unknown as SimWorld;
    const view = new VehicleView(world, materials, {} as ConstructorParameters<typeof VehicleView>[2]);
    (view as unknown as { records: Map<number, { model: Group }> }).records.set(7, { model: hull });
    const load = vi.spyOn(VehicleOccupant, 'load').mockImplementation(async (_registry, actorId) => Object.assign(new Group(), { actorId, pose: () => {}, dispose: () => {} }) as unknown as VehicleOccupant);
    try {
      const restore = await view.prewarmOccupants();
      expect(load.mock.calls.map(call => call[2]), 'transport warms the human escape cast, never seated zoo animals').toEqual(['char.courier-female', 'npc.civilian-man-a']);
      restore?.();
    } finally { load.mockRestore(); view.dispose(); }
  } finally { occupant.dispose(); materials.dispose(); lighting.dispose(); }
}

function checkPassengerReveal(): void {
  const assets = Object.create(EntityAssets.prototype) as EntityAssets;
  const bus = new Mesh(new BoxGeometry(9, 3, 2), new MeshBasicMaterial());
  Object.assign(assets, {
    world: { entities: { get: () => ({ hidden: true, passengerOf: 50 }) } },
    records: new Map([[50, { model: bus }]]),
  });
  const bounds = new Box3();
  expect(assets.playerBounds(bounds)).toBe(true);
  expect(bounds.getSize(new Vector3()).toArray()).toEqual([9, 3, 2]);
  bus.geometry.dispose(); bus.material.dispose();
}

/** Crowd headroom below the portable hard limits (16 attributes, 8 WebGPU vertex buffers). */
const CROWD = { attributes: 14, buffers: 7 };
const deathFrame = () => infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1;

function checkStaticArtworkBatches(): void {
  const source = new MeshLambertNodeMaterial(); source.userData.batchFeatures = 'diner-art';
  const geometry = new BoxGeometry(), root = new Group(); root.add(new Mesh(geometry, source));
  const a = new InstancedGroup(root, [new Object3D()]), b = new InstancedGroup(root, [new Object3D(), new Object3D()]);
  try {
    const first = a.children[0] as InstancedMesh, second = b.children[0] as InstancedMesh;
    expect(first.userData.staticInstanceAttributes).toBe(true);
    expect(first.isInstancedMesh).toBe(false);
    expect(first.material).toBe(second.material);
    expect(first.geometry.getAttribute('_placement0')).not.toBe(second.geometry.getAttribute('_placement0'));
  } finally { a.dispose(); b.dispose(); source.dispose(); geometry.dispose(); }
}

test('static placement batches reuse their graph and narrow barriers keep the foreground cut', async () => {
  await checkHighwayModels();
  checkVehicleForegroundVeto();
  await checkSeatedBodyFrame(); checkChangingSupport();
  checkStaticArtworkBatches();
  checkPassengerReveal();
  expect(isStructuralOccluder('prop.privacy-fence')).toBe(true);
  expect(isStructuralOccluder('prop.picket-fence')).toBe(true);
  expect(isStructuralOccluder('prop.trash-bags')).toBe(false);
  expect(isStructuralOccluder('bld.house-a')).toBe(false);
  expect(isUncutProp('prop.crowd-fence')).toBe(false);
  expect(isUncutProp('prop.privacy-fence', 1)).toBe(false);
  expect(isUncutProp('prop.bench')).toBe(true);
  const fence = new Object3D(), distantFence = new Object3D(); fence.position.set(1, 0, 1); distantFence.position.set(30, 0, 30);
  const cut = { seeThrough: (enabled: boolean, ref: Object3D) => { ref.userData.occluder = enabled; } };
  const parts = { lodBatches: [{ id: 'prop.privacy-fence', refs: [fence, distantFence], origin: [0, 0], height: 1.8, foot: { cx: 0, cz: 0, hx: .135, hz: .52 }, hero: cut, near: cut, far: cut }], dressingEntries: [] };
  const camera = new PerspectiveCamera(45, 16 / 9, .1, 100); camera.position.set(8, 8, 8); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  type PolicyArgs = ConstructorParameters<typeof DistrictOcclusion>;
  const policy = new DistrictOcclusion(parts as unknown as PolicyArgs[0], {} as PolicyArgs[1], () => {}, () => {});
  policy.update({ camera } as Parameters<DistrictOcclusion['update']>[0], true, { x: 0, y: .7, z: 0 }, new Box3(new Vector3(-2, 0, -.55), new Vector3(.55, 1.9, 2)));
  expect(fence.userData.occluder).toBe(true);
  expect(distantFence.userData.occluder).toBe(false);
  // District-batched vehicle hulls use the same on-foot veto as physical/scripted cars.
  const hull = { ...parts.lodBatches[0], id: 'veh.military-truck', refs: [fence], height: 3, half: 5, foot: { cx: 0, cz: 0, hx: 2, hz: 1 } };
  const vehiclePolicy = new DistrictOcclusion({ ...parts, lodBatches: [hull] } as unknown as PolicyArgs[0], {} as PolicyArgs[1], () => {}, () => {});
  const vehicleView = { camera } as Parameters<DistrictOcclusion['update']>[0], subject = new Box3(new Vector3(-.55, 0, -.55), new Vector3(.55, 1.9, .55));
  vehiclePolicy.update(vehicleView, true, { x: 0, y: .7, z: 0 }, subject, true);
  expect(vehiclePolicy.courierOccluded).toBe(true);
  vehiclePolicy.update(vehicleView, true, { x: 0, y: .7, z: 0 }, subject, false);
  expect(vehiclePolicy.courierOccluded).toBe(false);
  expect(fence.userData.occluder).toBe(true); // rider/driver retains the placement cut

  // An open raised gun platform keeps the bounded cut, never the enclosing-prop
  // lens cut that erases its entire supporting deck beside the courier.
  const platform = { ...hull, id: 'kit.dispersal-platform', height: 4.165, foot: { cx: 0, cz: 0, hx: 5, hz: 4 } };
  const platformPolicy = new DistrictOcclusion({ ...parts, lodBatches: [platform] } as unknown as PolicyArgs[0], {} as PolicyArgs[1], () => {}, () => {});
  platformPolicy.update(vehicleView, true, { x: 0, y: .7, z: 0 }, subject);
  expect(fence.userData.occluder).toBe(true);
  expect(platformPolicy.courierTucked).toBe(false);
  expect(platformPolicy.seeThroughAudit().lensPlacements).toEqual([]);

  const lighting = new Lighting(new Scene()), shading = new Materials(lighting), material = shading.fromColor('joint', new Color('#999996'), 0, true);
  const root = new Group(), geometries = addHighwayRailJoints(root, material);
  const a = new InstancedGroup(root, [new Object3D()]), b = new InstancedGroup(root, [new Object3D()]);
  const postGeometry = new BoxGeometry(.16, 1.05, .16), points: [number, number, number][] = [[-129, .525, 3], [-128, .525, 3], [-127, .525, 3], [128, .525, -3]];
  const posts = batchPerimeterPosts(points, postGeometry, shading.get('woodWarm'));
  try {
    expect(a.children).toHaveLength(2);
    a.children.forEach((child, index) => {
      const mesh = child as InstancedMesh, other = b.children[index] as InstancedMesh;
      expect(mesh.userData.staticInstanceAttributes).toBe(true);
      expect(mesh.isInstancedMesh).toBe(false);
      expect(mesh.material).toBe(other.material);
      expect(mesh.geometry.getAttribute('_placement0')).toBeDefined();
      expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
      expect(mesh.geometry.index!.count).toBe(36);
    });
    expect(posts.map(mesh => mesh.count)).toEqual([1, 2, 1]);
    expect(new Set(posts.map(mesh => mesh.material)).size).toBe(1);
    let index = 0;
    for (const mesh of posts) {
      expect(mesh.userData.staticInstanceAttributes).toBe(true);
      expect(mesh.castShadow).toBe(false); expect(mesh.receiveShadow).toBe(true);
      expect(mesh.geometry.index!.array).toBe(postGeometry.index!.array);
      const placement = mesh.geometry.getAttribute('_placement3');
      for (let i = 0; i < mesh.count; i++) expect([placement.getX(i), placement.getY(i), placement.getZ(i)]).toEqual(points[index++].map(Math.fround));
      expect(Array.from(mesh.instanceColor!.array)).toEqual(Array(mesh.count * 3).fill(1));
    }
    expect(posts[0].geometry.getAttribute('_placement0')).not.toBe(posts[1].geometry.getAttribute('_placement0'));
  } finally { a.dispose(); b.dispose(); for (const mesh of posts) { mesh.geometry.dispose(); mesh.dispose(); } postGeometry.dispose(); for (const geometry of geometries) geometry.dispose(); shading.dispose(); lighting.dispose(); }
});

/** Invalid lantern transforms poison the whole ramp's bounds, hiding its road and rails while collision remains. */
async function checkHighwayModels(): Promise<void> {
  const lighting = new Lighting(new Scene()), shading = new Materials(lighting);
  try {
    for (const lod of ['', '.lod1', '.lod2']) {
      const file = `public/assets/models/kit.highway-onramp${lod}.glb`, bytes = readFileSync(file);
      const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
      scene.updateMatrixWorld(true);
      scene.traverse(node => {
        if (node instanceof Mesh) expect(node.matrixWorld.elements.every(Number.isFinite), `${file}: ${node.name} has a finite world transform`).toBe(true);
      });
      scene.userData.assetId = 'kit.highway-onramp';
      const batch = staticBatch(scene, true, shading), box = new Box3().setFromObject(batch);
      expect([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite), `${file}: production batching preserves finite culling bounds`).toBe(true);
      expect(box.getSize(new Vector3()).x).toBeGreaterThan(28);
      expect(box.getSize(new Vector3()).y).toBeGreaterThan(9);
      batch.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose(); } });
      scene.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose(); } });
    }
  } finally { shading.dispose(); lighting.dispose(); }
}

test('a held cane reaches the floor across rig scales without moving its fitted grip', () => {
  const props = new RoutineProps(), matrix = new Matrix4();
  for (const scale of [.8, 1, 1.3]) for (const floor of [0, .13]) {
    const hand = new Matrix4().makeScale(scale, scale, scale).setPosition(.2, floor + .8 * scale, .3);
    props.begin(); props.held('cane', hand, 7, undefined, .07, false, floor);
    const mesh = props.children.find(child => (child as InstancedMesh).count === 1) as InstancedMesh;
    mesh.getMatrixAt(0, matrix);
    expect(mesh.geometry.boundingBox!.clone().applyMatrix4(matrix).min.y).toBeCloseTo(floor, 5);
    const grip = hand.clone().multiply(new Matrix4().makeTranslation(.07 - .014, 0, 0));
    for (const axis of [12, 13, 14]) expect(matrix.elements[axis]).toBeCloseTo(grip.elements[axis], 6);
  }
  props.dispose();
});

test('authored aftermath and skinned infected headwear survives variation and accepts explicit accessories', async () => {
  const shaded = vi.fn((...args: unknown[]) => {
    expect(args[5], 'headwear declares no emissive eye surface').toBeDefined();
    expect(args[8], 'headwear reads each instance’s infected flag').toBeDefined();
    return new MeshLambertNodeMaterial();
  });
  const accessories = new CrowdAccessories({ shaded } as unknown as Materials);
  accessories.ids.splice(0, accessories.ids.length, 'acc.placeholder-hair');
  const poses = new CrowdPosePalette({ parts: ['head'], frames: 1, duration: 1, matrices: new Float32Array(new Matrix4().elements) }, 2);
  try {
    await accessories.init(); accessories.begin();
    const person = { id: 100, faction: 'civilian', archetype: 'civilian.cashier', appearance: { entityId: 100, asset: 'npc.person.aftermath', accessories: ['acc.placeholder-hair'], tint: '#888888' } } as unknown as EntitySnapshot;
    accessories.place(person, 'lod0', poses, 0, [0, 1], new Matrix4());
    accessories.place({ ...person, id: 101, faction: 'infected' }, 'lod0', poses, 0, [0, 1], new Matrix4());
    accessories.finish();
    const mesh = accessories.children.find(m => (m as InstancedMesh).count === 2) as InstancedMesh;
    const threat = mesh.geometry.getAttribute('_crowdThreat') as InstancedBufferAttribute;
    expect(threat, 'separate headwear must inherit the underground body highlight limit').toBeDefined();
    expect([threat.getX(0), threat.getX(1)]).toEqual([0, 1]);
    expect(threat.updateRanges).toEqual([{ start: 0, count: 2 }]);
    expect(accessories.snapshot().every(s => s.layout.webgpu && s.layout.webgl2)).toBe(true);
    expect(shaded.mock.calls.every(args => args.length === 9 && args[5] && args[8])).toBe(true);
  } finally { accessories.dispose(); poses.texture.dispose(); }
  for (let id = 1; id <= 32; id++) {
    const entity = { id, archetype: 'civilian.cashier', appearance: { entityId: id, asset: 'npc.person.aftermath', accessories: [], tint: '#888888' } } as unknown as EntitySnapshot;
    expect(resolveCrowdAppearance(entity, ['acc.test']).accessory, `authored headwear, entity ${id}`).toBeNull();
    entity.appearance!.accessories = ['acc.test'];
    expect(resolveCrowdAppearance(entity, ['acc.test']).accessory).toBe('acc.test');
    for (const model of ['inf.common-worker', 'inf.jogger', 'inf.cashier', 'inf.delivery-driver', 'inf.suburban-mom', 'inf.bbq-dad', 'inf.bathrobe-neighbor']) {
      const native = { id, archetype: 'infected.runner', infected: { variant: model } } as unknown as EntitySnapshot;
      expect(resolveCrowdAppearance(native, ['acc.test']).accessory, model).toBeNull();
      native.appearance = { entityId: id, asset: model, accessories: ['acc.test'], tint: '#888888' } as EntitySnapshot['appearance'];
      expect(resolveCrowdAppearance(native, ['acc.test']).accessory, model).toBe('acc.test');
    }
  }
  const coarse = new BufferGeometry(), head = characterNodes.indexOf('head');
  coarse.setAttribute('position', new BufferAttribute(new Float32Array([-.15, 0, -.2, .15, .3, .2, .2, .24, 0, .2, .05, 0]), 3));
  coarse.setAttribute('_parts', new BufferAttribute(new Float32Array([head, -1, 0, 0, head, -1, 0, 0, head, 0, 2, 0, head, 0, 0, 0]), 4));
  coarse.userData.crowdBinds = characterNodes.flatMap(() => new Matrix4().toArray());
  const brow = skinnedBrow(coarse)!;
  expect(brow.width).toBeCloseTo(.4); expect(brow.depth).toBeCloseTo(.3);
  coarse.userData.crowdAtlas = true;
  markCrowdAppearance(coarse);
  expect(coarse.getAttribute('_parts').getY(3)).toBe(0); // authored lower-face/beard surface is never hair
  expect(coarse.getAttribute('_parts').getW(3)).toBe(0);
  coarse.dispose();
});

test('crowd registration retains converted textured variants with their own model identity', () => {
  const native = new Set(['inf.runner']), aliases = new Map<string, string>();
  const variant = { id: 'inf.outfit', status: 'integrated', category: 'infected' } as const;
  expect(isCrowdVariant(variant, native)).toBe(false);
  expect(isCrowdVariant({ ...variant, textureMode: 'baseColor' }, native)).toBe(false);
  expect(isCrowdVariant({ ...variant, textureMode: 'baseColor', crowdSkin: true }, native)).toBe(true);
  expect(isCrowdVariant({ ...variant, id: 'inf.runner', crowdSkin: true }, native)).toBe(false);
  expect(registerCrowdModel(aliases, { id: variant.id, asset: variant.id })).toBe(variant.id);
  expect(aliases.get(variant.id)).toBe(variant.id);

  const bodies = Array.from({ length: 5 }, (_, i) => ({ id: i + 2, transform: { x: 1 + i * .1, y: 0, z: 0 }, health: { current: 100, max: 100 }, infected: { hidden: false } } as unknown as EntitySnapshot));
  expect(crowdSurroundsCourier({ x: 0, z: 0 }, bodies)).toBe(true);
  // L4 t13681: bulky bodies already cover her before five centres enter 3 m.
  const l4Overlap = bodies.map((body, i) => ({ ...body, transform: { ...body.transform, x: [2.69, 2.78, 2.99, 3.70, 4.08][i] } }));
  expect(crowdSurroundsCourier({ x: 0, z: 0 }, l4Overlap)).toBe(false);
  expect(crowdSurroundsCourier({ x: 0, z: 0 }, l4Overlap, 4.5)).toBe(true);

  expect(crowdSurroundsCourier({ x: 0, z: 0 }, bodies.slice(0, 4))).toBe(false);
  expect(crowdSurroundsCourier({ x: 0, z: 0 }, bodies.map(body => ({ ...body, transform: { ...body.transform, x: 4 } })))).toBe(false);
  expect(crowdSurroundsCourier({ x: 0, z: 0 }, bodies.map(body => ({ ...body, health: { current: 0, max: 100 } })))).toBe(false);
});

test('crowd weapons preserve the authored grip, rotate +X barrel into +Z, and own their geometry', () => {
  const root = new Group(), grip = new Object3D(), muzzle = new Object3D();
  grip.name = 'grip'; grip.position.set(-.2, .1, .03); muzzle.name = 'muzzle'; muzzle.position.set(.7, .1, .03);
  const source = new BoxGeometry(.9, .03, .03), mesh = new Mesh(source, new MeshBasicMaterial({ color: '#804020' }));
  root.add(mesh, grip, muzzle); const original = source.getAttribute('position').array.slice();
  const result = crowdWeaponGeometry(root, .65);
  expect(result.muzzle.x).toBeCloseTo(0); expect(result.muzzle.y).toBeCloseTo(0); expect(result.muzzle.z).toBeCloseTo(.585);
  expect(Object.keys(result.geometry.attributes)).toEqual(['position', 'normal', 'color']);
  expect(result.geometry.groups).toHaveLength(0); expect(source.getAttribute('position').array).toEqual(original);
  for (const [id, hold] of Object.entries(crowdGunHolds)) expect(hold.support).toEqual([-longGunHolds[crowdWeaponAssets[id as keyof typeof crowdWeaponAssets]].support[2], longGunHolds[crowdWeaponAssets[id as keyof typeof crowdWeaponAssets]].support[1], longGunHolds[crowdWeaponAssets[id as keyof typeof crowdWeaponAssets]].support[0]]);
  result.geometry.dispose(); source.dispose(); mesh.material.dispose();
});

test('GPU limits: crowd layouts bind matrix columns or instanceMatrix (never both); frozen corpse pages stay within buffer headroom', () => {
  const geometry = new BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['color', 3], ['_parts', 4], ['_dogCream', 3]] as const) geometry.setAttribute(name, new BufferAttribute(new Float32Array(size * 3), size));
  const instance = new InstancedInterleavedBuffer(new Float32Array(8), 8, 1);
  geometry.setAttribute('_state', new InterleavedBufferAttribute(instance, 4, 0)); geometry.setAttribute('_variant', new InterleavedBufferAttribute(instance, 4, 4));
  const columns = new InstancedInterleavedBuffer(new Float32Array(16), 16, 1);
  for (let c = 0; c < 4; c++) geometry.setAttribute(`_crowd${c}`, new InterleavedBufferAttribute(columns, 4, c * 4));
  const layout = crowdVertexLayout(geometry, new InstancedBufferAttribute(new Float32Array(16), 16));
  expect(layout).toEqual({ buffers: 7, locations: 11, webgpu: true, webgl2: true });

  const baked = bakeInfected(createSkinnedCrowdFixture(), [], false); packCrowdParts(baked.geometry);
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  pool.prepare('plain', baked.geometry, material, baked.clip, deathFrame());
  for (const id of [1, 2]) pool.place({ id } as EntitySnapshot, 'plain', baked.geometry, material, baked.clip, deathFrame(), new Matrix4(), new Color(1, 1, 1), [0, 0, 0]);
  const page = pool.children[0] as InstancedMesh, pageLayout = crowdVertexLayout(page.geometry, page.instanceMatrix);
  const surface = ['position', 'normal', 'color', '_parts'].map(name => page.geometry.getAttribute(name) as InterleavedBufferAttribute);
  expect(surface.every(a => a.isInterleavedBufferAttribute && a.data === surface[0].data)).toBe(true);
  expect(pageLayout.buffers + 1).toBeLessThanOrEqual(CROWD.buffers); // + placement colour
  expect(pageLayout.locations + 1).toBeLessThanOrEqual(CROWD.attributes);
  pool.dispose(); baked.geometry.dispose(); material.dispose();
});

test('textured corpse draws bind their surface and upload placements added after warm-up', () => {
  const baked = bakeInfected(createSkinnedCrowdFixture()); packCrowdParts(baked.geometry);
  const lighting = new Lighting(new Scene()), shading = new Materials(lighting);
  const crowd = new CrowdView({ scenario: 'L1' } as SimWorld, false, shading);
  const pool = crowd.children.find(o => o instanceof StaticCorpses) as StaticCorpses;
  const material = shading.shaded(vec3(.5)), bind = vi.fn();
  const surface = { bind, textures: [] };
  crowdSurfaceBindings.set(baked.geometry, surface);
  try {
    pool.prepare('runner', baked.geometry, material, baked.clip, deathFrame());
    const page = pool.children[0] as InstancedMesh;
    expect(crowdSurfaceBindings.get(page.geometry)).toBe(surface);
    const upload = () => (page.onBeforeRender as () => void).call(page);
    upload(); bind.mockClear();
    pool.place({ id: 1 } as EntitySnapshot, 'runner', baked.geometry, material, baked.clip, deathFrame(), new Matrix4().makeTranslation(3, 0, 5), new Color('white'), [0, 0, 0]);
    upload();
    const placement = page.geometry.getAttribute('_placement0') as InterleavedBufferAttribute;
    expect(placement.data.version).toBe(page.instanceMatrix.version);
    expect(placement.data.array[12]).toBe(3); expect(placement.data.array[14]).toBe(5);
    expect(bind).toHaveBeenCalledOnce();
    const frozenMaterial = page.material, frozenGeometry = page.geometry;
    const restored = { id: 1 } as EntitySnapshot;
    pool.begin(id => id === 1 ? restored : undefined);
    expect(pool.snapshot().instances).toBe(0);
    pool.place(restored, 'runner', baked.geometry, material, baked.clip, deathFrame(), new Matrix4().makeTranslation(3, 0, 5), new Color('white'), [0, 0, 0]);
    expect(pool.children[0]).toBe(page);
    expect(page.material).toBe(frozenMaterial); expect(page.geometry).toBe(frozenGeometry);
    upload(); expect(bind).toHaveBeenCalledTimes(2);
    const disposed = vi.fn(); frozenGeometry.addEventListener('dispose', disposed);
    for (const clear of [() => crowd.setGoreEnabled(false), () => crowd.setGoreEnabled(true), () => crowd.clearGore()]) {
      clear();
      expect(pool.snapshot().instances).toBe(0); expect(page.count).toBe(0); expect(page.visible).toBe(false);
      pool.place(restored, 'runner', baked.geometry, material, baked.clip, deathFrame(), new Matrix4(), new Color('white'), [0, 0, 0]);
      expect(pool.children[0]).toBe(page); expect(page.material).toBe(frozenMaterial); expect(page.geometry).toBe(frozenGeometry);
      expect(disposed).not.toHaveBeenCalled();
    }
  } finally { crowd.dispose(); baked.geometry.dispose(); shading.dispose(); lighting.dispose(); }
});

test('skinned crowd: four-influence packing, joint·bind⁻¹ atlas rows, and corpse freezing with the shader blend', () => {
  checkFractionalCrowdPicking(); checkAlphaMoveSet(); checkOrdinaryInfectedPresentation(); checkFiniteActionClips();
  const pose = (x: number, angle: number) => new Matrix4().compose(new Vector3(x, 1, 0), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle), new Vector3(1, 1, 1));
  const { dominant, skin } = packSkin([3, 7, 12, 0], [.2, .5, .3, 0], 1);
  expect(dominant[0]).toBe(7);
  expect(skin[0] % 32).toBe(12); expect(Math.floor(skin[0] / 32) % 32).toBe(3);
  expect(1 - skin[1] - skin[2] - skin[3]).toBeCloseTo(.5);
  const rest = [pose(0, 0), pose(.5, .3)], frame = [pose(.1, .2), pose(.7, -.4)];
  const binds = restInverses(rest.map(m => ({ matrixWorld: m })));
  const rows = new Float32Array(32); frame.forEach((m, i) => m.toArray(rows, i * 16));
  const gpu = new Float32Array(32); premultiplyRow(rows, gpu, binds, 0, 2);
  const local = new Vector3(.1, .2, .3), world = local.clone().applyMatrix4(rest[1]);
  expect(world.applyMatrix4(new Matrix4().fromArray(gpu, 16)).distanceTo(local.applyMatrix4(frame[1]))).toBeLessThan(1e-5);
  const clip = { parts: ['a', 'b'], frames: 1, duration: 1, matrices: rows, binds };
  const out = skinnedVertexMatrix(clip, 0, new BufferAttribute(new Float32Array([0, 0, 0, 0]), 4), new BufferAttribute(new Float32Array([1, .25, 0, 0]), 4), 0, new Float32Array(16));
  const a = new Matrix4().multiplyMatrices(frame[0], rest[0].clone().invert()), b = new Matrix4().multiplyMatrices(frame[1], rest[1].clone().invert());
  expect([...out].map(v => +v.toFixed(5))).toEqual(a.toArray().map((v, i) => +(v * .75 + b.elements[i] * .25).toFixed(5)));
  // A frozen accessory uses one head influence in bind space, including nonidentity binds.
  const triangle = (part: number, points: Vector3[]) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(points.flatMap(p => p.toArray())), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(9).fill(.5), 3));
    geometry.setAttribute('_parts', new BufferAttribute(new Float32Array([part, -4, 0, 0, part, -4, 0, 0, part, -4, 0, 0]), 4));
    geometry.setAttribute('_skin', new BufferAttribute(new Float32Array(12), 4));
    return geometry;
  };
  const localPoints = [new Vector3(0, .1, 0), new Vector3(.2, .1, 0), new Vector3(0, .3, .1)];
  const body = triangle(0, localPoints), accessory = triangle(1, localPoints.map(p => p.clone().applyMatrix4(rest[1])));
  const composite = body.clone(); composite.userData = { corpseBody: body, corpseAccessory: accessory };
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  pool.prepare('attachment', composite, material, clip, 0);
  pool.place({ id: 7 } as EntitySnapshot, 'attachment', composite, material, clip, 0, new Matrix4(), new Color('white'), [0, 0, 0]);
  const positions = (pool.children[0] as InstancedMesh).geometry.getAttribute('position');
  for (let i = 0; i < 3; i++) expect(new Vector3().fromBufferAttribute(positions, positions.count - 3 + i).distanceTo(localPoints[i].clone().applyMatrix4(frame[1]))).toBeLessThan(1e-5);
  pool.dispose(); material.dispose(); composite.dispose(); body.dispose(); accessory.dispose();
});

test('corpse pages: bodies persist past the old cap, bounds stay conservative, culling restores identity/pose/tint, normals survive vec4 padding', () => {
  // Raised kerbs, planters and steps must support the whole flat body. A root
  // on one side of an edge must not leave the torso buried on the other side.
  for (const stepHeight of [.13, .35, .6]) for (const doorway of [false, true]) {
    const floor = (_x: number, z: number) => z > 0 ? stepHeight : 0;
    const world = { scenario: 'L1', entities: { revision: 0, get: () => undefined, *iterate() {} },
      districts: { districts: [], supportBelow: floor }, infected: { nav: { clear: () => !doorway, move: (p: { x: number; z: number }, dx: number, dz: number) => { p.x += dx; p.z += dz; } } } } as unknown as SimWorld;
    const body = { id: 900, health: { current: 0 }, transform: { x: 0, y: .7 + stepHeight, z: .05, yaw: 0 }, combat: { radius: .35 } } as EntitySnapshot;
    const pose = new CorpseLayout(world).place(body);
    expect('ax' in pose).toBe(true);
    if ('ax' in pose) {
      const low = Math.min(pose.az, pose.bz) - pose.radius, high = Math.max(pose.az, pose.bz) + pose.radius;
      expect(floor(0, low), `step ${stepHeight}: body straddles the edge`).toBe(floor(0, high));
      expect(pose.y).toBe(floor(pose.x, pose.z));
    }
  }
  // If surrounding solids admit no slide at all, the last-resort flat pose
  // still needs to clear the raised part of its footprint.
  const pinnedWorld = { scenario: 'L1', entities: { revision: 0, get: () => undefined, *iterate() {} },
    districts: { districts: [], supportBelow: (_x: number, z: number) => z > 0 ? .35 : 0 },
    infected: { nav: { clear: () => true, move: () => {} } } } as unknown as SimWorld;
  const pinnedBody = { id: 901, health: { current: 0 }, transform: { x: 0, y: .7, z: -.05, yaw: 0 }, combat: { radius: .35 } } as EntitySnapshot;
  expect(new CorpseLayout(pinnedWorld).place(pinnedBody).y).toBe(.35);
  // A rocket can launch a body while its ground pose is still deferred.
  // Readiness must drain that entry without waiting for a paused flight to land.
  const airborne = { ...pinnedBody, id: 902, transform: { ...pinnedBody.transform } };
  const flightWorld = { ...pinnedWorld, entities: { revision: 0, get: () => airborne, *iterate() {} } } as unknown as SimWorld;
  const flightLayout = new CorpseLayout(flightWorld);
  flightLayout.beginFrame(0); flightLayout.place(airborne);
  airborne.corpseThrown = true; airborne.corpseBlast = { delay: 0, x: 1, y: 2, z: 1 };
  const placeFlight = flightLayout.place.bind(flightLayout); let flightCalls = 0;
  flightLayout.place = (...args) => {
    if (++flightCalls > 2) throw new Error('airborne deferred pose never drains');
    return placeFlight(...args);
  };
  flightLayout.settleAll();
  expect(flightCalls).toBe(1);
  airborne.corpseBlast = undefined;
  // A legacy flight or unloaded support can return an airborne pose from the
  // search itself, rather than the active-blast shortcut above.
  airborne.transform.y = 2;
  flightLayout.beginFrame(0); placeFlight(airborne); flightCalls = 0;
  flightLayout.settleAll();
  expect(flightCalls).toBe(1);
  airborne.transform.y = .7;
  flightLayout.beginFrame(Infinity);
  expect('ax' in flightLayout.place(airborne)).toBe(true);
  // A body resting on another must fall when a blast removes that support.
  const lower = { ...pinnedBody, id: 910, transform: { x: 0, y: .7, z: 0, yaw: 0 } };
  const upper = { ...pinnedBody, id: 911, transform: { ...lower.transform } };
  const top = { ...pinnedBody, id: 912, transform: { ...lower.transform } };
  const supportBodies = new Map([[lower.id, lower], [upper.id, upper], [top.id, top]]);
  const supportWorld = { ...pinnedWorld, districts: { districts: [], supportBelow: () => 0 },
    entities: { revision: 0, get: (id: number) => supportBodies.get(id), *iterate() {} } } as unknown as SimWorld;
  const supportLayout = new CorpseLayout(supportWorld); supportLayout.beginFrame(Infinity);
  supportLayout.place(lower);
  expect(supportLayout.place(upper).y).toBeCloseTo(.22);
  expect(supportLayout.place(top).y).toBeCloseTo(.44);
  // Suspend a search on the old support before it gets thrown away.
  upper.transform.x = .1;
  let searchClock = 0;
  const searchNow = vi.spyOn(performance, 'now').mockImplementation(() => searchClock++);
  try { supportLayout.beginFrame(.5); supportLayout.place(upper); }
  finally { searchNow.mockRestore(); }
  lower.corpseThrown = true; lower.corpseBlast = { delay: 0, x: 0, y: 2, z: 0 };
  supportLayout.beginFrame(Infinity);
  supportLayout.place(lower);
  expect(supportLayout.place(upper).y).toBe(0);
  expect(supportLayout.place(top).y).toBeCloseTo(.22);
  upper.transform.x = 10;
  supportLayout.place(upper);
  expect(supportLayout.place(top).y).toBe(0);
  expect(supportLayout.audit().count).toBe(2);
  const baked = bakeInfected(createSkinnedCrowdFixture()); packCrowdParts(baked.geometry);
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial(), records = new Map<number, EntitySnapshot>();
  try {
    for (let id = 1; id <= 260; id++) {
      const e = { id, corpse: true } as EntitySnapshot; records.set(id, e);
      pool.place(e, 'runner', baked.geometry, material, baked.clip, deathFrame(), new Matrix4().makeTranslation(id * .01, 0, 0), new Color('white'), [0, 0, 0]);
    }
    pool.begin(id => records.get(id)); expect(pool.snapshot().instances).toBe(260);
    for (const child of pool.children) {
      const mesh = child as InstancedMesh, local = mesh.geometry.boundingSphere!, matrix = new Matrix4();
      for (let index = 0; index < mesh.count; index++) {
        mesh.getMatrixAt(index, matrix);
        expect(mesh.boundingSphere!.center.distanceTo(local.center.clone().applyMatrix4(matrix)) + local.radius).toBeLessThanOrEqual(mesh.boundingSphere!.radius + 1e-5);
      }
    }
    records.delete(1); pool.begin(id => records.get(id)); expect(pool.snapshot().instances).toBe(259);
    const warmedPages = [...pool.children];
    for (let restore = 0; restore < 3; restore++) {
      for (const [id, e] of records) records.set(id, { ...e });
      pool.begin(id => records.get(id));
      for (const [id, e] of records) pool.place(e, 'runner', baked.geometry, material, baked.clip, deathFrame(), new Matrix4().makeTranslation(id * .01, 0, 0), new Color('white'), [0, 0, 0]);
      expect(pool.snapshot().instances).toBe(259);
      expect(pool.children).toEqual(warmedPages);
    }
  } finally { pool.dispose(); }

  const culled = new StaticCorpses(), live = new Map<number, EntitySnapshot>();
  const add = (id: number, x: number, tint: string) => { const e = { id, corpse: true, transform: { x, y: .7, z: 0 } } as EntitySnapshot; live.set(id, e); culled.place(e, 'runner', baked.geometry, material, baked.clip, 0, new Matrix4().makeTranslation(x, 0, 0), new Color(tint), [id / 10, 0, 0]); };
  add(2, 9.5, '#3070b0'); add(1, 0, '#e03020');
  const page = culled.children[0] as InstancedMesh, initial = culled.drawn().sort((p, q) => p.id - q.id);
  const camera = new OrthographicCamera(-2, 2, 2, -2, .1, 30), frustum = new Frustum();
  const aim = (x: number) => { camera.position.set(x, 10, 0); camera.lookAt(x, 0, 0); camera.updateMatrixWorld(true); frustum.setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); culled.begin(id => live.get(id)); culled.cull?.(frustum); (page.onAfterRender as () => void)(); };
  try {
    aim(0); expect(page.count).toBe(1); expect(culled.snapshot().instances).toBe(2);
    expect(page.geometry.getAttribute('_variant').getX(0) % 2).toBeCloseTo(new Color('#e03020').r);
    aim(9.5); expect(culled.snapshot().figures.filter(f => f.drawn).map(f => f.id)).toEqual([2]);
    expect(page.geometry.getAttribute('_variant').getX(0) % 2).toBeCloseTo(new Color('#3070b0').r);
    expect(culled.drawn().sort((p, q) => p.id - q.id)).toEqual(initial);
  } finally { culled.dispose(); }

  const source = baked.geometry.getAttribute('normal'), padded = new Float32Array(source.count * 4);
  for (let i = 0; i < source.count; i++) { padded[i * 4] = source.getX(i); padded[i * 4 + 1] = source.getY(i); padded[i * 4 + 2] = source.getZ(i); }
  const paddedGeometry = baked.geometry.clone(); paddedGeometry.setAttribute('normal', new BufferAttribute(padded, 4));
  const expected = new Float32Array(source.count * 3), matrix = new Matrix4(), point = new Vector3(), parts = baked.geometry.getAttribute('_parts');
  for (let i = 0; i < source.count; i++) { matrix.fromArray(baked.clip.matrices, parts.getX(i) * 16); point.set(source.getX(i), source.getY(i), source.getZ(i)).transformDirection(matrix).toArray(expected, i * 3); }
  const frozen = new StaticCorpses();
  try {
    frozen.place({ id: 1 } as EntitySnapshot, 'runner', paddedGeometry, material, baked.clip, 0, new Matrix4(), new Color('white'), [0, 0, 0]);
    const normal = (frozen.children[0] as InstancedMesh).geometry.getAttribute('normal');
    expect(normal.itemSize).toBe(3);
    expect(Float32Array.from({ length: normal.count * 3 }, (_, i) => normal.getComponent(Math.floor(i / 3), i % 3))).toEqual(expected);
  } finally { frozen.dispose(); baked.geometry.dispose(); paddedGeometry.dispose(); material.dispose(); }
  // r2-corpse (G-14, L4-17): delivered humanoid death clips end lying on the floor; animals and crawlers keep their fall; repair is idempotent.
  const deliveries = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8')) as Record<string, string>;
  const delivered = (model: string) => {
    const bytes = gunzipSync(readFileSync(`public${deliveries[`${model}:lod0:infected`]}`));
    const bake = decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer); packCrowdParts(bake.geometry); return bake;
  };
  const lying = (bake: ReturnType<typeof delivered>, death: (typeof infectedClips)[number]) => {
    const g = bake.geometry, p = g.getAttribute('position'), parts = g.getAttribute('_parts'), skin = g.getAttribute('_skin'), P = bake.clip.parts.length;
    const offset = (infectedClips.indexOf(death) * framesPerClip + framesPerClip - 1) * P * 16, pose = new Float32Array(P * 16), m = new Float32Array(16);
    premultiplyRow(bake.clip.matrices, pose, bake.clip.binds!, offset, P, 0);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < p.count; i++) {
      if (parts.getZ(i) > 1.5 || parts.getW(i) >= 1024) continue;
      skinnedVertexMatrix(bake.clip, offset, parts, skin, i, m, pose);
      const y = m[1] * p.getX(i) + m[5] * p.getY(i) + m[9] * p.getZ(i) + m[13]; min = Math.min(min, y); max = Math.max(max, y);
    }
    return { min, max };
  };
  const worker = delivered('inf.common-worker'), tallBefore = lying(worker, 'death-back').max;
  expect(repairDeathPoses(worker.clip, worker.geometry)).toBe(true);
  for (const death of ['death-back', 'death-side', 'death-crumple'] as const) { const { min, max } = lying(worker, death); expect(Math.abs(min)).toBeLessThan(.02); expect(max).toBeLessThan(.7); }
  expect(lying(worker, 'death-back').max).toBeLessThan(tallBefore);
  // r3-corpse: no skin triangle edge of a visible part stretches past 2x its bind length (limbs keep close to their rest relation to the body).
  const stretch = (bake: ReturnType<typeof delivered>, death: (typeof infectedClips)[number]) => {
    const g = bake.geometry, p = g.getAttribute('position'), parts = g.getAttribute('_parts'), skin = g.getAttribute('_skin'), index = g.index!, P = bake.clip.parts.length;
    const offset = (infectedClips.indexOf(death) * framesPerClip + framesPerClip - 1) * P * 16, pose = new Float32Array(P * 16), m = new Float32Array(16), at: number[][] = [];
    premultiplyRow(bake.clip.matrices, pose, bake.clip.binds!, offset, P, 0);
    for (let i = 0; i < p.count; i++) { skinnedVertexMatrix(bake.clip, offset, parts, skin, i, m, pose); at.push([m[0] * p.getX(i) + m[4] * p.getY(i) + m[8] * p.getZ(i) + m[12], m[1] * p.getX(i) + m[5] * p.getY(i) + m[9] * p.getZ(i) + m[13], m[2] * p.getX(i) + m[6] * p.getY(i) + m[10] * p.getZ(i) + m[14]]); }
    let worst = 0;
    for (let t = 0; t < index.count; t += 3) for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const i = index.getX(t + a), j = index.getX(t + b); if ([i, j].some(v => parts.getZ(v) > 1.5 || parts.getW(v) >= 1024)) continue;
      const rest = Math.hypot(p.getX(i) - p.getX(j), p.getY(i) - p.getY(j), p.getZ(i) - p.getZ(j)); if (rest < .04) continue;
      worst = Math.max(worst, Math.hypot(at[i][0] - at[j][0], at[i][1] - at[j][1], at[i][2] - at[j][2]) / rest);
    }
    return worst;
  };
  for (const model of ['inf.common-worker', 'inf.cashier', 'inf.delivery-driver']) {
    const bake = model === 'inf.common-worker' ? worker : delivered(model); repairDeathPoses(bake.clip, bake.geometry);
    for (const death of ['death-back', 'death-side', 'death-crumple'] as const) expect(stretch(bake, death)).toBeLessThan(2);
  }
  const alpha = delivered('inf.alpha');
  expect(repairDeathPoses(alpha.clip, alpha.geometry, { prone: true })).toBe(true);
  const settled = Array.from(alpha.clip.matrices); repairDeathPoses(alpha.clip, alpha.geometry, { prone: true });
  expect(Array.from(alpha.clip.matrices)).toEqual(settled);
  for (const death of ['death-back', 'death-side', 'death-crumple'] as const) expect(lying(alpha, death).max).toBeLessThan(1.5);
  for (const model of ['inf.dog', 'inf.crawler']) { const bake = delivered(model), before = Array.from(bake.clip.matrices); expect(repairDeathPoses(bake.clip, bake.geometry)).toBe(false); expect(Array.from(bake.clip.matrices)).toEqual(before); }
  // A transferred worker repair retains its exact pose rows and reach. The renderer
  // must recognize the completed work instead of blending the fall a second time.
  for (const model of ['inf.common-worker', 'inf.alpha']) {
    const raw = gunzipSync(readFileSync(`public${deliveries[`${model}:lod0:infected`]}`));
    const bytes = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
    const prepared = decodeCivilianBake(bytes), prone = model === 'inf.alpha';
    expect(repairDeathPoses(prepared.clip, prepared.geometry, { prone })).toBe(true);
    const matrices = Array.from(prepared.clip.matrices), reach = deathReach.get(prepared.clip)!;
    const received = decodeCivilianBake(structuredClone(bytes, { transfer: [bytes] }));
    registerDeathPoseRepair(received.clip, { prone, reach });
    expect(repairDeathPoses(received.clip, received.geometry, { prone })).toBe(true);
    expect(Array.from(received.clip.matrices)).toEqual(matrices);
    expect(deathReach.get(received.clip)).toBe(reach);
    expect(repairDeathPoses(received.clip, received.geometry, { prone: !prone })).toBe(false);
    prepared.geometry.dispose(); received.geometry.dispose();
  }

});

test('LOD selection: authored distance bands with hysteresis; game-camera-size crowd figures never take the far silhouette', () => {
  expect([0, 7, 9, 25].map(d => pickLod(d))).toEqual(['lod0', 'lod0', 'lod1', 'lod2']);
  expect(pickLod(9, 'lod0')).toBe('lod0'); expect(pickLod(10.5, 'lod0')).toBe('lod1');
  expect(pickLod(7, 'lod1')).toBe('lod1'); expect(pickLod(5.5, 'lod1')).toBe('lod0');
  expect(pickLod(120, 'lod0')).toBe('lod2'); expect(pickLod(4, 'lod2')).toBe('lod0');
  expect(corpseLod(7.9)).toBe('lod1'); expect(corpseLod(9, 'lod1')).toBe('lod1'); expect(corpseLod(10, 'lod1')).toBe('lod2');
  expect(crowdLod(89, 'lod1')).toBe('lod1'); expect(crowdLod(87, 'lod1')).toBe('lod2'); expect(crowdLod(103, 'lod2')).toBe('lod2');
  for (const pixels of [105, 160, 300]) for (const previous of [undefined, 'lod1', 'lod2'] as const) expect(crowdLod(pixels, previous)).toBe('lod1');
  expect(propLod(129)).toBe('lod0'); expect(propLod(111, 'lod0')).toBe('lod1'); expect(propLod(145, 'lod1')).toBe('lod0');
});

test('materials: palette program keys match Three through weather and node changes; uniforms share a render group per material only', () => {
  // A paused redraw must retire a dead source's warning without advancing FX
  // time, while retaining live attacks and a bloater's real death countdown.
  const source = { health: { current: 0 }, transform: { x: 0, z: 0 }, infected: { state: 'dead', attackId: 7, special: 'charge', until: 30, specialAttack: { stage: 'telegraph' } } } as EntitySnapshot;
  const world = { tick: 20, entities: { get: (id: number) => id === 2 ? source : undefined } } as unknown as SimWorld;
  const tells = new Map<number, { sourceId: number; slot: number; kind: string }>();
  const fx = Object.assign(Object.create(Vfx.prototype) as object, { world, tells, time: 0, enabled: true, featherVeil: null,
    obstruction: { remainingTicks: 0, opacity: 0 }, telegraphs: { remove: vi.fn() }, effect: vi.fn() }) as unknown as Vfx;
  tells.set(7, { sourceId: 2, slot: 0, kind: 'charge' }); fx.updateSpecialState(); expect(tells.size).toBe(0); expect(fx.time).toBe(0);
  source.health.current = 1; source.infected!.state = 'attack';
  tells.set(7, { sourceId: 2, slot: 0, kind: 'charge' }); fx.updateSpecialState(); expect(tells.size).toBe(1);
  source.health.current = 0; source.infected!.state = 'dead'; source.infected!.special = 'explode';
  tells.set(7, { sourceId: 2, slot: 0, kind: 'bloated' }); fx.updateSpecialState(); expect(tells.size).toBe(1);
  world.tick = 31; fx.updateSpecialState(); expect(tells.size).toBe(0);
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting);
  try {
    const material = materials.get('sidewalk'), reference = MeshLambertNodeMaterial.prototype.customProgramCacheKey;
    const check = () => expect(material.customProgramCacheKey()).toBe(reference.call(material));
    check(); material.fade.value = .3; check();
    material.setWeatherMode(weatherMaterialFlags.fog | weatherMaterialFlags.wet); check();
    material.positionNode = vec3(1, 2, 3); check(); material.positionNode = null; check();
    Object.defineProperty(material, 'extraNode', { value: float(.5), configurable: true }); check();
    const copy = material.frozenCopy(); expect(copy.customProgramCacheKey()).toBe(reference.call(copy)); copy.dispose();
    const first = materials.get('asphalt'), second = materials.get('grass'), group = first.fade.groupNode;
    expect(group.shared).toBe(true); expect(group.updateType).toBe('render');
    for (const node of [first.emissivePower, first.hitFlash, first.figureRim]) expect(node.groupNode).toBe(group);
    expect(second.fade.groupNode).not.toBe(group);
    first.fade.value = .2; expect(second.fade.value).toBe(1);
    // Q-227/Q-228: L10 lamps keep the same light list and shadow filters through promotion.
    // r27-l9apc: so does L9, where the APC headlight dying at the durability floor rebuilt ~110 programs (5.4 s frame).
    for (const preset of ['L9-crossing', 'L10-night'] as const) {
    lighting.set(preset);
    const filters = [lighting.sun.shadow, lighting.spot.shadow].map(shadow => (shadow as typeof shadow & { filterNode: unknown }).filterNode);
    expect(filters.every(Boolean)).toBe(true);
    for (const spot of [false, true, false]) lighting.withShadowSource(spot, () => {
      expect(lighting.sun.visible && lighting.spot.visible).toBe(true);
      expect(lighting.sun.shadow.autoUpdate).toBe(!spot); expect(lighting.spot.shadow.autoUpdate).toBe(spot);
      expect(lighting.sun.shadow.intensity).toBe(Number(!spot)); expect(lighting.spot.shadow.intensity).toBe(Number(spot));
      expect([lighting.sun.shadow, lighting.spot.shadow].map(shadow => (shadow as typeof shadow & { filterNode: unknown }).filterNode)).toEqual(filters);
    });
    }
    lighting.set('night'); lighting.field.strength.value = 1;
    const focus = { x: 4, y: 0, z: -2 };
    lighting.setHeroLight({ x: 0, z: 0, id: 'moving-headlight', y: 5, radius: 6, aimX: 0, aimZ: 0, stretch: 1, r: 1, g: 1, b: 1, flicker: 0, strobe: false, seed: 0, on: true, hero: true }, focus, 3);
    expect(lighting.spot.target.position.toArray()).toEqual([focus.x, focus.y, focus.z]);
    expect(lighting.spot.angle).toBeCloseTo(Math.atan2(6, Math.hypot(4, 5, 2)));
    expect(lighting.spot.distance).toBeGreaterThan(10);
    const moving = { x: 1, z: 0, id: 'moving-headlight', y: 5, radius: 6, aimX: 0, aimZ: 0, stretch: 1, r: 1, g: 1, b: 1, flicker: 0 as const, strobe: false, seed: 0, on: true, hero: true };
    lighting.setHeroLight(moving, focus, 3.3);
    expect(lighting.spot.position.x).toBeCloseTo(1);
    expect(lighting.getState().promotionChanges).toBe(1);
    // A brighter overlapping lamp replaces a weaker one while still inside its
    // pool. Fade through zero before changing direction: only one map refreshes.
    const brighter = { ...moving, id: 'brighter', x: 8, z: -4, r: 8, g: 8, b: 8 };
    for (const [time, fade] of [[10, 1], [10.075, .5], [10.15, 0], [10.225, .5], [10.3, 1]]) {
      lighting.setHeroLight(brighter, focus, time);
      expect(lighting.getState().heroLight).toBe('brighter');
      expect(lighting.spot.shadow.intensity).toBeCloseTo(fade);
      expect(Number(lighting.sun.shadow.autoUpdate) + Number(lighting.spot.shadow.autoUpdate)).toBe(1);
      if (time === 10) expect(lighting.spot.position.x).toBe(1);
    }
    expect(lighting.spot.position.x).toBe(8); expect(lighting.getState().promotionChanges).toBe(2);
    lighting.setHeroLight(null, focus, 11); lighting.setHeroLight(null, focus, 11.3);
    expect(lighting.sun.shadow.intensity).toBe(1); expect(lighting.spot.shadow.intensity).toBe(0);
    expect(lighting.sun.shadow.autoUpdate).toBe(true); expect(lighting.getState().fieldShadow).toBe(0);
    // Moon/local handoffs and power loss share the same promotion cooldown.
    lighting.setHeroLight(brighter, focus, 11.4);
    expect(lighting.getState().heroLight).toBeNull();
    lighting.setHeroLight(brighter, focus, 11.5);
    const changes = lighting.getState().promotionChanges;
    brighter.on = false;
    lighting.setHeroLight(moving, focus, 11.6);
    expect(lighting.getState().promotionChanges).toBe(changes);
    lighting.setHeroLight(moving, focus, 11.8);
    expect(lighting.spot.shadow.intensity).toBe(0);
    lighting.setHeroLight(moving, focus, 12);
    expect(lighting.getState().promotionChanges).toBe(changes + 1);
    // Subway headlamps keep their forward target; the low underground tier
    // still has no spot shadow, while outdoor L6 practicals retain theirs.
    lighting.set('L6-subway'); lighting.setQuality('low');
    const headlamp = { ...moving, id: 'headlamp', x: focus.x, z: focus.z, y: 1, aimX: 6 };
    lighting.setHeroLight(headlamp, focus, 0);
    expect(lighting.spot.target.position.x).toBe(focus.x + 6); expect(lighting.spot.shadow.intensity).toBe(0);
    lighting.set('L6'); lighting.setHeroLight(moving, focus, 0);
    expect(lighting.spot.shadow.intensity).toBe(1);
    const field = new LightField();
    try {
      field.strength.value = 1; field.push(moving); expect(field.heroAt(focus.x, focus.z)).toBe(moving);
      const drivingHeadlight = { ...moving, id: 'vehicle-3-light:headL', drivenHeadlight: true, x: 0, z: 0, aimX: 6, radius: 3, stretch: 3 };
      field.push(drivingHeadlight);
      expect(field.heroStrength(drivingHeadlight, 15, 0)).toBe(0);
      expect(field.heroAt(15, 0)).toBe(drivingHeadlight);
      drivingHeadlight.on = false; expect(field.heroAt(15, 0)).toBeNull();
      drivingHeadlight.on = true;
      const beam = { ...moving, x: 0, z: 0, aimX: 6, radius: 3, stretch: 3 };
      expect(field.heroStrength(beam, 0, 0)).toBeGreaterThan(.02);
      expect(field.heroStrength({ ...beam, stretch: 1 }, 0, 0)).toBe(0);
      const blocked = { ...moving, visibility: [[moving.x, moving.z], ...Array.from({ length: 65 }, (_, i) => [moving.x + Math.cos(i / 64 * Math.PI * 2), moving.z + Math.sin(i / 64 * Math.PI * 2)])] as [number, number][] };
      expect(field.heroStrength(blocked, focus.x, focus.z)).toBe(0);
      const fire = field.addTransient(focus, '#ffbb55', 10, 4, 10, true);
      expect(field.heroAt(focus.x, focus.z)?.id).toMatch(/^transient-/);
      fire.remove(); expect(field.heroAt(focus.x, focus.z)).toBe(moving);
    }
    finally { field.dispose(); }
  } finally { materials.dispose(); lighting.dispose(); }
});

test('texture route: lossless 256-byte-aligned float uploads; cold WebGPU atlases map, warm ones reuse Three, ranges write rows', async () => {
  let bytes = new ArrayBuffer(0);
  const buffer = { getMappedRange: () => bytes, unmap: vi.fn(), destroy: vi.fn() };
  const command = {}, encoder = { copyBufferToTexture: vi.fn(), finish: () => command };
  const gpu = { createBuffer: vi.fn(({ size }: { size: number }) => { bytes = new ArrayBuffer(size); return buffer; }), createCommandEncoder: vi.fn(() => encoder), queue: { submit: vi.fn() } };
  const width = 76, backing = Float32Array.from({ length: width * 8 + 4 }, (_, i) => i * .12345), pixels = backing.subarray(4);
  uploadFloatTexture(gpu, {}, pixels, width, 2);
  const stride = Math.ceil(width * 16 / 256) * 256, source = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength), mapped = new Uint8Array(bytes);
  for (let row = 0; row < 2; row++) expect(mapped.slice(row * stride, row * stride + width * 16)).toEqual(source.slice(row * width * 16, (row + 1) * width * 16));
  expect(buffer.unmap.mock.invocationCallOrder[0]).toBeLessThan(encoder.copyBufferToTexture.mock.invocationCallOrder[0]);

  gpu.queue.submit.mockClear();
  const original = vi.fn(), write = vi.fn(), data = { texture: {}, glTextureType: 0, glFormat: 0, glType: 0 };
  const backend = { ...gpu, device: { ...gpu, queue: { ...gpu.queue, writeTexture: write } } as FloatUploadDevice, get: () => data, updateTexture: original };
  const texture = new DataTexture(new Float32Array(128), 4, 8, RGBAFormat, FloatType);
  installTextureRanges(backend); backend.updateTexture(texture, {});
  expect(original).not.toHaveBeenCalled(); expect(gpu.queue.submit).toHaveBeenCalledOnce();
  backend.updateTexture(texture, {}); expect(original).toHaveBeenCalledOnce();
  texture.addUpdateRange(96, 32); backend.updateTexture(texture, {}); expect(write).toHaveBeenCalledOnce();
  texture.dispose();
  await checkWarmPipelineDraws();
});

test('switching equal-version colour and pose textures refreshes the GPU binding, including cloned render bindings', () => {
  const a = new DataTexture(), b = new DataTexture(); a.needsUpdate = b.needsUpdate = true;
  expect(a.version).toBe(b.version);
  let value = b;
  const binding = { isSampledTexture: true, texture: a, generation: a.version as number | undefined,
    update() { const changed = this.texture !== value; this.texture = value; return changed; } };
  const manager = { _createBindings: vi.fn() };
  installTextureBindingIdentity(manager); manager._createBindings([{ bindings: [binding] }]);
  expect(binding.update()).toBe(true); expect(binding.generation).toBeUndefined();
  binding.generation = b.version;
  expect(binding.update()).toBe(false); expect(binding.generation).toBe(b.version);
  const clone = { ...binding }; manager._createBindings([{ bindings: [clone] }]);
  value = a;
  expect(clone.update()).toBe(true); expect(clone.generation).toBeUndefined();
  expect(binding.texture).toBe(b); expect(binding.generation).toBe(b.version);
  a.dispose(); b.dispose();
});

function checkCivilianShaderBindings(): void {
  const shading = new Materials(new Lighting(new Scene())), pose = new DataTexture(), a = new DataTexture(), b = new DataTexture();
  const one = civilianMaterial(shading, false, pose, { bindRow: 0, atlas: a });
  const same = civilianMaterial(shading, false, pose, { bindRow: 0, atlas: a });
  const other = civilianMaterial(shading, false, pose, { bindRow: 0, atlas: b });
  expect(one.material).toBe(same.material); expect(one.material).not.toBe(other.material);
  expect(one.material.customProgramCacheKey()).toBe(same.material.customProgramCacheKey());
  expect(one.material.customProgramCacheKey()).toBe(other.material.customProgramCacheKey());
  const nightMaterial = one.material as PaletteMaterial;
  expect(nightMaterial.figureFill.value, 'human civilians retain a restrained night figure fill').toBe(2);
  expect(nightMaterial.figureFillNeutral.value).toBe(1);
  const flipped = b.clone(); flipped.flipY = !b.flipY;
  const differentLayout = civilianMaterial(shading, false, pose, { bindRow: 0, atlas: flipped });
  expect(differentLayout.material.customProgramCacheKey()).not.toBe(one.material.customProgramCacheKey());
  const atlas = crowdTextureForDraw(new TextureNode(a)), poses = crowdTextureForDraw(new TextureNode(pose), true);
  const first = new Mesh(new BoxGeometry(), one.material), second = new Mesh(new BoxGeometry(), other.material);
  const otherPose = new DataTexture();
  crowdSurfaceBindings.set(first.geometry, { bind() {}, textures: [a], pose });
  crowdSurfaceBindings.set(second.geometry, { bind() {}, textures: [b], pose: otherPose });
  const baked = bakeInfected(createSkinnedCrowdFixture()); packCrowdParts(baked.geometry);
  const bodyA = baked.geometry, bodyB = baked.geometry.clone(), pools = [new StaticCorpses(), new StaticCorpses()];
  crowdSurfaceBindings.set(bodyA, { bind() {}, textures: [a], pose });
  crowdSurfaceBindings.set(bodyB, { bind() {}, textures: [b], pose: otherPose });
  const corpseA = pools[0].prepare('a', bodyA, one.material, baked.clip, deathFrame());
  const corpseB = pools[1].prepare('b', bodyB, other.material, baked.clip, deathFrame());
  const frozenA = corpseA.material as PaletteMaterial, frozenB = corpseB.material as PaletteMaterial;
  expect(frozenA).not.toBe(frozenB);
  expect(frozenA.outputNode).not.toBe(one.material.outputNode);
  for (const mode of [0, 1, 0]) {
    frozenA.setWeatherMode(mode); frozenB.setWeatherMode(mode);
    expect(frozenA.outputNode).toBe(frozenB.outputNode);
    expect(frozenA.customProgramCacheKey()).toBe(frozenB.customProgramCacheKey());
  }
  const otherFrozen = (differentLayout.material as PaletteMaterial).frozenCopy(true);
  expect(otherFrozen.outputNode).not.toBe(frozenA.outputNode); otherFrozen.dispose();
  const frame = new NodeFrame();
  for (const object of [first, second, corpseA, corpseB, corpseA]) {
    frame.object = object; atlas.update(frame); poses.update(frame);
    const usesA = object === first || object === corpseA;
    expect(atlas.value).toBe(usesA ? a : b);
    expect(poses.value).toBe(usesA ? pose : otherPose);
  }
  pools.forEach(pool => pool.dispose()); bodyA.dispose(); bodyB.dispose();
  first.geometry.dispose(); second.geometry.dispose();
  const disposed = vi.fn(); one.material.addEventListener('dispose', disposed);
  one.release(); expect(disposed).not.toHaveBeenCalled();
  same.release(); expect(disposed).toHaveBeenCalledOnce(); other.release();
  differentLayout.release(); shading.dispose();
  for (const texture of [pose, otherPose, a, b, flipped]) texture.dispose();
}

// Soldiers and armed civilians in L3/L4 share the courier's real gun contracts.
test('crowd long guns use asset grip/muzzle sockets and the courier support-hand offsets', async () => {
  checkCivilianShaderBindings();
  const props = new RoutineProps();
  let release!: () => void;
  const downloaded = new Promise<void>(resolve => { release = resolve; });
  const loadAsset = vi.fn(async (id: string) => {
    await downloaded;
    const model = new Group(); model.name = id; const material = new MeshLambertNodeMaterial({ color: '#789abc' });
    model.add(new Mesh(new BoxGeometry(.8, .1, .05), material));
    const grip = new Object3D(); grip.name = 'grip'; grip.position.set(-.2, -.1, 0); model.add(grip);
    const muzzle = new Object3D(); muzzle.name = 'muzzle'; muzzle.position.set(.4, 0, 0); model.add(muzzle);
    return model;
  });
  const loading = props.init({ loadAsset });
  expect(loadAsset.mock.calls).toHaveLength(5);
  release(); await loading;
  for (const [prop, asset] of [['rifle', 'wpn.assault-rifle'], ['hmg', 'wpn.machine-gun'], ['hunting-rifle', 'wpn.hunting-rifle'], ['shotgun', 'wpn.shotgun']]) {
    const hold = longGunHolds[asset], crowd = crowdGunHolds[prop];
    expect(crowd.support).toEqual([-hold.support[2], hold.support[1], hold.support[0]]);
    props.begin();
    props.held(prop === 'hmg' ? 'rifle' : prop as 'rifle' | 'hunting-rifle' | 'shotgun', new Matrix4().makeTranslation(2, 3, 4), 7, undefined, .07, prop === 'hmg');
    const muzzle = props.muzzles.get(7)!;
    expect(muzzle.x).toBeCloseTo(2); expect(muzzle.y).toBeCloseTo(3 + .1 * hold.scale); expect(muzzle.z).toBeCloseTo(4 + .6 * hold.scale);
    expect(props.guns[0].geometry.getAttribute('color').getY(0)).toBeGreaterThan(0);
    expect(props.guns[0].geometry.boundingBox!.max.z).toBeCloseTo(.6 * hold.scale);
  }
  props.dispose();
});

function checkVehicleForegroundVeto(): void {
  expect(courierForegroundWanted(true, false)).toBe(true);
  expect(courierForegroundWanted(false, false)).toBe(false);
  expect(courierForegroundWanted(false, true)).toBe(true);
  // vqa-3 P1: an on-foot vehicle hull stays whole; her own occluded chest/head turns the foreground contour on instead.
  for (const crowd of [false, true]) for (const mega of [false, true]) expect(courierForegroundWanted(crowd, mega, true)).toBe(true);
  const mega = { id: 4, infected: { pursuit: true }, hidden: false, health: { current: 100 }, transform: { x: 0, y: 4.65, z: 5 } } as unknown as EntitySnapshot;
  expect(megaOccludesCourier({ x: 0, y: 10, z: 10 }, { x: 0, y: .7, z: 0 }, [mega])).toBe(true);
  mega.transform.x = 6;
  expect(megaOccludesCourier({ x: 0, y: 10, z: 10 }, { x: 0, y: .7, z: 0 }, [mega])).toBe(false);
  mega.transform.x = 0; mega.transform.z = -4;
  expect(megaOccludesCourier({ x: 0, y: 10, z: 10 }, { x: 0, y: .7, z: 0 }, [mega])).toBe(false);
}
