"""Deterministic palette-only Molotov. Label relief is >=3 mm; wick/fire pivot at mouth."""
import argparse
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ASSET = {'id': 'thr.molotov', 'category': 'weapon'}
OUT = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
for arg in ('render', 'glb'):
    p.add_argument('--' + arg)
p.add_argument('--view', choices=['ref', 'game', 'front', 'side', 'rear'], default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960)
p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
root = bpy.data.objects.new('root', None)
bpy.context.collection.objects.link(root)
root['asset_id'] = ASSET['id']
root['category'] = 'weapon'
root['forward'] = '+X'
root['ss_physics'] = {'class': 'light', 'mass': 0.65, 'friction': 0.55,
                      'restitution': 0.08, 'centerOfMass': [0, 0.15, 0],
                      'pushable': True, 'kickable': True, 'flammable': True}


def material(token, color, roughness=0.7, metal=0, emission=0):
    m = bpy.data.materials.new(('emi_' if emission else 'pal_') + token)
    m.use_nodes = True
    rgb = [int(color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb) + (1,)
    m.diffuse_color = c
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = c
    bs.inputs['Roughness'].default_value = roughness
    bs.inputs['Metallic'].default_value = metal
    if emission:
        bs.inputs['Base Color'].default_value = tuple(v * .04 for v in c[:3]) + (1,)
        bs.inputs['Emission Color'].default_value = c
        bs.inputs['Emission Strength'].default_value = emission
    return m


green = material('grass', '435b26', .22, .18)
dark = material('uiDark', '25222c')
cream = material('picketWhite', 'f2e6dc')
brass = material('woodWarm', 'c58a36', .27, .58)
red = material('brick', 'a8483a')
cloth = material('sidewalk', 'b9a4a0')
fire_red = material('sirenRed', 'ff3d0d', emission=1.0)
fire_gold = material('schoolBusYellow', 'f2b630', emission=1.8)
fire_core = material('windowGlow', 'ffdb38', emission=2.0)


def mesh(name, verts, faces, mats):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.parent = root
    for m in mats:
        me.materials.append(m)
    return ob


def lathe(name, rings, mat, segments=32):
    verts = [(r * math.cos(i * math.tau / segments), r * math.sin(i * math.tau / segments), z)
             for z, r in rings for i in range(segments)]
    faces = [tuple(range(segments - 1, -1, -1))]
    for j in range(len(rings) - 1):
        for i in range(segments):
            faces.append((j * segments + i, j * segments + (i + 1) % segments,
                          (j + 1) * segments + (i + 1) % segments, (j + 1) * segments + i))
    faces.append(tuple((len(rings) - 1) * segments + i for i in range(segments)))
    return mesh(name, verts, faces, [mat])


# Thick heel, cylindrical body, broad rounded shoulder and narrow straight neck.
lathe('bottle', [(0, .043), (.003, .050), (.009, .055), (.019, .057),
                 (.035, .058), (.190, .058), (.208, .056), (.220, .051),
                 (.231, .043), (.239, .034), (.245, .025), (.252, .023),
                 (.310, .023), (.317, .025), (.321, .025)], green)
lathe('heelRing', [(.004, .049), (.009, .056), (.013, .057), (.017, .055)], green)
for z in (.312, .329):
    lathe('neckBand', [(z, .025), (z + .003, .029), (z + .012, .029), (z + .015, .026)], brass)
lathe('mouth', [(.342, .025), (.345, .025), (.3455, .016)], dark)


def patch(name, theta0, theta1, z0, z1, radius, mat, segments=16):
    # Closed curved relief, its back safely inside the substrate.
    vs = []
    for rr in (radius - .001, radius):
        for z in (z0, z1):
            for i in range(segments + 1):
                t = theta0 + (theta1 - theta0) * i / segments
                vs.append((rr * math.cos(t), rr * math.sin(t), z))
    n = segments + 1
    fs = []
    for i in range(segments):
        fs.extend([(2*n+i, 2*n+i+1, 3*n+i+1, 3*n+i),
                   (i, n+i, n+i+1, i+1),
                   (i, i+1, 2*n+i+1, 2*n+i),
                   (n+i, 3*n+i, 3*n+i+1, n+i+1)])
    fs.extend([(0, 2*n, 3*n, n), (n-1, 2*n-1, 4*n-1, 3*n-1)])
    return mesh(name, vs, fs, [mat])


patch('paperLabel', -.97, .97, .058, .185, .062, cream)
# Inset frame drawn as raised strips; no coincident polygons.
for z in (.064, .178):
    patch('labelBorder', -.90, .90, z, z + .0035, .0655, brass)
for t in (-.90, .855):
    patch('labelBorder', t, t + .045, .064, .1815, .0655, brass, 2)
for z, length in [(.087, .63), (.076, .36)]:
    patch('labelRule', -length, length, z, z + .004, .0655, dark)
for t in (.43, .59):
    patch('smallPrint', t, t+.09, .076, .080, .0655, dark, 2)


def silhouette(name, outline, depth, center, mat):
    # Outline in Y/Z; thickness gives readable sides and embossed relief.
    if sum(y*z1-y1*z for (y,z),(y1,z1) in zip(outline, outline[1:]+outline[:1])) < 0:
        outline = list(reversed(outline))
    n = len(outline)
    vs = [(center[0] + x, center[1] + y, center[2] + z)
          for x in (-depth/2, depth/2) for y, z in outline]
    fs = [tuple(range(n-1, -1, -1)), tuple(range(n, 2*n))]
    fs += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    return mesh(name, vs, fs, [mat])


# Reference's simple fire pictogram, not a real brand or a texture.
silhouette('flameEmblem', [(-.018, 0), (-.022, .012), (-.018, .032), (-.008, .048),
                          (.002, .066), (.004, .041), (.013, .050), (.020, .019),
                          (.017, 0)], .004, (.0675, 0, .101), red)
silhouette('emblemCutout', [(-.005, .006), (-.008, .019), (.001, .040),
                          (.002, .018), (.007, .006)], .003, (.071, 0, .101), cream)


def ribbon(name, path, widths, mat):
    # Faceted solid cloth strip. Four rails across each curved section expose folds.
    vs = []
    for j, (y, z) in enumerate(path):
        dy, dz = Vector(path[min(j+1, len(path)-1)]) - Vector(path[max(0, j-1)])
        tangent = Vector((0, dy, dz))
        tangent.normalize()
        across = Vector((0, -tangent.z, tangent.y))
        for x, offset in [(-.011, -1), (.006, -.34), (.011, .34), (-.006, 1)]:
            v = Vector((x, y, z)) + across * widths[j] * offset
            vs.append(tuple(v))
    fs = []
    for j in range(len(path)-1):
        for i in range(3):
            fs.append((j*4+i, (j+1)*4+i, (j+1)*4+i+1, j*4+i+1))
    ob = mesh(name, vs, fs, [mat])
    mod = ob.modifiers.new('Cloth thickness', 'SOLIDIFY'); mod.thickness = .004
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob


ribbon('wick', [(0, .338), (.004, .357), (.020, .380), (.044, .394),
                (.065, .397), (.084, .386), (.093, .367)],
               [.010, .013, .015, .017, .016, .013, .009], cloth)
ribbon('wickFold', [(-.008, .345), (.009, .371), (.031, .386), (.056, .384), (.077, .369)],
                  [.004, .005, .005, .004, .003], cream)

# Contiguous nested flame rings share vertices: colored bands cannot z-fight.
outline = [(.026, .378), (.036, .408), (.063, .431), (.102, .442),
           (.102, .428), (.129, .410), (.165, .407), (.189, .399),
           (.178, .386), (.156, .386), (.177, .360), (.203, .344),
           (.219, .320), (.220, .305), (.199, .313), (.176, .335),
           (.186, .290), (.187, .261), (.176, .202), (.161, .230),
           (.147, .285), (.121, .318), (.116, .294), (.099, .309),
           (.091, .335), (.098, .366), (.081, .388), (.054, .389)]
outline.reverse()  # front faces point +X
center = Vector((.125, .372))
n = len(outline)
vs = [(0, y, z) for y, z in outline]
# Front/back low-poly lens; rings control the orange, gold, and hot cream bands.
for sign in (1, -1):
    for scale, depth in ((.76, .010), (.48, .016), (.17, .020)):
        for y, z in outline:
            yz = center + (Vector((y, z)) - center) * scale
            vs.append((sign * depth, yz.x, yz.y))
fs = []; indices = []
for side in range(2):
    previous = 0
    for band in range(3):
        current = n + side*3*n + band*n
        for i in range(n):
            f = (previous+i, previous+(i+1)%n, current+(i+1)%n, current+i)
            fs.append(f if side == 0 else tuple(reversed(f))); indices.append(band)
        previous = current
    fs.append(tuple(previous+i for i in range(n)) if side == 0 else tuple(previous+i for i in reversed(range(n))))
    indices.append(2)
flame = mesh('flame', vs, fs, [fire_red, fire_gold, fire_core])
for poly, index in zip(flame.data.polygons, indices):
    poly.material_index = index
# Separate flame pivot for optional procedural flicker; static wick stays on bottle.
flame.location = (0, 0, .345)
for v in flame.data.vertices:
    v.co.z -= .345
flame['animated'] = True

# Join static parts once per palette material, preserving the flame's joint.
objects = []
for m in (green, dark, cream, brass, red, cloth):
    group = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o != flame and o.data.materials[0] == m]
    bpy.ops.object.select_all(action='DESELECT')
    for ob in group:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    bpy.ops.object.join()
    ob = group[0]; ob.name = 'body' if m == green else m.name.removeprefix('pal_')
    objects.append(ob)
