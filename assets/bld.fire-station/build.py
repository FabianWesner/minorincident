"""Sunset Grove fire house; deterministic, texture-free hero model.
+X is the facade, Z is up, metres. Static parts merge per material and
roof/interior remain removable; doors and bell retain functional pivots.
Run through experiment/tools/blender_run.py. --glb exports all three LODs.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/blender"))
from sslib.lod0 import stabilize_ao, prune_hidden_faces, prepare_export_lod
import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib import palette, ao

parser = argparse.ArgumentParser()
parser.add_argument('--render')
parser.add_argument('--view', default='ref', choices=['ref', 'game', 'front', 'side', 'rear'])
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--glb')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
rng = random.Random(24)
asset = bpy.data.collections.new('FireStation')
scene.collection.children.link(asset)
M = {t: palette.mat(t) for t in ['brick', 'survivorRed', 'picketWhite', 'sidewalk', 'asphalt', 'uiDark', 'backpackTeal', 'schoolBusYellow', 'woodWarm', 'grass', 'foliage']}
M['glow'] = palette.mat('windowGlow', emissive=True)
M['schoolBusYellow'].node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = .45
M['backpackTeal'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .3
M['glow'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 3.0
parts = []

def empty(name, location=(0, 0, 0), parent=None, **extras):
    o = bpy.data.objects.new(name, None)
    asset.objects.link(o)
    o.location = location
    if parent:
        o.parent = parent
        o.matrix_parent_inverse = parent.matrix_world.inverted()
    for k, v in extras.items():
        o[k] = v
    bpy.context.view_layer.update()
    return o

root = empty('root', asset_id='bld.fire-station', tier='Hero', forward='+X')
roof = empty('roof', parent=root)
interior = empty('interior', parent=root)
empty('front', (1.6, 0, 2), root)

def finish(o, material, group=root, bevel=0, segments=2):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    asset.objects.link(o)
    o.data.materials.append(M[material])
    if bevel >= .015:
        mod = o.modifiers.new('Soft edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 2 if bevel >= .06 else 1
    if o.type == 'MESH':
        mod = o.modifiers.new('Corner normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
    o.parent = group
    o.matrix_parent_inverse = group.matrix_world.inverted()
    parts.append(o)
    return o

def box(name, p, size, material, group=root, bevel=.025, segments=1):
    x, y, z = (v / 2 for v in size)
    vertices = [(-x,-y,-z),(-x,-y,z),(-x,y,-z),(-x,y,z),(x,-y,-z),(x,-y,z),(x,y,-z),(x,y,z)]
    faces = [(0,2,6,4),(1,5,7,3),(0,4,5,1),(2,3,7,6),(0,1,3,2),(4,6,7,5)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(vertices, [], faces)
    o = bpy.data.objects.new(name, me)
    o.location = p
    o['lod_shape'] = 'box'
    return finish(o, material, group, min(bevel, min(size) * .4), segments)

def cylinder(name, p, radius, depth, material, group=root, vertices=20, radius2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius if radius2 is None else radius2, depth=depth, location=p)
    o = bpy.context.object
    o.name = name
    o['lod_shape'] = 'round'
    return finish(o, material, group, .012)

def sphere(name, p, size, material, group=root, segments=12, rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=p)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o['lod_shape'] = 'round'
    for f in o.data.polygons:
        f.use_smooth = True
    return finish(o, material, group)

def rod(name, a, b, radius, material, group=root):
    a, b = Vector(a), Vector(b)
    o = cylinder(name, (a + b) / 2, radius, (b - a).length, material, group, vertices=12)
    o.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return o

FACE = Matrix(((0, 0, 1), (1, 0, 0), (0, 1, 0))).to_quaternion()
font_path = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
font = bpy.data.fonts.load(font_path) if Path(font_path).exists() else None

def text(name, body, p, width, height, material, group=root):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = body
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.size = 1
    curve.extrude = .007
    curve.bevel_depth = 0
    curve.bevel_resolution = 0
    curve.resolution_u = 3
    if font:
        curve.font = font
    o = bpy.data.objects.new(name, curve)
    asset.objects.link(o)
    o.location = p
    bpy.context.view_layer.update()
    s = min(width / o.dimensions.x, height / o.dimensions.y)
    o.scale = (s, s, s)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = FACE
    o['lettering'] = True
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o.select_set(False)
    return finish(o, material, group)

def wall_bricks(name, axis, fixed, lo, hi, zlo, zhi, holes=()):
    """Single thickness relief bricks over recessed structural mortar walls."""
    step, row = .49, .235
    batches = {}
    for j in range(math.ceil((zhi-zlo)/row)):
        z = zlo + j*row + row/2
        if z + row/2 > zhi + .001:
            continue
        offset = (j % 2) * step/2
        start = lo-step+offset
        for i in range(math.ceil((hi-lo)/step)+2):
            a, b = max(lo, start+i*step), min(hi, start+(i+1)*step)
            if b-a < .07:
                continue
            if any(a < h[1] and b > h[0] and z > h[2] and z < h[3] for h in holes):
                continue
            material = 'brick' if rng.random() < .83 else ('survivorRed' if rng.random() < .65 else 'woodWarm')
            p = (fixed, (a+b)/2, z) if axis=='x' else ((a+b)/2, fixed, z)
            size = (.075, b-a-.015, row-.015) if axis=='x' else (b-a-.015, .075, row-.015)
            vertices, faces = batches.setdefault(material, ([], []))
            x, y, zz = (v / 2 for v in size)
            base = len(vertices)
            vertices.extend([(p[0]+dx,p[1]+dy,p[2]+dz) for dx,dy,dz in [(-x,-y,-zz),(-x,-y,zz),(-x,y,-zz),(-x,y,zz),(x,-y,-zz),(x,-y,zz),(x,y,-zz),(x,y,zz)]])
            faces.extend([tuple(base+v for v in f) for f in [(0,2,6,4),(1,5,7,3),(0,4,5,1),(2,3,7,6),(0,1,3,2),(4,6,7,5)]])
    for material, (vertices, faces) in batches.items():
        me = bpy.data.meshes.new(name)
        me.from_pydata(vertices, [], faces)
        o = bpy.data.objects.new(name, me)
        asset.objects.link(o)
        finish(o, material)

# Paving: each slab has a visible bevel and seam; all lane paint clears slabs by 8 mm.
box('Foundation', (0, 0, .15), (11.6, 12.2, .3), 'sidewalk', bevel=.09, segments=2)
for ix in range(5):
    for iy in range(8):
        box('Apron slab', (1.78+ix*.78, -5.39+iy*1.54, .34), (.75, 1.5, .12), 'sidewalk', bevel=.035)
for y in [-5.94, 5.94]:
    for x in [-5.25,-4.15,-3.05,-1.95,-.85,.25,1.35,2.45,3.55,4.65,5.4]:
        box('Curb stone', (x,y,.45), (.98,.32,.38), 'picketWhite', bevel=.045)
for y in [4.78,.98,.60,-3.23]:
    box('Yellow bay guide', (3.53,y,.411), (4.05,.10,.018), 'schoolBusYellow', bevel=.006, segments=1)

# Open building shell; garage apertures lead to a simple usable interior.
box('Interior floor', (-1.65,.9,.45), (6.3,8.45,.16), 'asphalt', interior)
box('Back wall', (-4.65,.9,2.95), (.3,8.45,5.0), 'brick')
box('Left wall', (-1.65,5.02,2.95), (6.3,.3,5), 'brick')
box('Right wall', (-1.65,-3.22,2.95), (6.3,.3,5), 'brick')
for y,w in [(4.98,.38),(.83,.42),(-3.24,.38)]:
    box('Garage pier', (1.4,y,2.05), (.38,w,3.24), 'brick')
box('Front upper wall', (1.4,.86,4.46), (.36,8.5,2.05), 'brick')
wall_bricks('Facade brick', 'x', 1.615,-3.43,5.17,.5,5.5, [(-3.05,.60,.45,3.65),(1.06,4.79,.45,3.65)])
wall_bricks('Side brick', 'y',5.21,-4.79,1.59,.5,5.5, [(-.65,1.03,1.2,2.85)])
# Rear is intentionally smooth masonry: spend triangles on visible features.
for y in [5.0,.83,-3.26]:
    box('Pier footing',(1.67,y,.83),(.42,.50,.72),'picketWhite')
    for z in [3.63,4.92,5.22]:
        if y == .83 and z > 4:
            continue  # The station sign replaces these central trim blocks.
        box('Corner sandstone', (1.67,y,z),(.40,.52,.18),'picketWhite')
for z in [3.66,3.94]:
    box('Bay lintel stone',(1.72,.86,z),(.48,8.65,.23),'picketWhite',bevel=.04)
# Stone copings are segmented rather than an unbroken slab.
box('Flat roof deck',(-1.62,.87,5.51),(6.65,8.72,.20),'asphalt',roof)
for y in [-3.48,5.24]:
    box('Parapet',(-1.63,y,5.69),(6.7,.26,.28),'brick',root)
    for x in [-4.65,-3.53,-2.41,-1.29,-.17,.95]:
        box('Coping stone',(x,y,5.87),(1.10,.42,.21),'picketWhite',roof,.035)
for x in [-4.98,1.73]:
    box('Parapet',(x,.87,5.69),(.26,8.72,.28),'brick',root)
    for i in range(8):
        box('Coping stone',(x,-2.94+i*1.09,5.87),(.44,1.06,.21),'picketWhite',roof,.035)

# Separate sectional doors, origin at top roller axle; children move with the assembly.
for name,y in [('door_bay_L',2.92),('door_bay_R',-1.23)]:
    door=empty(name,(1.52,y,3.58),root, animation='sectionalLift', travel=3.15)
    box('Door dark reveal',(1.51,y,2.0),(.09,3.70,3.18),'uiDark',door)
    for j in range(4):
        z=.86+j*.74
        box('Door section',(1.59,y,z),(.11,3.60,.71),'survivorRed',door,.03,2)
        for k in range(3):
            yy=y+(k-1)*1.16
            box('Panel rim',(1.661,yy,z),(.027,1.06,.59),'survivorRed',door,.016)
            box('Raised door panel',(1.685,yy,z),(.024,.96,.49),'survivorRed',door,.016)
    for k in range(3):
        yy=y+(k-1)*1.16
        box('Garage window gasket',(1.715,yy,2.57),(.065,1.03,.53),'uiDark',door,.02)
        box('Garage ivory frame',(1.758,yy,2.57),(.04,.99,.48),'picketWhite',door,.015)
        box('Garage window',(1.785,yy,2.57),(.025,.88,.37),'uiDark',door,.01)
        box('Glass reflection',(1.802,yy-.24,2.64),(.009,.24,.11),'asphalt',door,.002)
    box('Door handle',(1.75,y-1.42,1.61),(.08,.10,.28),'asphalt',door)
    box('Door bottom seal',(1.69,y,.51),(.09,3.65,.07),'uiDark',door,.01)
    for yy in [y-1.89,y+1.89]:
        box('Door track',(1.15,yy,2),(.12,.08,3.1),'asphalt',interior)
# Side window, standing proud of the side masonry.
box('Side window recess',(.19,5.267,2.07),(1.76,.10,1.63),'uiDark')
box('Side window sill',(.19,5.40,1.20),(1.98,.36,.19),'picketWhite')
box('Side window lintel',(.19,5.36,2.94),(1.98,.23,.18),'picketWhite')
for x in [-.25,.60]:
    box('Side glowing pane',(x,5.33,2.08),(.73,.055,1.44),'glow')
for x in [-.68,.19,1.06]:
    box('Side mullion',(x,5.39,2.08),(.075,.09,1.6),'backpackTeal')
box('Side crossbar',(.19,5.4,2.12),(1.8,.075,.08),'backpackTeal')

# Tower: matching brick shaft, service door and open belfry.
TY=-4.42
box('Tower core',(-.15,TY,3.58),(3.5,2.1,6.30),'brick')
wall_bricks('Tower facade brick','x',1.655,TY-1.05,TY+1.05,.5,6.64,[(TY-.49,TY+.49,.55,2.55)])
wall_bricks('Tower side brick','y',TY-1.095,-1.9,1.59,.5,6.64)
box('Tower plinth',(1.71,TY,.80),(.5,2.2,.72),'picketWhite')
box('Service door shadow',(1.711,TY,1.65),(.10,1.04,2.12),'uiDark')
door=empty('door_service',(1.79,TY+.44,.55),root,animation='hinge',axis='Z')
box('Service door',(1.79,TY,1.58),(.09,.90,2.03),'backpackTeal',door)
box('Service door pane',(1.848,TY,1.99),(.025,.69,.60),'uiDark',door)
for z in [1.48,2.38]:
    box('Service door rail',(1.87,TY,z),(.035,.78,.055),'schoolBusYellow',door)
box('Door pull',(1.88,TY-.32,1.25),(.06,.055,.19),'schoolBusYellow',door)
box('Door lintel',(1.74,TY,2.72),(.26,1.23,.19),'picketWhite')
box('Doorstep',(1.97,TY,.50),(.62,1.30,.20),'picketWhite')
box('Tower plaque',(1.728,TY,4.5),(.11,.82,1.16),'picketWhite')
box('Plaque inset',(1.80,TY,4.5),(.05,.64,.99),'uiDark')
# Crossed axes, rendered as actual relief.
for s in [-1,1]:
    rod('Axe handle',(1.86,TY-.23*s,4.13),(1.86,TY+.23*s,4.82),.026,'woodWarm')
    o=box('Axe head',(1.88,TY+.20*s,4.75),(.05,.27,.14),'picketWhite')
    o.rotation_euler.x=s*.5
box('Belfry stone floor',(.35,TY,6.73),(2.95,2.45,.26),'picketWhite')
for x in [-.97,1.66]:
    for y in [TY-.98,TY+.98]:
        box('Bell tower column',(x,y,7.65),(.38,.36,1.76),'brick')
        for j in range(7):
            box('Column brick',(x+.01,y,6.91+j*.236),(.41,.39,.21),'survivorRed' if j%3==0 else 'brick',bevel=.014,segments=1)
        box('Column capital',(x,y,8.40),(.49,.47,.26),'picketWhite')
# Voussoir arch segments over front and opposite opening.
for x in [1.68,-.99]:
    for k in range(9):
        t=math.pi*k/8
        y=TY+.84*math.cos(t)
        z=7.99+.48*math.sin(t)
        o=box('Belfry arch stone',(x,y,z),(.40,.29,.25),'picketWhite',bevel=.018)
        o.rotation_euler.x=t-math.pi/2
rod('Bell beam',(.3,TY-.88,8.14),(.3,TY+.88,8.14),.09,'woodWarm')
bell=empty('bell',(.3,TY,8.13),root,animation='swing',axis='Y')
# Bell is a hollow cast lip, shoulder, crown and internal clapper.
profile=[(.08,8.07),(.16,8.01),(.27,7.94),(.34,7.86),(.36,7.69),(.40,7.34),(.53,7.12),(.60,7.04),(.60,6.99),(.51,6.98),(.46,7.08),(.32,7.36),(.29,7.70),(.22,7.79),(.08,7.80)]
verts=[]
faces=[]
for r,z in profile:
    for k in range(40):
        t=k*2*math.pi/40
        verts.append((.3+r*math.cos(t),TY+r*math.sin(t),z))
for j in range(len(profile)-1):
    for k in range(40):
        a=j*40+k;b=j*40+(k+1)%40
        faces.append((a,a+40,b+40,b))
me=bpy.data.meshes.new('Bell cast')
me.from_pydata(verts,[],faces)
o=bpy.data.objects.new('Bronze bell',me)
asset.objects.link(o)
for p in me.polygons:p.use_smooth=True
finish(o,'schoolBusYellow',bell)
rod('Clapper stem',(.3,TY,7.80),(.3,TY,6.98),.045,'schoolBusYellow',bell)
sphere('Clapper',(.3,TY,6.95),(.12,.12,.13),'schoolBusYellow',bell)

# Four-sided hipped tile roof: deliberate staggered shingle seams.
box('Belfry cornice',(.35,TY,8.55),(3.04,2.65,.20),'picketWhite',roof,.05)
center=Vector((.35,TY,9.95))
basecorners=[Vector((1.98,TY+1.48,8.66)),Vector((-1.28,TY+1.48,8.66)),Vector((-1.28,TY-1.48,8.66)),Vector((1.98,TY-1.48,8.66))]
for face in range(4):
    a,b=basecorners[face],basecorners[(face+1)%4]
    for row in range(5):
        t0=row/5;t1=min((row+1)/5,.985)
        l0=a.lerp(center,t0);r0=b.lerp(center,t0)
        l1=a.lerp(center,t1);r1=b.lerp(center,t1)
        n=5-row
        for k in range(n):
            corners=[l0.lerp(r0,k/n+.009),l0.lerp(r0,(k+1)/n-.009),l1.lerp(r1,(k+1)/n-.009),l1.lerp(r1,k/n+.009)]
            top=[tuple(v+Vector((0,0,.025))) for v in corners]
            bottom=[tuple(v-Vector((0,0,.045))) for v in corners]
            me=bpy.data.meshes.new('Tile');me.from_pydata(top+bottom,[],[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)])
            o=bpy.data.objects.new('Tower roof tile',me);asset.objects.link(o)
            finish(o,'woodWarm' if (row+k+face)%3 else 'asphalt',roof,.012,1)
for corner in basecorners:
    rod('Roof hip cap',corner+Vector((0,0,.075)),center+Vector((0,0,.065)),.054,'woodWarm',roof)
cylinder('Finial base',(.35,TY,9.98),.10,.12,'woodWarm',roof)
sphere('Finial',(.35,TY,10.13),(.10,.10,.15),'woodWarm',roof)
cylinder('Finial tip',(.35,TY,10.35),.05,.25,'woodWarm',roof,radius2=0)

# Main cream station sign with sculpted fictional fire-service crest and bolt heads.
box('Sign shadow',(1.66,.81,4.76),(.12,6.24,1.26),'uiDark')
box('Sign enamel',(1.75,.81,4.76),(.13,6.16,1.20),'picketWhite',bevel=.055,segments=2)
text('Town sign','SUNSET GROVE',(1.828,.16,5.03),4.57,.37,'uiDark')
text('Department sign','FIRE DEPT',(1.828,.16,4.51),4.5,.51,'uiDark')
# Eight pointed Maltese-style badge, front-plane extrusion.
pts=[]
for k in range(16):
    t=k*2*math.pi/16;r=.47 if k%2==0 else .28
    pts.append((1.84,3.18+r*math.cos(t),4.76+r*math.sin(t)))
vs=pts+[(x-.045,y,z) for x,y,z in pts]
fs=[tuple(range(16)),tuple(range(31,15,-1))]+[(k,(k+1)%16,(k+1)%16+16,k+16) for k in range(16)]
me=bpy.data.meshes.new('Fire crest');me.from_pydata(vs,[],fs)
o=bpy.data.objects.new('Fire crest',me);asset.objects.link(o);finish(o,'survivorRed',bevel=.008,segments=1)
box('Crest bell relief',(1.893,3.18,4.77),(.035,.25,.29),'schoolBusYellow',bevel=.05)
box('Crest bell lip',(1.906,3.18,4.60),(.035,.35,.055),'schoolBusYellow',bevel=.015)
rod('Crest bell hanger',(1.906,3.18,4.95),(1.906,3.18,4.89),.027,'schoolBusYellow')
for y in [-2.18,3.80]:
    for z in [4.23,5.29]:
        o=cylinder('Sign bolt',(1.844,y,z),.038,.025,'woodWarm',vertices=12)
        o.rotation_euler.y=math.pi/2

# Exterior lamps remain independently named with their light anchors.
for i,(y,z) in enumerate([(3.0,3.45),(-1.16,3.45),(.82,2.88),(5.01,2.60),(TY,5.37)]):
    lamp=empty('lamp_'+str(i),(1.79,y,z),root,animation='breakable')
    box('Lamp mounting plate',(1.81,y,z+.14),(.08,.18,.29),'uiDark',lamp)
    rod('Lamp gooseneck',(1.83,y,z+.25),(2.13,y,z+.12),.042,'uiDark',lamp)
    cylinder('Lamp shade',(2.14,y,z),.23,.20,'uiDark',lamp,radius2=.08)
    cylinder('Lamp shade rim',(2.14,y,z-.10),.235,.045,'uiDark',lamp)
    bulb=sphere('lampBulb_'+str(i),(2.14,y,z-.17),(.13,.13,.14),'glow',lamp)
    empty('light:entry_'+str(i),(2.14,y,z-.20),root,ss_light=json.dumps({'type':'point','color':'light_window_warm','intensity':2.3,'range':3,'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'none','heroPriority':1,'flicker':'none','powerGroup':'fire_station','breakable':True,'emissiveNodes':[bulb.name],'tiers':'all'}))
empty('light:side_window',(.19,5.43,2.1),root,ss_light=json.dumps({'type':'window','color':'light_window_warm','intensity':1.5,'range':2,'emissiveNodes':['Side glowing pane','Side glowing pane.001'],'powerGroup':'fire_station'}))

# Four protective bollards, cast caps, mounting feet and collar bands.
for y in [4.91,1.11,.52,-3.27]:
    cylinder('Bollard foot',(1.97,y,.47),.20,.14,'woodWarm')
    cylinder('Bollard',(1.97,y,1.09),.14,1.18,'schoolBusYellow')
    sphere('Bollard dome',(1.97,y,1.69),(.142,.142,.12),'schoolBusYellow')
    cylinder('Bollard collar',(1.97,y,1.49),.151,.065,'woodWarm')

# Roof HVAC units: raised feet, recessed louvers, fan grilles, service covers.
for i,(x,y,w,d,h) in enumerate([(-.50,3.76,1.10,1.16,.70),(-1.15,1.47,1.14,1.24,.68),(-2.55,-1.10,1.00,1.09,1.07)]):
    for dx in [-.34,.34]:
        for dy in [-.36,.36]:
            box('HVAC foot',(x+dx,y+dy,5.71),(.17,.15,.19),'uiDark',roof)
    box('HVAC cabinet',(x,y,5.84+h/2),(w,d,h),'picketWhite',roof,.045)
    box('HVAC top lid',(x,y,5.85+h),(w+.05,d+.05,.07),'picketWhite',roof,.025)
    cylinder('Fan black well',(x,y,5.90+h),.34,.05,'uiDark',roof,vertices=24)
    for k in range(5):
        o=box('Fan blade',(x,y,5.933+h),(.08,.56,.018),'asphalt',roof,.007,1)
        o.rotation_euler.z=k*math.pi/5
    cylinder('Fan hub',(x,y,5.95+h),.085,.04,'picketWhite',roof)
    for k in range(5):
        box('Fan safety grid',(x-.25+k*.125,y,5.974+h),(.014,.49,.013),'picketWhite',roof,.002,1)
    box('Service cover',(x+w/2+.016,y+.16,5.84+h*.5),(.045,d*.55,h*.68),'picketWhite',roof,.017)
    for j in range(5):
        box('Cooling louver',(x+w/2+.043,y-.30,5.81+h*.40+j*.068),(.027,.25,.027),'uiDark',roof,.003,1)
    for z in [5.89,5.78+h]:
        for yy in [y-.43,y+.43]:
            sphere('HVAC screw',(x+w/2+.055,yy,z),(.025,.025,.025),'uiDark',roof,8,4)

# Fictional civic flag: cream-red bands and a teal canton, no real insignia.
cylinder('Flag pole',(1.14,5.70,2.90),.045,4.97,'picketWhite')
cylinder('Flag base',(1.14,5.70,.52),.18,.30,'woodWarm')
sphere('Flag finial',(1.14,5.70,5.47),(.09,.09,.10),'schoolBusYellow')
for j in range(9):
    z=5.17-j*.17
    o=box('Civic flag stripe',(1.16+(.03*math.sin(j*.6)),5.14,z),(.05,1.08,.165),'survivorRed' if j%2==0 else 'picketWhite',bevel=.011,segments=1)
box('Flag canton',(1.20,5.42,4.88),(.075,.48,.59),'backpackTeal',bevel=.015)
# Small geometric stars on the visible side of the fictional flag.
for j in range(3):
    for k in range(2):
        sphere('Civic flag star',(1.247,5.29+k*.22,4.70+j*.17),(.012,.025,.025),'schoolBusYellow',segments=6,rings=3)

# Reference landscaping: chunky leaves, modest pink flowers and ground weeds.
for x,y,scale in [(-3.8,5.63,1.2),(-1.65,5.65,.95),(-4.45,3.1,1.1),(-4.5,-2.0,1.0),(-1.2,-5.7,1.0),(.8,-5.66,.80),(1.32,5.64,.7)]:
    sphere('Shrub heart',(x,y,.77),(.47*scale,.37*scale,.49*scale),'grass',segments=10,rings=5)
    for n in range(18):
        a=rng.random()*math.tau
        z=.55+rng.random()*1.35*scale
        radius=rng.uniform(.17,.52)*scale
        p=(x+math.cos(a)*radius,y+math.sin(a)*radius,z)
        o=sphere('Shrub leaf',p,(.12*scale,.055*scale,.23*scale),'foliage' if n%3 else 'schoolBusYellow',segments=6,rings=3)
        o.rotation_euler=(rng.uniform(-.8,.8),rng.uniform(-.8,.8),a)
for x,y in [(4.9,5.57),(5.4,-5.5),(2.8,5.55),(2.8,-5.60),(.95,-5.65),(1.35,5.45)]:
    for k in range(7):
        a=k*math.tau/7
        o=sphere('Paving weed',(x+.13*math.cos(a),y+.13*math.sin(a),.51),(.055,.055,.27),'grass',segments=6,rings=3)
        o.rotation_euler=(.5*math.sin(a),.5*math.cos(a),0)
for x,y in [(0,5.60),(-2.15,5.72),(.05,-5.66)]:
    for k in range(4):
        xx=x+k*.13;z=.71+(.12 if k%2 else 0)
        rod('Flower stem',(xx,y,.45),(xx,y,z),.014,'grass')
        sphere('Flower center',(xx,y,z),(.045,.045,.045),'schoolBusYellow',segments=8,rings=4)
        for n in range(5):
            a=n*math.tau/5
            sphere('Flower petal',(xx+.07*math.cos(a),y+.07*math.sin(a),z),(.054,.038,.035),'survivorRed',segments=6,rings=3)

# Two compact rooftop planting silhouettes, behind the parapet as in the reference.
for x,y in [(-4.15,3.65),(-4.15,2.15)]:
    box('Roof planter',(x,y,5.78),(.65,.78,.30),'picketWhite',roof,.035)
    sphere('Roof shrub core',(x,y,6.35),(.38,.36,.60),'grass',roof,segments=8,rings=4)
    for k in range(12):
        a=k*math.tau/12
        z=6.13+(k%4)*.25
        leaf=sphere('Roof shrub leaf',(x+.32*math.cos(a),y+.32*math.sin(a),z),(.12,.07,.25),'foliage',roof,segments=6,rings=3)
        leaf.rotation_euler=(.4*math.sin(a),.4*math.cos(a),a)

# Apply geometry operations once, then merge within each functional parent/material.
prune_hidden_faces(parts, occlusion=True, game_camera=True, defer=True)
lod_parts = [(o.name, o.parent, o.data.copy(), o.matrix_world.copy(), bool(o.get('lettering')), o.get('lod_shape', 'custom')) for o in parts] if args.glb else []
depsgraph = bpy.context.evaluated_depsgraph_get()
evaluated = [(o, bpy.data.meshes.new_from_object(o.evaluated_get(depsgraph), depsgraph=depsgraph), o.matrix_world.copy()) for o in parts]
# Authoring Y runs toward the left of the facade; convert to the +X-forward
# game frame once. Glyphs preserve their readable orientation.
mirror = Matrix.Diagonal((1, -1, 1, 1))
for e in list(asset.objects):
    if e.type == 'EMPTY':
        e.location.y *= -1
bpy.context.view_layer.update()
for o, data, transform in evaluated:
    if o.get('lettering'):
        transform.translation.y *= -1
        data.transform(transform)
    else:
        data.transform(mirror @ transform)
        for polygon in data.polygons:
            polygon.flip()
    o.modifiers.clear()
    o.data = data
    parent = o.parent
    o.parent = None
    o.matrix_world = Matrix.Identity(4)
    o.parent = parent
    o.matrix_parent_inverse = parent.matrix_world.inverted()
    o.matrix_basis = Matrix.Identity(4)
def merge(objects, prefix=''):
    groups={}
    for o in objects:
        groups.setdefault((o.parent.name,o.data.materials[0].name),[]).append(o)
    merged=[]
    for (parent,material),batch in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in batch:o.select_set(True)
        bpy.context.view_layer.objects.active=batch[0]
        bpy.ops.object.join()
        o=batch[0];o.name=prefix+parent+'_'+material
        merged.append(o)
    return merged

meshes=merge(parts)

def light_references(objects):
    for o in asset.objects:
        if 'ss_light' in o:
            data=json.loads(o['ss_light'])
            parent='lamp_'+o.name.rsplit('_',1)[-1] if o.name.startswith('light:entry_') else 'root'
            data['emissiveNodes']=[m.name for m in objects if m.parent.name==parent and m.data.materials[0].name.startswith('emi_')]
            o['ss_light']=json.dumps(data)

light_references(meshes)
# Building collision is a shell, leaving the two apertures free.
for name,p,size in [('rear',(-4.65,.9,2.95),(.3,8.45,5)),('left',(-1.65,5.02,2.95),(6.3,.3,5)),('right',(-1.65,-3.22,2.95),(6.3,.3,5)),('tower',(-.15,TY,3.58),(3.5,2.1,6.3))]:
    empty('col:'+name,(p[0],-p[1],p[2]),root,collider='cuboid',size=list(size))

# Runtime exports contain no studio geometry, cameras, or actual lights.
def statistics(objects=None):
    objects = meshes if objects is None else objects
    tris=0
    for o in objects:
        o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
    return {'triangles':tris,'draw_calls':len(objects)}

def build_lod(level):
    # Keep closed primitive solids; remove detail before silhouette.
    omit=['Facade brick','Side brick','Tower facade brick','Tower side brick',
          'Shrub leaf','Roof shrub leaf','Paving weed','Flower','Civic flag star',
          'HVAC screw','Fan safety grid','Fan blade','Glass reflection','Panel rim','Tower roof tile','Raised door panel','Cooling louver']
    if level==2:
        omit += ['Town sign','Department sign','Roof hip cap',
                 'Apron slab','Curb stone','Coping stone','Column brick',
                 'HVAC foot','Service cover',
                 'Fan black well','Fan hub','Bollard collar','Bollard foot',
                 'Axe handle','Axe head','Door track','Sign bolt','Crest bell',
                 'Lamp mounting plate','Lamp gooseneck','Lamp shade','Belfry arch stone','Corner sandstone']
    objects=[]
    for name,parent,raw,world,lettering,shape in lod_parts:
        if any(name.startswith(prefix) for prefix in omit):continue
        data=raw.copy();transform=world.copy()
        if lettering:
            transform.translation.y *= -1;data.transform(transform)
        else:
            data.transform(mirror @ transform)
            for polygon in data.polygons:polygon.flip()
        if level==2:
            token=data.materials[0].name.removeprefix('pal_')
            token={'foliage':'grass','woodWarm':'brick','sidewalk':'picketWhite',
                   'asphalt':'uiDark','survivorRed':'brick','backpackTeal':'uiDark'}.get(token,token)
            if token in M:data.materials[0]=M[token]
        o=bpy.data.objects.new('lod_'+name,data);asset.objects.link(o)
        o.parent=parent;o.matrix_parent_inverse=parent.matrix_world.inverted()
        if shape=='round' or name=='Bronze bell':
            data.calc_loop_triangles();ratio=.35 if level==1 else .16
            if name=='Bronze bell':ratio=.22 if level==1 else .09
            ratio=max(ratio,12/max(12,len(data.loop_triangles)))
            mod=o.modifiers.new('Round form reduction','DECIMATE');mod.ratio=ratio
            bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
        objects.append(o)
    if level in [1,2]:
        # A solid pyramid replaces the shingle mosaic at long distance.
        v=[tuple(mirror.to_3x3() @ p) for p in basecorners]+[tuple(mirror.to_3x3() @ center)]
        data=bpy.data.meshes.new('Distant tower roof')
        data.from_pydata(v,[],[(0,4,1),(1,4,2),(2,4,3),(3,4,0),(0,1,2,3)])
        data.materials.append(M['woodWarm'])
        o=bpy.data.objects.new('lod_roof_cap',data);asset.objects.link(o)
        o.parent=roof;o.matrix_parent_inverse=roof.matrix_world.inverted();objects.append(o)
    return merge(objects,'lod'+str(level)+'_')

if args.glb:
    output=Path(args.glb).resolve();output.parent.mkdir(parents=True,exist_ok=True)
    def export(path,objects):
        bpy.ops.object.select_all(action='DESELECT')
        for o in asset.objects:o.select_set(o.type=='EMPTY' or o in objects)
        stabilize_ao(list(bpy.context.scene.objects)); prepare_export_lod(list(bpy.context.scene.objects), str(path)); bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_cameras=False,export_lights=False)
    ao.bake_all(meshes,samples=32);stats=statistics();export(output,meshes)
    lods={}
    for o in meshes:asset.objects.unlink(o)
    for level in [1,2]:
        low=build_lod(level);light_references(low);ao.bake_all(low,samples=32)
        lods['lod'+str(level)]=statistics(low)
        export(output.with_name(output.stem+'.lod'+str(level)+'.glb'),low)
        for o in low:bpy.data.objects.remove(o,do_unlink=True)
    for o in meshes:asset.objects.link(o)
    light_references(meshes)
    report={'id':'bld.fire-station','tier':'Hero',**stats,'materials':sorted({o.data.materials[0].name for o in meshes}),'nodes_ok':all(bpy.data.objects.get(n) for n in ['root','roof','interior','door_bay_L','door_bay_R','door_service','bell']),'within_budget':stats['triangles']<=60000 and stats['draw_calls']<=40,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':['Reference-derived full-size footprint exceeds placeholder manifest dimensions; registry integration remains pending.']}
    (HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    (HERE/'lod-stats.json').write_text(json.dumps(lods,indent=2)+'\n')
    print('OK',json.dumps(report))

if args.render:
    # Render-only studio; never exported.
    world=bpy.data.worlds.new('Warm studio');world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.14,.12,.18,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.55
    scene.world=world
    def area(name,p,power,color,size):
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
        o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=p;o.rotation_euler=(Vector((0,0,3))-o.location).to_track_quat('-Z','Y').to_euler()
    area('Golden key',(8,-8,15),2200,(1,.73,.46),8)
    area('Lavender fill',(2,9,11),1550,(.61,.68,1),10)
    area('Roof rim',(-8,-2,13),1900,(1,.85,.65),7)
    for anchor in [o for o in asset.objects if o.name.startswith('light:entry_')]:
        data=bpy.data.lights.new('Preview '+anchor.name,'POINT')
        data.energy=40;data.color=(1,.60,.24);data.shadow_soft_size=.18
        light=bpy.data.objects.new(data.name,data);scene.collection.objects.link(light);light.location=anchor.matrix_world.translation
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015))
    plane=bpy.context.object
    mat=bpy.data.materials.new('Studio ground');mat.diffuse_color=(.025,.021,.033,1);plane.data.materials.append(mat)
    camdata=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',camdata);scene.collection.objects.link(cam)
    target=Vector((0,0,5.05))
    positions={'ref':(25,-19,19),'game':(22,-22,31),'front':(28,0,12),'side':(0,30,13),'rear':(-22,-20,17)}
    cam.location=Vector(positions[args.view]);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    camdata.type='ORTHO';camdata.ortho_scale=23.6
    scene.camera=cam
    scene.render.engine='CYCLES';scene.cycles.samples=args.samples;scene.cycles.use_denoising=True;scene.cycles.seed=24
    scene.render.resolution_x=args.width;scene.render.resolution_y=args.height;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(Path(args.render).resolve())
    Path(args.render).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print('OK render',args.render,statistics())
