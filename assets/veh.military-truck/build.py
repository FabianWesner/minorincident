"""Deterministic hero military cargo truck. +X front, +Z up, metres.
Run only through experiment/tools/blender_run.py. Static parts join by material;
rigid wheels, hinged doors/tailgate and lamp assemblies retain joint origins.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.distance import tier_argument, export_variant, build_native_lods
DISTANCE = tier_argument()

HERE = Path(__file__).resolve().parent
if '--lod-only' in sys.argv:
    build_native_lods(__file__)
    sys.exit(0)

ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'tools/blender'))
from sslib import palette, ao

p = argparse.ArgumentParser()
p.add_argument('--render')
p.add_argument('--view', default='ref', choices=['ref', 'game', 'front', 'side', 'rear'])
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960)
p.add_argument('--height', type=int, default=540)
p.add_argument('--glb')
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
M = {t: palette.mat(t) for t in ['olive', 'oliveLight', 'oliveSeam', 'khaki', 'khakiSeam', 'uiDark', 'picketWhite', 'leather']}
M['lamp'] = palette.mat('windowGlow', True)
M['red'] = palette.mat('sirenRed', True)
M['glass'] = palette.mat('tealDark')
for key, mat in M.items():
    bs = mat.node_tree.nodes['Principled BSDF']
    bs.inputs['Roughness'].default_value = .78 if key in ['khaki','khakiSeam'] else .42
    if key == 'glass':
        bs.inputs['Roughness'].default_value = .17
        bs.inputs['Base Color'].default_value = (.026,.038,.038,1)
    if key in ['lamp','red']: bs.inputs['Emission Strength'].default_value = 2.2

owners = {}
def empty(name, loc=(0,0,0), parent=None):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    o.location = loc
    o.parent = parent
    return o
root = empty('veh.military-truck')
root['ss_physics'] = json.dumps({'class':'heavy','mass':6800,'friction':.8,'restitution':.04,'centerOfMass':[0,1.1,0], 'pushable':False,'kickable':False,'flammable':True})
for name, loc in {'body':(0,0,0), 'doorL':(1.20,-1.08,1.60), 'doorR':(1.20,1.08,1.60), 'tailgate':(-3.42,0,1.31), 'lightsFront':(3.20,0,1.45), 'lightsBrake':(-3.29,0,1.15), 'lampsRoof':(.76,0,2.76)}.items():
    owners[name] = empty(name, loc, root)

def finish(o, name, mat, owner='body', bevel=0, smooth=False):
    if DISTANCE: bevel = 0
    o.name = name
    # Keep rigid assemblies economical while preserving their material character.
    if owner.startswith('wheel'):
        mat = 'uiDark' if mat in ['uiDark','asphalt'] else 'olive'
    elif owner in ['doorL','doorR']:
        mat = {'oliveLight':'olive','oliveSeam':'olive','silver':'glass'}.get(mat,mat)
    elif owner in ['lightsFront','lightsBrake','lampsRoof'] and mat not in ['lamp','red']:
        owner = 'body'
    o.data.materials.append(M[mat])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod=o.modifiers.new('soft manufactured edges','BEVEL'); mod.width=bevel; mod.segments=1 if name in ['tread block','lug','stake rivet'] else 2
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth:
        for f in o.data.polygons: f.use_smooth=True
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    o.parent=owners[owner]
    o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    return o

def box(name, loc, size, mat='olive', bevel=.025, owner='body', rot=None):
    if DISTANCE: bevel = 0
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object; o.dimensions=size
    if rot: o.rotation_euler=rot
    return finish(o,name,mat,owner,bevel,True)

def cyl(name,loc,r,depth,mat='oliveSeam',axis='Y',owner='body',n=32):
    if DISTANCE: n = min(n, 12 if DISTANCE == 1 else 8)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=depth, location=loc)
    o=bpy.context.object
    o.rotation_euler=(math.pi/2,0,0) if axis=='Y' else ((0,math.pi/2,0) if axis=='X' else (0,0,0))
    return finish(o,name,mat,owner,.008,True)

def rod(name,a,b,r=.015,mat='oliveSeam',owner='body',n=12):
    if DISTANCE: n = min(n, 12 if DISTANCE == 1 else 8)
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object; o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return finish(o,name,mat,owner,0,True)

def mesh(name,verts,faces,mat,owner='body',smooth=False):
    data=bpy.data.meshes.new(name); data.from_pydata(verts,[],faces); data.update()
    o=bpy.data.objects.new(name,data); scene.collection.objects.link(o)
    return finish(o,name,mat,owner,0,smooth)

def ring(name,loc,major,minor,mat,owner='body',axis='Y',n=40):
    if DISTANCE: n = min(n, 12 if DISTANCE == 1 else 8)
    bpy.ops.mesh.primitive_torus_add(major_segments=(16 if DISTANCE == 1 else 12) if DISTANCE else (n),minor_segments=(4 if DISTANCE == 1 else 3) if DISTANCE else (10),location=loc,major_radius=major,minor_radius=minor)
    o=bpy.context.object
    if axis=='Y': o.rotation_euler.x=math.pi/2
    elif axis=='X': o.rotation_euler.y=math.pi/2
    return finish(o,name,mat,owner,0,True)

def text(name,body,loc,size,owner='body',plane='front'):
    bpy.ops.object.text_add(location=loc)
    o=bpy.context.object; o.data.body=body; o.data.align_x='CENTER'; o.data.align_y='CENTER'; o.data.size=size; o.data.extrude=0 if DISTANCE else (.0015); o.data.bevel_depth=0 if DISTANCE else (.0006)
    o.rotation_euler=(math.pi/2,0,math.pi/2) if plane=='front' else ((math.pi/2,0,0) if plane=='side' else (0,0,math.pi/2))
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object,name,'picketWhite',owner)

# Ladder chassis, drivetrain, suspension and six chunky all-terrain wheels.
for y in [-.66,.66]:
    box('chassis',(-.12,y,.85),(6.2,.16,.25),'oliveSeam')
for x in [-2.95,-1.8,-.5,.8,2.25]: box('crossmember',(x,0,.85),(.13,1.55,.14),'oliveSeam')
wheel_x=[2.12,-1.03,-2.39]
for ax,x in enumerate(wheel_x):
    cyl('axle',(x,0,.58),.1,2.2,'uiDark')
    cyl('differential',(x,0,.58),.22,.38,'oliveSeam')
    for s in [-1,1]:
        y=s*1.10
        name=('wheelF' if ax==0 else 'wheelM' if ax==1 else 'wheelR')+('L' if s==-1 else 'R')
        owners[name]=empty(name,(x,y,.62),root)
        cyl('tire',(x,y,.62),.60,.39,'uiDark',owner=name,n=56)
        for side in [-1,1]:
            ring('sidewall',(x,y+side*.185,.62),.505,.068,'asphalt',name,n=48)
        cyl('rim recess',(x,y+s*.218,.62),.363,.024,'oliveSeam',owner=name,n=40)
        ring('rim lip',(x,y+s*.246,.62),.327,.035,'oliveLight',name)
        cyl('wheel dish',(x,y+s*.244,.62),.278,.048,'olive',owner=name,n=40)
        cyl('hub',(x,y+s*.284,.62),.124,.09,'oliveSeam',owner=name)
        cyl('hub cap',(x,y+s*.338,.62),.075,.015,'oliveLight',owner=name)
        for i in range(8):
            a=i*math.tau/8
            cyl('lug',(x+.183*math.sin(a),y+s*.286,.62+.183*math.cos(a)),.019,.027,'oliveLight',owner=name,n=8)
        for i in range(32):
            a=i*math.tau/32
            for j in [-1,1]:
                box('tread block',(x+.616*math.sin(a),y+j*.145,.62+.616*math.cos(a)),(.11,.18,.065),'uiDark',.012,name,(0,a,j*.19))
        for k in range(3):
            box('leaf spring',(x,s*.69,.73+k*.025),(.93,.09,.02),'oliveSeam',.004)
        rod('damper',(x-.24,s*.74,.62),(x+.08,s*.74,1.1),.042)
rod('drive shaft',(-2.5,0,.65),(1.9,0,.65),.065)
# Cab block and long rounded bonnet.
box('cab lower',(.66,0,1.53),(1.46,1.99,.67),'olive',.055)
box('cab rear',(-.02,0,2.08),(.16,1.99,1.19),'olive',.04)
box('cab roof',(.68,0,2.72),(1.63,2.13,.16),'oliveLight',.065)
box('bonnet',(2.12,0,1.90),(1.54,1.76,.52),'olive',.10)
box('hood crown',(2.10,0,2.157),(1.44,1.63,.075),'oliveLight',.047)
rod('hood split',(1.42,0,2.20),(2.77,0,2.20),.006)
box('cowl',(1.33,0,2.12),(.20,1.91,.22),'olive',.03)
# Split windshield set in a slightly raked cab front.
for y in [-.48,.48]:
    box('windshield rubber',(1.35,y,2.40),(.07,.89,.55),'uiDark',.023,rot=(0,-.10,0))
    box('windshield glass',(1.393,y,2.40),(.014,.81,.47),'glass',.012,rot=(0,-.10,0))
    rod('wiper',(1.431,y-.25,2.18),(1.43,y+.22,2.25),.013,'uiDark')
    rod('wiper arm',(1.441,y+.13,2.17),(1.44,y-.02,2.23),.012)
rod('windshield divider',(1.414,0,2.12),(1.364,0,2.68),.032,'oliveLight')
# Doors are independent assemblies with front hinge pivots.
for s,owner in [(-1,'doorL'),(1,'doorR')]:
    y=s*1.019
    box('door panel',(.67,y,1.80),(1.09,.065,.66),'olive',.03,owner)
    box('window frame',(.63,y,2.38),(1.05,.075,.58),'oliveLight',.027,owner)
    box('window seal',(.63,y+s*.044,2.38),(.91,.027,.48),'uiDark',.022,owner)
    box('side glass',(.63,y+s*.062,2.38),(.85,.014,.42),'glass',.019,owner)
    box('door handle',(.26,y+s*.064,2.07),(.18,.055,.037),'oliveSeam',.013,owner)
    for z in [1.60,1.98]: cyl('hinge',(1.20,y+s*.061,z),.022,.13,'oliveLight','Z',owner,n=12)
    # Five-point raised military star inside a painted circle (>= 6 mm proud).
    ring('star circle',(.67,y+s*.054,1.78),.248,.017,'picketWhite',owner,n=48)
    verts=[(.67,y+s*.073,1.78)]
    for i in range(10):
        a=math.pi/2+i*math.pi/5; r=.221 if i%2==0 else .092
        verts.append((.67+r*math.cos(a),y+s*.073,1.78+r*math.sin(a)))
    faces=[(0,i+1,(i+1)%10+1) for i in range(10)]
    if s>0: faces=[tuple(reversed(f)) for f in faces]
    mesh('raised white star',verts,faces,'picketWhite',owner)
    rod('mirror support',(1.21,s*1.01,2.49),(1.29,s*1.37,2.50),.018,'oliveLight',owner)
    rod('mirror support lower',(1.2,s*1.02,2.14),(1.29,s*1.37,2.15),.017,'oliveLight',owner)
    box('mirror housing',(1.29,s*1.39,2.33),(.14,.12,.42),'olive',.035,owner)
    box('mirror glass',(1.206,s*1.39,2.33),(.017,.095,.34),'silver',.014,owner)
    box('step',(.68,s*1.05,1.10),(1.15,.47,.12),'oliveSeam',.026)
    box('step tread',(.68,s*1.14,1.166),(.96,.26,.015),'uiDark',.006)
    box('fuel tank',(-.37,s*.88,.98),(.62,.48,.52),'olive',.075)
    for x in [-.58,-.15]: box('tank strap',(x,s*1.128,.98),(.055,.019,.45),'oliveSeam',.009)
    cyl('tank filler',(-.35,s*1.137,1.15),.065,.03,'oliveLight',owner='body',n=16)
    # Angular front fenders, hood vents and bonnet latches.
    box('fender top',(2.11,s*1.04,1.47),(1.24,.56,.13),'oliveLight',.04)
    for x,angle in [(1.38,-.57),(2.85,.57)]:
        box('fender slope',(x,s*1.04,1.23),(.58,.55,.12),'olive',.028,rot=(0,angle,0))
    box('headlamp shell',(2.91,s*1.02,1.49),(.22,.47,.42),'olive',.045)
    profile=[(1.12,.94),(1.48,1.53),(2.67,1.53),(3.15,1.00),(3.03,.92),(2.60,1.39),(1.58,1.39),(1.22,.90)]
    lipverts=[(x,s*y,z) for y in [1.30,1.355] for x,z in profile]
    lipfaces=[tuple(reversed(range(8))),tuple(range(8,16))]
    lipfaces += [(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
    mesh('fender edge lip',lipverts,lipfaces,'oliveLight')
    for x in [1.65,2.60]:
        box('bonnet latch',(x,s*.889,1.99),(.065,.024,.12),'oliveSeam',.009)
    for x in [1.81,1.92,2.03]: box('hood vent',(x,s*.892,1.99),(.06,.012,.04),'uiDark',.006)
    cyl('side reflector',(2.72,s*1.334,1.36),.061,.024,'lamp',owner='lightsFront',n=16)
# Tall upright vertical-bar grille, bumper, tow eyes and stencil identifiers.
box('grille surround',(2.945,0,1.71),(.15,1.73,.92),'oliveLight',.06)
box('grille dark inset',(3.03,0,1.72),(.024,1.51,.77),'uiDark',.025)
for y in [-.64,-.48,-.32,-.16,0,.16,.32,.48,.64]:
    box('grille bar',(3.055,y,1.73),(.04,.035,.72),'oliveLight',.009)
for z in [1.40,2.04]: box('grille crossrail',(3.077,0,z),(.042,1.51,.035),'olive',.007)
box('front bumper',(3.24,0,.98),(.26,2.54,.29),'olive',.04)
for s in [-1,1]:
    ring('tow eye',(3.397,s*.48,1.14),.075,.020,'oliveSeam',axis='X',n=20)
    box('lamp gasket',(3.04,s*1.02,1.49),(.045,.345,.30),'uiDark',.027,owner='lightsFront')
    box('headlamp',(3.073,s*1.02,1.49),(.031,.278,.23),'lamp',.035,owner='lightsFront')
    rod('bumper guide',(3.02,s*1.19,1.54),(3.04,s*1.19,1.94),.018,'oliveLight')
    ring('guide ring',(3.04,s*1.19,1.97),.050,.012,'lamp','lightsFront',axis='X',n=16)
text('bumper stencil left','A-714',(3.381,-.89,.985),.135)
text('bumper stencil center','G-30',(3.381,0,.985),.13)
text('bumper stencil right','D-3C',(3.381,.91,.985),.135)
text('hood stencil','SG 714',(2.11,0,2.201),.17,plane='top')
# Cargo bed lower slatted panels, corner hardware, rear mudflaps.
box('bed floor',(-1.67,0,1.28),(3.31,2.24,.21),'olive',.045)
for s in [-1,1]:
    for z in [1.47,1.66]: box('bed plank',(-1.67,s*1.12,z),(3.29,.10,.16),'olive',.018)
    for x in [-3.27,-2.52,-1.76,-1.00,-.12]:
        box('bed stake',(x,s*1.183,1.60),(.075,.04,.61),'oliveSeam',.008)
        for z in [1.39,1.79]: cyl('stake rivet',(x,s*1.211,z),.019,.015,'oliveLight',n=10)
    box('bed toprail',(-1.67,s*1.16,1.86),(3.40,.13,.11),'oliveLight',.022)
    box('rear mudflap',(-3.03,s*1.08,.60),(.07,.48,.59),'uiDark',.012)
    box('rear fender',(-1.70,s*1.04,1.26),(2.55,.55,.10),'oliveSeam',.022)
    for x in [-3.19,-.17]:
        box('corner marker',(x,s*1.214,1.36),(.11,.033,.09),'lamp',.017,owner='lightsBrake')
for z in [1.47,1.66]: box('tailgate plank',(-3.34,0,z),(.10,2.19,.16),'olive',.018,'tailgate')
for y in [-.75,0,.75]: box('tailgate brace',(-3.405,y,1.56),(.034,.085,.50),'oliveSeam',.012,'tailgate')
box('rear bumper',(-3.38,0,.95),(.20,2.27,.16),'oliveSeam',.025)
for s in [-1,1]:
    box('rear lamp housing',(-3.44,s*.91,1.17),(.095,.32,.20),'olive',.022)
    for y,material in [(s*.96,'red'),(s*.82,'lamp')]: cyl('rear lamp',(-3.498,y,1.17),.068,.025,material,'X','lightsBrake',n=20)
    rod('tailgate hinge',(-3.42,s*.65,1.31),(-3.42,s*.91,1.31),.033,owner='tailgate')
# Canvas: scalloped tension bays, sewn arch ribs, hanging tie straps.
# Cross section rises above the cab with a shallow pitched crown, rounded shoulders.
section=[(-1.13,1.88),(-1.16,2.30),(-1.15,3.10),(-1.04,3.40),(-.85,3.52),(-.42,3.55),(0,3.59),(.42,3.55),(.85,3.52),(1.04,3.40),(1.15,3.10),(1.16,2.30),(1.13,1.88)]
CANVAS_SPANS=(4 if DISTANCE==1 else 1) if DISTANCE else 24
xs=[-3.30+i*(3.28/CANVAS_SPANS) for i in range(CANVAS_SPANS+1)]
verts=[]
for i,x in enumerate(xs):
    phase=(i%6)/6; sag=math.sin(math.pi*phase)
    for j,(y,z) in enumerate(section):
        # Windless, taut cloth pulled into purposeful diagonal/vertical folds.
        side=abs(y)>1.0 and z<3.34
        offset=(.055*math.sin(i*1.9+j*2.3)+.035*math.cos(i*.9-j))*sag if side else 0
        yy=y+math.copysign(offset,y) if side else y
        zz=z-(.075*sag if z>3.30 else 0)
        verts.append((x,yy,zz))
faces=[]
for i in range(CANVAS_SPANS):
    for j in range(12):
        a=i*13+j; b=(i+1)*13+j
        faces.extend([(a,b,a+1),(a+1,b,b+1)])
# Pulled-in curtain centers produce large diagonal folds on both end caps.
for row,x,indent in [(0,-3.30,.08),(CANVAS_SPANS,-.02,-.08)]:
    center=len(verts); verts.append((x+indent,0,2.70))
    for j in range(13):
        face=(center,row*13+j,row*13+(j+1)%13)
        faces.append(tuple(reversed(face)) if row==CANVAS_SPANS else face)
mesh('folded canvas',verts,faces,'khakiSeam')
# Narrow stitched seam arches are proud of the cloth; scalloped hem is folded outward.
for x in [-3.30,-2.48,-1.66,-.84,-.02]:
    for j in range(12):
        y1,z1=section[j]; y2,z2=section[j+1]
        rod('canvas arch seam',(x,y1*1.010,z1+.014),(x,y2*1.010,z2+.014),.014,'khaki')
    for s in [-1,1]:
        rod('canvas tie',(x,s*1.181,2.92),(x-.05,s*1.190,2.77),.016,'khakiSeam')
        rod('canvas tie',(x-.05,s*1.190,2.77),(x-.075,s*1.194,2.56),.014,'khaki')
        box('strap buckle',(x-.075,s*1.213,2.63),(.055,.024,.067),'oliveSeam',.006)
        ring('tie eye',(x,s*1.226,1.87),.044,.011,'khakiSeam',n=16)
        box('bed tie strap',(x,s*1.229,1.66),(.047,.028,.35),'khakiSeam',.008)
for s in [-1,1]: rod('canvas hem',(-3.32,s*1.155,1.91),(-.015,s*1.155,1.91),.022,'khakiSeam')
# Rear curtain split and rolled edge, not a flat painted rectangle.
rod('rear curtain seam',(-3.316,0,1.90),(-3.316,0,3.58),.017,'khakiSeam')
for y in [-.76,.76]:
    rod('rear canvas tie',(-3.324,y,3.26),(-3.324,y*.90,2.91),.015,'khakiSeam')
# Roof clearance lamps (a discrete independent rigid group).
for y in [-.91,-.28,0,.28,.91]:
    box('roof lamp base',(.79,y,2.829),(.14,.13,.055),'oliveSeam',.018,owner='lampsRoof')
    box('roof marker',(.79,y,2.868),(.105,.093,.055),'lamp',.026,owner='lampsRoof')
# Small interior glimpses and the tall exhaust behind the cab.
for y in [-.48,.48]:
    box('seat back',(.31,y,2.10),(.18,.48,.49),'leather',.06)
    box('seat cushion',(.49,y,1.86),(.44,.47,.14),'leather',.04)
ring('steering wheel',(1.04,-.49,2.17),.19,.021,'uiDark',axis='X',n=28)
rod('steering column',(.82,-.49,1.96),(1.04,-.49,2.17),.034,'uiDark')
rod('exhaust',(-.19,.85,.90),(-.19,.85,2.79),.06,'oliveSeam')
cyl('exhaust cap',(-.19,.85,2.82),.079,.06,'oliveSeam','Z')
for name,loc in {'driverSeat':(.43,-.48,1.90),'exitL':(.65,-1.65,0),'exitR':(.65,1.65,0)}.items(): empty(name,loc,root)
collider=empty('col:body',(-.03,0,1.78),root)
collider['collider']='cuboid'; collider['shape']='cuboid'; collider['size']=[6.6,2.5,3.55]
for s,label in [(-1,'L'),(1,'R')]:
    anchor=empty('light:headlight'+label,(3.1,s*1.02,1.49),root)
    anchor.rotation_euler=Vector((1,0,-.12)).to_track_quat('-Z','Y').to_euler()
    anchor['ss_light']=json.dumps({'type':'spot','color':'light_window_warm','intensity':5,'range':24,'angle':48,'penumbra':.35,'pool':True,'beam':'soft','flare':True,'reflect':True,'shadow':'hero','heroPriority':2,'powerGroup':'self','breakable':True,'emissiveNodes':['lightsFront_emi_windowGlow'],'tiers':'all'})
    anchor=empty('light:brake'+label,(-3.52,s*.96,1.17),root)
    anchor['ss_light']=json.dumps({'type':'point','color':'light_siren_red','intensity':2,'range':3,'powerGroup':'self','emissiveNodes':['lightsBrake_emi_sirenRed'],'tiers':'all'})
anchor=empty('light:clearance',(.79,0,2.87),root)
anchor['ss_light']=json.dumps({'type':'point','color':'light_window_warm','intensity':.5,'range':2,'powerGroup':'self','emissiveNodes':['lampsRoof_emi_windowGlow','lightsBrake_emi_windowGlow'],'tiers':'all'})

if DISTANCE:
    export_variant(Path(__file__).parent, DISTANCE, omit=('tread block', 'lug', 'stake rivet', 'sidewall', 'rim lip', 'seat', 'steering', 'canvas arch seam', 'leaf spring','tie eye','canvas tie','bumper stencil','damper','hub cap'), far_omit=('seat', 'steering', 'strap', 'stitch', 'tie', 'latch', 'bolt', 'wire', 'rim', 'vent slot', 'hub cap', 'wheel dish', 'rim recess', 'hood split', 'damper', 'guide ring', 'tailgate hinge', 'rope', 'stencil', 'canvas hem', 'window rubber', 'grille slat','tow eye','hub','star circle','bed stake','hinge','axle','differential','grille bar'))

# Join within each rigid assembly by material, preserving bevel geometry.
def consolidate():
    bpy.context.view_layer.update()
    groups={}
    for o in list(scene.objects):
        if o.type=='MESH': groups.setdefault((o.parent.name,o.data.materials[0].name),[]).append(o)
    for (owner,material),objs in sorted(groups.items()):
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        bpy.context.view_layer.objects.active=objs[0]
        bpy.ops.object.join()
        o=bpy.context.object; o.name=owner+'_'+material
        scene.cursor.location=owners[owner].matrix_world.translation
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
def clean_mesh(obj, minimum_component=0):
    bm=bmesh.new(); bm.from_mesh(obj.data)
    if minimum_component:
        unseen=set(bm.verts)
        while unseen:
            seed=unseen.pop(); island={seed}; stack=[seed]
            while stack:
                for edge in stack.pop().link_edges:
                    for vertex in edge.verts:
                        if vertex in unseen:
                            unseen.remove(vertex); island.add(vertex); stack.append(vertex)
            extent=max(max(v.co[k] for v in island)-min(v.co[k] for v in island) for k in range(3))
            if extent < minimum_component:
                bmesh.ops.delete(bm,geom=list(island),context='VERTS')
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bad=[f for f in bm.faces if f.calc_area()<1e-8]
    if bad: bmesh.ops.delete(bm,geom=bad,context='FACES')
    # Closed bevelled parts must face outward before AO rays are traced.
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data); bm.free(); obj.data.update()

consolidate()
meshes=[o for o in root.children_recursive if o.type=='MESH']
def stats():
    tris=0
    for o in meshes:
        o.data.calc_loop_triangles(); tris+=len(o.data.loop_triangles)
    return {'triangles':tris,'draw_calls':sum(bool(o.data.polygons) for o in meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials})}
# Trim bevel tessellation to the hero budget without changing part placement.
raw_triangles=stats()['triangles']
if raw_triangles > 74000:
    for o in meshes:
        bpy.context.view_layer.objects.active=o
        dec=o.modifiers.new('hero bevel reduction','DECIMATE'); dec.ratio=74000/raw_triangles
        bpy.ops.object.modifier_apply(modifier=dec.name)
bpy.context.view_layer.update()
points=[o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
root.location.z=-min(v.z for v in points)
root.location.x=-(min(v.x for v in points)+max(v.x for v in points))/2
bpy.context.view_layer.update()
for o in meshes: clean_mesh(o)
base_stats=stats()
print('BUILD OK',json.dumps(base_stats))

if args.glb:
    # True AO bake on the final mesh assemblies, preserved as COLOR_0 on all LODs.
    ao.bake_all(meshes,samples=32)
    def export(path):
        bpy.ops.object.select_all(action='DESELECT')
        for o in [root,*root.children_recursive]: o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE')
    target=Path(args.glb).resolve(); export(target)

if args.render:
    # Neutral dark diorama studio; all staging is created after asset export.
    world=bpy.data.worlds.new('studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.15,.20,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(name,loc,power,size,color):
        d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.shape='DISK'; d.size=size; d.color=color
        o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=loc
        o.rotation_euler=(Vector((0,0,1.3))-o.location).to_track_quat('-Z','Y').to_euler()
    light('key',(3,-5,8),1800,6,(1,.79,.57))
    light('fill',(2,6,5),1100,7,(.68,.77,1))
    light('rim',(-5,1,7),2100,5,(1,.68,.36))
    bpy.ops.mesh.primitive_plane_add(size=200)
    floor=bpy.context.object; floor.name='studio floor'; floor.location.z=-.017
    mat=bpy.data.materials.new('studio'); mat.diffuse_color=(.07,.061,.080,1); mat.use_nodes=True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=mat.diffuse_color
    floor.data.materials.append(mat)
    d=bpy.data.cameras.new('camera'); cam=bpy.data.objects.new('camera',d); scene.collection.objects.link(cam); scene.camera=cam
    views={'ref':((10,-13,7.3),(0,0,1.65),10.4),'game':((11,-11,13),(0,0,1.65),12.8),'front':((14,-.2,4),(0,0,1.8),9),'side':((0,-15,4),(0,0,1.75),10),'rear':((-12,-8,5.5),(0,0,1.75),10)}
    loc,tgt,scale=views[args.view]; cam.location=loc; cam.rotation_euler=(Vector(tgt)-cam.location).to_track_quat('-Z','Y').to_euler(); d.type='ORTHO'; d.ortho_scale=scale
    scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=args.samples; scene.cycles.use_denoising=True; scene.cycles.seed=714
    scene.view_settings.view_transform='AgX'
    scene.render.resolution_x=args.width; scene.render.resolution_y=args.height; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(Path(args.render).resolve())
    bpy.ops.render.render(write_still=True)
    print('RENDER OK',args.render)
    if args.view == 'ref' and ('round' in Path(args.render).name or Path(args.render).name=='hero.png'):
        loc,tgt,scale=views['game']; cam.location=loc; cam.rotation_euler=(Vector(tgt)-cam.location).to_track_quat('-Z','Y').to_euler(); d.ortho_scale=scale
        scene.render.filepath=str(Path(args.render).resolve()).replace('-ref.png','-game.png').replace('hero.png','game.png')
        scene.render.resolution_x=960; scene.render.resolution_y=540; scene.cycles.samples=24
        bpy.ops.render.render(write_still=True)
        print('RENDER OK',scene.render.filepath)

if args.glb and not DISTANCE:
    build_native_lods(__file__)