objects.append(flame)
for name, loc in [('grip', (0, 0, .145)), ('col:bottle', (0, 0, .172)), ('light:wick', (0, .07, .39))]:
    ob = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ob); ob.parent = root; ob.location = loc
    if name.startswith('col:'):
        ob['collider'] = 'cylinder'; ob['shape'] = 'cylinder'; ob['radius'] = .058; ob['height'] = .345
    if name.startswith('light:'):
        ob['ss_light'] = {'type': 'fire', 'color': 'light_fire', 'intensity': 2.5,
                          'range': 1.5, 'pool': True, 'beam': 'none', 'flare': False,
                          'reflect': True, 'shadow': 'none', 'heroPriority': 1,
                          'flicker': 'fire', 'powerGroup': 'self', 'breakable': False,
                          'emissiveNodes': ['flame'], 'tiers': 'all'}
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.samples = 32
scene.render.bake.target = 'VERTEX_COLORS'
for ob in objects:
    if ob == flame:
        continue
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    c = ob.data.color_attributes.new(name='ao', type='FLOAT_COLOR', domain='CORNER')
    ob.data.color_attributes.active_color = c
    bpy.ops.object.bake(type='AO')
triangles = sum(len(poly.vertices)-2 for ob in objects for poly in ob.data.polygons)
print('OK molotov triangles', triangles)
if a.glb:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()), export_format='GLB',
                              use_selection=True, export_yup=True, export_extras=True,
                              export_cameras=False, export_lights=False)
