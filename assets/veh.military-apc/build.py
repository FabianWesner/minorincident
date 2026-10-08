"""Method A: deterministic 6x6 APC, metres, Blender +X front / +Z up.
Native LODs retain motion pivots and rebuild with fewer segments/details.
"""
import argparse
import json
import math
from pathlib import Path
import sys
import bpy
import bmesh
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib import palette, primitives as P, sockets, export, ao
from sslib.distance import tier_argument, build_native_lods

TIER = tier_argument()
p = argparse.ArgumentParser()
p.add_argument('--glb', required=True)
p.add_argument('--quality', default='high', choices=['high', 'low'])
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in list(bpy.data.meshes):
    if data.users == 0: bpy.data.meshes.remove(data)
root = sockets.empty('veh.military-apc')
root['ss_physics'] = json.dumps({'class': 'heavy', 'mass': 10500, 'friction': .8,
    'restitution': .04, 'centerOfMass': [0, 1.05, 0], 'pushable': False,
    'kickable': False, 'flammable': True})
owners = {'body': sockets.empty('body', parent=root),
          'lightsFront': sockets.empty('lightsFront', (2.74,0,1.22), root)}

def attach(obj, owner='body'):
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = owners[owner]
    obj.matrix_world = world
    return obj

def box(name, loc, size, token='olive', bevel=.035, owner='body', rot=None, emissive=False):
    obj = P.rounded_box(name, size, palette.mat(token, emissive), loc, bevel=0 if TIER else bevel)
    obj.modifiers['bevel'].segments = 1
    if rot: obj.rotation_euler = rot
    return attach(obj, owner)

def cyl(name, loc, radius, depth, token='oliveSeam', owner='body', axis='Z', segments=20):
    obj = P.cylinder(name, radius, depth, palette.mat(token), loc,
                     vertices=min(segments, [segments, 12, 8][TIER]))
    if axis == 'Y': obj.rotation_euler.x = math.pi / 2
    if axis == 'X': obj.rotation_euler.y = math.pi / 2
    return attach(obj, owner)

def rod(name, a, b, radius=.025, token='oliveSeam', owner='body'):
    a, b = Vector(a), Vector(b)
    obj = cyl(name, (a+b)/2, radius, (b-a).length, token, owner, segments=8)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj

# A closed chamfered armor hull with a steep glacis and narrow roof.
# Each ring is clockwise viewed from the front; normals are recalculated below.
rings = [(-2.65, .98, .76, 1.69), (-2.26, 1.23, .79, 2.20),
         (1.27, 1.23, .79, 2.20), (2.65, .96, .79, 1.36)]
verts = []
for x, w, low, high in rings:
    verts.extend([(x,-w,low), (x,w,low), (x,w,high-.30),
                  (x,w-.24,high), (x,-w+.24,high), (x,-w,high-.30)])
faces = [tuple(reversed(range(6))), tuple(range(18,24))]
for j in range(3):
    for i in range(6): faces.append((j*6+i,j*6+(i+1)%6,(j+1)*6+(i+1)%6,(j+1)*6+i))
