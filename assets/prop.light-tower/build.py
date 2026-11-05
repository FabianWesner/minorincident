"""Sunset Grove mobile light tower. Metres, +X forward, Z up.
Reference: four-wheel cabinet, front telescopic mast, twin asymmetric lamps.
Static parts merge by palette; moving assemblies retain joint-origin empties.
Run only through experiment/tools/blender_run.py.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
p.add_argument('--glb')
p.add_argument('--render')
p.add_argument('--view', default='ref', choices=['ref', 'game', 'front', 'side', 'rear'])
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960)
p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'


def material(token, color, metal=0, emission=0):
    rgb = [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    rgb = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m = bpy.data.materials.new(('emi_' if emission else 'pal_') + token)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = .42 if metal else .57
    bsdf.inputs['Metallic'].default_value = metal
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*rgb, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    return m


Y = material('schoolBusYellow', 'f2b630')
D = material('uiDark', '25222c')
S = material('sidewalk', 'b9a4a0', .65)
E = material('windowGlow', 'ffc773', emission=3.5)
buckets = {}


def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    o.location = loc
    if parent:
        o.parent = parent
    return o


root = empty('root')
root['assetId'] = 'prop.light-tower'
root['ss_physics'] = {'class': 'heavy', 'mass': 380, 'friction': .75,
    'restitution': .05, 'centerOfMass': [0, .8, 0], 'pushable': True,
    'kickable': False, 'barricadeValue': 1.5, 'barricadeHP': 350,
    'vaultable': False, 'flammable': False, 'sounds': 'prop.metal-heavy'}


def finish(o, name, mat, owner=None, bevel=0):
    o.name = name
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod = o.modifiers.new('Rounded edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod = o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # AO attribute is baked after material merging.
    ao = o.data.color_attributes.new(name='ao', type='FLOAT_COLOR', domain='CORNER')
    for c in ao.data:
        c.color = (1, 1, 1, 1)
    buckets.setdefault((owner or root, mat), []).append(o)
    return o


def box(name, loc, size, mat, bevel=.012, owner=None, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.dimensions = size
    if rot:
        o.rotation_euler = rot
    return finish(o, name, mat, owner, min(bevel, min(size)*.35))


def cylinder(name, loc, radius, depth, mat, axis='Z', owner=None, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    o = bpy.context.object
    if axis == 'Y':
        o.rotation_euler.x = math.pi/2
    elif axis == 'X':
        o.rotation_euler.y = math.pi/2
    return finish(o, name, mat, owner)


def rod(name, start, end, radius, mat, owner=None):
    start, end = Vector(start), Vector(end)
    o = cylinder(name, (start+end)/2, radius, (end-start).length, mat, owner=owner, vertices=12)
    o.rotation_euler = (end-start).to_track_quat('Z', 'Y').to_euler()
    return o


def bolt(loc, axis='Y', owner=None, radius=.015):
    return cylinder('fastener', loc, radius, .014, S, axis, owner, 6)


# Broad bevels produce the characteristic chamfered yellow casing.
box('cabinet', (0, 0, 1.15), (2.16, 1.2, 1.25), Y, .095)
box('chassis', (0, 0, .49), (2.38, 1.37, .20), D, .035)
box('roof_seam', (0, 0, 1.737), (1.99, 1.15, .018), D, .004)
box('roof_lid', (0, 0, 1.764), (2.08, 1.18, .09), Y, .035)
for y in (-.37, .37):
    box('roof_stamp', (-.05, y, 1.817), (1.38, .036, .025), Y, .009)
for x in (-1.12, 1.12):
    box('bumper', (x, 0, .52), (.15, 1.58, .18), D, .02)
    for y in (-.70, .70):
        box('bumper_end', (x, y, .53), (.19, .17, .22), S, .018)
        bolt((x+.103, y, .53), 'X')

# Service doors: layered reveals are 8–20mm apart, never coplanar.
for side, suffix in ((-1, 'L'), (1, 'R')):
    door = empty('door'+suffix, (-.82, side*.621, .77), root)
    y = side*.615
    box('door_shadow', (-.23, y, 1.125), (1.20, .026, .98), D)
    box('service_door', (-.23, side*.64, 1.125), (1.17, .035, .95), Y, .023, door)
    box('vent_well', (-.30, side*.669, 1.35), (.77, .025, .42), D, .023, door)
    for k in range(6):
        box('louvre', (-.30, side*.697, 1.185+k*.064), (.70, .045, .026), S, .007, door,
            (side*.22, 0, 0))
    for xx in (-.69, .09):
        for zz in (1.145, 1.56):
            bolt((xx, side*.694, zz), owner=door, radius=.011)
    box('handle_recess', (-.24, side*.673, .91), (.27, .025, .095), D, .015, door)
    box('handle', (-.24, side*.704, .936), (.23, .041, .033), Y, .01, door)
    for z in (.79, 1.47):
        cylinder('door_hinge', (-.807, side*.676, z), .025, .10, S, owner=door, vertices=12)
    # Narrow front control panel, sockets and raised lid latches.
    box('control_panel', (.65, side*.628, 1.12), (.29, .043, .62), D, .025)
    box('control_trim', (.65, side*.657, 1.12), (.24, .023, .55), S, .012)
    box('switch_plate', (.65, side*.678, 1.29), (.19, .017, .16), D)
    cylinder('selector', (.65, side*.707, 1.29), .041, .043, S, 'Y', vertices=12)
    box('selector_grip', (.65, side*.734, 1.29), (.02, .022, .067), D, .005)
    box('outlet', (.65, side*.684, 1.02), (.15, .03, .25), Y, .012)
    for z in (.94, .99, 1.04, 1.09):
        box('socket_ridge', (.65, side*.709, z), (.11, .024, .014), S, .004)
    for x in (-.95, .97):
        box('corner_panel', (x, side*.609, 1.13), (.16, .025, 1.06), Y, .015)
        for z in (.72, 1.5):
            cylinder('quarter_turn_latch', (x, side*.64, z), .030, .028, D, 'Y', vertices=12)

# Front mounting strap, ventilation and handgrips.
box('mast_shield', (1.098, 0, 1.16), (.14, .40, 1.18), D, .03)
for z in (.81, .88, .95, 1.02):
    box('mount_vent', (1.176, 0, z), (.025, .24, .035), S, .008)
for z in (1.23, 1.34):
    rod('mount_grip', (1.205, -.11, z), (1.205, .11, z), .021, S)
for y in (-.17, .17):
    for z in (.64, 1.64):
        bolt((1.179, y, z), 'X')
box('rear_access_reveal', (-1.085, 0, 1.18), (.025, .98, .94), D, .025)
box('rear_access', (-1.109, 0, 1.18), (.027, .93, .89), Y, .02)
box('rear_vent', (-1.131, 0, 1.35), (.021, .64, .32), D)
for z in (1.24, 1.3, 1.36, 1.42):
    box('rear_louvre', (-1.152, 0, z), (.025, .58, .021), S, .004)

# Fuel cap and rounded rear lifting handle.
cylinder('fuel_cap_seat', (-.52, 0, 1.827), .15, .045, S)
cylinder('fuel_cap', (-.52, 0, 1.867), .12, .055, D)
for k in range(12):
    t = k*math.tau/12
    box('fuel_cap_grip', (-.52+.119*math.cos(t), .119*math.sin(t), 1.873), (.028, .026, .045), D, .006)
for side in (-1, 1):
    rod('carry_handle_leg', (-.86, side*.46, 1.79), (-.75, side*.36, 2.02), .047, Y)
rod('carry_handle', (-.75, -.36, 2.02), (-.75, .36, 2.02), .047, Y)

# Multi-part tyres. Profile and staggered tread stay chunky at the game camera.
for x, axle in ((.77, 'F'), (-.77, 'R')):
    cylinder('axle', (x, 0, .36), .055, 1.57, D, 'Y')
    for side, suffix in ((-1, 'L'), (1, 'R')):
        y = side*.76
        wheel = empty('wheel'+axle+suffix, (x, y, .36), root)
        # Closed six-ring tyre profile keeps a broad, solid tread shoulder.
        profile = ((.19,-.105),(.30,-.105),(.35,-.07),
                   (.35,.07),(.30,.105),(.19,.105))
        verts = [(x+r*math.cos(k*math.tau/20), y+offset,
                  .36+r*math.sin(k*math.tau/20))
                 for r, offset in profile for k in range(20)]
        faces = [(i*20+k, i*20+(k+1)%20,
                  ((i+1)%6)*20+(k+1)%20, ((i+1)%6)*20+k)
                 for i in range(6) for k in range(20)]
        mesh = bpy.data.meshes.new('tyre_profile')
        mesh.from_pydata(verts, [], faces)
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()
        tyre = bpy.data.objects.new('tyre', mesh)
        scene.collection.objects.link(tyre)
        bpy.context.view_layer.objects.active = tyre
        finish(tyre, 'tyre', D, wheel)
        for poly in tyre.data.polygons:
            poly.use_smooth = True
        for k in range(20):
            for row in (-1, 1):
                t = k*math.tau/20 + row*.038
                box('tread', (x+.350*math.sin(t), y+row*.045, .36+.350*math.cos(t)),
                    (.070, .074, .020), D, 0, wheel, (0, t, row*.12))
        cylinder('rim_lip', (x, y+side*.099, .36), .214, .035, S, 'Y', wheel, 20)
        cylinder('rim_dish', (x, y+side*.122, .36), .181, .028, S, 'Y', wheel, 20)
        cylinder('hub', (x, y+side*.149, .36), .072, .061, D, 'Y', wheel, 16)
        for k in range(6):
            t = k*math.tau/6
            bolt((x+.133*math.sin(t), y+side*.15, .36+.133*math.cos(t)), owner=wheel, radius=.014)
        if axle == 'R':
            box('fender_top', (x, side*.76, .782), (.50, .34, .085), D, .025)
            for sign in (-1, 1):
                box('fender_flank', (x+sign*.29, side*.76, .65), (.09, .34, .30), D, .019,
                    rot=(0, sign*-.40, 0))

# Telescope, collars, locking handle and protected cable.
mast = empty('mast', (.94, 0, 1.76), root)
for z, radius, depth, mat in ((2.04,.115,.57,S), (2.68,.079,.78,S), (3.22,.063,.40,S)):
    cylinder('mast_stage', (.94, 0, z), radius, depth, mat, owner=mast, vertices=20)
for z, radius in ((1.79,.144), (2.32,.129), (3.08,.096), (3.45,.091)):
    cylinder('mast_collar', (.94, 0, z), radius, .085, S, owner=mast)
box('mast_clamp', (1.033, 0, 2.77), (.07, .12, .18), Y, .012)
cylinder('mast_lock', (1.083, 0, 2.77), .055, .07, D, 'X', vertices=12)
rod('power_cable', (.86, .09, 1.78), (.86, .09, 3.49), .012, D)
bar = empty('lightBar', (.94, 0, 3.49), root)
box('lamp_crossbar', (.94, 0, 3.49), (.17, 1.17, .13), D, .02, bar)
for side, suffix in ((-1, 'L'), (1, 'R')):
    y = side*.49
    lamp = empty('lamp'+suffix, (.94, y, 3.54), root)
    box('lamp_case', (.94, y, 3.79), (.37, .82, .66), S, .055, lamp)
    box('lamp_recess', (1.134, y, 3.79), (.025, .72, .56), D, .025, lamp)
    # Four raised bezel bars around a recessed luminous matrix.
    for yy in (-.374, .374):
        box('lamp_bezel_vertical', (1.164, y+yy, 3.79), (.07, .072, .59), Y, .018, lamp)
    for zz in (-.291, .291):
        box('lamp_bezel_horizontal', (1.164, y, 3.79+zz), (.07, .72, .072), Y, .018, lamp)
    box('lamp_reflector', (1.153, y, 3.79), (.018, .61, .45), Y, .012, lamp)
    rows = 3 if side == -1 else 5
    for row in range(rows):
        for col in range(4):
            z = 3.61+row*.09
            box('LED_cell', (1.169, y+(col-1.5)*.145, z), (.016, .126, .074), E, 0, lamp)
    for yy in (-.35, .35):
        for zz in (-.27, .27):
            bolt((1.205, y+yy, 3.79+zz), 'X', lamp, .012)
        rod('lamp_yoke', (.94, y+yy, 3.48), (.94, y+yy, 3.77), .023, S)
        cylinder('lamp_pivot', (.94, y+yy, 3.54), .045, .04, D, 'Y', vertices=12)
    anchor = empty('light:flood_'+suffix, parent=lamp)
    anchor.location = (.236, 0, .25)
    anchor.rotation_euler = Vector((1, 0, -.50)).to_track_quat('-Z', 'Y').to_euler()
    anchor['ss_light'] = {'type': 'spot', 'color': 'light_led_white', 'intensity': 6,
        'range': 24, 'angle': 48, 'penumbra': .35, 'pool': True, 'beam': 'soft',
        'flare': True, 'reflect': True, 'shadow': 'hero', 'heroPriority': 2,
        'flicker': 'none', 'animation': None, 'powerGroup': 'self', 'breakable': True,
        'emissiveNodes': ['lamp'+suffix+'_emi_windowGlow'], 'tiers': 'all'}

# Merge by material within each joint. Preserve global transforms and local pivots.
for (owner, mat), objects in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    o = objects[0]
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.join()
    o.name = ('body' if owner == root and mat == Y else
              ('static_' if owner == root else owner.name+'_') + mat.name)
    bpy.context.view_layer.update()
    o.parent = owner
    o.matrix_parent_inverse = owner.matrix_world.inverted()
# Joint hierarchy: raising the mast carries the bar and both aimed lamp heads.
for child, parent in ((bar, mast), (bpy.data.objects['lampL'], bar),
                      (bpy.data.objects['lampR'], bar)):
    bpy.context.view_layer.update()
    rest = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = rest
# Pivoted lamp aiming produces the reference's asymmetric angled housings.
for suffix, yaw in (('L', -5), ('R', 23)):
    lamp = bpy.data.objects['lamp'+suffix]
    lamp.rotation_euler = (0, math.radians(-9), math.radians(yaw))

collider = empty('col:cabinet', (0, 0, 1.10), root)
collider['collider'] = 'cuboid'
collider['shape'] = 'cuboid'
collider['size'] = [2.4, 1.62, 1.50]
pole_collider = empty('col:mast', (.94, 0, 2.72), root)
pole_collider['collider'] = 'cylinder'
pole_collider['shape'] = 'cylinder'
pole_collider['radius'] = .13
pole_collider['height'] = 1.84
head_collider = empty('col:lamps', (.94, 0, 3.79), root)
head_collider['collider'] = 'cuboid'
head_collider['shape'] = 'cuboid'
head_collider['size'] = [.62, 1.74, .72]
bpy.context.view_layer.update()
root.location.z = -min((o.matrix_world @ v.co).z
                       for o in scene.objects if o.type == 'MESH'
                       for v in o.data.vertices)
bpy.context.view_layer.update()
asset = list(scene.objects)
meshes = [o for o in asset if o.type == 'MESH']
# Cycles AO goes into the named vertex color attribute, with a fixed seed.
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 32
scene.cycles.seed = 0
scene.render.bake.target = 'VERTEX_COLORS'
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
    o.data.color_attributes.active_color = o.data.color_attributes['ao']
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.bake(type='AO')
for o in meshes:
    # Palette-only assets need no UVs; discard Blender's unused primitive maps.
    for uv in list(o.data.uv_layers):
        o.data.uv_layers.remove(uv)
print('AO OK')
triangles = sum(len(poly.vertices)-2 for o in meshes for poly in o.data.polygons)
draw_calls = sum(len(o.data.materials) for o in meshes)
metrics = {'triangles': triangles, 'draw_calls': draw_calls,
           'materials': sorted({m.name for o in meshes for m in o.data.materials}),
           'nodes': sorted(o.name for o in asset)}
(HERE/'metrics.json').write_text(json.dumps(metrics, indent=2)+'\n')
print('BUILD OK', triangles, 'triangles;', draw_calls, 'draw calls')
if a.glb:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()), export_format='GLB',
        use_selection=True, export_apply=True, export_yup=True, export_extras=True,
        export_cameras=False, export_lights=False)
    print('GLB OK')

if a.render:
    # Presentation geometry is added after export and never enters the GLB.
    floor = material('stage', 'b9a4a0')
    box('stage', (0, 0, -.075), (200, 200, .15), floor, 0)
    world = bpy.data.worlds.new('Studio')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.33, .31, .36, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = .55
    for loc, power, size, color in (((4,-5,8),1000,5,(1,.90,.73)),
                                    ((-4,3,6),750,5,(.72,.81,1)),
                                    ((1,4,7),800,4,(1,.87,.67))):
        bpy.ops.object.light_add(type='AREA', location=loc)
        light = bpy.context.object
        light.data.energy, light.data.size, light.data.color = power, size, color
        light.rotation_euler = (Vector((0,0,2))-light.location).to_track_quat('-Z','Y').to_euler()
    target = Vector((0, 0, 2.02))
    camera_positions = {'ref': (8,11,7), 'game': (13,-13,15.4),
                        'front': (14,0,4), 'side': (0,-14,4), 'rear': (-12,-7,6)}
    bpy.ops.object.camera_add(location=camera_positions[a.view])
    cam = bpy.context.object
    scene.camera = cam
    cam.rotation_euler = (target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 8.8 if a.view != 'game' else 9.0
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = a.samples
    scene.cycles.use_denoising = True
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = 'GPU'
    except Exception:
        pass
    scene.render.resolution_x, scene.render.resolution_y = a.width, a.height
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'Khronos PBR Neutral'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(Path(a.render).resolve())
    bpy.ops.render.render(write_still=True)
    print('RENDER OK')
