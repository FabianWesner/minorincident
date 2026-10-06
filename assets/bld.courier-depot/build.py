"""Sunset Parcel Co. courier depot: reproducible hero building and authored LODs.
Metres, +X front, Z up. Run only with experiment/tools/blender_run.py.
--glb writes model.glb and model.lod1/2.glb; --render runs an Eevee studio.
"""
import argparse
import hashlib
import json
import math
import random
import struct
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib import ao, palette

ASSET = {'id': 'bld.courier-depot', 'category': 'building'}
SCRIPT_HASH = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
REQUIRED = ['root', 'body', 'roof', 'interior', 'door_main', 'parcel_counter',
            'window_display', 'window_entry', 'window_side', 'entry']
parser = argparse.ArgumentParser()
parser.add_argument('--glb')
parser.add_argument('--render')
parser.add_argument('--view', default='ref', choices=['ref', 'game', 'front', 'side', 'rear', 'pose'])
parser.add_argument('--lod', type=int, default=0, choices=[0, 1, 2])
parser.add_argument('--turntable', action='store_true')
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--samples', type=int, default=24)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
FACE = Matrix(((0, 0, 1), (1, 0, 0), (0, 1, 0))).to_quaternion()


def build(lod=0):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    rng = random.Random(1202)
    high, mid = lod == 0, lod == 1
    meshes, mats, cache = [], {}, {}

    def empty(name, p=(0, 0, 0), parent=None, **extras):
        o = bpy.data.objects.new(name, None)
        scene.collection.objects.link(o)
        o.location = p
        if parent:
            bpy.context.view_layer.update()
            world = o.matrix_world.copy()
            o.parent = parent
            o.matrix_world = world
        for k, v in extras.items():
            o[k] = v
        bpy.context.view_layer.update()
        return o

    root = empty('root', asset_id=ASSET['id'], forward='+X', tier='Hero')
    body = empty('body', parent=root)
    roof = empty('roof', parent=root, hide_when_inside=True)
    interior = empty('interior', parent=root)
    door = empty('door_main', (1.27, 1.35, .26), root,
                 animation='hinge', axis='Z', pivot_description='right vertical jamb')
    windows = {name: empty(name, parent=root) for name in ['window_display', 'window_entry', 'window_side']}
    windows['window_entry'].parent = door
    windows['window_entry'].matrix_parent_inverse = door.matrix_world.inverted()
    counter = empty('parcel_counter', (.68, .62, 1.30), root,
                    interaction='parcel_pickup', radius=.85, facing='+X')
    empty('entry', (1.97, .68, .28), root, interaction='courier_depot_enter')
    empty('front', (1.8, 0, 2), root, front=True)

    def material(token):
        if token not in mats:
            if token == 'keep_glass':
                m = bpy.data.materials.new(token)
                m.use_nodes = True
                b = m.node_tree.nodes['Principled BSDF']
                b.inputs['Base Color'].default_value = (.62, .77, .80, .12)
                b.inputs['Alpha'].default_value = .12
                b.inputs['Roughness'].default_value = .15
                b.inputs['IOR'].default_value = 1.45
                m.diffuse_color = (.62, .77, .80, .12)
                m.surface_render_method = 'BLENDED' if 'BLENDED' in m.bl_rna.properties['surface_render_method'].enum_items.keys() else 'DITHERED'
            else:
                emissive = token.startswith('emi_')
                m = palette.mat(token[4:] if emissive else token, emissive=emissive)
                b = m.node_tree.nodes['Principled BSDF']
                b.inputs['Roughness'].default_value = .65
                if token in ['silver', 'uiDark']:
                    b.inputs['Metallic'].default_value = .25
                if emissive:
                    b.inputs['Emission Strength'].default_value = 1.3
            m.use_backface_culling = True
            mats[token] = m
        return mats[token]

    def finish(o, token, parent, bevel=0):
        o.data.materials.append(material(token))
        if bevel and (high or mid):
            mod = o.modifiers.new('Soft miniature edges', 'BEVEL')
            mod.width = bevel
            mod.segments = 2 if high else 1
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=mod.name)
            mod = o.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
            bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.context.view_layer.update()
        world = o.matrix_world.copy()
        o.parent = parent
        o.matrix_world = world
        meshes.append(o)
        return o

    def box(name, p, size, token='picketWhite', parent=body, bevel=.025, rot=None):
        bevel = min(bevel, min(size) * .28) if high or (mid and bevel >= .012) else 0
        key = ('box', tuple(size), token, bevel)
        if key not in cache:
            bpy.ops.mesh.primitive_cube_add(size=1, location=p)
            o = bpy.context.object
            o.dimensions = size
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            finish(o, token, parent, bevel)
            cache[key] = o.data
        else:
            o = bpy.data.objects.new(name, cache[key])
            scene.collection.objects.link(o)
            o.location = p
            bpy.context.view_layer.update()
            world = o.matrix_world.copy()
            o.parent = parent
            o.matrix_world = world
            meshes.append(o)
        o.name = name
        if rot:
            o.rotation_euler = rot
        return o

    def mesh(name, vs, fs, token, parent=body, bevel=0):
        data = bpy.data.meshes.new(name)
        data.from_pydata(vs, [], fs)
        data.update()
        o = bpy.data.objects.new(name, data)
        scene.collection.objects.link(o)
        return finish(o, token, parent, bevel)

    def cylinder(name, p, r, depth, token, parent=body, r2=None, n=None):
        n = n or (24 if high else 8 if mid else 6)
        bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r, radius2=r if r2 is None else r2,
                                       depth=depth, location=p)
        o = bpy.context.object
        o.name = name
        return finish(o, token, parent, .009 if high else 0)

    def rod(name, a, b, r, token, parent=body, n=None):
        a, b = Vector(a), Vector(b)
        o = cylinder(name, (a+b)/2, r, (b-a).length, token, parent, n=n)
        o.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
        return o

    def curve(name, points, r, token, parent=body):
        c = bpy.data.curves.new(name, 'CURVE')
        c.dimensions = '3D'
        c.bevel_depth = r
        c.bevel_resolution = 2 if high else 0
        sp = c.splines.new('POLY')
        sp.points.add(len(points)-1)
        for v, p in zip(sp.points, points):
            v.co = (*p, 1)
        o = bpy.data.objects.new(name, c)
        scene.collection.objects.link(o)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.ops.object.convert(target='MESH')
        return finish(o, token, parent)

    def sphere(name, p, size, token, parent=body):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12 if high else 6,
                                           ring_count=6 if high else 3, location=p)
        o = bpy.context.object
        o.name = name
        o.scale = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        for f in o.data.polygons:
            f.use_smooth = True
        return finish(o, token, parent)

    def text(name, label, p, width, height, token='picketWhite', parent=body):
        c = bpy.data.curves.new(name, 'FONT')
        c.body = label
        c.align_x = 'CENTER'
        c.align_y = 'CENTER'
        c.size = 1
        c.extrude = .003
        c.offset = .002
        c.resolution_u = 2
        o = bpy.data.objects.new(name, c)
        scene.collection.objects.link(o)
        bpy.context.view_layer.update()
        scale = min(width / max(.001, o.dimensions.x), height / max(.001, o.dimensions.y))
        o.scale = (scale, scale, scale)
        o.rotation_mode = 'QUATERNION'
        o.rotation_quaternion = FACE
        o.location = p
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.ops.object.convert(target='MESH')
        return finish(o, token, parent)

    def profile(name, poly, x, thick, token, parent=body):
        area = sum(a*d-b*c for (a,b),(c,d) in zip(poly, poly[1:]+poly[:1]))
        if area < 0:
            poly = list(reversed(poly))
        count = len(poly)
        vs = [(xx,y,z) for xx in (x-thick/2,x+thick/2) for y,z in poly]
        fs = [tuple(reversed(range(count))), tuple(range(count,2*count))]
        fs += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
        return mesh(name,vs,fs,token,parent,.008)

    def parcel(p, size, parent=interior, detailed=True):
        x,y,z = p
        w,d,h = size
        box('Cardboard parcel', p, size, 'woodWarm', parent, .018)
        if lod < 2 and detailed:
            box('Parcel sealing tape', (x,y,z+h/2+.006), (w*.96,.07,.012), 'canvasTan', parent, .002)
            box('Parcel tape front', (x+w/2+.006,y,z), (.012,.07,h*.94), 'canvasTan', parent, .002)
            box('Parcel address label', (x+w/2+.015,y-d*.20,z+h*.10), (.012,d*.35,h*.25), 'picketWhite', parent, .003)
            if high:
                for j in range(3):
                    box('Parcel label print', (x+w/2+.024,y-d*.20,z+h*.13-j*h*.05), (.006,d*.24,.008), 'uiDark', parent, 0)
                box('Box top seam', (x,y,z+h/2+.015), (w*.88,.009,.008), 'leatherShadow', parent, 0)

    # Raised tiled sidewalk/base: bottom at zero, shop floor at 0.26m.
    box('Foundation', (.35,0,.09), (4.55,5.0,.18), 'sidewalk', bevel=.055)
    if high:
        for ix in range(5):
            for iy in range(8):
                x,y=-1.46+ix*.9,-2.18+iy*.625
                if x<1.2 and abs(y)<2.08:
                    continue
                box('Sidewalk slab',(x,y,.21),(.876,.598,.12),'sidewalk',bevel=.025)
    else:
        box('Sidewalk top',(.35,0,.22),(4.55,5.0,.08),'sidewalk',bevel=0)
    box('Interior floor',(-.15,0,.27),(2.65,4.26,.12),'canvasTan',interior)
    if high:
        for x in [-1.05,-.55,-.05,.45,.95]:
            box('Floor tile groove',(x,0,.334),(.008,4.12,.008),'woodWarm',interior,0)
        for y in [-1.6,-.8,0,.8,1.6]:
            box('Floor tile groove',(-.15,y,.334),(2.55,.008,.008),'woodWarm',interior,0)

    # Real hollow shell and entrance aperture. Display and side panes are transparent.
    box('Back wall',(-1.40,0,1.9),(.18,4.3,3.30),'picketWhite')
    box('Left wall',(-.11,-2.10,1.9),(2.74,.18,3.30),'picketWhite')
    box('Right wall',(-.11,2.10,1.9),(2.74,.18,3.30),'picketWhite')
    for y,w in [(-1.98,.33),(-.23,.17),(1.80,.63)]:
        box('Front masonry pier',(1.20,y,1.45),(.22,w,2.36),'picketWhite')
    box('Front sign wall',(1.20,0,2.96),(.22,4.35,1.08),'picketWhite')
    box('Display base wall',(1.20,-1.09,.48),(.22,1.58,.37),'picketWhite')
    if high:
        # Small masonry gaps stand clear of the structural backing.
        for row in range(8):
            z=.46+row*.38
            for side in [-1,1]:
                for ix in range(5):
                    x=-1.12+ix*.53
                    box('Side cream block',(x,side*2.208,z),(.514,.028,.365),
                        'sidewalk' if (row+ix)%9==0 else 'picketWhite',bevel=.01)
            for y,w in [(-1.98,.29),(1.80,.57)]:
                if z<2.62:
                    box('Facade cream block',(1.322,y,z),(.026,w,.365),'picketWhite',bevel=.008)
        for y in [-2.13,2.13]:
            box('Corner stone trim',(1.34,y,1.43),(.09,.13,2.36),'picketWhite')
    # Flat removable roof, parapet, individual coping stones.
    box('Roof deck',(-.08,0,3.40),(2.91,4.55,.13),'asphalt',roof)
    for x in [-1.48,1.35]:
        box('Parapet',(x,0,3.51),(.14,4.49,.22),'picketWhite',roof)
        count=6 if high else 1
        for i in range(count):
            box('Roof coping',(x,-2.23+(i+.5)*4.46/count,3.65),(.25,4.46/count-.014,.11),'picketWhite',roof)
    for y in [-2.20,2.20]:
        box('Side parapet',(-.07,y,3.51),(2.7,.14,.22),'picketWhite',roof)
        box('Side roof coping',(-.07,y,3.65),(2.91,.25,.11),'picketWhite',roof)

    # Shop fascia, raised fictional lettering and parcel-with-wings emblem.
    box('Sign cream edge',(1.40,0,3.075),(.15,4.47,.66),'picketWhite',bevel=.028)
    box('Teal enamel sign',(1.49,0,3.075),(.08,4.37,.55),'poloDark',bevel=.021)
    if lod < 2:
        text('Sunset Parcel Co lettering','SUNSET PARCEL CO.',(1.54,.46,3.075),2.62,.31)
    for y in [-2.01,2.01]:
        for offset in [-.11,.035]:
            profile('Sign end diagonal',[(y+offset-.04,2.83),(y+offset+.04,2.83),(y+offset+.20,3.32),(y+offset+.12,3.32)],1.55,.018,'survivorRed')
    logo_y=-1.36
    box('Parcel emblem',(1.568,logo_y,3.065),(.058,.39,.35),'schoolBusYellow',bevel=.038)
    if lod < 2:
        box('Parcel logo tape',(1.608,logo_y,3.065),(.013,.048,.30),'woodWarm',bevel=.002)
        box('Logo shipping label',(1.61,logo_y+.09,3.10),(.014,.08,.06),'picketWhite',bevel=.002)
        for side in [-1,1]:
            for k in range(3):
                y=logo_y+side*(.25+.012*k)
                profile('Parcel wings',[(y,3.05-k*.065),(y+side*.20,3.15-k*.055),
                        (y+side*.17,3.22-k*.055),(y,3.14-k*.065)],1.566,.03,'picketWhite')
        rod('Parcel top fold',(1.61,logo_y-.16,3.225),(1.61,logo_y+.16,3.225),.016,'woodWarm',n=6)

    # Alternating sloped canopy panels and rounded scalloped valance.
    strips=16 if lod<2 else 12
    width=4.64/strips
    for i in range(strips):
        y=-2.32+(i+.5)*width
        token='schoolBusYellow' if i%2 else 'polo'
        box('Awning panel',(1.64,y,2.655),(1.05,width-.005,.095),token,bevel=.014,rot=(0,.14,0))
        y0,y1=y-width/2+.003,y+width/2-.003
        poly=[(y0,2.585),(y1,2.585)]
        steps=8 if high else 3
        poly += [(y+(width/2-.003)*math.cos(k*math.pi/steps),2.415-.095*math.sin(k*math.pi/steps)) for k in range(steps+1)]
        poly += [(y0,2.585)]
        # Remove the repeated start/end vertex before extrusion.
        poly=poly[:-1]
        profile('Scalloped awning edge',poly,2.18,.075,token)
    if lod<2:
        for i in range(4):
            x=.64+i*.34
            token='schoolBusYellow' if i%2 else 'polo'
            box('Side awning stripe',(x,-2.32,2.65),(.32,.52,.09),token,rot=(-.12,0,0))
            box('Side valance',(x,-2.59,2.48),(.32,.055,.22),token,bevel=.04)
        for y in [-2.03,2.03]:
            rod('Awning support',(1.32,y,2.2),(2.03,y,2.52),.028,'uiDark',n=8)

    # Fixed display window: layered bronze/wood frames and genuinely see-through glazing.
    box('Display pane',(1.276,-1.095,1.59),(.016,1.42,1.89),'keep_glass',windows['window_display'],0)
    for y in [-1.82,-.36]:
        box('Display frame',(1.34,y,1.56),(.13,.074,2.06),'woodWarm')
    for z in [.55,2.57]:
        box('Display frame',(1.34,-1.09,z),(.13,1.55,.075),'woodWarm')
    box('Display mullion',(1.349,-1.1,1.59),(.095,.052,1.91),'woodWarm')
    box('Display bottom rail',(1.36,-1.10,.99),(.10,1.5,.065),'woodWarm')
    # Entry leaf authored at its hinge and rebased by the final merge.
    for y in [.03,1.31]:
        box('Entry stile',(1.31,y,1.41),(.10,.075,2.25),'woodWarm',door)
    for z in [.33,1.02,2.49]:
        box('Entry rail',(1.31,.67,z),(.10,1.35,.075),'woodWarm',door)
    box('Entry pane',(1.31,.67,1.41),(.014,1.23,2.07),'keep_glass',windows['window_entry'],0)
    box('Entry door plinth',(1.342,.67,.62),(.075,1.26,.49),'woodWarm',door)
    if lod<2:
        for z in [.59,1.41,2.22]:
            rod('Door hinge barrel',(1.31,1.35,z-.09),(1.31,1.35,z+.09),.035,'brass',door,n=12)
        for z in [1.14,1.43]:
            rod('Door pull mount',(1.34,.18,z),(1.44,.18,z),.021,'brass',door,n=8)
        rod('Door pull',(1.45,.18,1.14),(1.45,.18,1.43),.028,'brass',door,n=12)
        box('Door welcome sticker',(1.365,.78,1.75),(.017,.35,.13),'picketWhite',door,.004)
        if high:
            text('Door OPEN lettering','OPEN',(1.38,.78,1.75),.28,.075,'poloDark',door)
    # Decorative side window from the invisible side, retained as a named pane node.
    box('Side window pane',(-.50,2.199,1.72),(.95,.025,1.12),'emi_windowGlow',windows['window_side'],0)
    for x in [-1.03,.03]:
        box('Side window jamb',(x,2.25,1.72),(.08,.075,1.26),'woodWarm')
    for z in [1.10,2.34]:
        box('Side window sill',(-.5,2.25,z),(1.15,.085,.09),'woodWarm')

    # Shelves behind the display/entrance, with purposeful varied parcels.
    if lod<2:
        for y in [-1.24,.98]:
            for yy in [y-.71,y+.71]:
                box('Parcel shelf upright',(-1.16,yy,1.45),(.13,.10,2.30),'woodWarm',interior)
            for row in range(4):
                z=.48+row*.53
                box('Parcel shelf',(-.94,y,z),(.65,1.58,.065),'woodWarm',interior)
                for j in range(3):
                    yy=y-.49+j*.49
                    h=.24+((j+row)%3)*.06
                    parcel((-.89,yy,z+.037+h/2),(.38,.32+.05*(j%2),h),detailed=high)
        # Sorting cubby beside the display pane keeps its window visibly busy.
        for z in [.51,1.05,1.59]:
            box('Display cubby shelf',(.62,-1.18,z),(.47,1.12,.055),'woodWarm',interior)
            parcel((.67,-1.41,z+.18),(.31,.35,.30),detailed=high)
            parcel((.67,-.90,z+.23),(.34,.34,.40),detailed=high)
    else:
        box('Distant shelf',(-.96,0,1.34),(.45,3.48,1.84),'woodWarm',interior,0)
        for y in [-1.2,-.6,0,.6,1.2]:
            box('Distant shelf parcel',(-.65,y,1.57),(.20,.39,.37),'canvasTan',interior,0)

    # Pickup counter: visible chest-height cabinet, panel fronts and POS terminal.
    box('Counter cabinet',(.18,.82,.79),(.68,1.45,.93),'woodWarm',interior,.035)
    box('Counter top',(.22,.82,1.30),(.88,1.58,.10),'woodWarm',interior,.034)
    box('Counter kick plate',(.53,.82,.39),(.065,1.42,.12),'leatherShadow',interior,.008)
    if lod<2:
        for y in [.38,1.25]:
            box('Counter cabinet panel',(.54,y,.85),(.055,.72,.72),'corgiOrange',interior,.022)
            rod('Counter drawer pull',(.60,y-.07,1.1),(.60,y+.07,1.1),.015,'brass',interior,n=8)
        box('POS base',(.42,1.06,1.39),(.24,.27,.08),'uiDark',interior)
        box('POS display',(.30,1.06,1.61),(.085,.35,.33),'poloDark',interior,.026,rot=(0,-.12,0))
        box('POS bright screen',(.349,1.06,1.63),(.018,.285,.22),'polo',interior,.009,rot=(0,-.12,0))
        parcel((.22,.26,1.49),(.30,.34,.28),detailed=high)
        if high:
            for k in range(4):
                box('POS key',(.51,1.0+k*.055,1.433),(.06,.031,.015),'silver',interior,.004)
        for y in [-1.02,1.04]:
            box('Ceiling light',(-.03,y,3.18),(.42,.56,.055),'emi_windowGlow',interior,.015)

    # Red parcel drop box with inset slot and white envelope relief.
    box('Parcel drop box',(1.54,1.94,1.47),(.42,.45,.60),'survivorRed',bevel=.065)
    box('Dropbox raised lid',(1.58,1.94,1.77),(.46,.47,.12),'survivorRed',bevel=.043)
    box('Dropbox slot',(1.797,1.94,1.67),(.018,.31,.06),'uiDark',bevel=.003)
    box('Envelope mark',(1.767,1.94,1.43),(.016,.22,.16),'picketWhite',bevel=.004)
    if lod<2:
        for side in [-1,1]:
            rod('Envelope fold',(1.781,1.94+side*.10,1.50),(1.781,1.94,1.43),.009,'survivorRed',n=6)
        box('Mailbox keyhole',(1.78,1.94,1.31),(.014,.025,.035),'uiDark',bevel=.002)

    # Four gooseneck sign lamps and a warm wall lantern.
    for i,y in enumerate([-1.73,-.60,.60,1.73]):
        if lod<2:
            points=[(1.41,y,3.61),(1.44,y,3.84),(1.50,y,3.95),(1.64,y,3.99),
                    (1.77,y,3.94),(1.84,y,3.78),(1.86,y,3.68)]
            curve('Gooseneck arm',points,.026,'uiDark',roof)
            cylinder('Lamp mount',(1.41,y,3.65),.071,.05,'uiDark',roof)
        cylinder('Sign lamp shade',(1.87,y,3.63),.135,.14,'uiDark',roof,r2=.047)
        cylinder('Sign lamp lip',(1.87,y,3.55),.141,.025,'uiDark',roof)
        cylinder('Sign lamp bulb',(1.87,y,3.53),.095,.022,'emi_windowGlow',roof)
    box('Lantern mount',(1.36,1.84,2.28),(.055,.14,.23),'uiDark')
    rod('Lantern arm',(1.39,1.84,2.39),(1.69,1.84,2.39),.027,'uiDark',n=8)
    box('Lantern glass',(1.70,1.84,2.22),(.19,.20,.27),'emi_windowGlow')
    cylinder('Lantern cap',(1.70,1.84,2.40),.18,.13,'uiDark',r2=.015)
    box('Lantern foot',(1.70,1.84,2.065),(.23,.24,.045),'uiDark')
    if lod<2:
        for x in [1.60,1.80]:
            for y in [1.74,1.94]:
                rod('Lantern frame',(x,y,2.08),(x,y,2.36),.012,'uiDark',n=6)

    # Rooftop HVAC and bent metal duct.
    box('HVAC cabinet',(-.35,1.12,3.96),(.70,.83,.58),'sidewalk',roof,.03)
    box('HVAC top',(-.35,1.12,4.27),(.76,.89,.08),'picketWhite',roof,.024)
    box('HVAC front grille',(.018,1.12,3.97),(.04,.65,.43),'uiDark',roof,.008)
    if lod<2:
        for i in range(7 if high else 3):
            z=3.81+i*(.31/(6 if high else 2))
            box('HVAC grille slat',(.048,1.12,z),(.022,.61,.019),'silver',roof,.003)
        for i in range(6 if high else 3):
            x=-.63+i*.112
            box('Side grille slot',(x,.683,3.99),(.058,.016,.31),'uiDark',roof,.002)
        box('HVAC service panel',(.022,1.54,3.97),(.026,.12,.30),'picketWhite',roof,.003)
        box('HVAC service badge',(.038,1.54,4.01),(.015,.08,.045),'poloDark',roof,.001)
    if high:
        for x in [-.58,-.10]:
            for y in [.88,1.38]:
                box('HVAC foot',(x,y,3.68),(.11,.10,.13),'uiDark',roof,.009)
        curve('Bent rooftop vent',[(-.36,-1.44,3.49),(-.36,-1.44,3.78),(-.36,-1.40,3.88),
              (-.36,-1.31,3.91),(-.36,-.99,3.91),(-.36,-.90,3.87),(-.36,-.87,3.72)],.068,'silver',roof)
        for y in [-1.24,-1.01]:
            rod('Vent pipe collar',(-.36,y-.025,3.91),(-.36,y+.025,3.91),.079,'picketWhite',roof,n=16)
    elif mid:
        rod('Roof vent',(-.36,-1.44,3.73),(-.36,-.87,3.73),.06,'silver',roof,n=6)

    # Side delivery plaque. Side plane faces -Y, visible in the original crop.
    if lod<2:
        box('Side service plaque',(.64,-2.255,1.94),(.67,.06,1.20),'poloDark')
        if high:
            for i,label in enumerate(['PACK','SHIP','PICK UP','LOCAL']):
                o=text('Side plaque lettering',label,(.64,-2.294,2.19-i*.22),.55,.16)
                o.rotation_quaternion=Matrix(((1,0,0),(0,0,-1),(0,1,0))).to_quaternion()

    # A-frame sign on the apron, without occluding the display or doorway.
    sign_y=-.70
    box('Chalkboard frame',(2.36,sign_y,.93),(.11,.91,1.31),'woodWarm',bevel=.027,rot=(0,-.10,0))
    box('Chalkboard face',(2.435,sign_y,.95),(.025,.77,1.15),'uiDark',bevel=.007,rot=(0,-.10,0))
    for y in [sign_y-.42,sign_y+.42]:
        rod('A-frame rear leg',(2.00,y,.28),(2.29,y,1.51),.037,'woodWarm',n=10 if high else 4)
        rod('A-frame front leg',(2.50,y,.27),(2.29,y,1.51),.035,'woodWarm',n=10 if high else 4)
    if lod<2:
        for i,label in enumerate(['Same-day','in','Sunset Grove!']):
            text('Chalkboard message',label,(2.513,sign_y,1.25-i*.20),.65,.125)
        box('Chalkboard parcel icon',(2.493,sign_y,.59),(.018,.15,.14),'schoolBusYellow',bevel=.02)
        rod('A-frame stop',(2.05,sign_y-.43,.70),(2.42,sign_y-.43,.70),.013,'brass',n=6)

    # Hand truck at left: chunky red frame, two dark wheels, parcels on its toe plate.
    for y in [-2.07,-1.67]:
        curve('Hand truck frame',[(1.93,y,.35),(1.94,y,1.27),(1.91,y,1.40),(1.85,y,1.44),
              (1.76,y,1.40),(1.72,y,1.23)],.033,'survivorRed')
        wheel=cylinder('Hand truck wheel',(1.91,y,.40),.145,.115,'uiDark',n=20 if high else 6)
        wheel.rotation_euler.x=math.pi/2
        hub=cylinder('Hand truck wheel hub',(1.91,y-.062,.40),.058,.02,'silver',n=12 if high else 6)
        hub.rotation_euler.x=math.pi/2
    box('Hand truck toe',(2.03,-1.87,.34),(.43,.53,.07),'survivorRed',bevel=.02)
    if lod<2:
        for z in [.62,.93,1.20]:
            rod('Hand truck brace',(1.93,-2.07,z),(1.93,-1.67,z),.022,'survivorRed',n=8)
    parcel((2.12,-1.87,.59),(.48,.50,.43),body)
    parcel((2.08,-1.84,.97),(.39,.39,.32),body)

    # Terracotta flower pots and left-side conifer.
    for x,y in [(1.98,2.18),(1.84,-1.30),(.65,-2.38)]:
        cylinder('Terracotta planter',(x,y,.43),.22,.35,'woodWarm',r2=.27)
        cylinder('Planter rim',(x,y,.615),.285,.075,'woodWarm')
        cylinder('Planter soil',(x,y,.655),.245,.016,'leatherShadow',n=12 if high else 6)
        sphere('Flowering bush',(x,y,.80),(.33,.29,.26),'grass')
        if high:
            for k in range(13):
                angle=k*2.4
                dx,dy=math.cos(angle)*.22,math.sin(angle)*.22
                sphere('Bush leaf',(x+dx,y+dy,.76+rng.uniform(-.05,.18)),(.09,.07,.14),'foliage')
            for k in range(9):
                angle=k*2.4
                xx,yy=x+.24*math.cos(angle),y+.23*math.sin(angle)
                z=.85+rng.uniform(.02,.13)
                sphere('Flower center',(xx,yy,z),(.032,.032,.030),'schoolBusYellow')
                for j in range(5):
                    a=j*math.tau/5
                    sphere('White flower petal',(xx+.055*math.cos(a),yy+.055*math.sin(a),z),(.044,.028,.021),'picketWhite')
    rod('Conifer trunk',(-.03,-2.38,.22),(-.03,-2.38,1.8),.08,'woodWarm',n=10 if high else 6)
    for k in range(5 if high else 3):
        z=.81+k*(.28 if high else .43)
        r=.39-k*(.064 if high else .12)
        cylinder('Conifer tier',(-.03,-2.38,z),r,.64,'foliageDark' if k%2 else 'grass',r2=.035,n=12 if high else 6)
        if high:
            for j in range(6):
                t=j*math.tau/6
                cylinder('Conifer branch',(-.03+.19*math.cos(t),-2.38+.19*math.sin(t),z-.06),r*.43,.35,'foliage',r2=.018,n=6)

    # Resolve global authoring geometry into each parent joint; merge per material.
    bpy.context.view_layer.update()
    groups={}
    for o in meshes:
        groups.setdefault((o.parent, o.data.materials[0]), []).append(o)
    merged=[]
    for (parent, mat), batch in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in batch:
            o.select_set(True)
        bpy.context.view_layer.objects.active=batch[0]
        bpy.ops.object.join()
        o=bpy.context.object
        o.name=parent.name+'_'+mat.name
        bpy.context.view_layer.update()
        world=o.matrix_world.copy()
        data=o.data.copy()
        pivot=parent.matrix_world.translation.copy()
        data.transform(Matrix.Translation(-pivot) @ world)
        o.data=data
        o.matrix_world=Matrix.Translation(pivot)
        merged.append(o)
    door.rotation_euler.z=math.radians(65)
    bpy.context.view_layer.update()
    # No broad collision box blocks the usable pickup interior.
    for name,p,size in [('rear',(-1.40,0,1.9),(.18,4.3,3.3)),
                        ('left',(-.11,-2.10,1.9),(2.74,.18,3.3)),
                        ('right',(-.11,2.10,1.9),(2.74,.18,3.3)),
                        ('display',(1.20,-1.11,1.45),(.24,2.02,2.36)),
                        ('entry_right',(1.20,1.80,1.45),(.24,.63,2.36)),
                        ('counter',(.18,.82,.79),(.68,1.45,.93))]:
        empty('col:'+name,p,root,collider='cuboid',size=list(size))
    for name,p,parent in [('shop',(.55,.5,2.25),interior),('sign',(1.87,0,3.48),roof),('entry',(1.73,1.84,2.22),body)]:
        emissive=[o.name for o in merged if o.parent==parent and o.data.materials[0].name.startswith('emi_')]
        empty('light:'+name,p,root,ss_light=json.dumps({'type':'point','color':'light_window_warm',
              'intensity':2.0,'range':3.0,'pool':True,'beam':'none','flare':True,'reflect':True,
              'shadow':'none','heroPriority':1,'flicker':'none','powerGroup':'courier_depot',
              'breakable':True,'emissiveNodes':emissive,'tiers':'all'}))
    # Geometry signature is independent of Blender's generated datablock names.
    digest=hashlib.sha256()
    tris=0
    for o in sorted(merged,key=lambda o:o.name):
        digest.update(o.name.encode())
        for v in o.data.vertices:
            digest.update(struct.pack('<3f',*(o.matrix_world @ v.co)))
        o.data.calc_loop_triangles()
        tris+=len(o.data.loop_triangles)
        # Blender may emit cached loop triangles in a different order after AO.
        # Compare canonical triangles by coordinates and winding, as production QA does.
        triangles=[]
        for t in o.data.loop_triangles:
            corners=[struct.pack('<3f',*(o.matrix_world @ o.data.vertices[i].co)) for i in t.vertices]
            triangles.append(min(b''.join(corners[j:]+corners[:j]) for j in range(3)))
        for triangle in sorted(triangles):
            digest.update(triangle)
    bpy.context.view_layer.update()
    coords=[o.matrix_world @ v.co for o in merged for v in o.data.vertices]
    bounds=[[min(v[i] for v in coords),max(v[i] for v in coords)] for i in range(3)]
    report={'triangles':tris,'draw_calls':len(merged),'materials':sorted(m.name for m in mats.values()),
            'geometry_hash':digest.hexdigest(),'bounds_blender':bounds,
            'nodes_ok':all(bpy.data.objects.get(n) for n in REQUIRED),
            'missing_nodes':[n for n in REQUIRED if not bpy.data.objects.get(n)]}
    assert report['nodes_ok']
    print('OK geometry',lod,tris,'triangles',len(merged),'draws',flush=True)
    return report,merged


