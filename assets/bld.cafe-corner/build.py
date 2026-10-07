"""Sunset Grove Coffee. Deterministic hero building, +X front, Z up, metres.
Run only through experiment/tools/blender_run.py. Export + LODs are local to this asset.
"""
import argparse
import hashlib
import json
import math
import random
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/blender"))
from sslib.lod0 import stabilize_ao, prune_hidden_faces, prepare_export_lod

import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'tools/blender'))
from sslib import ao, palette

ASSET = {'id': 'bld.cafe-corner', 'category': 'building'}
parser = argparse.ArgumentParser()
parser.add_argument('--glb')
parser.add_argument('--lod',type=int,choices=[0,1,2],help='Export just this tier, preserving the other report entries')
parser.add_argument('--render')
parser.add_argument('--turntable', action='store_true')
parser.add_argument('--view', choices=['ref', 'game', 'front', 'side', 'rear', 'pose'], default='ref')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
REQUIRED = ['root', 'body', 'roof', 'interior', 'door_main', 'window_left', 'window_right', 'window_entry', 'entry', 'col:building']


def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.location = loc
    if parent:
        bpy.context.view_layer.update()
        matrix = o.matrix_world.copy()
        o.parent = parent
        o.matrix_world = matrix
    return o


def build(level=0):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.context.scene.cursor.location=(0,0,0)
    rng = random.Random(1206)
    high = level == 0
    mid = level == 1
    segments = 24 if high else 10 if mid else 6
    mats = {}
    cache = {}
    root = empty('root')
    root['asset_id'] = ASSET['id']
    root['forward'] = '+X'
    root['tier'] = 'hero'
    root['lods'] = json.dumps({'LOD0': 'model.glb', 'LOD1': 'model.lod1.glb', 'LOD2': 'model.lod2.glb'})
    body = empty('body', parent=root)
    roof = empty('roof', parent=root)
    inside = empty('interior', parent=root)
    door = empty('door_main', (2.245, -.55, .26), root)
    windows = {n: empty('window_' + n, parent=root) for n in ['left', 'right', 'entry']}
    for o in windows.values():
        o['emissive'] = True
    empty('entry', (3.05, 0, .27), root)['interaction'] = 'cafe_enter'
    col = empty('col:building', (0, 0, 1.74), root)
    col['collider'] = 'cuboid'
    col['size'] = [4.4, 8.0, 2.96]

    def material(token):
        if token not in mats:
            emissive = token.startswith('emi_')
            m = palette.mat(token[4:] if emissive else token, emissive=emissive)
            m.use_backface_culling = True
            m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .7
            if emissive:
                m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = .55 if token == 'emi_windowGlow' else 3
            mats[token] = m
        return mats[token]

    def finish(o, name, token, parent, bevel=0):
        o.name = name
        if not o.data.materials:
            o.data.materials.append(material(token))
        if bevel >= .02 and high:
            bpy.context.view_layer.objects.active = o
            mod = o.modifiers.new('soft bevel', 'BEVEL')
            mod.width = bevel
            mod.segments = 2 if bevel >= .06 else 1
            bpy.ops.object.modifier_apply(modifier=mod.name)
            mod = o.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
            bpy.ops.object.modifier_apply(modifier=mod.name)
        basis = o.matrix_basis.copy()
        o.parent = parent
        o.matrix_parent_inverse = parent.matrix_world.inverted()
        o.matrix_basis = basis
        return o

    def box(name, loc, size, token='brick', parent=body, bevel=.025, rot=None):
        bevel = min(bevel, min(size) * .25) if high else 0
        key = (tuple(size), token, bevel)
        if key not in cache:
            bpy.ops.mesh.primitive_cube_add(size=1)
            o = bpy.context.object
            o.dimensions = size
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            finish(o, name, token, parent, bevel)
            cache[key] = o.data
        else:
            o = bpy.data.objects.new(name, cache[key])
            bpy.context.collection.objects.link(o)
            o.parent = parent
            o.matrix_parent_inverse = parent.matrix_world.inverted()
        o.location = loc
        if rot:
            o.rotation_euler = rot
        return o

    def cyl(name, loc, radius, depth, token, parent=body, axis='z', n=None):
        n = n or (12 if high and radius <= .065 else segments)
        key=('cylinder',radius,depth,token,n)
        if key not in cache:
            bpy.ops.mesh.primitive_cylinder_add(vertices=n or segments,radius=radius,depth=depth)
            o=bpy.context.object
            finish(o,name,token,parent,.008)
            cache[key]=o.data
        else:
            o=bpy.data.objects.new(name,cache[key])
            bpy.context.collection.objects.link(o)
            o.parent=parent
            o.matrix_parent_inverse=parent.matrix_world.inverted()
        o.location=loc
        if axis=='x':
            o.rotation_euler.y=math.pi/2
        elif axis=='y':
            o.rotation_euler.x=math.pi/2
        return o

    def tube(name, points, radius, token, parent=body, closed=False):
        # Direct tube mesh avoids a dependency-graph rebuild for each leaf stem.
        pts=[]
        for p in points:
            q=Vector(p)
            if not pts or (q-pts[-1]).length>1e-6:
                pts.append(q)
        sides=(8 if radius <= .025 else 12) if high else 4
        vertices=[]
        for j,p in enumerate(pts):
            before=pts[(j-1)%len(pts)] if closed or j else p
            after=pts[(j+1)%len(pts)] if closed or j<len(pts)-1 else p
            tangent=(after-before).normalized()
            axis=Vector((0,0,1)) if abs(tangent.z)<.95 else Vector((0,1,0))
            u=tangent.cross(axis).normalized()
            v=tangent.cross(u).normalized()
            vertices.extend(tuple(p+radius*(u*math.cos(k*math.tau/sides)+v*math.sin(k*math.tau/sides))) for k in range(sides))
        faces=[]
        for j in range(len(pts) if closed else len(pts)-1):
            a=j*sides
            b=((j+1)%len(pts))*sides
            for k in range(sides):
                kk=(k+1)%sides
                faces.append((a+k,a+kk,b+kk,b+k))
        if not closed:
            faces.extend([tuple(reversed(range(sides))),tuple((len(pts)-1)*sides+k for k in range(sides))])
        o=mesh(name,vertices,faces,token,parent)
        for polygon in o.data.polygons:
            polygon.use_smooth=len(polygon.vertices)==4
        return o

    def mesh(name, vertices, faces, token, parent=body, bevel=0):
        me = bpy.data.meshes.new(name)
        me.from_pydata(vertices, [], faces)
        me.update()
        o = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(o)
        return finish(o, name, token, parent, bevel)

    def ico(name, loc, radius, token):
        key=('ico',token)
        if key not in cache:
            bm=bmesh.new()
            bmesh.ops.create_icosphere(bm,subdivisions=0,radius=1)
            me=bpy.data.meshes.new(name)
            bm.to_mesh(me)
            bm.free()
            me.materials.append(material(token))
            cache[key]=me
        o=bpy.data.objects.new(name,cache[key])
        bpy.context.collection.objects.link(o)
        o.location=loc
        o.scale=(radius,)*3
        return finish(o,name,token,body)

    def text(word, loc, width, height, token, parent=body, script=False):
        bpy.ops.object.select_all(action='DESELECT')
        bpy.ops.object.text_add(location=loc, rotation=(math.pi/2, 0, math.pi/2))
        o = bpy.context.object
        font = '/System/Library/Fonts/Supplemental/' + ('Brush Script.ttf' if script else 'Arial Bold.ttf')
        o.data.font = bpy.data.fonts.load(font)
        o.data.body = word
        o.data.align_x = 'CENTER'
        o.data.align_y = 'CENTER'
        o.data.resolution_u = 3 if high else 1
        o.data.extrude = .006 if high else 0
        bpy.ops.object.convert(target='MESH')
        o = bpy.context.object
        xs = [v.co.x for v in o.data.vertices]
        ys = [v.co.y for v in o.data.vertices]
        for v in o.data.vertices:
            v.co.x = (v.co.x-(min(xs)+max(xs))/2)*width/(max(xs)-min(xs))
            v.co.y = (v.co.y-(min(ys)+max(ys))/2)*height/(max(ys)-min(ys))
        return finish(o, 'text_' + word, token, parent)

    # Continuous sidewalk and individually bevelled paving/curb units.
    box('lot', (.25, 0, .11), (6.5, 18, .22), 'asphalt', bevel=.07)
    if high:
        for x in [-2.62, -1.92, -1.22, -.52, .18, .88, 1.58, 2.28, 2.98]:
            for j in range(25):
                box('paver', (x, -8.64+j*.72, .245), (.685, .704, .07), 'sidewalk', bevel=.015)
        for j in range(30):
            box('curb', (3.44, -8.7+j*.6, .205), (.24, .585, .35), 'sidewalk')
    else:
        box('pavement', (.25, 0, .24), (6.45, 17.96, .07), 'sidewalk')
        box('curb', (3.44, 0, .205), (.24, 18, .35), 'sidewalk')
    for y in [-9.05, 9.05]:
        box('road_end', (2.4, y, .04), (4.0, .62, .08), 'asphalt')
        for x in [.95, 1.9, 2.85, 3.8]:
            box('crosswalk', (x, y, .085), (.52, .62, .009), 'picketWhite', bevel=0)

    # Shell around actual openings. Roof can be hidden to expose the cafe interior.
    box('back_wall', (-2.15, 0, 1.76), (.20, 8, 2.98))
    for y in [-3.9, 3.9]:
        box('end_wall', (0, y, 1.76), (4.2, .20, 2.98))
        box('end_plinth', (0, y, .55), (4.24, .24, .56), 'sidewalk')
    for y, width in [(-3.73, .55), (-1.35, .52), (1.35, .52), (3.73, .55)]:
        box('front_pier', (2.1, y, 1.76), (.22, width, 2.98))
        box('pier_plinth', (2.13, y, .57), (.28, width+.015, .60), 'sidewalk')
    box('front_header', (2.10, 0, 3.01), (.24, 8, .47))
    for y in [-2.55, 2.55]:
        box('window_base', (2.1, y, .56), (.24, 1.85, .59), 'sidewalk')
    # Staggered brick courses, proud 6 mm of the supporting wall.
    if high:
        for row in range(12):
            z = .88 + row*.19
            for j in range(18):
                y = -3.82 + j*.44 + (.22 if row%2 else 0)
                if y > 3.94 or (z<2.8 and (abs(y)<1.09 or 1.61<abs(y)<3.46)):
                    continue
                box('front_brick', (2.224, y, z), (.016, .416, .174), 'brick', bevel=.007)
            for y in [-4.011, 4.011]:
                for j in range(9):
                    x = -1.94+j*.45 + (.20 if row%2 else 0)
                    if x<2.01:
                        box('side_brick', (x, y, z), (.43, .018, .174), 'brick', bevel=.007)
    # Windows retain distinct emissive nodes. Deep backing and furniture silhouettes.
    for name, y in [('left', -2.55), ('right', 2.55)]:
        box('window_glow', (2.088, y, 1.86), (.032, 1.84, 1.82), 'emi_windowGlow', windows[name], bevel=0)
        for yy in [y-.96, y+.96, y]:
            box('window_mullion', (2.23, yy, 1.85), (.16, .065, 1.98), 'woodWarm')
        for z in [.90, 2.82]:
            box('window_rail', (2.235, y, z), (.16, 1.98, .085), 'woodWarm')
        box('window_sill', (2.26, y, .88), (.35, 2.09, .11), 'picketWhite')
        if high or mid:
            # Purposeful display objects in front of a warm back pane, never coplanar.
            box('display_counter', (2.15, y, 1.25), (.06, 1.7, .075), 'woodWarm')
            for yy in [y-.56, y+.29]:
                cyl('display_cup', (2.21, yy, 1.35), .067, .12, 'picketWhite', n=12)
                tube('cup_handle', [(2.21, yy+.06, 1.31), (2.21, yy+.12, 1.31), (2.21, yy+.12, 1.40), (2.21, yy+.06, 1.40)], .012, 'picketWhite')
                box('display_chair_back', (2.16, yy, 1.19), (.045, .24, .33), 'brick')
            for yy in [y-.48, y+.48]:
                cyl('pendant_stem', (2.16, yy, 2.62), .012, .27, 'uiDark', n=8)
                cyl('pendant_shade', (2.22, yy, 2.48), .10, .08, 'schoolBusYellow', n=12)
                cyl('pendant_lens', (2.22, yy, 2.433), .078, .018, 'emi_windowGlow', n=12)
    # Central entrance surround, transom and hinged leaf.
    for y in [-1.06, 1.06]:
        box('entry_jamb', (2.22, y, 1.73), (.21, .15, 2.90), 'asphalt')
    for z in [.32, 2.66, 2.94]:
        box('entry_crossbar', (2.22, 0, z), (.21, 2.15, .14), 'asphalt')
    for y in [-.79, .79]:
        box('sidelight', (2.15, y, 1.62), (.035, .38, 2.02), 'emi_windowGlow', windows['entry'], bevel=0)
        box('sidelight_mullion', (2.245, y, 1.10), (.085, .38, .06), 'asphalt')
    box('transom', (2.15, 0, 2.80), (.035, 1.96, .12), 'emi_windowGlow', windows['entry'], bevel=0)
    for y in [-.56, .56]:
        box('door_stile', (2.245, y, 1.45), (.10, .095, 2.22), 'asphalt', door)
    for z in [.39, .83, 2.50]:
        box('door_rail', (2.245, 0, z), (.10, 1.14, .085), 'asphalt', door)
    box('door_kickplate', (2.26, 0, .59), (.12, 1.03, .35), 'woodWarm', door)
    box('door_glass', (2.232, 0, 1.65), (.025, 1.0, 1.56), 'emi_windowGlow', door, bevel=0)
    # Counter shapes behind the door glass as in the warm concept.
    if high or mid:
        box('glass_counter_silhouette', (2.252, -.18, 1.20), (.035, .55, .22), 'woodWarm', door)
        for y in [-.30, .10]:
            box('glass_cafe_stool', (2.255, y, 1.0), (.035, .14, .27), 'brick', door)
    tube('door_pull', [(2.31, .37, 1.23), (2.38, .37, 1.23), (2.38, .37, 1.58), (2.31, .37, 1.58)], .023, 'brass', door)
    for z in ([.70, 2.21] if level<2 else []):
        cyl('door_hinge', (2.30, -.55, z), .028, .13, 'brass', door, n=12)
    box('threshold', (2.29, 0, .30), (.38, 1.18, .07), 'picketWhite')
    # OPEN sign and right-window slogan.
    box('open_board', (2.29, .80, 1.99), (.035, .48, .30), 'purple')
    tube('open_neon_border', [(2.315, .55, 1.83), (2.315, 1.05, 1.83), (2.315, 1.05, 2.15), (2.315, .55, 2.15)], .012, 'emi_lavender', closed=True)
    if high or mid:
        text('OPEN', (2.321, .80, 1.99), .41, .17, 'emi_lavender')
        box('slogan_panel', (2.235, 3.07, 1.92), (.05, .55, 1.67), 'canvasTan')
        for word, z in [('COFFEE', 2.54), ('PEOPLE', 2.32), ('COMMUNITY', 2.10), ('STRONGER', 1.88), ('TOMORROW', 1.66)]:
            text(word, (2.268, 3.07, z), .44, .14, 'uiDark')
    # Paired fabric awnings slope down away from wall.
    for y in [-2.55, 2.55]:
        for j in range(9):
            yy = y-.99+j*.2475
            token = 'survivorRed' if j%2 == 0 else 'picketWhite'
            box('awning_panel', (2.55, yy, 2.89), (.85, .243, .065), token, bevel=.012, rot=(0, .38, 0))
            box('awning_valance', (2.948, yy, 2.66), (.09, .243, .20), token, bevel=.04)
        if high or mid:
            for yy in [y-.95, y+.95]:
                tube('awning_bracket', [(2.23, yy, 2.55), (2.88, yy, 2.68), (2.23, yy, 3.03)], .025, 'uiDark')
    # Flat tar roof, segmented pale parapet, HVAC, exhaust and pipework.
    box('roof_slab', (0, 0, 3.27), (4.65, 8.40, .22), 'sidewalk', roof, .06)
    box('roof_tar', (0, 0, 3.40), (4.28, 8.02, .06), 'asphalt', roof)
    for y in [-4.10, 4.10]:
        box('side_parapet', (0, y, 3.59), (4.65, .23, .42), 'sidewalk', roof)
    for x in [-2.22, 2.22]:
        box('parapet', (x, 0, 3.59), (.25, 8.24, .42), 'sidewalk', roof)
    if high or mid:
        for y in [(-3.75+j*.75) for j in range(11)]:
            box('coping_block', (2.365, y, 3.60), (.045, .73, .36), 'picketWhite', roof, .009)
        for x in [-1.7, -.8, .1, 1.0]:
            box('roof_seam', (x, 0, 3.443), (.018, 7.6, .014), 'uiDark', roof, 0)
    box('hvac_foot', (-.8, -1.5, 3.52), (1.3, 1.55, .16), 'uiDark', roof)
    box('hvac', (-.8, -1.5, 3.93), (1.18, 1.44, .76), 'sidewalk', roof, .045)
    box('hvac_top', (-.8, -1.5, 4.34), (1.27, 1.52, .08), 'picketWhite', roof)
    box('hvac_recess', (-.187, -1.5, 3.94), (.035, 1.06, .54), 'uiDark', roof)
    if high or mid:
        for z in [3.73+j*.07 for j in range(7)]:
            box('hvac_louver', (-.154, -1.5, z), (.035, 1.00, .026), 'asphalt', roof, .003)
        for y in [-2.10, -.90]:
            for z in [3.67, 4.22]:
                cyl('hvac_screw', (-.162, y, z), .018, .014, 'uiDark', roof, 'x', 8)
        for y in [1.0, 2.7]:
            cyl('vent_pipe', (-1.15, y, 3.76), .11, .66, 'asphalt', roof)
            cyl('vent_hat', (-1.15, y, 4.09), .18, .08, 'sidewalk', roof)
        box('duct_box', (-.90, .20, 3.71), (.70, .85, .50), 'asphalt', roof)
        tube('roof_conduit', [(-.3, -1.5, 3.47), (-.3, 1, 3.47), (-1.15, 1, 3.47)], .025, 'uiDark', roof)
    # Hero scalloped sign: closed extrusion with outward-facing normals.
    outline = [(-1.57, 3.16), (1.57, 3.16), (1.57, 4.02), (1.31, 4.02), (1.31, 4.33)]
    for j in range(13 if high else 7):
        a = math.pi * j/(12 if high else 6)
        outline.append((.75*math.cos(a), 4.33+.40*math.sin(a)))
    outline += [(-1.31, 4.33), (-1.31, 4.02), (-1.57, 4.02)]
    n = len(outline)
    vertices = [(x, y, z) for x in [2.35, 2.52] for y, z in outline]
    faces = [tuple(range(n-1, -1, -1)), tuple(range(n, 2*n))]
    faces += [(j, (j+1)%n, (j+1)%n+n, j+n) for j in range(n)]
    mesh('coffee_sign', vertices, faces, 'uiDark', roof, .024)
    tube('neon_rim', [(2.557, y, z) for y, z in outline], .028, 'emi_survivorRed', roof, True)
    if high or mid:
        tube('gold_neon_rim', [(2.575, y*.977, 3.92+(z-3.92)*.965) for y, z in outline], .010, 'emi_windowGlow', roof, True)
        text('Sunset Grove', (2.584, 0, 3.93), 2.62, .36, 'windowGlow', roof, True)
        text('Coffee', (2.584, 0, 3.49), 1.68, .36, 'windowGlow', roof, True)
    else:
        text('COFFEE', (2.579, 0, 3.75), 2.0, .35, 'windowGlow', roof)
    # Cup pictogram with steam above the wordmark.
    mesh('cup_icon', [(2.587, -.24, 4.43), (2.587, .24, 4.43), (2.587, .15, 4.22), (2.587, -.12, 4.22)], [(3,2,1,0)], 'windowGlow', roof)
    tube('cup_handle_icon', [(2.593, -.23, 4.41), (2.593, -.35, 4.39), (2.593, -.33, 4.29), (2.593, -.18, 4.27)], .021, 'windowGlow', roof)
    tube('cup_saucer', [(2.593, -.24, 4.18), (2.593, .23, 4.18)], .014, 'windowGlow', roof)
    for y in ([-.12, 0, .12] if level<2 else []):
        tube('steam_icon', [(2.593, y, 4.47), (2.593, y-.025, 4.53), (2.593, y+.015, 4.59)], .012, 'windowGlow', roof)

    # Full walk-in interior, independent of roof/exterior visibility.
    box('cafe_floor', (0, 0, .31), (4.08, 7.75, .06), 'woodWarm', inside)
    if high or mid:
        for y in [-3.5, -2.8, -2.1, -1.4, -.7, 0, .7, 1.4, 2.1, 2.8, 3.5]:
            box('floor_seam', (0, y, .345), (3.99, .012, .008), 'asphalt', inside, 0)
        box('coffee_bar', (-1.25, 0, .87), (.80, 4.3, 1.05), 'backpackTeal', inside)
        box('bar_top', (-1.25, 0, 1.44), (.95, 4.45, .10), 'woodWarm', inside)
        box('coffee_machine', (-1.25, .90, 1.76), (.44, .65, .53), 'asphalt', inside)
        for y in [.70, 1.08]:
            cyl('coffee_dispenser', (-.96, y, 1.74), .045, .16, 'asphalt', inside, 'x', 10)
        box('pastry_display', (-1.25, -.90, 1.67), (.55, .85, .32), 'canvasTan', inside)
        for y in [-2.85, 2.85]:
            cyl('inside_table_stem', (.70, y, .69), .07, .65, 'uiDark', inside)
            cyl('inside_table', (.70, y, 1.04), .52, .09, 'woodWarm', inside)
            for yy in [y-.75, y+.75]:
                box('interior_seat', (.70, yy, .65), (.46, .44, .13), 'brick', inside)
                box('interior_backrest', (.70, yy+(.15 if yy>y else -.15), .97), (.46, .08, .49), 'brick', inside)
                for x in [.54, .86]:
                    for yyy in [yy-.14, yy+.14]:
                        cyl('interior_chair_leg', (x, yyy, .49), .026, .30, 'uiDark', inside, n=8)
        box('inside_menu', (-2.027, 0, 2.28), (.038, 2.0, .73), 'uiDark', inside)
        text('COFFEE  &  PASTRIES', (-1.998, 0, 2.39), 1.78, .17, 'picketWhite', inside)
        text('SUNSET GROVE', (-1.998, 0, 2.12), 1.50, .13, 'picketWhite', inside)
    # Rear service features finish the otherwise hidden facades.
    box('rear_service_door', (-2.265, 1.7, 1.42), (.065, .92, 2.28), 'backpackTeal')
    if high or mid:
        box('service_door_inset', (-2.306, 1.7, 1.52), (.025, .72, 1.72), 'asphalt')
        cyl('service_handle', (-2.347, 1.38, 1.44), .031, .14, 'brass', axis='y')
        tube('rear_downpipe', [(-2.31, -3.58, .31), (-2.31, -3.58, 3.67), (-2.19, -3.58, 3.74)], .044, 'asphalt')
        box('rear_vent', (-2.269, -.75, 1.74), (.055, .9, .63), 'uiDark')
        for z in [1.51+j*.09 for j in range(6)]:
            box('rear_vent_louver', (-2.31, -.75, z), (.04, .84, .033), 'sidewalk')

    # Patio furniture and eight-panel orange umbrella roofs.
    for y in [-5.40, 5.40]:
        cyl('patio_table_base', (1.45, y, .34), .29, .12, 'uiDark')
        cyl('patio_table_stem', (1.45, y, .74), .063, .76, 'uiDark')
        cyl('patio_tabletop', (1.45, y, 1.16), .55, .10, 'woodWarm')
        cyl('umbrella_pole', (1.45, y, 1.53), .033, 2.55, 'woodWarm')
        verts = [(1.45, y, 2.97)]
        for radius, z in [( .36, 2.91), (1.03, 2.62)]:
            verts += [(1.45+radius*math.cos(j*math.tau/8), y+radius*math.sin(j*math.tau/8), z) for j in range(8)]
        for j in range(8):
            k = (j+1)%8
            token = 'schoolBusYellow' if j%2 else 'orange'
            mesh('umbrella_sector', verts, [(0,j+1,k+1), (j+1,j+9,k+9,k+1)], token)
        # Backface culling remains ON: explicit underside, no double-sided material.
        mesh('umbrella_underside', verts, [(0,(j+1)%8+1,j+1) for j in range(8)]+[(j+1,(j+1)%8+1,(j+1)%8+9,j+9) for j in range(8)], 'woodWarm')
        cyl('umbrella_finial', (1.45, y, 3.005), .065, .08, 'woodWarm')
        if high or mid:
            for j in range(8):
                a = j*math.tau/8
                tube('umbrella_rib', [(1.45, y, 2.87), (1.45+.97*math.cos(a), y+.97*math.sin(a), 2.59)], .013, 'woodWarm')
        for yy in [y-.80, y+.80]:
            box('patio_seat', (1.53, yy, .70), (.51, .49, .09), 'woodWarm')
            backy = yy + (.20 if yy>y else -.20)
            for z in [.94, 1.18]:
                box('chair_back_slat', (1.53, backy, z), (.49, .07, .13), 'woodWarm')
            if level==2:
                box('distant_chair_support',(1.53,yy,.48),(.16,.16,.43),'uiDark')
                continue
            for x in [1.30, 1.76]:
                for yyy in [yy-.21, yy+.21]:
                    cyl('chair_leg', (x, yyy, .49), .026, .44, 'uiDark', n=8)
                tube('chair_frame', [(x, yy-.21, .72), (x, yy+.21, .72), (x, backy, 1.34)], .025, 'uiDark')
        if high:
            cyl('patio_cup', (1.61, y+.22, 1.28), .055, .12, 'picketWhite', n=12)
            cyl('patio_coffee', (1.61, y+.22, 1.346), .045, .007, 'uiDark', n=12)
    # Hollow wooden planter boxes with leafy/flowering masses.
    def foliage(x, y, z, radius, count, flowers=True):
        if level == 2:
            count = 1
        elif mid:
            count = max(4, count//5)
        for j in range(count):
            a = rng.uniform(0, math.tau)
            r = radius*math.sqrt(rng.random())
            loc = (x+r*math.cos(a), y+r*math.sin(a), z+rng.uniform(0, radius*.85))
            o = ico('leaf',loc,1,'foliage' if j%3 else 'foliageDark')
            o.scale = (.17, .14, .23) if high else (.30, .28, .32) if mid else (radius*.85, radius*.75, radius*.8)
            if level==2:
                o.scale.z=min(o.scale.z,max(.08,loc[2]-.29))
            tilt=(rng.uniform(-.6,.6),rng.uniform(-.6,.6))
            o.rotation_euler=(0,0,a) if level==2 else (*tilt,a)

            if flowers and high and j%6 == 0:
                xx, yy, zz = loc
                color = 'cardiganRose' if j%3 else 'picketWhite'
                for k in range(5):
                    a = k*math.tau/5
                    ico('petal',(xx+.055*math.cos(a), yy+.055*math.sin(a), zz+.18),.035,color)
                cyl('flower_core', (xx, yy, zz+.20), .027, .025, 'schoolBusYellow', n=8)
    for x, y, width in [(2.83,-1.37,.72), (2.83,1.37,.72), (2.78,-3.6,.78), (1.85,6.64,.92), (1.85,-6.64,.92)]:
        box('planter_bottom', (x,y,.36), (.58,width,.15), 'woodWarm')
        for xx in [x-.28,x+.28]:
            box('planter_wall', (xx,y,.57), (.09,width,.48), 'woodWarm')
        for yy in [y-width/2,y+width/2]:
            box('planter_end', (x,yy,.57), (.63,.09,.48), 'woodWarm')
        box('planter_soil', (x,y,.79), (.45,width-.10,.045), 'uiDark')
        if high or mid:
            for z in [.43,.59,.75]:
                box('planter_front_slat', (x+.33,y,z), (.07,width+.09,.13), 'woodWarm')
            for yy in [y-width*.38,y+width*.38]:
                box('planter_strap', (x+.374,yy,.59), (.02,.045,.45), 'brass')
        foliage(x,y,.82,.40,24)
    for y in [-7.75,7.75,-6.4,6.4,-4.8,4.8]:
        foliage(-.25,y,.39,.68,30)
        foliage(-1.3,y,.49,.78,32)
        foliage(-1.75,y,1.02,.80,28)
        foliage(-1.83,y,1.72,.74,28)
        if abs(y)<6.5:
            foliage(-1.88,y,2.42,.65,18)
    # Hanging ivy at upper left of the storefront.
    if high or mid:
        for z in [1.02+j*.30 for j in range(9)]:
            foliage(2.31,-1.39,z,.17,7,False)
    # Small curb weeds (seeded and kept away from the entrance).
    if high:
        for j in range(32):
            y = -8.45+j*.54
            for k in range(3):
                tube('weed', [(3.54,y,.16), (3.56+.12*math.sin(k*2),y+.12*math.cos(k*2),.30+rng.random()*.10)], .012, 'foliageDark')
    # Chalkboard with angled A-frame and raised lettering.
    box('chalkboard_frame', (3.02,-2.03,1.04), (.12,.89,1.46), 'woodWarm', bevel=.035)
    box('chalkboard_face', (3.091,-2.03,1.04), (.024,.74,1.30), 'uiDark')
    if high or mid:
        for yy in [-2.42,-1.64]:
            tube('chalkboard_rear_leg', [(2.61,yy,.28),(3.0,yy,1.77)], .040, 'woodWarm')
        for word,z,width in [('Good',1.56,.54),('Coffee',1.26,.63),('Brighter',.95,.64),('Days',.67,.47)]:
            text(word,(3.113,-2.03,z),width,.19,'picketWhite',script=True)
    # Three inverted U bicycle hoops in front of right window.
    for y in [-2.94,-2.46,-1.98]:
        pts = [(2.98,y-.15,.30),(2.98,y-.15,.80)]
        for j in range(9 if high else 5):
            a = math.pi-math.pi*j/(8 if high else 4)
            pts.append((2.98,y+.15*math.cos(a),.80+.15*math.sin(a)))
        pts.append((2.98,y+.15,.30))
        tube('bike_hoop',pts,.039,'asphalt')
        for yy in [y-.15,y+.15]:
            box('rack_foot',(2.98,yy,.31),(.15,.15,.06),'sidewalk')
    # Street lanterns and small wall lamps, all single-sided glass volumes.
    def lantern(x,y,z,small=False):
        r = .10 if small else .19
        h = .26 if small else .48
        cyl('lantern_foot',(x,y,z-h*.58),r*1.04,.045,'brass' if small else 'uiDark',n=8)
        bpy.ops.mesh.primitive_cone_add(vertices=4,radius1=r,radius2=r*.72,depth=h,location=(x,y,z),rotation=(0,0,math.pi/4))
        finish(bpy.context.object,'lantern_glass','emi_windowGlow',body)
        for a in ([math.pi/4+k*math.pi/2 for k in range(4)] if level<2 else []):
            tube('lantern_frame',[(x+r*math.cos(a),y+r*math.sin(a),z-h/2),(x+r*.72*math.cos(a),y+r*.72*math.sin(a),z+h/2)],.012 if small else .021,'uiDark')
        bpy.ops.mesh.primitive_cone_add(vertices=4,radius1=r*1.33,radius2=.025,depth=r*.70,location=(x,y,z+h/2+r*.35),rotation=(0,0,math.pi/4))
        finish(bpy.context.object,'lantern_roof','uiDark',body)
        cyl('lantern_finial',(x,y,z+h/2+r*.80),r*.14,r*.32,'brass',n=8)
    for y in [-7.31,7.31]:
        box('lamp_foot',(1.85,y,.40),(.45,.45,.26),'uiDark')
        box('lamp_plinth',(1.85,y,.69),(.29,.29,.36),'asphalt')
        cyl('lamp_pole',(1.85,y,1.91),.061,2.15,'uiDark')
        for z in [.88,2.58,2.94]:
            cyl('lamp_collar',(1.85,y,z),.105,.10,'brass')
        lantern(1.85,y,3.22)
    for y in [-1.36,1.36]:
        tube('wall_lamp_arm',[(2.23,y,2.33),(2.43,y,2.33),(2.43,y,2.47)],.024,'uiDark')
        lantern(2.43,y,2.43,True)
    # Corner signs, hydrant and trash bin.
    cyl('street_sign_pole',(1.87,8.15,1.82),.045,3.04,'uiDark')
    for word,y,z,w in [('Main St',8.20,3.03,.77),('Pine Ave',8.20,2.68,.85)]:
        box('street_sign_frame',(1.92,y,z),(.065,w,.30),'picketWhite')
        box('street_sign_panel',(1.960,y,z),(.025,w-.035,.26),'backpackTeal')
        if high or mid:
            text(word,(1.980,y,z),w-.09,.16,'picketWhite')
    cyl('hydrant_base',(2.54,7.78,.34),.19,.13,'survivorRed')
    cyl('hydrant_body',(2.54,7.78,.65),.12,.55,'survivorRed')
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=8 if high else 4,radius=.135,location=(2.54,7.78,.94))
    finish(bpy.context.object,'hydrant_cap','survivorRed',body)
    cyl('hydrant_top',(2.54,7.78,1.09),.045,.10,'brass',n=8)
    for y in [7.95,7.61]:
        cyl('hydrant_outlet',(2.54,y,.72),.082,.13,'survivorRed',axis='y')
    cyl('hydrant_front_cap',(2.681,7.78,.70),.073,.08,'survivorRed',axis='x')
    if high:
        tube('hydrant_chain',[(2.71,7.78,.70),(2.72,7.84,.51),(2.56,7.96,.64)],.009,'brass')
    cyl('bin_body',(2.60,8.53,.73),.26,.86,'asphalt')
    cyl('bin_rim',(2.60,8.53,1.15),.29,.075,'uiDark')
    cyl('bin_lid',(2.60,8.53,1.20),.27,.065,'asphalt')
    box('bin_slot',(2.891,8.53,1.12),(.018,.20,.07),'uiDark')
    if high or mid:
        for j in range(12):
            a = j*math.tau/12
            cyl('bin_rib',(2.60+.265*math.cos(a),8.53+.265*math.sin(a),.73),.015,.79,'uiDark',n=6)

    if high:
        prune_hidden_faces([o for o in bpy.context.scene.objects if o.type == "MESH"], occlusion=True, game_camera=True, defer=True)
    # Merge by shared material inside each visibility/joint assembly.
    groups = [body,roof,inside,door,*windows.values()]
    for parent in groups:
        materials = sorted({o.data.materials[0] for o in list(parent.children) if o.type == 'MESH'},key=lambda m:m.name)
        for m in materials:
            obs = [o for o in list(parent.children) if o.type == 'MESH' and o.data.materials[0] == m]
            bpy.ops.object.select_all(action='DESELECT')
            for o in obs:
                if o.data.users>1:
                    o.data=o.data.copy()
                o.select_set(True)
            bpy.context.view_layer.objects.active = obs[0]
            bpy.ops.object.join()
            o = obs[0]
            o.name = parent.name+'_'+m.name
            bpy.context.scene.cursor.location = parent.matrix_world.translation
            bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
            if o.data.users>1:
                o.data=o.data.copy()
            bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
            # Sign/canopy faces explicitly wind outward for single-sided drawing.
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    initial_triangles=0
    for o in meshes:
        o.data.calc_loop_triangles()
        initial_triangles+=len(o.data.loop_triangles)
    target=96000 if level==0 else 12500 if level==1 else 3000
    if initial_triangles>target:
        for o in meshes:
            if len(o.data.loop_triangles)<128:
                continue
            bpy.context.view_layer.objects.active=o
            mod=o.modifiers.new('tier triangle budget','DECIMATE')
            mod.ratio=target/initial_triangles
            bpy.ops.object.modifier_apply(modifier=mod.name)
    for name, loc, emission_nodes in [
        ('windows',(2.4,0,1.9),['window_left','window_right','window_entry','door_main']),
        ('sign',(2.57,0,3.95),['roof']),
        ('lanterns',(1.85,0,3.22),['body']),
    ]:
        a = empty('light:'+name,loc,root)
        a['ss_light'] = json.dumps({'type':'window' if name=='windows' else 'neon' if name=='sign' else 'point','color':'light_window_warm','intensity':1.8,'range':5,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':1,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':[o.name for o in meshes if o.parent.name in emission_nodes and o.data.materials[0].name.startswith('emi_')],'tiers':'all'})
    bpy.context.view_layer.update()
    points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    # Preserve the original authored hinge/socket frame when bevel bounds change.
    center = [.69870162, 0]
    for child in root.children:
        child.location.x -= center[0]
        child.location.y -= center[1]
    bpy.context.view_layer.update()
    for o in meshes:
        o.data.calc_loop_triangles()
    triangles = sum(len(o.data.loop_triangles) for o in meshes)
    h = hashlib.sha256()
    for o in sorted(meshes,key=lambda o:o.name):
        h.update(o.name.encode())
        coordinates=[tuple(round(float(x),5) for x in v.co) for v in o.data.vertices]
        h.update(str(sorted(coordinates)).encode())
        faces=sorted(tuple(sorted(coordinates[i] for i in face.vertices)) for face in o.data.polygons)
        h.update(str(faces).encode())
    return {'id':ASSET['id'],'level':level,'triangles':triangles,'draw_calls':len(meshes),'nodes_ok':all(bpy.data.objects.get(n) is not None for n in REQUIRED),'missing_nodes':[n for n in REQUIRED if bpy.data.objects.get(n) is None],'geometry_hash':h.hexdigest()}, meshes


