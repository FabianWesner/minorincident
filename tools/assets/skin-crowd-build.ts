import { restoreCrowdGlasses } from './skin-crowd-glasses';
import { restoreFireHelmet } from './restore-fire-helmet';
import { restoreMegaSkull } from './restore-mega-skull';
import { paintAnimalDetails, restoreElephantTail, type TuskRecipe } from './skin-crowd-animal-details';
import { animalTeeth } from './skin-crowd-animal-infection';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { getBounds } from '@gltf-transform/functions';
import type { AssetDef } from '../../src/assets/types';
import { variantPath } from '../../src/assets/types';
import { assetIO } from './io';
import { validateAssets } from './validate';
import { compressSkin, decodeSkinImage } from './skin-crowd-compress';
import { skinCrowdBakes } from './skin-crowd-bakes';
import { classifyCrowdAtlas } from './skin-crowd-regions';
import { paintCrowdShirt, paintCrowdWraps, type CrowdWrap } from './skin-crowd-wraps';
import { Matrix4, Vector3 } from 'three';
import { PNG } from 'pngjs';
import { regularInfectedModels } from '../../src/data/crowdAppearance';
import { legacyCrowdPalette } from './skin-crowd-legacy-palette';

// A cast directory is the complete input; no hand-prepared files or placement numbers.
// A named game variant can consume a compatible reviewed base cast without
// copying or modifying that source package.
const source = resolve(process.argv[2] ?? ''), sourceId = basename(source), id = process.argv[3] || sourceId;
const authored = existsSync(join(source, 'model.glb'));
if (!process.argv[2] || !existsSync(join(source, authored ? 'model.glb' : 'lod0.glb'))) throw Error('Usage: skin-crowd-build.sh <cast/<id> directory> [asset-id]');
// A game asset directory is not a new-pipeline cast. Without the durable,
// pre-binding source manifest, --reconstruct-body would quietly skin the old
// rigid geometry and make an incomplete migration look like a new figure.
if (!source.includes('/cast/') && !existsSync(join(source, 'source/manifest.json'))) {
  throw Error(`${id}: refusing legacy game geometry as a cast source; pass a pipeline cast directory or provide source/manifest.json`);
}
// Healthy and infected dogs retain one body, world scale and skeleton. Build the
// canonical healthy body first, so a single inf.dog invocation is still sufficient.
if (id === 'inf.dog' && !existsSync(join(source, 'rig.json')) && existsSync(join(source, 'source/manifest.json'))) execFileSync('sh', ['tools/assets/skin-crowd-build.sh', join(dirname(source), 'amb.dog')], { stdio: 'inherit' });
const castAt = source.lastIndexOf('/cast/'), pipeline = process.env.CROWD_PIPELINE ?? (castAt >= 0 ? source.slice(0, castAt) : join(dirname(dirname(execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim())), 'minorincident_3dpipeline'));
const basis = join(pipeline, 'vendor/basis-encoder-2.1');
const manifestPath = 'src/assets/manifest.json', manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AssetDef[];
const def = manifest.find(a => a.id === id); if (!def) throw Error(`Unknown cast id ${id}`);
const output = 'public/assets/models/skinned', report = join(process.env.CROWD_REPORT ?? 'test-results/skinned-prod/builds', id), assets = join('assets', id);
mkdirSync(output, { recursive: true }); mkdirSync(report, { recursive: true }); mkdirSync(assets, { recursive: true });
const metadata = existsSync(join(source, 'rig.json')) ? JSON.parse(readFileSync(join(source, 'rig.json'), 'utf8')) as { class?: string; lods: { lod: number; uniform_scale?: number; world_scale?: number; rotation_y_degrees?: number }[] } : undefined;
const nativeInfected = !!metadata && metadata.class !== 'quadruped' && regularInfectedModels.some(model => model === id);
// Animal fur/mane envelopes are wider than the face. Use reviewed pre-binding
// eye landmarks instead of placing dormant/infected eyes on that envelope.
const animalEyeRecipes = JSON.parse(readFileSync('tools/assets/skin-crowd-animal-eyes.json', 'utf8')) as Record<string, { source_sha256: string; eye_centers: number[][]; radius_extent: number; game_radius: number; tusks?: TuskRecipe }>;
if (['inf.lion', 'inf.gorilla', 'inf.elephant', 'inf.flamingo'].includes(id) && !animalEyeRecipes[sourceId]) {
  throw Error(`${id}: missing animal infection recipe for ${sourceId}`);
}
let eyeSource = existsSync(join(source, 'eyes.json')) ? join(source, 'eyes.json') : undefined;
if (metadata && ['quadruped', 'bird'].includes(metadata.class ?? '') && animalEyeRecipes[sourceId]) {
  const recipe = animalEyeRecipes[sourceId], body = join(source, 'source/flat-lod0.glb');
  if (createHash('sha256').update(readFileSync(body)).digest('hex') !== recipe.source_sha256) throw Error(`${id}: animal eye landmarks do not match the source body`);
  const infectedRadius: Record<string, number> = { 'inf.lion': .040, 'inf.gorilla': .036, 'inf.elephant': .060, 'inf.flamingo': .024 };
  eyeSource = join(report, 'source-eyes.json'); writeFileSync(eyeSource, JSON.stringify({ ...recipe, game_radius: infectedRadius[id] ?? recipe.game_radius }, null, 2) + '\n');
}
// Derived story identities fit the continuous source directly to the neutral
// game rig. The old cut-source ownership leaves shoulder slivers in cower poses.
const derivedTemplate = id !== sourceId && id.startsWith('npc.') && existsSync(join('assets', sourceId, 'model.glb'));
if (derivedTemplate) {
  def.budget.triangles = 6000; def.budget.fileKB = 600;
  // Retain the source LOD1 anatomy at distance. The legacy 2k cap otherwise
  // invokes position simplification after binding and reconnects two seams.
  def.authoredLodTriangles = { lod1: 2500, lod2: 2500 };
  delete def.authoredLodRatios;
}
const unbound = existsSync(join(source, 'source/manifest.json')) && !metadata;
const alignment = unbound ? JSON.parse(readFileSync(join(id === 'inf.dog' ? join(dirname(source), 'amb.dog') : source, 'source/manifest.json'), 'utf8')) as { initial_game_height_scale: number; game_alignment_rotation_y_degrees: number; triangle_budgets?: [number, number, number]; rig_class?: string; rig_source?: string; rig_fit_height?: boolean; authored_skin?: true | string; wraps?: CrowdWrap[]; spectacles?: boolean; covered_legs?: boolean; healthy_toy_eyes?: boolean; rectangular_glasses?: boolean } : undefined;
if (alignment?.triangle_budgets) {
  const [near, middle, far] = alignment.triangle_budgets;
  if (![near, middle, far].every(n => Number.isInteger(n) && n > 0) || middle > near || far > middle) throw Error(`${id}: invalid source triangle budgets`);
  def.budget.triangles = near; def.budget.fileKB = 600;
  def.authoredLodTriangles = { lod1: middle, lod2: far };
}
// L8 zoo quadrupeds follow the measured class budgets in the v2 playbook,
// even when an older source manifest carries the former 4k/1.5k distance caps.
if (metadata?.class === 'quadruped' && ['amb.lion', 'inf.lion', 'amb.gorilla', 'inf.gorilla', 'amb.elephant', 'inf.elephant', 'amb.flamingo', 'inf.flamingo'].includes(id)) {
  def.budget.triangles = 8000;
  def.authoredLodTriangles = { lod1: 3000, lod2: 1000 };
  delete def.authoredLodRatios;
}
const io = await assetIO(), started = Date.now(), receipts = [];
type ProtectedDetailLod = { lod: number; spatula_triangles?: number; spatula_parent?: string; decal_triangles?: number; text_parent?: string };
const protectedDetailsPath = join(source, 'protected-details.json');
const protectedDetails = existsSync(protectedDetailsPath) ? JSON.parse(readFileSync(protectedDetailsPath, 'utf8')) as { lods?: ProtectedDetailLod[] } : undefined;
// A carried object fused into the body cannot follow the game's prop lifecycle.
// Refuse it before changing any active asset; anatomy fits inside this hand envelope.
// Mega Alpha hands are intentionally far beyond the ordinary hand reach: the
// boss's oversized fists are anatomy, not fused carried props. L10's Mega has
// no held-weapon socket; keep the prop guard for all other humanoid sources.
if (metadata?.class !== 'quadruped' && metadata?.class !== 'mega' && !def.animatedNodes.includes('body')) {
  const document = await io.read(join(source, authored ? 'model.glb' : 'lod0.glb'));
  // Some reviewed casts carry a separately-authored hand prop. It remains a
  // child of the hand for animation, but is not fused body geometry and must
  // not expand the anatomical reach envelope.
  const propContract = protectedDetails?.lods?.find(item => item.lod === 0);
  const separateProps = new Set<string>();
  if (propContract?.spatula_triangles && propContract.spatula_parent) {
    const candidates = document.getRoot().listNodes().filter(node => node.getName().toLowerCase().includes('spatula'));
    const matching = candidates.filter(node => {
      const triangles = (node.getMesh()?.listPrimitives() ?? []).reduce((sum, primitive) => sum + (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')!.getCount()) / 3, 0);
      return triangles === propContract.spatula_triangles && node.listParents().some(parent => parent.getName() === propContract.spatula_parent);
    });
    if (matching.length !== 1 || candidates.length !== 1) throw Error(`${id}: protected spatula contract does not match one separate source mesh`);
    separateProps.add(matching[0].getName());
  }
  const bounds = getBounds(document.getRoot().listScenes()[0]), reach = (bounds.max[1] - bounds.min[1]) * .25;
  for (const name of ['handL', 'handR']) {
    const hand = document.getRoot().listNodes().find(node => node.getName() === name); if (!hand) continue;
    const pivot = new Vector3().setFromMatrixPosition(new Matrix4().fromArray(hand.getWorldMatrix())); let distance = 0, furthest = '';
    hand.traverse(node => { if (separateProps.has(node.getName())) return; for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const position = primitive.getAttribute('POSITION')!, matrix = new Matrix4().fromArray(node.getWorldMatrix());
      for (let i = 0; i < position.getCount(); i++) { const d = new Vector3().fromArray(position.getElement(i, [])).applyMatrix4(matrix).distanceTo(pivot); if (d > distance) { distance = d; furthest = node.getName(); } }
    } });
    if (distance > reach) throw Error(`${id}: ${name} includes a fused carried prop (${distance.toFixed(3)} m on ${furthest}, reach ${reach.toFixed(3)}); separate it from the source body before migration`);
  }
}
for (const lod of [0, 1, 2]) {
  // The authored human LOD2 can attach a hand only to the thigh. Retain the
  // sound LOD1 anatomy (well inside the 4k far-tier budget) with a smaller atlas.
  // Never position-simplify a painted body across its UV islands.
  const sourceLod = ((unbound || derivedTemplate) && id.startsWith('npc.') || nativeInfected) && lod === 2 ? 1 : lod;
  const rig = derivedTemplate ? join('assets', sourceId, 'model.glb') : alignment?.rig_source ? join(source, alignment.rig_source) : unbound ? join(id === 'inf.dog' ? 'assets/amb.dog' : assets, id === 'char.corgi' && lod ? `model.lod${lod}.glb` : 'model.glb') : join(source, authored ? `model${sourceLod ? `.lod${sourceLod}` : ''}.glb` : `lod${sourceLod}.glb`), body = join(source, `source/${unbound ? 'assembled' : 'flat'}-lod${sourceLod}.glb`), raw = join(report, `lod${lod}.raw.glb`);
  const args = ['tools/assets/skin-crowd-figure.ts', '--rig', rig, '--out', raw, '--report', join(report, `lod${lod}.json`)];
  const contract = join(assets, 'model.glb'); if (existsSync(contract)) args.push('--contract', contract);
  const placement = metadata?.lods.find(p => p.lod === sourceLod);
  if (existsSync(body)) args.push('--body', body, '--body-scale', String(alignment?.initial_game_height_scale ?? placement?.uniform_scale ?? placement?.world_scale ?? 1), '--body-rot-y', String(alignment?.game_alignment_rotation_y_degrees ?? placement?.rotation_y_degrees ?? 0));
  if (alignment || derivedTemplate) args.push('--body-yaw-fixed');
  if (unbound && id === 'inf.dog') args.push('--atlas-base-half', '--eyes', join(source, 'eyes.json'));
  else if (eyeSource && (id.startsWith('inf.') || alignment?.healthy_toy_eyes || metadata && ['quadruped', 'bird'].includes(metadata.class ?? ''))) args.push('--eyes', eyeSource);
  if (metadata && !derivedTemplate) args.push('--reconstruct-body');
  // The lowered Mega fists contain small nearest-template trouser islands.
  // Repair their semantic ownership without refitting the matching v2 rig.
  if (metadata?.class === 'mega') args.push('--repair-contacts');
  if (id.startsWith('npc.')) args.push('--healthy');
  if (nativeInfected) {
    args.push('--eye-radius', '.04', '--basis', basis);
    if (existsSync(body) && existsSync(join(source, 'eyes.json'))) args.push('--eyes', join(source, 'eyes.json'), '--reproject-eyes');
    const headwear = id === 'inf.jogger' ? 'magenta' : id === 'inf.delivery-driver' ? 'navy' : id === 'inf.suburban-mom' ? 'brown' : undefined;
    if (headwear) args.push('--clear-headwear', headwear, '--brim-clearance', '.07', '--brim-reach-scale', '.7', '--brim-sightline-degrees', '60', '--brim-max-lift', '.08');
  }
  if (protectedDetails?.lods) {
    const lodDetails = protectedDetails.lods.find(item => item.lod === sourceLod);
    const protectedProps: { pattern: RegExp; triangles?: number; owner?: string }[] = [
      { pattern: /spatula/i, triangles: lodDetails?.spatula_triangles, owner: lodDetails?.spatula_parent },
      { pattern: /decal/i, triangles: lodDetails?.decal_triangles, owner: lodDetails?.text_parent },
    ].filter(prop => prop.triangles && prop.owner);
    if (protectedProps.length) {
      const sourceDocument = await io.read(rig);
      const entries = protectedProps.map(prop => {
        const candidates = sourceDocument.getRoot().listNodes().filter(node => node.getName() && prop.pattern.test(node.getName()));
        const matching = candidates.filter(node => {
          const triangles = (node.getMesh()?.listPrimitives() ?? []).reduce((sum, primitive) => sum + (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')!.getCount()) / 3, 0);
          return triangles === prop.triangles && node.listParents().some(parent => parent.getName() === prop.owner);
        });
        if (matching.length !== 1 || candidates.length !== 1) throw Error(`${id}: protected detail ${prop.pattern} does not match one separate source mesh at LOD${lod}`);
        return { name: matching[0].getName(), intended_owner: prop.owner, exact_owner: true };
      });
      const recipe = join(report, 'protected-props.json');
      writeFileSync(recipe, JSON.stringify({ lods: [{ lod, props: entries }] }, null, 2) + '\n');
      args.push('--props', rig, '--props-recipe', recipe, '--props-lod', String(lod), '--props-rest-aligned', '--basis', basis);
    }
  }
  if (derivedTemplate || unbound && (!alignment?.rig_source || alignment.rig_fit_height) && (id.startsWith('npc.') || alignment?.rig_class === 'humanoid' || alignment?.rig_class === 'alpha')) args.push('--fit-rig-height');
  if (alignment?.spectacles || ['npc.civilian-woman-b', 'npc.civilian-elderly'].includes(id)) args.push('--spectacles');
  if (lod > 0 && (alignment?.spectacles || ['npc.civilian-woman-b', 'npc.civilian-elderly'].includes(id))) {
    const measured = JSON.parse(readFileSync(join(report, 'lod0.json'), 'utf8')) as { spectacleTop: number };
    args.push('--spectacle-top', String(measured.spectacleTop));
  }
  if (metadata?.class === 'quadruped') args.push('--rig-kind', 'quadruped');
  if (unbound && existsSync(join(source, 'props.json'))) args.push('--props', join(source, `source/assembled-lod${sourceLod}.glb`), '--props-recipe', join(source, 'props.json'), '--props-lod', String(sourceLod));
  if (id === 'char.corgi') args.push('--retain-corgi-props');
  if (unbound && ['npc.lab-guard', 'npc.police-officer', 'npc.firefighter-alive'].includes(id)) args.push('--clear-headwear', id === 'npc.firefighter-alive' ? 'red' : 'navy');
  if (unbound && ['npc.lab-tech-a', 'npc.civilian-kid'].includes(id)) args.push('--clear-headwear', 'brown');
  if (unbound && id === 'inf.alpha-worker') args.push('--clear-headwear', 'yellow');
  if (unbound && id.startsWith('inf.alpha') && id !== 'inf.alpha-worker') args.push('--clear-headwear', id === 'inf.alpha-hoodie' ? 'green' : id === 'inf.alpha-fire' ? 'yellow' : id === 'inf.alpha-suit' ? 'navy' : 'brown');
  if (unbound && id === 'inf.firefighter') args.push('--clear-headwear', 'red');
  if (unbound && id === 'inf.riot-cop') args.push('--clear-headwear', 'navy');
  if (unbound && id === 'inf.crawler') args.push('--clear-headwear', 'brown');
  // The civilian hoodie cap covers both infection eyes from the level camera.
  // Reuse the measured brim clearance on the retained bound cast too.
  if (id === 'npc.civilian-man-b') args.push('--clear-headwear', 'navy', '--brim-clearance', '.07', '--brim-reach-scale', '.45', '--brim-sightline-degrees', '60');
  if (id === 'char.corgi' || id === 'amb.dog') args.push('--no-eye-discs');
  const cheap = def.category === 'prop' && def.budget.triangles <= 12000;
  const triangleLimit = lod > 0 && def.authoredLodTriangles ? def.authoredLodTriangles[lod === 1 ? 'lod1' : 'lod2'] : lod > 0 && def.authoredLodRatios ? Math.ceil(def.budget.triangles * def.authoredLodRatios[lod === 1 ? 'lod1' : 'lod2']) : lod === 1 && def.tier === 'hero' ? Math.ceil(def.budget.triangles * .15) : lod === 2 && !cheap ? Math.min(4000, def.budget.triangles) : def.budget.triangles;
  // The Mega's corrected four-weight seams need a little more encoded data.
  // Keep its painted atlas readable inside 250 kB with modest LOD1 headroom.
  const workingTriangleLimit = metadata?.class === 'mega' && lod === 1 ? triangleLimit - 128 : triangleLimit;
  let bodyBudget: number | undefined = unbound && id === 'inf.dog' ? (JSON.parse(readFileSync(join(dirname(report), 'amb.dog', `lod${lod}.json`), 'utf8')) as { bodyTriangleBudget: number | null }).bodyTriangleBudget ?? undefined : undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    execFileSync(process.execPath, ['--import', 'tsx', ...args, ...bodyBudget ? ['--body-budget', String(bodyBudget)] : []], { stdio: 'pipe' });
    if (id.startsWith('inf.mega-alpha')) writeFileSync(join(report, `lod${lod}.head.json`), JSON.stringify(await restoreMegaSkull(raw, join(assets, lod ? `model.lod${lod}.glb` : 'model.glb')), null, 2) + '\n');
    if (id === 'npc.firefighter-alive') await restoreFireHelmet(raw, join(assets, 'model.lod1.glb'), lod);
    if (id === 'amb.elephant' || id === 'inf.elephant') await restoreElephantTail(raw, join(assets, 'model.glb'), lod);
    const document = await io.read(raw);
    if (['inf.lion', 'inf.gorilla'].includes(id)) {
      const fit = JSON.parse(readFileSync(join(report, `lod${lod}.json`), 'utf8')) as { scale: number; yaw: number; translation: number[] };
      const teeth = animalTeeth(document, fit, { species: id.split('.')[1], infected: true });
      await io.write(raw, document); writeFileSync(join(report, `lod${lod}.teeth.json`), JSON.stringify(teeth, null, 2) + '\n');
    }
    if (alignment?.rectangular_glasses) { restoreCrowdGlasses(document, lod); await io.write(raw, document); }
    const total = document.getRoot().listNodes().reduce((sum, node) => sum + (node.getMesh()?.listPrimitives().reduce((sum, primitive) => sum + (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')!.getCount()) / 3, 0) ?? 0), 0);
    if (total <= workingTriangleLimit) break;
    const info = JSON.parse(readFileSync(join(report, `lod${lod}.json`), 'utf8')) as { triangles: number };
    bodyBudget = info.triangles - (total - workingTriangleLimit) - 8;
    if (attempt === 3 || bodyBudget <= 0) throw Error(`${id}: fitted caps exceed triangle budget ${triangleLimit}`);
  }
  const animalRecipe = animalEyeRecipes[sourceId];
  if (animalRecipe) {
    const document = await io.read(raw), fit = JSON.parse(readFileSync(join(report, `lod${lod}.json`), 'utf8')) as { scale: number; yaw: number; translation: number[] };
    const look = ['amb.lion', 'inf.lion', 'inf.gorilla', 'inf.elephant', 'inf.flamingo'].includes(id) ? { species: id.split('.')[1], infected: id.startsWith('inf.') } : undefined;
    const details = paintAnimalDetails(document, id.startsWith('amb.'), animalRecipe.tusks, fit, sourceId === 'amb.flamingo', look);
    await io.write(raw, document); writeFileSync(join(report, `lod${lod}.details.json`), JSON.stringify(details, null, 2) + '\n');
  }
  // Region classes in the atlas alpha: tinted, flattened hair/skin/garments for civilians; skin only for uniforms.
  if (id.startsWith('npc.')) {
    const document = await io.read(raw);
    const shelter = id.startsWith('npc.shelter-survivor.');
    if (id === 'npc.shelter-survivor.bandaged') {
      const head = document.getRoot().listNodes().find(n => n.getName() === 'head')!;
      // This source's heavy fringe hides the whole face in the legacy cower.
      head.setExtras({ ...head.getExtras(), cowerHeadLift: .95 });
    }
    if (shelter && /\.(bandaged|sitting)$/.test(id)) paintCrowdShirt(document, '#f2b630');
    const regions = classifyCrowdAtlas(document, id.startsWith('npc.civilian-'), id === 'npc.national-guard', alignment?.authored_skin, alignment?.covered_legs ?? (derivedTemplate && sourceId === 'npc.civilian-man-a'));
    if (regions) { await io.write(raw, document); writeFileSync(join(report, `lod${lod}.regions.json`), JSON.stringify(regions, null, 2) + '\n'); }
    const dressings: CrowdWrap[] = shelter || id === 'npc.civilian-man-a.aftermath' ? [
      { joint: 'foreArmL', colour: '#e7dfce', stain: true },
      ...(/\.(bandaged|sitting)$/.test(id) ? [{ joint: 'head', colour: '#b6aa93', stain: true }] : []),
      ...(id.endsWith('.bandaged') ? [{ joint: 'armL', colour: '#e7dfce', stain: true }] : []),
    ] : alignment?.wraps ?? [];
    if (dressings.length) { const wraps = paintCrowdWraps(document, dressings); await io.write(raw, document); writeFileSync(join(report, `lod${lod}.wraps.json`), JSON.stringify(wraps, null, 2) + '\n'); }
  }
  if (nativeInfected) {
    const document = await io.read(raw);
    for (const texture of document.getRoot().listTextures()) {
      texture.setImage(new Uint8Array(PNG.sync.write(await decodeSkinImage(texture.getImage()!, texture.getMimeType(), basis)))).setMimeType('image/png');
    }
    const palette = legacyCrowdPalette(await io.read(join(assets, 'model.glb')));
    const regions = classifyCrowdAtlas(document, true, false, true, false, palette);
    if (!regions) throw Error(`${id}: regional readability pass requires a decoded body atlas`);
    await io.write(raw, document);
    writeFileSync(join(report, `lod${lod}.regions.json`), JSON.stringify({ ...regions, authoredPalette: palette }, null, 2) + '\n');
  }
  const tiers = [];
  for (const low of [false, true]) {
    const target = join(output, `${id}.lod${lod}${low ? '.low' : ''}.glb`);
    const initialAtlas = lod === 2 && (unbound || derivedTemplate) && id.startsWith('npc.') ? 256 : low || lod > 0 ? 512 : 1024;
    let positionPrecision: number | undefined;
    await compressSkin(raw, target, basis, initialAtlas);
    // Keep detailed boss faces at 512 when the standalone LOD budget permits.
    const byteLimit = [600000, 250000, 150000][lod];
    for (const atlas of nativeInfected ? [] : [512, 256, 128]) {
      if (readFileSync(target).length <= byteLimit || atlas >= initialAtlas) continue;
      await compressSkin(raw, target, basis, atlas);
    }
    // Preserve L9's continuous native infected anatomy at its far file cap.
    if (lod === 2 && nativeInfected && readFileSync(target).length > byteLimit) {
      for (const precision of [1 / 16384, 1 / 8192, 1 / 4096, 1 / 2048, 1 / 1024]) {
        positionPrecision = precision;
        await compressSkin(raw, target, basis, 128, undefined, undefined, false, precision);
        if (readFileSync(target).length <= byteLimit) break;
      }
    }
    const bytes = readFileSync(target), document = await io.read(target), errors: string[] = [];
    if (bytes.length > [600000, 250000, 150000][lod]) errors.push(`size ${bytes.length} exceeds LOD${lod}`);
    if (!document.getRoot().listSkins().length) errors.push('missing skin');
    for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
      const weights = primitive.getAttribute('WEIGHTS_0'); if (!weights) continue;
      for (let i = 0; i < weights.getCount(); i++) if (Math.abs(weights.getElement(i, []).reduce((a, b) => a + b, 0) - 1) > .0001) errors.push(`unnormalized weights ${i}`);
    }
    if (document.getRoot().listTextures().some(t => t.getMimeType() !== 'image/ktx2')) errors.push('non-KTX2 texture');
    if (document.getRoot().listTextures().some(t => t.getSize()?.some(n => n % 4))) errors.push('texture extent is not aligned to its 4x4 GPU block');
    if (errors.length) throw Error(`${id} LOD${lod}: ${errors.slice(0, 5).join('; ')}`);
    tiers.push({ low, path: target, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), positionPrecision, errors });
    if (id === 'inf.dog' || id === 'amb.dog') for (const coat of def.decayVariants) {
      const sibling = variantPath(target, coat);
      const coatSource = join(dirname(source), `${id}.${coat}`, 'source', `assembled-lod${lod}.glb`);
      await compressSkin(raw, sibling, basis, low || lod > 0 ? 512 : 1024, existsSync(coatSource) ? undefined : coat, existsSync(coatSource) ? coatSource : undefined, unbound && id === 'inf.dog');
      if (readFileSync(sibling).length > [600000, 250000, 150000][lod]) throw Error(`${id}.${coat}: LOD${lod} byte limit`);
      if (lod === 0 && !low) await io.write(variantPath(join(assets, 'model.skin.glb'), coat), await io.read(sibling));
    }
  }
  if (lod === 0) {
    const document = await io.read(tiers[0].path), bounds = getBounds(id === 'char.corgi' ? document.getRoot().listScenes()[0] : document.getRoot().listNodes().find(node => node.getName() === 'skin_body')!);
    if (id === 'npc.firefighter-alive') {
      const helmet = getBounds(document.getRoot().listNodes().find(node => node.getName() === 'prod_fire_helmet')!);
      for (let axis = 0; axis < 3; axis++) { bounds.min[axis] = Math.min(bounds.min[axis], helmet.min[axis]); bounds.max[axis] = Math.max(bounds.max[axis], helmet.max[axis]); }
    }
    def.dimensions = { x: bounds.max[0] - bounds.min[0], y: bounds.max[1] - bounds.min[1], z: bounds.max[2] - bounds.min[2], tolerance: .15 };
    await io.write(join(assets, 'model.skin.glb'), await io.read(raw));
  }
  receipts.push({ lod, source: rig, sourceSha256: createHash('sha256').update(readFileSync(rig)).digest('hex'), ...(existsSync(body) ? { bodySource: body, bodySha256: createHash('sha256').update(readFileSync(body)).digest('hex') } : {}), tiers });
  unlinkSync(raw);
}
def.crowdSkin = true; def.textureMode = 'baseColor'; def.sourceGlb = join(assets, 'model.skin.glb');
def.glb = join(output, `${id}.lod0.glb`); def.lods = { lod1: join(output, `${id}.lod1.glb`), lod2: join(output, `${id}.lod2.glb`) };
delete def.textureAtlasLow; delete def.lowGlb; delete def.corpseGlb;
const bakePath = 'src/assets/civilianBakes.json', bakes = JSON.parse(readFileSync(bakePath, 'utf8')) as Record<string, string>;
const preparedBakes = id === 'char.corgi' ? {} : await skinCrowdBakes(def);
const validation = await validateAssets([def]);
writeFileSync(join(report, 'validation.json'), JSON.stringify(validation, null, 2) + '\n');
if (validation.some(row => row.errors.length)) throw Error(`${id}: standard validator failed: ${validation.flatMap(row => row.errors).join('; ')}`);
for (const key of Object.keys(bakes)) if (key.startsWith(id + ':')) {
  const file = 'public' + bakes[key]; if (!Object.values(preparedBakes).includes(bakes[key]) && existsSync(file)) unlinkSync(file); delete bakes[key];
}
Object.assign(bakes, preparedBakes);
// A failed or interrupted bake can leave content-addressed files that never
// reached the registry. Retire only this identity's unreferenced outputs.
const referencedBakes = new Set(Object.values(bakes));
for (const name of readdirSync('public/assets/civilians')) if (name.startsWith(id + '.lod') && name.endsWith('.bin.gz') && !referencedBakes.has('/assets/civilians/' + name)) unlinkSync(join('public/assets/civilians', name));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(bakePath, JSON.stringify(bakes, null, 2) + '\n');
writeFileSync(join(report, 'build.json'), JSON.stringify({ id, source, elapsedSeconds: (Date.now() - started) / 1000, manualSteps: [], receipts, preparedBakes }, null, 2) + '\n');
console.log(`${id}: 3 LODs × 2 tiers validated, ${((Date.now() - started) / 1000).toFixed(1)} s, zero manual steps`);
