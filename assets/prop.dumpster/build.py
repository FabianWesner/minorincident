"""Reproducible texture-free dumpster. Metres; front +X; ground Z=0.
Lids pivot about Y; caster swivels about Z; wheels rotate about Y.
Static parts are joined per material, moving assemblies per joint/material.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--glb')
parser.add_argument('--render')
parser.add_argument('--view', choices=['ref', 'game', 'front', 'side', 'rear'], default='ref')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Palette start values tuned for the reference's painted steel and warm rust.
COLORS = {'grass': '4d7958', 'backpackTeal': '2f6e6a', 'uiDark': '25222c',
          'asphalt': '3e3544', 'sidewalk': 'b9a4a0', 'brick': 'a8483a', 'woodWarm': 'b0703f'}
M = {}
for token, color in COLORS.items():
    rgb = [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    mat = bpy.data.materials.new('pal_' + token)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb) + (1,)
    bsdf.inputs['Metallic'].default_value = .32 if token in ('grass', 'backpackTeal', 'sidewalk') else .08
    bsdf.inputs['Roughness'].default_value = .57 if token != 'uiDark' else .69
    M[token] = mat

def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    if parent:
        bpy.context.view_layer.update()
        world = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = world
    return obj

root = empty('root')
root['asset_id'] = 'prop.dumpster'
root['ss_physics'] = {'class': 'heavy', 'mass': 220, 'friction': .65, 'restitution': .05,
                      'centerOfMass': [0, .83, 0], 'pushable': True, 'kickable': False,
                      'barricadeValue': 1.7, 'barricadeHP': 650, 'vaultable': False,
                      'flammable': False, 'explosive': None, 'sounds': 'prop.metal-heavy'}
body = empty('body', parent=root)
empty('front', (.68, 0, 1.05), root)

def finish(obj, name, token, parent=body, bevel=0):
    obj.name = name
    obj.data.materials.append(M[token])
    bpy.context.view_layer.objects.active = obj
    if bevel:
        mod = obj.modifiers.new('soft steel edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for face in obj.data.polygons:
        face.use_smooth = not name.startswith(('paint_', 'end_chip'))
    mod = obj.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world
    return obj

def box(name, pos, size, token='grass', parent=body, bevel=.018):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, token, parent, min(bevel, min(size) * .38))

def cylinder(name, pos, radius, depth, token, parent=body, axis='Y', vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=pos)
    obj = bpy.context.object
    obj.rotation_euler = (math.pi / 2, 0, 0) if axis == 'Y' else (0, math.pi / 2, 0) if axis == 'X' else (0, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(obj, name, token, parent, .007 if radius > .12 else 0)

# Hollow steel container: the opening remains visible when the two lids lift.
box('floor', (0, 0, .345), (1.24, 2.10, .09), 'backpackTeal')
for x in (-.622, .622):
    box('steel_wall', (x, 0, .97), (.055, 2.12, 1.19))
    # Pressed lower panel and long seam: 6mm clearance from base wall.
    box('lower_panel', (x + math.copysign(.042, x), 0, .565), (.017, 2.09, .36), bevel=.009)
    box('lower_seam', (x + math.copysign(.041, x), 0, .765), (.018, 2.11, .019), 'backpackTeal', bevel=.004)
    box('upper_panel', (x + math.copysign(.041, x), 0, 1.13), (.018, 2.09, .65), bevel=.008)
    box('top_rim', (x, 0, 1.595), (.105, 2.25, .12), bevel=.018)
for y in (-1.059, 1.059):
    box('end_wall', (0, y, .97), (1.19, .055, 1.19), 'backpackTeal')
    box('end_rim', (0, y, 1.595), (1.24, .115, .12))
    for x in (-.588, .588):
        box('corner_fold', (x, y, .97), (.072, .079, 1.20), bevel=.012)
    # Forklift sleeve: a hollow rectangular pocket, opening visible on each end.
    for offset in (.033, .226):
        box('pocket_wall', (0, y + math.copysign(offset, y), 1.055), (1.31, .043, .27), bevel=.010)
    for z in (.908, 1.202):
        box('pocket_horizontal', (0, y + math.copysign(.125, y), z), (1.31, .235, .046), bevel=.012)
    for x in (-.42, .42):
        obj = box('pocket_gusset', (x, y + math.copysign(.083, y), 1.30), (.045, .21, .18), 'backpackTeal', bevel=.007)
        obj.rotation_euler.x = math.copysign(-.48, y)
    # Cast lift rail's metal fasteners are raised clear of the paint.
    for x in (-.47, .47):
        cylinder('pocket_bolt', (x, y + math.copysign(.250, y), 1.203), .019, .012, 'sidewalk', vertices=12)

# Two independent lids, five broad moulded ribs each; both meet at a deep central gap.
# Rear hinge is at X=-.58; the central gap remains clear.
for side, y in [('L', -.558), ('R', .558)]:
    lid = empty('lid' + side, (-.596, y, 1.711), root)
    panel = box('lid_shell', (0, y, 1.715), (1.26, 1.055, .095), 'uiDark', lid, .032)
    for i in range(5):
        yy = y + (i - 2) * .204
        box('lid_rib', (.014, yy, 1.775), (1.205, .181, .063), 'uiDark', lid, .019)
        box('rib_front_lip', (.585, yy, 1.765), (.085, .180, .095), 'uiDark', lid, .017)
    for yy in (y - .38, y + .38):
        cylinder('hinge_knuckle', (-.596, yy, 1.711), .056, .17, 'woodWarm', lid)
        cylinder('hinge_pin', (-.596, yy, 1.711), .026, .194, 'woodWarm', lid)
    # Raised recessed handle, mechanically legible in game view.
    for yy in (y - .115, y + .115):
        box('handle_foot', (.432, yy, 1.823), (.072, .043, .047), 'uiDark', lid, .009)
    box('handle_bridge', (.432, y, 1.855), (.068, .27, .035), 'uiDark', lid, .012)

# Four offset, swivelling casters with separate wheel axes at wheel centres.
for name, x, y in [('FL', .48, -.88), ('FR', .48, .88), ('RL', -.48, -.88), ('RR', -.48, .88)]:
    swivel = empty('caster' + name, (x, y, .305), root)
    cylinder('swivel_mount', (x, y, .306), .10, .044, 'sidewalk', swivel, 'Z')
    cylinder('swivel_race', (x, y, .278), .079, .037, 'sidewalk', swivel, 'Z')
    box('caster_mount_plate', (x, y, .326), (.23, .20, .039), 'backpackTeal', bevel=.010)
    wx = x + .037
    wheel = empty('wheel' + name, (wx, y, .142), swivel)
    for yy in (y - .080, y + .080):
        fork = box('fork', (x + .018, yy, .207), (.11, .035, .175), 'sidewalk', swivel, .013)
        fork.rotation_euler.y = -.16
        cylinder('axle_bolt', (wx, yy + math.copysign(.023, yy-y), .142), .027, .016, 'sidewalk', swivel, vertices=16)
    cylinder('rubber_tire', (wx, y, .142), .142, .123, 'uiDark', wheel, vertices=24)
    for yy in (y - .064, y + .064):
        cylinder('tire_sidewall', (wx, yy, .142), .119, .012, 'asphalt', wheel)
        cylinder('wheel_rim', (wx, yy + math.copysign(.01, yy-y), .142), .082, .013, 'woodWarm', wheel)
        cylinder('hub', (wx, yy + math.copysign(.021, yy-y), .142), .039, .019, 'sidewalk', wheel, vertices=20)

# Sparse chipped paint: closed irregular plates with front faces 4mm proud.
# No graffiti, posters, decals or textures. Seeded rust primarily follows edges.
rng = random.Random(27)
chip_bounds = {}
def chip(name, center, width, height, axis, token, parent=body):
    # Reject overlapping patch footprints, preventing coplanar paint faces.
    axes = [i for i in range(3) if i != axis]
    u, v = center[axes[0]], center[axes[1]]
    bounds = (u-width/2, u+width/2, v-height/2, v+height/2)
    key = (axis, round(center[axis], 3))
    existing = chip_bounds.setdefault(key, [])
    if any(bounds[0] < b[1] + .003 and bounds[1] > b[0] - .003
           and bounds[2] < b[3] + .003 and bounds[3] > b[2] - .003 for b in existing):
        return
    existing.append(bounds)
    n = 6
    ring = []
    for i in range(n):
        angle = i * math.tau / n
        r = rng.uniform(.63, 1)
        ring.append((math.cos(angle) * width * r / 2, math.sin(angle) * height * r / 2))
    verts = []
    sign = 1 if center[axis] > 0 else -1
    for depth in (0, .004):
        for u, v in ring:
            if axis == 0: verts.append((center[0] + sign * depth, center[1] + u, center[2] + v))
            elif axis == 1: verts.append((center[0] + u, center[1] + sign * depth, center[2] + v))
            else: verts.append((center[0] + u, center[1] + v, center[2] + depth))
    faces = [tuple(range(n-1, -1, -1)), tuple(range(n, 2*n))]
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    if (axis == 0 and sign < 0) or (axis == 1 and sign > 0):
        faces = [tuple(reversed(face)) for face in faces]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj, name, token, parent)
for x in (-.68, .68):
    for z in (.410, .800, 1.610):
        for i in range(12):
            y = -1.005 + i * .181 + rng.uniform(-.035, .035)
            chip('paint_edge_chip', (x, y, z + rng.uniform(-.023, .023)), rng.uniform(.055, .130), rng.uniform(.018, .053), 0, 'woodWarm' if i%3 else 'brick')
    for i in range(14):
        y = rng.uniform(-1.00, 1.00)
        z = rng.uniform(.86, 1.39)
        chip('paint_spall', (x, y, z), rng.uniform(.038, .09), rng.uniform(.040, .10), 0, 'brick')
for y in (-1.108, 1.108):
    for i in range(16):
        chip('end_chip', (rng.uniform(-.54, .54), y, rng.choice([.42, 1.49]) + rng.uniform(-.03, .03)), rng.uniform(.02, .08), rng.uniform(.02, .07), 1, 'woodWarm')

# Small chipped rims on the lids move with their hinged panel.
for side, y in [('L', -.558), ('R', .558)]:
    lid = bpy.data.objects['lid' + side]
    for i in range(5):
        yy = y + (i - 2) * .204
        for x in (-.53, .55):
            chip('paint_lid_chip', (x, yy, 1.811), .082, .021, 2, 'woodWarm', lid)
for x in (-.68, .68):
    for y in (-.97, .97):
        for z in (.89, 1.25):
            chip('paint_corner_wear', (x, y, z), .05, .19, 0, 'woodWarm')

# Join by joint and material. No animation part loses its pivot.
parents = [o for o in bpy.context.scene.objects if o.type == 'EMPTY']
for parent in parents:
    for mat in M.values():
        objects = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent == parent and o.data.materials[0] == mat]
        if not objects: continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        objects[0].name = parent.name + '_' + mat.name

col = empty('col:body', (0, 0, 1.0), root)
col['collider'] = 'cuboid'
col['shape'] = 'cuboid'
col['size'] = [1.36, 2.40, 1.65]
scene = bpy.context.scene
asset = list(scene.objects)
meshes = [o for o in asset if o.type == 'MESH']
# AO is baked deterministically into exported COLOR_0, named ao in Blender.
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.seed = 27
scene.render.bake.target = 'VERTEX_COLORS'
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    attr = obj.data.color_attributes.new(name='ao', type='FLOAT_COLOR', domain='CORNER')
    obj.data.color_attributes.active_color = attr
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.bake(type='AO')
triangles = 0
for obj in meshes:
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
# Draw calls include all animated primitives (stricter than the static cap).
report = {'id': 'prop.dumpster', 'tier': 'Side', 'triangles': triangles,
          'draw_calls': len(meshes), 'materials': sorted(m.name for m in M.values()),
          'nodes_ok': all(bpy.data.objects.get(n) for n in ['root', 'body', 'front', 'lidL', 'lidR', 'col:body'] + ['wheel'+s for s in ['FL','FR','RL','RR']]),
          'within_budget': 6000 <= triangles <= 12000 and len(meshes) <= 30,
          'rounds': 5, 'webgpu_ok': False, 'webgl2_ok': False, 'gaps': []}
(HERE / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
if args.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for obj in asset: obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(args.glb).resolve()), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_extras=True, export_cameras=False, export_lights=False)
print('BUILD OK', triangles, 'triangles', len(meshes), 'draw calls')
if args.render:
    world = bpy.data.worlds.new('studio')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.23, .20, .27, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = .65
    bpy.ops.mesh.primitive_plane_add(size=200)
    stage = bpy.data.materials.new('studio_floor')
    stage.use_nodes = True
    stage.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.032, .027, .041, 1)
    bpy.context.object.data.materials.append(stage)
    for position, energy, size, color in [((3,-4,6), 650, 4, (1,.83,.66)), ((-3,2,5), 550, 3, (.70,.77,1))]:
        bpy.ops.object.light_add(type='AREA', location=position)
        light = bpy.context.object
        light.data.energy, light.data.size, light.data.color = energy, size, color
        light.rotation_euler = (Vector((0,0,.9))-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    scene.camera = camera
    target = Vector((0,0,.92))
    camera.location = {'ref': (5,-3.3,3.5), 'game': (5,-5,7), 'front': (6,0,1.1), 'side': (0,-6,1.1), 'rear': (-5,3,3.5)}[args.view]
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 5.45 if args.view == 'game' else 4.65
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = args.width, args.height
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.render.filepath = str(Path(args.render).resolve())
    bpy.ops.render.render(write_still=True)
    if args.view == 'ref':
        camera.location = (5, -5, 7)
        camera.data.ortho_scale = 5.45
        camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.resolution_x, scene.render.resolution_y = 960, 540
        scene.cycles.samples = 24
        output = Path(args.render)
        game_name = output.name.replace('-ref', '-game') if '-ref' in output.name else 'game.png'
        scene.render.filepath = str(output.with_name(game_name).resolve())
        bpy.ops.render.render(write_still=True)
    print('RENDER OK')