if a.render:
    scene.cycles.samples = a.samples; scene.cycles.use_denoising = True
    scene.world = bpy.data.worlds.new('Studio'); scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.038, .031, .047, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .45
    target = Vector((0, .058, .220))
    for name, loc, power, color in [('key', (.65, -.8, 1.0), 28, (1, .77, .53)),
                                     ('fill', (.3, .7, .5), 10, (.5, .65, 1)),
                                     ('rim', (-.45, .3, .75), 24, (1, .58, .25))]:
        data = bpy.data.lights.new(name, 'AREA'); data.energy = power; data.shape = 'DISK'; data.size = .6; data.color = color
        ob = bpy.data.objects.new(name, data); scene.collection.objects.link(ob); ob.location = loc
        ob.rotation_euler = (target-ob.location).to_track_quat('-Z', 'Y').to_euler()
    data = bpy.data.lights.new('fireBounce', 'POINT'); data.energy = .6; data.color = (1, .25, .03); data.shadow_soft_size = .08
    ob = bpy.data.objects.new('fireBounce', data); scene.collection.objects.link(ob); ob.location = (0, .09, .385)
    cam = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera')); scene.collection.objects.link(cam)
    direction = {'ref': (1.3, -.45, .28), 'game': (1, -1, 1.35), 'front': (1, 0, .15), 'side': (0, -1, .15), 'rear': (-1, 0, .15)}[a.view]
    cam.location = target + Vector(direction)
    cam.rotation_euler = (target-cam.location).to_track_quat('-Z', 'Y').to_euler()
    if a.view == 'ref':
        cam.rotation_euler.rotate_axis('Z', math.radians(20))
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = .87; scene.camera = cam
    scene.render.resolution_x = a.width; scene.render.resolution_y = a.height; scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.render.image_settings.file_format = 'PNG'; scene.render.filepath = str(Path(a.render).resolve())
    Path(a.render).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)

    if a.view == 'ref':
        cam.location = target + Vector((1, -1, 1.35))
        cam.rotation_euler = (target-cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.resolution_x = 960; scene.render.resolution_y = 540; scene.cycles.samples = 24
        companion = 'game.png' if Path(a.render).stem == 'hero' else Path(a.render).stem.replace('-ref', '') + '-game.png'
        scene.render.filepath = str(Path(a.render).resolve().with_name(companion))
        bpy.ops.render.render(write_still=True)