mesh = bpy.data.meshes.new('sloped armor hull'); mesh.from_pydata(verts, [], faces)
obj = bpy.data.objects.new(mesh.name, mesh); bpy.context.scene.collection.objects.link(obj)
mesh.materials.append(palette.mat('olive')); attach(obj)
box('roof armor', (-.48,0,2.20), (3.44,1.96,.10), 'oliveLight')
box('chassis', (0,0,.76), (4.8,1.65,.22), 'oliveSeam')
for x, prefix in [(1.78,'wheelF'),(-.32,'wheelM'),(-1.91,'wheelR')]:
    if TIER < 2: cyl('axle', (x,0,.57), .085, 2.65, 'uiDark', axis='Y')
    for s, side in [(-1,'L'),(1,'R')]:
        name = prefix+side; y = s*1.24
        owners[name] = sockets.empty(name,(x,y,.60),root)
        cyl('tire',(x,y,.60),.60,.46,'uiDark',name,'Y',32)
        cyl('wheel rim',(x,y+s*.24,.60),.34,.035,'oliveLight',name,'Y',20)
        cyl('wheel hub',(x,y+s*.27,.60),.13,.09,'oliveSeam',name,'Y',12)
        if not TIER:
            for i in range(16):
                a=i*math.tau/16
                box('tread',(x+.59*math.sin(a),y,.60+.59*math.cos(a)),(.16,.43,.06),
                    'uiDark',.008,name,(0,a,0))
            for i in range(6):
                a=i*math.tau/6
                cyl('lug',(x+.23*math.sin(a),y+s*.27,.60+.23*math.cos(a)),.025,.025,
                    'oliveSeam',name,'Y',6)
        # Deliberately broad armor brow leaves the full tire silhouette readable.
        box('fender',(x,s*1.21,1.31),(1.48,.55,.12),'oliveLight')
        if TIER < 2:
            box('mudflap',(x-.70,s*1.23,.87),(.055,.44,.49),'uiDark',.008)

# Driver vision blocks on the glacis, side ports, rear personnel door.
for s in [-1,1]:
    box('vision surround',(1.71,s*.48,1.986),(.085,.66,.27),'oliveSeam',.02,rot=(0,.55,0))
    box('vision glass',(1.76,s*.48,2.01),(.025,.53,.16),'tealDark',.008,rot=(0,.55,0))
    for x in [-1.47,-.63,.26]:
        box('side firing port',(x,s*1.237,1.77),(.26,.035,.13),'oliveSeam',.01)
    if TIER < 2:
        box('side stowage',(-1.62,s*1.24,1.47),(.88,.20,.32),'khaki',.04)
        for x in [-1.90,-1.35]: box('stowage strap',(x,s*1.35,1.47),(.055,.025,.29),'oliveSeam',.005)
        rod('side grab rail',(-.82,s*1.26,1.47),(.75,s*1.26,1.47))
        for x in [-.82,.75]: rod('rail support',(x,s*1.22,1.47),(x,s*1.26,1.47))
    box('headlamp guard',(2.67,s*.72,1.22),(.13,.39,.29),'oliveSeam',.025)
    box('headlamp',(2.745,s*.72,1.22),(.025,.26,.16),'windowGlow',.01,'lightsFront',emissive=True)
owners['lightsBrake'] = sockets.empty('lightsBrake', (-2.69,0,1.1), root)
for s in [-1,1]:
    box('brake lens',(-2.69,s*.79,1.1),(.03,.20,.13),'sirenRed',.008,'lightsBrake',emissive=True)
box('front bumper',(2.72,0,.91),(.25,2.36,.21),'oliveSeam')
box('rear bumper',(-2.72,0,.89),(.25,2.36,.18),'oliveSeam')
box('rear door',(-2.667,0,1.28),(.045,1.12,.90),'oliveLight',.02)
if TIER < 2:
    for y in [-.50,.50]:
        for z in [1.02,1.56]: box('rear hinge',(-2.70,y,z),(.04,.14,.07),'oliveSeam',.008)
    box('rear latch',(-2.71,.30,1.32),(.04,.21,.05),'uiDark',.006)
    box('engine grille',(-1.53,0,2.27),(.78,.85,.045),'oliveSeam',.01)
    for i in range(7): box('grille rib',(-1.85+i*.105,0,2.30),(.03,.78,.03),'uiDark',.003)
    cyl('driver hatch',(.69,0,2.28),.36,.10,'oliveSeam')
    rod('hatch handle',(.56,-.13,2.35),(.82,-.13,2.35))
    rod('antenna',(-1.89,.73,2.30),(-1.99,.73,3.26),.014,'uiDark')
# Painted geometric identification, no font/texture dependency.
for s in [-1,1]:
    starverts=[(-.43,s*1.254,1.56)]
    for i in range(10):
        a=math.pi/2+i*math.pi/5; r=.28 if i%2==0 else .12
        starverts.append((-.43+r*math.cos(a),s*1.254,1.56+r*math.sin(a)))
    data=bpy.data.meshes.new('unit star'); data.from_pydata(starverts,[],[(0,i+1,(i+1)%10+1) for i in range(10)])
    data.materials.append(palette.mat('picketWhite'))
    obj=bpy.data.objects.new('unit star',data); bpy.context.scene.collection.objects.link(obj); attach(obj)