def render():
    scene=bpy.context.scene
    scene.render.engine='BLENDER_EEVEE'
    scene.eevee.taa_render_samples=args.samples
    world=bpy.data.worlds.new('Neutral violet studio')
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.14,.12,.18,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.6
    scene.world=world
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015))
    ground=bpy.context.object
    m=bpy.data.materials.new('studio_ground')
    m.use_nodes=True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.029,.025,.038,1)
    ground.data.materials.append(m)
    target=Vector((.40,0,2.05))
    for name,p,power,size,color in [('Warm key',(6,-6,9),1150,6,(1,.78,.56)),
                                    ('Cool fill',(1,6,8),850,7,(.68,.74,1)),
                                    ('Roof rim',(-5,-2,7),950,5,(1,.65,.36))]:
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;d.color=color
        o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=p
        o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    for p,power in [((.35,-1.1,2.5),38),((.10,.92,2.6),48),((1.83,1.84,2.22),12)]:
        d=bpy.data.lights.new('Warm interior spill','POINT');d.energy=power;d.color=(1,.60,.25);d.shadow_soft_size=.22
        o=bpy.data.objects.new(d.name,d);scene.collection.objects.link(o);o.location=p
    bpy.ops.object.camera_add()
    cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO'
    views={'ref':(22,-7,7.1),'game':(13,-13,18),'front':(16,0,6),'side':(0,-16,6),'rear':(-13,8,8),'pose':(13,-8,12)}
    def view(name):
        cam.location=views[name];cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.ortho_scale=10.1 if name!='game' else 13.4
    view(args.view)
    scene.render.resolution_x=args.width;scene.render.resolution_y=args.height;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.image_settings.file_format='PNG'
    folder=Path(args.render).resolve().parent;folder.mkdir(parents=True,exist_ok=True)
    scene.render.filepath=str(Path(args.render).resolve())
    bpy.ops.render.render(write_still=True);print('OK render',args.view,flush=True)
    if args.turntable:
        scene.render.resolution_x=960;scene.render.resolution_y=540;scene.eevee.taa_render_samples=24
        for name in ['front','side','rear','game','pose']:
            view(name)
            if name=='pose':
                for o in bpy.data.objects['roof'].children:
                    o.hide_render=True
                bpy.data.objects['door_main'].rotation_euler.z=0
            scene.render.filepath=str(folder/('pose-test.png' if name=='pose' else name+'.png'))
            bpy.ops.render.render(write_still=True);print('OK render',name,flush=True)
        for o in bpy.data.objects['roof'].children:
            o.hide_render=False
        bpy.data.objects['door_main'].rotation_euler.z=math.radians(65)
        view('ref')
        for o in scene.objects:
            if o.type=='LIGHT' and o.data.type=='AREA':o.data.energy*=.13
        world.node_tree.nodes['Background'].inputs[1].default_value=.08
        scene.render.filepath=str(folder/'night.png')
        bpy.ops.render.render(write_still=True);print('OK render night',flush=True)


