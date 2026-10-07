"""Reproducible clinic-annex hero + authored LODs. +X front, Z up, metres.
Only this asset directory is written. Run through experiment/tools/blender_run.py.
"""
import argparse
import json
import math
import random
import subprocess
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(REPO / 'tools/blender'))
from sslib import palette, ao, lod0
from sslib.lod0 import prepare_export_lod

ASSET = {'id': 'bld.clinic-annex', 'category': 'building'}
SEED = 19102
# Per-asset helpers are intentionally excluded by the repository's public scope.
# Keep the production optimizer invocation in this source-of-truth script.
OPTIMIZE_JS = r"""
import { readFileSync, writeFileSync } from 'node:fs';
import { optimizeAsset } from './tools/assets/optimize.ts';
import { assetIO } from './tools/assets/io.ts';
import { triangleCount } from './tools/assets/delivery.ts';
const [path, contractFile] = process.argv.slice(1);
const contract = JSON.parse(readFileSync(contractFile, 'utf8'));
const def = {
  id: 'bld.clinic-annex', category: 'building', tier: 'hero', status: 'modeled',
  glb: path, sourceGlb: path, sourceForward: '+X', forward: '+X',
  dimensions: contract.dimensions, frontNodes: ['front'],
  requiredNodes: contract.requiredNodes, animatedNodes: contract.animatedNodes,
  sockets: contract.sockets, decayVariants: [],
  budget: { triangles: 100000, materials: 24, fileKB: 1500, drawCalls: 40 },
};
await optimizeAsset(path, path, def);
const io = await assetIO(), doc = await io.read(path);
const stats = {
  triangles: triangleCount(doc),
  drawCalls: doc.getRoot().listNodes().reduce((sum, node) => sum + (node.getMesh()?.listPrimitives().length ?? 0), 0),
  materials: doc.getRoot().listMaterials().map(m => m.getName()),
};
writeFileSync(path.replace('.glb', '.stats.json'), JSON.stringify(stats, null, 2) + '\n');
console.log('OPTIMIZE OK', JSON.stringify(stats));
"""
parser = argparse.ArgumentParser()
parser.add_argument('--glb')
parser.add_argument('--render')
parser.add_argument('--view', default='ref', choices=['ref', 'front', 'side', 'rear', 'game', 'night', 'interaction'])
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--lod', type=int, default=0, choices=[0, 1, 2])
parser.add_argument('--review-set', action='store_true', help='Also render turntable, game, night, interaction and LOD review views')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

groups = {}
parts = {}
level = 0
rng = random.Random(SEED)


def empty(name, pos=(0, 0, 0), parent='root'):
    ob = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = pos
    if parent and name != 'root':
        ob.parent = groups[parent]
        ob.location -= groups[parent].matrix_world.translation
    groups[name] = ob
    return ob


def token_for(token):
    if level == 2:
        return {'sidewalk': 'picketWhite', 'silver': 'picketWhite', 'brass': 'schoolBusYellow',
                'asphalt': 'uiDark', 'tealDark': 'backpackTeal', 'foliageDark': 'foliage',
                'foliageLight': 'foliage', 'cardiganRose': 'schoolBusYellow', 'survivorRed': 'woodWarm'}.get(token, token)
    return token


def finish(ob, token, group='body', bevel=0, emission=False):
    mat = palette.mat(token_for(token), emissive=emission)
    mat.use_backface_culling = True
    bs = mat.node_tree.nodes['Principled BSDF']
    bs.inputs['Roughness'].default_value = .63
    if emission:
        bs.inputs['Emission Strength'].default_value = 3.5 if token == 'tealLight' else 2.2
    ob.data.materials.append(mat)
    if bevel >= .015 and level < 2:
        mod = ob.modifiers.new('Soft toy edges', 'BEVEL')
        mod.width = bevel
        mod.segments = (2 if bevel >= .08 else 1) if level == 0 else 1
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod = ob.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.setdefault((group, mat.name), []).append(ob)
    return ob