# Roof weapon: independently yawing turret with gun elevation pivot.
owners['turret']=sockets.empty('turret',(-.38,0,2.29),root)
cyl('turret ring',(-.38,0,2.31),.53,.14,'oliveSeam','turret')
cyl('turret cupola',(-.38,0,2.46),.42,.25,'oliveLight','turret')
box('gun shield',(-.13,0,2.91),(.17,1.0,.69),'olive',.025,'turret',rot=(0,-.16,0))
owners['gun']=sockets.empty('gun',(.02,0,2.83),owners['turret'])
# sockets.empty locations are local; preserve a world-space elevation pivot.
owners['gun'].location=(.40,0,.54)
box('receiver',(.18,0,2.83),(.60,.18,.20),'uiDark',.016,'gun')
cyl('barrel',(.99,0,2.83),.048,1.12,'uiDark','gun','X',12)
cyl('barrel jacket',(.65,0,2.83),.071,.39,'oliveSeam','gun','X',12)
cyl('muzzle brake',(1.58,0,2.83),.065,.12,'uiDark','gun','X',12)
box('ammo box',(.06,-.25,2.81),(.33,.27,.24),'khaki',.02,'gun')
if TIER < 2:
    box('sight',(.42,0,2.97),(.06,.055,.13),'uiDark',.005,'gun')
    for s in [-1,1]: rod('gun grip',(-.22,s*.14,2.82),(-.22,s*.14,2.68),.026,'uiDark','gun')
sockets.empty('muzzle',(1.62,0,0),owners['gun'])
sockets.empty('front',(2.82,0,1.1),root)
for name, loc in {'driverSeat':(.71,-.46,1.46),'exitL':(-1.3,-1.8,0),'exitR':(-1.3,1.8,0)}.items():
    sockets.empty(name,loc,root)
for s,label in [(-1,'L'),(1,'R')]:
    anchor=sockets.empty('light:head'+label,(2.77,s*.72,1.22),root)
    anchor.rotation_euler=(0,-math.pi/2,0)
    anchor['ss_light']=json.dumps({'type':'spot','color':'light_window_warm','intensity':5,
        'range':24,'angle':48,'penumbra':.35,'pool':True,'beam':'soft','flare':True,
        'reflect':True,'shadow':'hero','heroPriority':2,'powerGroup':'self','breakable':True,
        'emissiveNodes':['lightsFront_emi_windowGlow'],'tiers':'all'})
    brake=sockets.empty('light:brake'+label,(-2.72,s*.79,1.1),root)
    brake['ss_light']=json.dumps({'type':'point','color':'light_siren_red','intensity':2,
        'range':3,'powerGroup':'self','emissiveNodes':['lightsBrake_emi_sirenRed'],'tiers':'all'})

export.merge_by_material(root, set(owners))
meshes=[o for o in root.children_recursive if o.type=='MESH']
for obj in meshes:
    bm=bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data); bm.free()
# Vertex AO is baked after final geometry batching, before each tier exports.
ao.bake_all(meshes,samples=16 if TIER else 32)
export.glb(root,Path(args.glb).resolve())
if not TIER and Path(args.glb).resolve() != Path(__file__).parent / 'model.glb':
    export.glb(root,Path(__file__).parent / 'model.glb')
count=sum(len(o.data.polygons) for o in meshes)
stats={'triangles':count,'meshes':len(meshes),'bytes':Path(args.glb).stat().st_size}
print('APC LOD',TIER,json.dumps(stats))
(Path(__file__).parent / ('build-stats.json' if not TIER else 'build-stats.lod%d.json'%TIER)).write_text(json.dumps(stats,indent=2)+'\n')
if not TIER: build_native_lods(__file__)
