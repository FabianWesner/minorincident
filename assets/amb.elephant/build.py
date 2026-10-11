"""Normal elephant base; infected delivery executes this same build with --infected.
Authored closed surfaces at three densities, never collapse/decimate. +X forward.
Run headlessly through tools/blender/run.py.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

p = argparse.ArgumentParser()
p.add_argument('--glb', required=True)
p.add_argument('--lod', type=int, choices=[0, 1, 2], default=0)
p.add_argument('--infected', action='store_true')
p.add_argument('--quality', choices=['high', 'low'], default='high')
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
parts, meshes = {}, []
seg, rings = [(24, 16), (12, 9), (8, 4)][a.lod]

def mat(name, rgb, emission=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    rgba = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb] + [1]
    m.diffuse_color = rgba
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = rgba
    b.inputs['Roughness'].default_value = .78
    if emission:
        b.inputs['Emission Color'].default_value = rgba
        b.inputs['Emission Strength'].default_value = emission
    return m

mats = {
    'skin': mat('pal_asphalt' if a.infected else 'pal_sidewalk', (.33, .30, .35) if a.infected else (.57, .53, .59)),
    'ivory': mat('pal_picketWhite', (.91, .84, .69)),
    'wound': mat('pal_blood' if a.infected else 'pal_uiDark', (.49, .045, .07) if a.infected else (.13, .12, .15)),
    'eye': mat('emi_infectedEye' if a.infected else 'pal_asphalt', (1, .07, .04) if a.infected else (.18, .15, .13), 3 if a.infected else 0)
}

def parent(o, name):
    bpy.context.view_layer.update()
    o.parent = parts[name]
    o.matrix_parent_inverse = o.parent.matrix_world.inverted()

def node(name, pos, owner=None):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    o.location = pos
    if owner: parent(o, owner)
    parts[name] = o
    return o

def finish(o, name, token, owner):
    o.name = name
    o.data.materials.append(mats[token])
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for f in o.data.polygons: f.use_smooth = True
    parent(o, owner)
    meshes.append(o)
    return o

def ell(name, pos, size, owner, token='skin', density=1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=max(6 if a.lod == 2 else 8, int(seg * density)), ring_count=max(3 if a.lod == 2 else 4, int(rings * density)), location=pos)
    o = bpy.context.object
    o.scale = size
    return finish(o, name, token, owner)

def tube(name, points, radii, owner, token='skin', n=None):
    n = n or [16, 10, 6][a.lod]
    verts, faces = [], []
    for j, point in enumerate(points):
        t = Vector(points[min(j + 1, len(points) - 1)]) - Vector(points[max(j - 1, 0)])
        t.normalize()
        u = t.cross(Vector((0, 1, 0))).normalized()
        v = t.cross(u).normalized()
        for i in range(n):
            angle = math.tau * i / n
            verts.append(Vector(point) + radii[j] * (u * math.cos(angle) + v * math.sin(angle)))
    for j in range(len(points) - 1):
        for i in range(n):
            k = j * n + i
            q = j * n + (i + 1) % n
            faces.append((k, q, q + n, k + n))
    faces += [tuple(range(n - 1, -1, -1)), tuple((len(points) - 1) * n + i for i in range(n))]
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    o = bpy.data.objects.new(name, data)
    scene.collection.objects.link(o)
    return finish(o, name, token, owner)

node('root', (0, 0, 0))
parts['root']['groundedAnimal'] = True  # Reuse the crowd bake's planted-sole correction.
node('hip', (-.95, 0, 1.65), 'root')
node('torso', (.12, 0, 1.90), 'hip')
node('body', (0, 0, 1.95), 'torso')
node('neck', (1.04, 0, 2.13), 'body')
node('head', (1.30, 0, 2.30), 'neck')
node('jaw', (1.50, 0, 1.95), 'head')
node('trunk', (1.72, 0, 2.33), 'head')
node('trunkTip', (2.22, 0, .82), 'trunk')
node('tail', (-1.58, 0, 1.98), 'hip')
node('backpackSocket', (0, 0, 2.85), 'torso')
node('front', (2.70, 0, 1.50), 'root')
barrel = ell('barrel', (-.15, 0, 1.91), (1.63, .80, 1.02), 'body')
ell('rump', (-1.18, 0, 1.86), (.63, .70, .83), 'hip', density=.75)
ell('shoulder', (.86, 0, 1.98), (.66, .79, .88), 'body', density=.75)
ell('skull', (1.32, 0, 2.31), (.59, .55, .68), 'head')
ell('forehead', (1.53, 0, 2.61), (.36, .44, .35), 'head', density=.7)
ell('lower_jaw', (1.49, 0, 1.94), (.34, .38, .23), 'jaw', density=.6)
# Thick volumetric fan ears, deformed from closed ellipsoids (never flat cards).
for s, side in [(1, 'L'), (-1, 'R')]:
    node('ear' + side, (1.12, s * .46, 2.42), 'head')
    ear = ell('ear_fan' + side, (1.02, s * .73, 2.34), (.48, .18, .70), 'ear' + side)
    for v in ear.data.vertices:
        v.co.x += .13 * (v.co.z / .70) ** 2
        v.co.y += s * .06 * math.sin(v.co.z * 6)
    ell('eye' + side, (1.72, s * .39, 2.55), (.07, .047, .05), 'head', 'eye', density=.4)
    ell('brow' + side, (1.68, s * .405, 2.64), (.16, .067, .055), 'head', density=.4)
    tube('tusk' + side, [(1.67, s * .32, 1.95), (1.97, s * .40, 1.76), (2.26, s * .43, 1.79), (2.46, s * .42, 1.98)], [.12, .10, .065, .006], 'head', 'ivory')
    for front, x in [(True, .84), (False, -1.06)]:
        upper = 'arm' + side if front else 'leg' + side
        lower = 'foreArm' + side if front else 'shin' + side
        foot = 'hand' + side if front else 'foot' + side
        alias = ('legF' if front else 'legB') + side
        node(upper, (x, s * .52, 1.86), 'torso' if front else 'hip')
        node(alias, (x, s * .52, 1.86), upper)
        node(lower, (x + .06, s * .56, .91), alias)
        node(foot, (x + .04, s * .58, .22), lower)
        node(('pawF' if front else 'pawB') + side, (x + .04, s * .58, .22), foot)
        tube('upper_' + alias, [(x, s * .52, 1.83), (x - .05, s * .56, 1.36), (x + .06, s * .56, .91)], [.36, .30, .255], alias)
        tube('lower_' + alias, [(x + .06, s * .56, .97), (x + .01, s * .58, .52), (x + .04, s * .58, .22)], [.265, .255, .28], lower)
        ell('sole_' + alias, (x + .07, s * .58, .19), (.34, .29, .19), ('pawF' if front else 'pawB') + side, density=.6)
        for j in range(3 if a.lod < 2 else 2):
            ell('nail_' + alias + str(j), (x + .355, s * .58 + (j - (1 if a.lod < 2 else .5)) * .13, .12), (.027, .063, .058), ('pawF' if front else 'pawB') + side, 'ivory', density=.35)
trunk_points = [(1.72, 0, 2.36), (1.93, 0, 2.12), (1.99, 0, 1.78), (1.94, 0, 1.39), (2.00, 0, 1.02), (2.23, 0, .80), (2.45, 0, .90), (2.53, 0, 1.08)]
tube('trunk_curve', trunk_points, [.24, .225, .195, .17, .14, .115, .095, .055], 'trunk')
ell('trunk_finger', (2.53, 0, 1.10), (.065, .07, .09), 'trunkTip', density=.5)
tube('tail_curve', [(-1.59, 0, 2.08), (-1.87, .05, 1.66), (-1.98, .09, 1.20), (-1.94, .12, .88)], [.055, .046, .036, .022], 'tail', n=6)
ell('tail_brush', (-1.94, .12, .88), (.07, .075, .15), 'tail', 'wound', density=.4)
# Skin wrinkles follow the barrel contour and retain an unbroken underlying surface.
if a.lod < 2:
    for s in [-1, 1]:
        for j in range(7 if a.lod == 0 else 3):
            x = -.95 + j * (.27 if a.lod == 0 else .7)
            points = []
            for k in range(5):
                z = 1.56 + k * .20
                y = .80 * math.sqrt(max(.01, 1 - ((x + .15) / 1.63) ** 2 - ((z - 1.91) / 1.02) ** 2))
                points.append((x + .018 * math.sin(k * 2), s * (y + .008), z))
            tube('flank_fold' + str(s) + '_' + str(j), points, [.006, .012, .014, .010, .004], 'body', n=5)
# Infection adds curved closed gashes on the unchanged normal silhouette.
# These follow the barrel contour; no square color islands or overlay cards.
if a.infected:
    for s in [-1, 1]:
        tube('cheek_cut' + str(s), [(1.69, s * .445, 2.38), (1.71, s * .425, 2.29), (1.66, s * .43, 2.17)], [.012, .025, .008], 'head', 'wound', n=5)
        points = []
        for x, z in [(-.57, 2.37), (-.42, 2.14), (-.48, 1.86)]:
            y = .80 * math.sqrt(1 - ((x + .15) / 1.63) ** 2 - ((z - 1.91) / 1.02) ** 2)
            points.append((x, s * (y + .008), z))
        tube('flank_gash' + str(s), points, [.018, .095, .012], 'body', 'wound', n=5)
# Hidden retained-parent caps match the existing infected dismemberment contract.
for joint in ['head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'legL', 'legR']:
    cap = ell('stump_' + joint, parts[joint].matrix_world.translation, (.23, .23, .025), parts[joint].parent.name, 'wound', density=.35)
    cap['hidden'] = True
    cap['detached_joint'] = joint
# One multi-material surface per animated part, preserving all joints.
for owner in list(parts):
    group = [o for o in list(scene.objects) if o.type == 'MESH' and o.parent == parts[owner] and not o.name.startswith('stump_')]
    if not group: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in group: o.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    if len(group) > 1: bpy.ops.object.join()
    group[0].name = owner + '__surface'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=a.glb, export_format='GLB', use_selection=True, export_apply=True, export_extras=True, export_cameras=False, export_lights=False)
triangles = sum(len(f.vertices) - 2 for o in scene.objects if o.type == 'MESH' for f in o.data.polygons)
Path(a.glb).with_suffix('.stats.json').write_text(json.dumps({'lod': a.lod, 'triangles': triangles, 'derivedFrom': 'amb.elephant', 'infected': a.infected, 'decimation': False}, indent=2) + '\n')
print('Elephant triangles:', triangles)