def mesh(name, vertices, faces, pos, token, group='body', bevel=0, emission=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = pos
    return finish(ob, token, group, bevel, emission)


def box(name, pos, size, token, group='body', bevel=.025, emission=False):
    x, y, z = (v / 2 for v in size)
    vertices = [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z),
                (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
    faces = [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return mesh(name, vertices, faces, pos, token, group, min(bevel, min(size) * .24), emission)


def cyl(name, pos, radius, depth, token, group='body', axis='z', vertices=None, r2=None):
    n = vertices or (16 if level == 0 else 8)
    top = radius if r2 is None else r2
    verts = [(r * math.cos(i * 2 * math.pi / n), r * math.sin(i * 2 * math.pi / n), z)
             for r, z in [(radius, -depth / 2), (top, depth / 2)] for i in range(n)]
    faces = [tuple(reversed(range(n))), tuple(range(n, n * 2))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    ob = mesh(name, verts, faces, pos, token, group)
    if axis == 'x':
        ob.rotation_euler.y = math.pi / 2
    elif axis == 'y':
        ob.rotation_euler.x = math.pi / 2
    return ob


def rod(name, start, end, radius, token, group='body'):
    d = Vector(end) - Vector(start)
    ob = cyl(name, (Vector(start) + Vector(end)) / 2, radius, d.length, token, group)
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return ob


def ico(name, pos, scale, token, group='body', sub=1):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    data = bpy.data.meshes.new(name)
    bm.to_mesh(data)
    bm.free()
    ob = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = pos
    return finish(ob, token, group)


def text(word, pos, width, height, token, group='body', side=False):
    curve = bpy.data.curves.new(word, 'FONT')
    curve.body = word
    curve.font = bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
    curve.align_x = curve.align_y = 'CENTER'
    curve.resolution_u = 3 if level == 0 else 1
    curve.extrude = .009 if level == 0 else 0
    ob = bpy.data.objects.new('text_' + word, curve)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = pos
    ob.rotation_euler = (math.pi / 2, 0, 0 if side else math.pi / 2)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.object
    xs = [v.co.x for v in ob.data.vertices]
    ys = [v.co.y for v in ob.data.vertices]
    for v in ob.data.vertices:
        v.co.x *= width / (max(xs) - min(xs))
        v.co.y *= height / (max(ys) - min(ys))
    if side:
        # Text normal +Y, with local +X toward -X (the visible side reads left to right).
        ob.rotation_euler = (math.pi / 2, 0, math.pi)
    return finish(ob, token, group)


def cross(pos, size, stem, token, group, emission=False):
    h, t = size / 2, stem / 2
    yz = [(-t, -h), (t, -h), (t, -t), (h, -t), (h, t), (t, t),
          (t, h), (-t, h), (-t, t), (-h, t), (-h, -t), (-t, -t)]
    verts = [(x, y, z) for x in [-.018, .018] for y, z in yz]
    faces = [tuple(reversed(range(12))), tuple(range(12, 24))]
    faces += [(i, (i + 1) % 12, (i + 1) % 12 + 12, i + 12) for i in range(12)]
    return mesh('Medical cross', verts, faces, pos, token, group, .008, emission)


def flower(pos, pink=False):
    token = 'cardiganRose' if pink else 'schoolBusYellow'
    if level == 0:
        for i in range(5):
            t = i * 2 * math.pi / 5
            ob = ico('Flower petal', (pos[0] + math.cos(t) * .065, pos[1] + math.sin(t) * .065, pos[2]), (.063, .038, .025), token)
            ob.rotation_euler.z = t
        ico('Flower heart', (pos[0], pos[1], pos[2] + .020), (.033, .033, .025), 'brass')
    else:
        ico('Distant bloom', pos, (.09, .09, .04), token)


def shrub(pos, radius, height, blooms=True):
    if level == 0:
        # Broad toy foliage cores support the fine leaves; no floating leaf cloud.
        for i in range(8):
            z = height * (.10 + i * .105)
            rr = radius * (.88 - .27 * z / height)
            t = i * 2.4
            ico('Bush crown', (pos[0] + math.cos(t) * radius * .13,
                pos[1] + math.sin(t) * radius * .13, pos[2] + z),
                (rr, rr * .88, max(.16, height * .15)), 'foliageDark' if i % 3 == 0 else 'foliage', sub=2)
    count = [64, 6, 3][level]
    for i in range(count):
        t = rng.random() * math.tau
        rr = radius * math.sqrt(rng.random())
        if level:
            rr *= .30
        zz = rng.uniform(.1, height) * max(.4, 1 - .20 * rr / radius) if level == 0 else height * (.27 + (i % 3) * .29)
        loc = (pos[0] + math.cos(t) * rr, pos[1] + math.sin(t) * rr, pos[2] + zz)
        scale = (.13, .07, .11) if level == 0 else (radius * .77, radius * .70, height * .25)
        ob = ico('Foliage', loc, scale, ['foliageDark', 'foliage', 'foliageLight'][i % 3])
        rx, ry = rng.random() * 2, rng.random() * 2
        ob.rotation_euler = (rx, ry, t) if level == 0 else (0, 0, t)
        if blooms and i % [8, 3, 3][level] == 0:
            flower((loc[0], loc[1], loc[2] + scale[2]), pink=(i % 24 == 0))


def planter(pos, width=1.0, depth=.65):
    x, y, z = pos
    if level == 2:
        box('Flower box', (x, y, z + .22), (depth, width, .44), 'woodWarm', bevel=0)
    else:
        box('Soil', (x, y, z + .35), (depth - .08, width - .08, .08), 'uiDark', bevel=0)
        for row in range(3):
            zz = z + .075 + row * .13
            for xx in [-depth / 2, depth / 2]:
                box('Planter board', (x + xx, y, zz), (.06, width, .115), 'woodWarm', bevel=.014)
            for yy in [-width / 2, width / 2]:
                box('Planter end', (x, y + yy, zz), (depth + .055, .06, .115), 'woodWarm', bevel=.014)
        for xx in [-depth / 2, depth / 2]:
            for yy in [-width / 2 + .05, width / 2 - .05]:
                box('Box corner brace', (x + xx, y + yy, z + .21), (.078, .075, .45), 'brass', bevel=.01)
                if level == 0:
                    for zz in [z + .08, z + .33]:
                        cyl('Box nail', (x + xx + (.043 if xx > 0 else -.043), y + yy, zz), .012, .012, 'uiDark', axis='x', vertices=8)
    for yy in [-width * .27, 0, width * .27]:
        shrub((x, y + yy, z + .37), depth * .5, .62)


def light(name, pos, targets, kind='window', color='light_window_warm', flicker='none', parent='root'):
    ob = empty('light:' + name, pos, parent)
    ob.rotation_euler = (0, -math.pi / 2, 0)
    ob['ss_light'] = json.dumps({'type': kind, 'color': color, 'intensity': 2.0,
        'range': 3.5, 'pool': True, 'beam': 'none', 'flare': False, 'reflect': True,
        'shadow': 'none', 'heroPriority': 1, 'flicker': flicker, 'animation': None,
        'powerGroup': 'clinic-annex', 'breakable': True, 'emissiveNodes': targets, 'tiers': 'all'})


def merge():
    if level == 0:
        grouped = {ob: group for (group, _), objects in parts.items() for ob in objects}
        lod0.prune_hidden_faces(list(grouped), grouped, occlusion=True, game_camera=True, defer=True)
    result = []
    for (group, material), objects in parts.items():
        bpy.ops.object.select_all(action='DESELECT')
        for ob in objects:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        ob = objects[0]
        ob.name = group + '_' + material
        ob.data.materials.clear()
        ob.data.materials.append(bpy.data.materials[material])
        for face in ob.data.polygons:
            face.material_index = 0
        bpy.context.view_layer.update()
        world = ob.matrix_world.copy()
        ob.parent = groups[group]
        ob.matrix_world = world
        for uv in list(ob.data.uv_layers):
            ob.data.uv_layers.remove(uv)
        result.append(ob)
    return result


def build(detail):
    global level, rng, groups, parts
    level = detail
    rng = random.Random(SEED)
    groups, parts = {}, {}
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    root = empty('root', parent=None)
    root['asset_id'], root['forward'], root['tier'] = ASSET['id'], '+X', 'hero'
    root['lods'] = json.dumps({'LOD0': 'model.glb', 'LOD1': 'model.lod1.glb', 'LOD2': 'model.lod2.glb'})
    for name in ['body', 'roof', 'interior', 'window_front', 'window_side', 'window_rear', 'sign_cross', 'lamp_entry']:
        empty(name)
    empty('door_main', (2.53, -.72, .26))
    empty('door_main_right', (2.53, 1.08, .26))
    empty('window_door_L', parent='door_main')
    empty('window_door_R', parent='door_main_right')
    empty('door_delivery', (-1.22, 3.457, 1.11))
    groups['door_delivery']['interaction'] = 'courier-delivery'
    groups['door_delivery']['hingeAxis'] = 'local-X'
    empty('delivery_interaction', (-.63, 3.85, 1.48))
    empty('fx_smoke', (-1.04, 2.07, 5.06), 'roof')['effect'] = 'smoke'
    empty('fx_smoke_window', (2.67, -1.33, 1.72))['effect'] = 'smoke'
    empty('front', (3.23, .1, 1.25))['front'] = True

    # Lots and curbs: separate tile solids make open joints instead of overlays.
    box('Site footing', (.5, 0, .085), (7.6, 9.6, .17), 'sidewalk', bevel=.06)
    if level == 0:
        for i in range(8):
            for j in range(10):
                x, y = -2.825 + i * .95, -4.32 + j * .96
                box('Paving', (x, y, .19), (.93, .94, .09), 'picketWhite' if (i + j) % 5 == 0 else 'sidewalk', bevel=.019)
        for i in range(8):
            for side in [-1, 1]:
                box('Curb block', (-2.825 + i * .95, side * 4.75, .16), (.93, .20, .32), 'picketWhite', bevel=.045)
        for j in range(10):
            for x in [-3.28, 4.28]:
                box('Curb end', (x, -4.32 + j * .96, .16), (.20, .94, .32), 'picketWhite', bevel=.045)
    elif level == 1:
        for i in range(8):
            box('Paving strip', (-2.825 + i * .95, 0, .19), (.93, 9.52, .09), 'sidewalk', bevel=0)
        for y in [-4.75, 4.75]:
            box('Curb run', (.5, y, .16), (7.56, .20, .32), 'picketWhite', bevel=.025)
        for x in [-3.28, 4.28]:
            box('Curb end run', (x, 0, .16), (.20, 9.5, .32), 'picketWhite', bevel=.025)
    else:
        box('Paving top', (.5, 0, .19), (7.56, 9.55, .09), 'picketWhite', bevel=0)

    # Real shell with a door and narrow front window opening; removable roof.
    box('Rear wall', (-2.40, 0, 1.97), (.20, 6.4, 3.46), 'picketWhite', bevel=.035)
    for side in [-1, 1]:
        box('Side wall', (0, side * 3.1, 1.97), (4.8, .20, 3.46), 'picketWhite', bevel=.035)
    for y, width in [(-2.60, 1.20), (-.83, .15), (2.20, 2.00)]:
        box('Front wall pier', (2.40, y, 1.435), (.20, width, 2.39), 'picketWhite', bevel=.025)
    box('Front window sill', (2.40, -1.38, .51), (.20, 1.1, .55), 'picketWhite')
    box('Front lintel', (2.40, 0, 3.16), (.20, 6.4, 1.06), 'picketWhite')
    for y in [-3.17, 3.17]:
        box('Foundation course', (0, y, .47), (5.0, .16, .47), 'sidewalk')
    # Panel joints sit 4mm proud; wide panels remain clean and readable.
    if level == 0:
        for z in [.86, 1.76, 2.66, 3.50]:
            box('Side mortar', (0, 3.206, z), (4.91, .012, .024), 'sidewalk', bevel=0)
            box('Other mortar', (0, -3.206, z), (4.91, .012, .024), 'sidewalk', bevel=0)
        for x in [-1.72, -.78, .18, 1.16, 2.12]:
            box('Side panel joint', (x, 3.208, 2.16), (.022, .012, 3.02), 'sidewalk', bevel=0)
            for z in [1.02, 2.85]:
                cyl('Panel bolt', (x + .05, 3.224, z), .012, .014, 'silver', axis='y', vertices=8)
        for y in [-2.60, 1.37, 2.5]:
            box('Front seam', (2.510, y, 1.62), (.014, .025, 2.50), 'sidewalk', bevel=0)

    # Low parapet, tiled membrane and coping seams.
    box('Roof slab', (0, 0, 3.70), (5.15, 6.50, .17), 'sidewalk', 'roof', .04)
    box('Roof membrane', (0, 0, 3.805), (4.77, 6.12, .03), 'asphalt', 'roof', .005)
    if level == 0:
        for i in range(5):
            for j in range(6):
                box('Roof tile', (-1.90 + i * .95, -2.55 + j * 1.02, 3.833), (.925, .997, .025), 'sidewalk' if (i + j) % 7 == 0 else 'asphalt', 'roof', .006)
    for x in [-2.50, 2.50]:
        if level == 0:
            for j in range(8):
                box('Parapet coping', (x, -2.80 + j * .80, 3.90), (.26, .784, .30), 'picketWhite', 'roof', .035)
        else:
            box('Parapet', (x, 0, 3.90), (.26, 6.5, .30), 'picketWhite', 'roof', .025)
    for y in [-3.12, 3.12]:
        box('Side parapet', (0, y, 3.90), (4.85, .26, .30), 'picketWhite', 'roof', .035)

    # Front glazing and separate outward-hinged entrance leaves.
    box('Front window pane', (2.526, -1.38, 1.73), (.035, 1.00, 1.86), 'tealLight', 'window_front', .009, True)
    for y in [-1.94, -.82]:
        box('Window jamb', (2.59, y, 1.72), (.16, .10, 1.98), 'silver')
    for z in [.73, 2.71]:
        box('Window rail', (2.59, -1.38, z), (.16, 1.20, .10), 'silver')
    box('Entrance threshold', (2.61, .18, .285), (.44, 1.9, .11), 'silver')
    for y in [-.77, 1.13]:
        box('Door jamb', (2.57, y, 1.40), (.20, .105, 2.30), 'silver')
    box('Door header', (2.57, .18, 2.58), (.20, 1.99, .13), 'silver')
    for name, pane, y in [('door_main', 'window_door_L', -.27), ('door_main_right', 'window_door_R', .63)]:
        box('Door glowing glass', (2.564, y, 1.43), (.035, .76, 2.07), 'tealLight', pane, .005, True)
        for yy in [y - .425, y + .425]:
            box('Door stile', (2.62, yy, 1.41), (.11, .075, 2.25), 'silver', name, .015)
        for z in [.325, 2.495]:
            box('Door rail', (2.62, y, z), (.11, .84, .08), 'silver', name, .015)
        box('Door kick plate', (2.631, y, .47), (.025, .76, .24), 'silver', name, .012)
        hy = y + (.30 if y < .3 else -.30)
        rod('Door pull', (2.73, hy, 1.10), (2.73, hy, 1.51), .027, 'brass', name)
        for z in [1.10, 1.51]:
            rod('Pull mount', (2.63, hy, z), (2.73, hy, z), .021, 'brass', name)
        if level == 0:
            box('Door notice', (2.591, y, 1.95), (.011, .27, .35), 'picketWhite', name, .005)
            cross((2.607, y, 2.00), .13, .039, 'brass', name)
            for z in [1.81, 1.85]:
                box('Notice rule', (2.607, y, z), (.008, .18, .010), 'brass', name, 0)

    # Shallow two-panel teal awning, pitched toward the street.
    awning = box('Entrance canopy', (2.95, .16, 2.79), (1.04, 2.15, .12), 'backpackTeal', bevel=.03)
    awning.rotation_euler.y = .14
    box('Awning front lip', (3.465, .16, 2.70), (.08, 2.20, .16), 'tealDark')
    if level < 2:
        for y in [-.89, .16, 1.21]:
            rod('Canopy seam', (2.47, y, 2.934), (3.46, y, 2.795), .010, 'brass')
        for y in [-.84, 1.16]:
            rod('Canopy stay', (2.55, y, 2.56), (3.36, y, 2.72), .025, 'uiDark')

    # Main identity panel: cross badge to the left, warm white lettering to the right.
    box('Name fascia rim', (2.625, -.27, 3.31), (.20, 5.15, .99), 'silver', bevel=.05)
    box('Name fascia', (2.750, -.27, 3.31), (.10, 5.04, .88), 'uiDark', bevel=.04)
    box('Cross enamel', (2.823, -2.21, 3.31), (.07, .76, .77), 'backpackTeal', bevel=.04)
    cross((2.878, -2.21, 3.31), .49, .17, 'picketWhite', 'sign_cross', True)
    if level < 2:
        text('Sunset Grove', (2.821, .18, 3.52), 3.50, .30, 'picketWhite')
        text('Medical Annex', (2.821, .18, 3.13), 3.50, .28, 'picketWhite')
    else:
        # The medical cross and two pale lines identify the sign at distant scale.
        for z, width in [(3.48, 3.25), (3.16, 3.50)]:
            box('Distant sign line', (2.821, .18, z), (.018, width, .075), 'picketWhite', bevel=0)
    if level == 0:
        for y in [-2.69, 2.15]:
            for z in [2.98, 3.63]:
                cyl('Sign screw', (2.813, y, z), .019, .013, 'silver', axis='x', vertices=12)
        for word, z in [('CARE', 2.34), ('TESTING', 2.08), ('SUPPLIES', 1.82), ('A SAFER', 1.56), ('TOMORROW', 1.30)]:
            text(word, (2.519, -2.54, z), .80, .17, 'uiDark')
    box('Header fluorescent casing', (2.556, -2.38, 2.79), (.12, 1.30, .18), 'backpackTeal')
    box('Header fluorescent', (2.628, -2.38, 2.79), (.025, 1.14, .07), 'tealLight', 'window_front', .008, True)

    # Entrance lantern and the tiny card reader are separate from the glazing power group.
    box('Entry lamp mount', (2.58, 1.66, 2.54), (.15, .20, .29), 'uiDark')
    box('Entry lamp lens', (2.72, 1.66, 2.53), (.17, .22, .22), 'windowGlow', 'lamp_entry', .025, True)
    for z in [2.39, 2.67]:
        box('Lamp rim', (2.70, 1.66, z), (.24, .30, .05), 'uiDark')
    box('Reader casing', (2.596, 1.35, 1.65), (.11, .17, .38), 'uiDark')
    if level == 0:
        box('Reader screen', (2.661, 1.35, 1.69), (.019, .10, .10), 'windowGlow', 'lamp_entry', .009, True)
        box('Reader slot', (2.661, 1.35, 1.55), (.02, .10, .026), 'brass', bevel=0)

    # Camera mounted on the right facade; its black lens points toward the forecourt.
    cyl('Camera wall puck', (1.76, 3.27, 3.15), .105, .10, 'uiDark', axis='y')
    rod('Camera bracket', (1.76, 3.31, 3.15), (1.76, 3.52, 3.22), .045, 'uiDark')
    camera = box('Security camera', (1.86, 3.58, 3.23), (.42, .22, .21), 'picketWhite', bevel=.045)
    camera.rotation_euler.y = .22
    cyl('Camera lens', (2.084, 3.58, 3.18), .069, .028, 'uiDark', axis='x')
    if level == 0:
        rod('Camera cable', (1.70, 3.30, 3.09), (1.80, 3.30, 2.92), .013, 'uiDark')
        rod('Camera cable return', (1.80, 3.30, 2.92), (1.90, 3.30, 3.06), .013, 'uiDark')

    # A short glowing side slit, biohazard notice, delivery hatch and arrow.
    box('Side window frame', (-1.20, 3.25, 3.31), (.86, .11, .21), 'brass')
    box('Side luminous slit', (-1.20, 3.316, 3.31), (.70, .027, .085), 'windowGlow', 'window_side', .009, True)
    box('Delivery risalit', (-1.22, 3.255, 1.71), (1.83, .16, 2.94), 'picketWhite', bevel=.035)
    if level < 2:
        text('DELIVERIES', (-1.22, 3.346, 2.69), 1.40, .23, 'uiDark', side=True)
    mesh('Delivery arrow', [(-.10, 0, .10), (.10, 0, .10), (0, 0, -.10)], [(0, 1, 2)], (-1.22, 3.35, 2.36), 'uiDark')
    box('Hatch recess', (-1.22, 3.355, 1.66), (1.30, .06, 1.18), 'uiDark', bevel=.025)
    for x in [-1.88, -.56]:
        box('Hatch side rim', (x, 3.411, 1.66), (.065, .13, 1.24), 'silver')
    for z in [1.04, 2.28]:
        box('Hatch rail', (-1.22, 3.411, z), (1.38, .13, .065), 'silver')
    box('Hatch leaf', (-1.22, 3.457, 1.66), (1.22, .10, 1.10), 'sidewalk', 'door_delivery', .025)
    box('Hatch drip hood', (-1.22, 3.52, 2.24), (1.35, .42, .10), 'silver', 'door_delivery', .03)
    box('Hatch pull', (-1.22, 3.538, 1.23), (.87, .055, .045), 'uiDark', 'door_delivery', .012)
    for z in [1.44, 1.90]:
        box('Hatch panel seam', (-1.22, 3.516, z), (1.09, .011, .021), 'uiDark', 'door_delivery', 0)
    if level == 0:
        for x in [-1.72, -.72]:
            for z in [1.15, 1.55, 2.14]:
                cyl('Hatch fastener', (x, 3.524, z), .019, .016, 'brass', 'door_delivery', axis='y', vertices=12)
        box('Hatch label', (-1.22, 3.525, 2.06), (.16, .014, .04), 'brass', 'door_delivery', .003)
    box('Hazard panel', (.78, 3.255, 2.08), (.75, .055, .88), 'schoolBusYellow', bevel=.025)
    # Three open crescent arms, a central ring and a dot make a geometric biohazard emblem.
    for arm in range(3):
        angle = arm * math.tau / 3
        cx, cz = .78 + math.sin(angle) * .15, 2.13 + math.cos(angle) * .15
        n = 20 if level == 0 else 9
        pts = []
        for r in [.21, .152]:
            pts += [(cx + math.sin(angle + t * 1.46 * math.pi / n - .73 * math.pi) * r, 3.289,
                     cz + math.cos(angle + t * 1.46 * math.pi / n - .73 * math.pi) * r) for t in range(n + 1)]
        faces = [(i, i + 1, i + n + 2, i + n + 1) for i in range(n)]
        ob = mesh('Biohazard crescent', pts, faces, (0, 0, 0), 'uiDark')
        # Planar sign faces must point outward (+Y).
        for p in ob.data.polygons:
            if p.normal.y < 0:
                p.flip()
    cyl('Hazard center', (.78, 3.299, 2.13), .053, .013, 'uiDark', axis='y')
    if level < 2:
        text('AUTHORIZED', (.78, 3.22, 1.47), 1.17, .15, 'uiDark', side=True)
        text('PERSONNEL ONLY', (.78, 3.22, 1.23), 1.30, .15, 'uiDark', side=True)

    # Rear window inferred in the same palette; no flat blank unseen wall.
    box('Rear window frame', (-2.52, -.25, 2.0), (.10, 1.55, 1.03), 'backpackTeal')
    box('Rear pane', (-2.583, -.25, 2.0), (.022, 1.37, .87), 'tealLight', 'window_rear', .009, True)
    box('Rear mullion', (-2.60, -.25, 2.0), (.055, .075, .90), 'silver')

    # Rooftop plant: square HVAC on feet, louvers/fans and capped tall exhaust.
    for x, y, w, d, h in [(-.58, -1.38, 1.24, 1.43, .85), (1.45, -2.34, .38, .41, .28), (-1.60, .35, .45, .42, .40), (.37, 1.30, .44, .43, .66)]:
        box('HVAC plinth', (x, y, 3.87), (w + .15, d + .15, .13), 'uiDark', 'roof')
        if level == 0:
            for xx in [-w * .37, w * .37]:
                for yy in [-d * .37, d * .37]:
                    box('Unit support', (x + xx, y + yy, 3.98), (.11, .11, .21), 'silver', 'roof', .017)
        box('Vent housing', (x, y, 4.0 + h / 2), (w, d, h), 'picketWhite', 'roof', .045)
        box('Unit cap', (x, y, 4.015 + h), (w + .065, d + .065, .07), 'silver', 'roof', .020)
        box('Front grille', (x + w / 2 + .011, y, 4.0 + h / 2), (.031, d * .75, h * .70), 'uiDark', 'roof', .008)
        box('Side grille', (x, y + d / 2 + .016, 4.0 + h / 2), (w * .75, .032, h * .70), 'uiDark', 'roof', .008)
        if level < 2:
            for i in range(9 if level == 0 else 3):
                z = 4.0 + h * (.20 + i * (.071 if level == 0 else .28))
                box('Louver slat', (x + w / 2 + .031, y, z), (.046, d * .73, h * .026), 'silver', 'roof', .004)
                box('Side louver', (x, y + d / 2 + .04, z), (w * .73, .041, h * .026), 'silver', 'roof', .004)
        if w > 1:
            cyl('Fan well', (x, y, 4.07 + h), .36, .023, 'uiDark', 'roof', vertices=24 if level == 0 else 8)
            if level == 0:
                for i in range(6):
                    ob = box('Fan blade', (x, y, 4.092 + h), (.58, .08, .017), 'silver', 'roof', .005)
                    ob.rotation_euler.z = i * math.pi / 3
                for yy in [y - d * .4, y + d * .4]:
                    for z in [4.12, 4.72]:
                        cyl('Unit rivet', (x + w / 2 + .027, yy, z), .013, .014, 'uiDark', 'roof', axis='x', vertices=8)
            if level < 2:
                box('Unit service plate', (x + w / 2 + .029, y + d * .35, 4.12), (.023, .14, .08), 'uiDark', 'roof', .004)
    box('Exhaust curb', (-1.37, 2.07, 3.88), (.65, .64, .16), 'silver', 'roof')
    box('Exhaust stack', (-1.37, 2.07, 4.50), (.38, .38, 1.12), 'sidewalk', 'roof', .035)
    box('Exhaust hood', (-1.37, 2.07, 5.05), (.57, .55, .33), 'silver', 'roof', .065)
    box('Exhaust mouth', (-1.065, 2.07, 5.06), (.025, .22, .11), 'uiDark', 'roof', .015)
    if level == 0:
        for y in [1.92, 2.22]:
            box('Stack seam', (-1.16, y, 4.48), (.012, .018, .94), 'asphalt', 'roof', 0)
        for y in [-.50, 1.1]:
            rod('Roof duct', (-1.95, y, 3.90), (-1.95, y, 4.15), .045, 'silver', 'roof')
            rod('Duct bend', (-1.95, y, 4.15), (-1.72, y, 4.15), .045, 'silver', 'roof')

    # Modest inferred interior: visible cutaway works without a solid block behind doors.
    box('Clinic floor', (0, 0, .265), (4.8, 6.16, .06), 'picketWhite', 'interior')
    box('Lab partition', (-.72, 0, 1.40), (.12, 5.9, 2.22), 'picketWhite', 'interior')
    box('Reception cabinet', (1.34, -1.35, .76), (.62, 1.05, .94), 'picketWhite', 'interior')
    box('Reception desk top', (1.36, -1.35, 1.28), (.76, 1.18, .10), 'backpackTeal' if level < 2 else 'picketWhite', 'interior')
    if level == 0:
        box('Reception monitor', (1.29, -1.35, 1.53), (.10, .37, .30), 'uiDark', 'interior')
        box('Monitor foot', (1.26, -1.35, 1.34), (.18, .24, .045), 'uiDark', 'interior')
        box('Desk papers', (1.61, -1.14, 1.344), (.17, .28, .018), 'picketWhite', 'interior', .003)

    # Forecourt bollards, tiny orange bench, perimeter planting and timber boxes.
    for y in [-.70, 1.13]:
        cyl('Bollard base', (3.38, y, .31), .17, .15, 'uiDark')
        cyl('Yellow bollard', (3.38, y, .73), .12, .80, 'schoolBusYellow', vertices=20 if level == 0 else 8)
        cyl('Bollard cap', (3.38, y, 1.14), .12, .055, 'schoolBusYellow', r2=.085)
    for x, y in [(3.48, -3.64), (3.49, -1.93)]:
        cyl('Post foot', (x, y, .31), .16, .14, 'sidewalk')
        cyl('Dark post', (x, y, .72), .095, .80, 'uiDark')
        for z in [1.08, 1.13]:
            cyl('Post ring', (x, y, z), .125, .04, 'silver')
        cyl('Post cap', (x, y, 1.19), .13, .10, 'silver', r2=.018)
    for x in [.22, 1.28]:
        for y in [3.43, 3.86]:
            box('Bench leg', (x, y, .47), (.075, .085, .47), 'uiDark')
        rod('Bench back upright', (x, 3.42, .36), (x, 3.42, 1.03), .035, 'uiDark')
    for y in [3.55, 3.72, 3.89]:
        box('Bench seat slat', (.75, y, .70), (1.31, .14, .075), 'woodWarm')
    for z in [.87, 1.05]:
        box('Orange bench back', (.75, 3.40, z), (1.31, .07, .14), 'survivorRed')
    planter((3.02, -2.65, .24), 1.65, .56)
    planter((3.04, 2.10, .24), .80, .65)
    planter((2.94, 3.24, .24), .64, .58)
    # Small side/rear bin is attached to this vignette, rather than a second asset.
    box('Utility box', (1.65, -3.67, .75), (.78, .58, 1.0), 'woodWarm', bevel=.035)
    box('Utility lid', (1.65, -3.67, 1.27), (.84, .63, .09), 'backpackTeal')
    if level < 2:
        for x in [1.38, 1.64, 1.90]:
            box('Bin slat', (x, -3.973, .77), (.019, .017, .89), 'uiDark', bevel=0)
    for x, y, radius, height in [(-2.9, -2.3, .45, 2.85), (-2.93, -.9, .47, 3.20), (-2.89, 1.10, .44, 3.32),
                                (-2.89, 2.57, .50, 3.10), (-1.92, -3.78, .47, 2.80), (-.70, -3.78, .45, 2.05),
                                (-1.89, 3.92, .42, 2.96), (-2.90, 3.85, .45, 2.16)]:
        shrub((x, y, .26), radius, height)
    if level == 0:
        for i in range(45):
            x = rng.uniform(-3.1, 4.1)
            y = rng.choice([-4.60, 4.61]) + rng.uniform(-.05, .05)
            for j in range(4):
                t = j * 1.7
                ico('Paving weed', (x + math.cos(t) * .06, y + math.sin(t) * .05, .27), (.027, .047, .14), 'foliage')
        # Sparse panel chips stay away from signage and window openings.
        for i in range(25):
            x = rng.uniform(-2.20, 2.20)
            z = rng.choice([.57, 3.55]) + rng.uniform(-.08, .08)
            box('Cream masonry wear', (x, 3.221, z), (.035, .012, .025), 'sidewalk', bevel=.004)

    light('front', (2.68, -1.38, 1.7), ['window_front'], color='light_led_white', flicker='damaged')
    light('side', (-1.20, 3.35, 3.31), ['window_side'])
    light('rear', (-2.65, -.25, 2.0), ['window_rear'], color='light_led_white')
    groups['light:rear'].rotation_euler.y = math.pi / 2
    groups['light:side'].rotation_euler = (math.pi / 2, 0, 0)
    light('entry_L', (2.69, -.27, 1.42), ['window_door_L'], color='light_led_white')
    light('entry_R', (2.69, .63, 1.42), ['window_door_R'], color='light_led_white')
    light('cross', (2.90, -2.21, 3.31), ['sign_cross'], kind='neon', color='light_led_white')
    light('lantern', (2.80, 1.66, 2.53), ['lamp_entry'], kind='point')
    col = empty('col:building', (0, 0, 1.98))
    col['collider'], col['size'] = 'cuboid', [5.0, 6.4, 3.46]
    col['note'] = 'Exterior envelope; detailed walkable cutaway collision is authored by the district.'
    return merge()


def bake(meshes):
    ao.bake_all(meshes, samples=32)
    for ob in meshes:
        for color in ob.data.color_attributes['ao'].data:
            value = max(.66, color.color[0])
            color.color = (value, value, value, 1)

    lod0.stabilize_ao(meshes)


def export(path):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in bpy.context.scene.objects:
        if ob.type in {'MESH', 'EMPTY'}:
            ob.select_set(True)
    prepare_export_lod(list(bpy.context.scene.objects), str(path)); bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_extras=True, export_cameras=False,
        export_lights=False, export_vertex_color='NAME', export_vertex_color_name='ao',
        export_all_vertex_colors=False)
    subprocess.run(['node', '--import', 'tsx', '--input-type=module', '-e', OPTIMIZE_JS,
        str(path), str(HERE / 'contract.json')], check=True, cwd=REPO)


def render(path, view):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = args.samples
    scene.render.resolution_x, scene.render.resolution_y = args.width, args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    world = bpy.data.worlds.new('Warm clinic studio')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.027, .023, .031, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = .60 if view != 'night' else .12
    stage = box('Studio floor', (0, 0, -.065), (200, 200, .08), 'uiDark', bevel=0)
    stage.data.materials.clear()
    stage_mat = bpy.data.materials.new('Review studio only')
    stage_mat.use_nodes = True
    stage_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.018, .015, .023, 1)
    stage_mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1
    stage.data.materials.append(stage_mat)
    target = Vector((.50, 0, 2.20))
    studio_lights = []
    for loc, power, size, color in [((4, -7, 12), 1800, 7, (1, .68, .38)), ((-5, 6, 9), 400, 8, (.58, .67, 1)), ((4, 7, 9), 1300, 6, (1, .73, .40))]:
        bpy.ops.object.light_add(type='AREA', location=loc)
        ob = bpy.context.object
        ob.data.energy = power if view != 'night' else power * .10
        ob.data.size, ob.data.color = size, color
        ob.rotation_euler = (target - ob.location).to_track_quat('-Z', 'Y').to_euler()
        studio_lights.append((ob, power))
    # Eevee preview turns runtime light anchors into small local lights, never exported.
    for name, loc, color, energy in [('Entry glow', (2.87, 1.66, 2.53), (1, .57, .20), 28),
                                     ('Blue spill', (2.93, -.9, 1.2), (.30, .74, 1), 18),
                                     ('Side slit spill', (-1.2, 3.5, 3.31), (1, .65, .20), 18)]:
        bpy.ops.object.light_add(type='POINT', location=loc)
        ob = bpy.context.object
        ob.name = name
        ob.data.color, ob.data.energy, ob.data.shadow_soft_size = color, energy, .25
    bpy.ops.object.camera_add()
    cam = bpy.context.object
    scene.camera = cam
    views = {'ref': (18, 13, 11.5), 'front': (20, 0, 5.8), 'side': (0, 20, 5.8),
             'rear': (-14, -17, 11), 'game': (15, 15, 17.3), 'night': (18, 13, 11.5), 'interaction': (18, 13, 11.5)}
    cam.location = views[view]
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.type, cam.data.ortho_scale = 'ORTHO', 15.0
    scene.view_settings.view_transform = 'AgX'
    if view == 'interaction':
        groups['door_main'].rotation_euler.z = -math.pi / 3
        groups['door_main_right'].rotation_euler.z = math.pi / 3
        groups['door_delivery'].rotation_euler.x = -math.pi / 4
        groups['roof'].hide_render = True
        for ob in groups['roof'].children_recursive:
            ob.hide_render = True
    scene.render.filepath = str(path)
    path.parent.mkdir(exist_ok=True, parents=True)
    bpy.ops.render.render(write_still=True)
    print('RENDER OK', view, str(path))
    if args.review_set:
        for name in ['front', 'side', 'rear', 'game', 'night', 'interaction']:
            cam.location = views[name]
            cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
            for ob, power in studio_lights:
                ob.data.energy = power * (.10 if name == 'night' else 1)
            world.node_tree.nodes['Background'].inputs[1].default_value = .12 if name == 'night' else .60
            scene.render.resolution_x, scene.render.resolution_y = 960, 540
            scene.eevee.taa_render_samples = 24
            if name == 'interaction':
                groups['door_main'].rotation_euler.z = -math.pi / 3
                groups['door_main_right'].rotation_euler.z = math.pi / 3
                groups['door_delivery'].rotation_euler.x = -math.pi / 4
                for ob in [groups['roof'], *groups['roof'].children_recursive]:
                    ob.hide_render = True
            scene.render.filepath = str(path.parent / (name + '.png'))
            bpy.ops.render.render(write_still=True)
            print('RENDER OK', name)


required = ['root', 'body', 'roof', 'interior', 'door_main', 'door_main_right', 'door_delivery',
            'window_front', 'window_side', 'window_rear', 'window_door_L', 'window_door_R',
            'sign_cross', 'lamp_entry']
contract = {'asset': ASSET['id'], 'forward': '+X', 'units': 'metres',
    'dimensions': {'x': 7.8, 'y': 5.23, 'z': 9.8, 'tolerance': .08},
    'requiredNodes': required,
    'animatedNodes': ['door_main', 'door_main_right', 'door_delivery', 'window_front', 'window_side', 'window_rear', 'window_door_L', 'window_door_R'],
    'sockets': ['fx_smoke', 'fx_smoke_window', 'delivery_interaction'],
    'budget': {'triangles': 100000, 'drawCalls': 40, 'fileKB': 1500}, 'seed': SEED}

if args.glb:
    (HERE / 'contract.json').write_text(json.dumps(contract, indent=2) + '\n')
    for detail in [0, 1, 2]:
        meshes = build(detail)
        bake(meshes)
        path = Path(args.glb).resolve()
        if detail:
            path = path.with_name(path.stem + '.lod' + str(detail) + path.suffix)
        export(path)
        tri = 0
        for ob in meshes:
            ob.data.calc_loop_triangles()
            tri += len(ob.data.loop_triangles)
        print('BUILD OK', detail, tri, 'triangles', len(meshes), 'material batches')
if args.render:
    meshes = build(args.lod)
    for ob in meshes:
        ob.data.calc_loop_triangles()
    print('PREVIEW OK', sum(len(ob.data.loop_triangles) for ob in meshes), 'triangles', len(meshes), 'batches')
    render(Path(args.render).resolve(), args.view)
    if args.review_set:
        args.review_set = False
        args.width, args.height, args.samples = 960, 540, 24
        for detail in [1, 2]:
            build(detail)
            render(Path(args.render).resolve().parent / ('lod' + str(detail) + '.png'), 'ref')
elif not args.glb:
    build(args.lod)