def render():
    scene = bpy.context.scene
    # Review images use Eevee; palette materials cull back faces.
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = args.samples
    world = bpy.data.worlds.new('studio')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.19,.17,.23,1)
    world.node_tree.nodes['Background'].inputs[1].default_value = .48
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02))
    m = bpy.data.materials.new('studio_ground')
    m.diffuse_color = (.031,.027,.038,1)
    m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = m.diffuse_color
    bpy.context.object.data.materials.append(m)
    for loc,energy,size,color in [((7,-7,12),2300,8,(1,.75,.52)),((-5,3,9),1700,7,(.66,.73,1)),((0,9,8),1400,6,(1,.44,.22))]:
        bpy.ops.object.light_add(type='AREA',location=loc)
        o = bpy.context.object
        o.data.energy = energy
        o.data.size = size
        o.data.color = color
        o.rotation_euler = (Vector((0,0,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
    for y in [-2.55,0,2.55]:
        bpy.ops.object.light_add(type='POINT',location=(2.0,y,1.9))
        bpy.context.object.data.energy=50
        bpy.context.object.data.color=(1,.48,.17)
        bpy.context.object.data.shadow_soft_size=.7
    bpy.ops.object.camera_add()
    cam = bpy.context.object
    scene.camera = cam
    views={'ref':(26,-2.0,7.4),'game':(22,-22,26),'front':(26,0,5),'side':(0,-24,9),'rear':(-22,15,13),'pose':(22,-13,18)}
    target = Vector((0,0,1.9))
    cam.location = views[args.view]
    cam.rotation_euler = (target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'
    cam.data.ortho_scale = 21.2
    if args.view=='pose':
        for child in bpy.data.objects['roof'].children:
            child.hide_render = True
        bpy.data.objects['door_main'].rotation_euler.z = -math.pi*.40
    scene.render.resolution_x=args.width
    scene.render.resolution_y=args.height
    scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(Path(args.render).resolve())
    bpy.ops.render.render(write_still=True)
    print('RENDER OK',args.view,flush=True)
    if args.turntable:
        folder=Path(args.render).resolve().parent
        for view in ['front','side','rear','game','pose']:
            cam.location=views[view]
            cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
            cam.data.ortho_scale=21.2
            if view=='pose':
                for child in bpy.data.objects['roof'].children:
                    child.hide_render=True
                bpy.data.objects['door_main'].rotation_euler.z=-math.pi*.40
            scene.render.resolution_x=960
            scene.render.resolution_y=540
            scene.eevee.taa_render_samples=24
            scene.render.filepath=str(folder/('pose-test.png' if view=='pose' else view+'.png'))
            bpy.ops.render.render(write_still=True)
            print('RENDER OK',view,flush=True)
        for child in bpy.data.objects['roof'].children:
            child.hide_render=False
        bpy.data.objects['door_main'].rotation_euler.z=0
        cam.location=views['ref']
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.ortho_scale=21.2
        world.node_tree.nodes['Background'].inputs[1].default_value=.10
        for o in bpy.context.scene.objects:
            if o.type=='LIGHT' and o.data.type=='AREA':
                o.data.energy *= .18
        scene.render.filepath=str(folder/'night.png')
        bpy.ops.render.render(write_still=True)
        print('RENDER OK night',flush=True)


if args.glb:
    previous=json.loads((HERE/'report.json').read_text()) if args.lod is not None and (HERE/'report.json').exists() else {}
    reports=previous.get('lods',{})
    path=Path(args.glb).resolve()
    for level in ([args.lod] if args.lod is not None else [0,1,2]):
        report,meshes=build(level)
        ao.bake_all(meshes,samples=32)
        bpy.ops.object.select_all(action='SELECT')
        output=path if level==0 else path.with_name(path.stem+'.lod'+str(level)+path.suffix)
        stabilize_ao(list(bpy.context.scene.objects)); prepare_export_lod(list(bpy.context.scene.objects), str(output)); bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
        reports['lod'+str(level)]=report
        print('BUILD OK',level,report['triangles'],'triangles',report['draw_calls'],'draw calls')
    (HERE/'report.json').write_text(json.dumps({**previous,'id':ASSET['id'],'tier':'hero','lods':reports,'renderer':'Eevee','backface_culling':True,'webgl2_ok':False,'webgpu_ok':False},indent=2)+'\n')
if args.render:
    preview_report, _ = build(0)
    print('BUILD OK preview', preview_report, flush=True)
    if (HERE/'report.json').exists():
        report=json.loads((HERE/'report.json').read_text())
        report['deterministic_rebuild']=preview_report['geometry_hash']==report['lods']['lod0']['geometry_hash']
        (HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
        assert report['deterministic_rebuild'], 'Source geometry differs from exported build'
        print('REBUILD OK',flush=True)
    render()