if args.glb:
    output=Path(args.glb).resolve();output.parent.mkdir(parents=True,exist_ok=True)
    reports={}
    for level in [0,1,2]:
        report,objects=build(level)
        ao.bake_all(objects,samples=32)
        path=output if level==0 else output.with_name(output.stem+'.lod'+str(level)+'.glb')
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_apply=True,export_yup=True,
                                 export_extras=True,export_cameras=False,export_lights=False)
        reports['lod'+str(level)]=report
    (HERE/'report.json').write_text(json.dumps({'id':ASSET['id'],'tier':'Hero','lods':reports,
        'renderer':'Eevee','backface_culling':True,'script_hash':SCRIPT_HASH,'webgpu_ok':None,'webgl2_ok':False},indent=2)+'\n')
    print('OK exported LOD chain',flush=True)
if args.render:
    report,_=build(args.lod)
    if args.lod==0 and (HERE/'report.json').exists():
        saved=json.loads((HERE/'report.json').read_text())
        saved['deterministic_rebuild']=saved['lods']['lod0']['geometry_hash']==report['geometry_hash']
        if saved['deterministic_rebuild']:
            saved['script_hash']=SCRIPT_HASH
        (HERE/'report.json').write_text(json.dumps(saved,indent=2)+'\n')
        if saved.get('script_hash')==SCRIPT_HASH:
            assert saved['deterministic_rebuild']
    render()
