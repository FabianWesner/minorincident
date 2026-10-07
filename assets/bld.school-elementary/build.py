"""Sunset Grove Elementary. Deterministic metres, Z up, entrance toward +X.
Geometry-only brickwork and signage; no textures. Static meshes merged per material
and semantic group. Doors hinge vertically; removable roof and lanterns stay separate.
"""
import argparse
import json
import math
from pathlib import Path
import bpy
import bmesh
from mathutils import Matrix, Vector

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.distance import tier_argument, export_variant, build_native_lods
DISTANCE = tier_argument()

HERE = Path(__file__).resolve().parent
if '--lod-only' in sys.argv:
    build_native_lods(__file__)
    sys.exit(0)

parser = argparse.ArgumentParser()
parser.add_argument('--render')
parser.add_argument('--view', default='ref')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--glb', default=str(HERE / 'model.glb'))
import sys
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
model = bpy.data.collections.new('School')
scene.collection.children.link(model)
groups = {}

def group(name, loc=(0,0,0), parent='root'):
    obj = bpy.data.objects.new(name, None)
    model.objects.link(obj)
    obj.location = loc
    if parent:
        obj.parent = groups[parent]
        obj.matrix_parent_inverse = groups[parent].matrix_world.inverted()
    groups[name] = obj
    bpy.context.view_layer.update()
    return obj

group('root', parent=None)['asset_id'] = 'bld.school-elementary'
group('body'); group('roof'); group('interior')

def linear(hex_color):
    c = [int(hex_color[i:i+2],16)/255 for i in (1,3,5)]
    return [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]

def material(token, color, rough=.65, metal=0, emission=0):
    m = bpy.data.materials.new(('emi_' if emission else 'pal_')+token)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = linear(color)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emission:
        p.inputs['Emission Color'].default_value = linear(color)
        p.inputs['Emission Strength'].default_value = emission
    m.diffuse_color = linear(color)
    return m

M = {
    'brick': material('brick','#a8483a'),
    'cream': material('picketWhite','#f2e6dc'),
    'stone': material('sidewalk','#b9a4a0'),
    'blue': material('backpackTeal','#2f6e6a',.38,.15),
    'dark': material('uiDark','#25222c',.52),
    'roof': material('asphalt','#5b4f5c'),
    'wood': material('woodWarm','#b0703f'),
    'gold': material('schoolBusYellow','#f2b630',.32,.5),
    'glow': material('windowGlow','#ffc773',.25,emission=2.8),
}
# Blue painted framing and muted blue glazing share the palette identity with different
# scalar roughness only; glass is opaque to avoid sorting and retain the toy look.
M['blue'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = linear('#354e70')
M['blue'].diffuse_color = linear('#354e70')


def finish(obj, mat, parent='body', bevel=.02, segments=2):
    if DISTANCE: bevel = 0
    model.objects.link(obj)
    obj.data.materials.append(M[mat])
    if bevel:
        mod=obj.modifiers.new('Soft edges','BEVEL')
        mod.width=bevel; mod.segments=segments
        mod.harden_normals=True
        mod=obj.modifiers.new('Corner normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
    obj.parent=groups[parent]
    obj.matrix_parent_inverse=groups[parent].matrix_world.inverted()
    return obj


def box(name, loc, size, mat, parent='body', bevel=.02, segments=2):
    if DISTANCE: bevel = 0
    bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1)
    bmesh.ops.scale(bm,vec=Vector(size),verts=bm.verts)
    mesh=bpy.data.meshes.new(name); bm.to_mesh(mesh); bm.free()
    obj=bpy.data.objects.new(name,mesh); obj.location=loc
    if name in {'Running bond','Side brick'}: segments=1
    return finish(obj,mat,parent,min(bevel,min(size)*.35),segments)


def front(name, u, z, w, h, mat, x=3.81, depth=.12, parent='body', bevel=.02):
    if DISTANCE: bevel = 0
    return box(name,(x,-u,z),(depth,w,h),mat,parent,bevel)


def cylinder(name, loc, radius, depth, mat, parent='body', axis='z', vertices=24):
    if DISTANCE: vertices = min(vertices, 12 if DISTANCE == 1 else 8)
    bm=bmesh.new(); bmesh.ops.create_cone(bm,cap_ends=True,cap_tris=False,segments=vertices,radius1=radius,radius2=radius,depth=depth)
    mesh=bpy.data.meshes.new(name); bm.to_mesh(mesh); bm.free()
    obj=bpy.data.objects.new(name,mesh); obj.location=loc
    if axis=='x': obj.rotation_euler.y=math.pi/2
    return finish(obj,mat,parent,.01)


def profile(name, points, x0, x1, mat, parent='body', bevel=.025):
    if DISTANCE: bevel = 0
    n=len(points)
    verts=[(x,-u,z) for x in [x0,x1] for u,z in points]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    bm=bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
    obj=bpy.data.objects.new(name,mesh)
    return finish(obj,mat,parent,bevel)


def label(body,u,z,width,size):
    curve=bpy.data.curves.new(body,'FONT'); curve.body=body
    curve.align_x='CENTER'; curve.align_y='CENTER'; curve.size=size
    curve.extrude= 0 if DISTANCE else (.012); curve.bevel_depth= 0 if DISTANCE else (.002); curve.bevel_resolution=1; curve.resolution_u= 2 if DISTANCE else (3)
    font=Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
    if font.exists(): curve.font=bpy.data.fonts.load(str(font))
    obj=bpy.data.objects.new(body,curve); model.objects.link(obj)
    obj.location=(4.475,-u,z); obj.rotation_euler=(math.pi/2,0,math.pi/2)
    obj.data.materials.append(M['dark']); obj.parent=groups['body']
    bpy.context.view_layer.update()
    obj.scale.x=width/obj.dimensions.x
    return obj


def paw(u,z,scale,x=4.48,ground=False):
    # Rounded three-lobed central pad and four oval toes.
    pts=[(-.45,-.30),(-.40,-.04),(-.25,.15),(-.12,.25),(0,.28),(.12,.25),(.25,.15),(.40,-.04),(.45,-.30),(.31,-.39),(0,-.32),(-.31,-.39)]
    obj=profile('Paw pad',[(u+a*scale,z+b*scale) for a,b in pts],x,x+.025,'dark',bevel=.022)
    parts=[obj]
    for a,b,r in [(-.48,.36,.14),(-.20,.58,.16),(.20,.58,.16),(.48,.36,.14)]:
        toe=cylinder('Paw toe',(x+.015,-(u+a*scale),z+b*scale),r*scale,.025,'dark',axis='x')
        toe.scale.x=1.28
        parts.append(toe)
    bpy.context.view_layer.update()
    if ground:
        # All newly made paw geometry is turned down onto the entry paving.
        for o in parts:
            o.parent=None
            o.matrix_world=Matrix.Translation((5.42,0,.273)) @ Matrix.Rotation(-math.pi/2,4,'Y') @ Matrix.Translation((-x,0,-z)) @ o.matrix_world
            o.parent=groups['body']

# Hollow wall volumes, cut by constructing the front as piers and lintels.
box('Foundation',(0,0,.23),(7.6,12,.46),'stone',bevel=.055)
box('Rear wall',(-3.57,0,2.75),(.36,12,5),'brick')
for y in [-5.82,5.82]: box('Side wall',(0,y,2.75),(7.5,.36,5),'brick')
# Front classroom openings centered at +/-4.25, z 2.42, 2.65 wide x 2.45 tall.
for a,b in [(-6,-5.68),(-2.83,-2.25),(2.25,2.83),(5.68,6)]:
    front('Facade pier',(a+b)/2,2.75,b-a,5,'brick',x=3.6,depth=.36)
for u in [-4.25,4.25]:
    front('Window lower wall',u,.76,2.85,1.02,'brick',x=3.6,depth=.36)
    front('Window header',u,4.43,2.85,1.6,'brick',x=3.6,depth=.36)
# The projecting entrance surround and its true recessed doorway.
for u,w in [(-2.12,.60),(2.12,.60),(.59,.24)]:
    front('Entrance brick pier',u,2.21,w,3.92,'brick',x=3.84,depth=.72)
front('Entrance lintel',0,4.14,4.6,.76,'brick',x=3.84,depth=.72)
front('Entrance threshold',0,.38,4.7,.26,'cream',x=3.9,depth=.9)

# Individual running-bond brick courses with open mortar joints.
# Front wall bricks avoid openings; no hidden overlapping skins across glazing.
def opening(u,z):
    return (abs(u)>2.82 and abs(u)<5.70 and 1.26<z<3.69) or (abs(u)<1.81 and .50<z<3.78)
for row in range(22):
    z=.59+row*.214
    u=-6+(row%2)*.30
    while u<6:
        lo=max(-6,u); hi=min(6,u+.59)
        mid=(lo+hi)/2
        if hi-lo>.06 and not opening(mid,z) and not (abs(mid)<2.50 and z>4.02):
            xf=4.215 if abs(mid)<2.42 else 3.805
            # Piers alongside the entrance are intentionally wide brick returns.
            if abs(mid)<1.81 and z<3.78: pass
            else: front('Running bond',mid,z,hi-lo-.018,.194,'brick',x=xf,depth=.052,bevel=.010)
        u+=.61
# Side and rear relief.
for side in [-1,1]:
    for row in range(22):
        z=.59+row*.214
        t=-3.73+(row%2)*.30
        while t<3.73:
            lo=max(-3.73,t); hi=min(3.73,t+.59)
            if hi-lo>.08:
                box('Side brick',((lo+hi)/2,side*6.015,z),(hi-lo-.018,.052,.194),'brick',bevel=.01)
            t+=.61
# Cream foundation band, cornice and separately jointed coping stones.
for side in [-1,1]:
    box('Side plinth',(0,side*6.06,.46),(7.7,.22,.65),'cream',bevel=.04)
    box('Side belt',(0,side*6.055,3.98),(7.7,.20,.44),'cream',bevel=.035)
for u in [-4.30,4.30]:
    front('Classroom belt',u,3.98,3.45,.44,'cream',depth=.22,x=3.89)
    front('Front plinth',u,.48,3.45,.58,'cream',depth=.22,x=3.9)
for u in [-5.78,-2.16,2.16,5.78]:
    front('Pier foot',u,.55,.78,1.0,'cream',x=4.04 if abs(u)<3 else 3.96,depth=.64)
    front('Pier cap',u,4.98,.83,.28,'cream',x=4.02 if abs(u)<3 else 3.94,depth=.68)
# Classroom windows with deep blue jambs, layered mullions, reflective opaque panes.
def window(u,w,z=2.43,h=2.38,x=3.91):
    front('Window shadow',u,z,w+.16,h+.12,'dark',x=x-.12,depth=.10)
    for a in [-1,1]:
        front('Window jamb',u+a*w/2,z,.105,h+.12,'blue',x=x,depth=.16)
        front('Window transom',u,z+a*h/2,w+.12,.105,'blue',x=x,depth=.16)
    for i in range(3):
        for j in range(2):
            pu=u-w/2+(i+.5)*w/3; pz=z-h/2+(j+.5)*h/2
            front('Glazing',pu,pz,w/3-.08,h/2-.08,'roof',x=x-.028,depth=.03,bevel=.006)
            # Dim classroom shapes behind the stylized glazing; proud of dark backing.
            front('Room reflection',pu+.06,pz-.17,w/3-.21,.21,'roof',x=x-.005,depth=.009,bevel=.004)
            front('Warm desk silhouette',pu-.09,pz-.29,w/3-.32,.075,'wood',x=x+.005,depth=.009,bevel=.003)
    for offset in [-w/6,w/6]: front('Window mullion',u+offset,z,.075,h,'blue',x=x+.026,depth=.12)
    front('Window crossbar',u,z,w,.070,'blue',x=x+.045,depth=.10)
    front('Stone sill',u,z-h/2-.14,w+.32,.22,'cream',x=x+.01,depth=.35,bevel=.035)
for u in [-4.25,4.25]: window(u,2.70)
window(1.22,1.0,z=2.14,h=3.12,x=3.925)
# Side windows are deliberately surface-mounted on a deep dark reveal.
for side in [-1,1]:
    for t in [-1.8,.25,2.05]:
        box('Side window reveal',(t,side*6.056,2.45),(1.59,.10,2.45),'roof')
        for a in [-1,1]:
            box('Side jamb',(t+a*.79,side*6.14,2.45),(.09,.12,2.5),'blue')
            box('Side transom',(t,side*6.14,2.45+a*1.22),(1.68,.12,.09),'blue')
        for dz in [-.35,.45]: box('Side crossbar',(t,side*6.18,2.45+dz),(1.57,.09,.07),'blue')
        box('Side mullion',(t,side*6.18,2.45),(.08,.09,2.40),'blue')
        box('Side sill',(t,side*6.16,1.12),(1.84,.35,.20),'cream',bevel=.04)
# Double doors, each assembly kept under a hinge origin.
for idx,(u,hinge) in enumerate([(-0.15,.40),(-1.27,-1.82)]):
    name='door_'+('L' if idx==0 else 'R')
    group(name,(3.86,-hinge,.53))
    front('Door dark glazing',u,2.14,1.05,3.10,'roof',x=3.87,depth=.075,parent=name)
    for a in [-1,1]: front('Door upright',u+a*.53,2.14,.15,3.19,'blue',x=3.94,depth=.14,parent=name)
    for z in [.59,1.64,3.70]: front('Door cross rail',u,z,1.16,.16 if z>1 else .28,'blue',x=3.96,depth=.12,parent=name)
    for z in [1.12,2.43,3.30]: front('Door reflection',u+.09,z,.62,.22,'roof',x=3.916,depth=.009,parent=name,bevel=.004)
    front('Push bar',u,1.71,.70,.075,'gold',x=4.042,depth=.06,parent=name)
    front('Handle',u+(-.39 if idx==0 else .39),1.87,.067,.40,'gold',x=4.085,depth=.11,parent=name)
    front('Kick plate',u,.68,.94,.22,'stone',x=4.038,depth=.035,parent=name)
    for z in [.84,2.10,3.42]: cylinder('Door hinge',(3.965,-hinge,z),.035,.17,'gold',parent=name)
for u in [.48,-1.90]: front('Entry stone jamb',u,2.13,.16,3.38,'cream',x=3.92,depth=.39)
# A large cream stepped pediment, not a rectangular sign.
points=[(-2.5,4.02),(2.5,4.02),(2.5,5.08),(1.72,5.08),(1.58,5.31),(1.30,5.41),(1.10,6.02),(-1.10,6.02),(-1.30,5.41),(-1.58,5.31),(-1.72,5.08),(-2.5,5.08)]
profile('Stepped entrance sign',points,3.98,4.44,'cream',bevel=.045)
front('Sign top coping',0,6.05,2.42,.18,'cream',x=4.36,depth=.43,bevel=.035)
front('Sign base molding',0,4.05,5.22,.17,'cream',x=4.46,depth=.35,bevel=.025)
label('SUNSET GROVE',0,4.95,3.99,.47)
label('ELEMENTARY',0,4.47,3.42,.44)
paw(0,5.50,.52)
# Lanterns: warm luminous cores, open frame, pyramid cap, mounting bracket.
for u,name in [(-2.13,'lampL'),(2.13,'lampR')]:
    group(name,(4.29,-u,2.37))
    front('Lantern backplate',u,2.37,.18,.55,'dark',x=4.27,depth=.055,parent=name)
    box('Lantern arm',(4.43,-u,2.10),(.36,.07,.07),'dark',name)
    cylinder('Lantern finial',(4.53,-u,2.97),.047,.12,'dark',name)
    box('Lantern base',(4.54,-u,2.17),(.39,.40,.12),'gold',name,bevel=.03)
    core=box('Lantern glow',(4.54,-u,2.53),(.30,.32,.59),'glow',name,bevel=.02)
    core.name=name+'_glass'
    for a in [-1,1]:
        for b in [-1,1]: box('Lantern frame',(4.54+a*.17,-u+b*.18,2.53),(.045,.045,.66),'dark',name,.009)
    bm=bmesh.new(); bmesh.ops.create_cone(bm,cap_ends=True,segments=4,radius1=.31,radius2=.075,depth=.19)
    me=bpy.data.meshes.new('Lantern cap'); bm.to_mesh(me); bm.free()
    cap=bpy.data.objects.new('Lantern cap',me); cap.location=(4.54,-u,2.92); cap.rotation_euler.z=math.pi/4
    finish(cap,'dark',name,.015)
    anchor=group('light:'+name,(4.56,-u,2.53),parent=name)
    anchor['ss_light']=json.dumps({'type':'point','color':'light_window_warm','intensity':2.5,'range':4,'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'hero','heroPriority':1,'flicker':'none','animation':None,'powerGroup':'school','breakable':True,'emissiveNodes':[name+'_glass'],'tiers':'all'})
# Stone paving with actual joints, two step levels and surface paw.
for ix in range(4):
    for iy in range(6):
        box('Entry paver',(4.15+ix*.55,-2.45+iy*.98,.13),(.535,.96,.26),'cream',bevel=.028)
for iy in range(6): box('Upper step',(3.95,-2.45+iy*.98,.30),(.62,.96,.34),'cream',bevel=.028)
paw(0,0,.75,x=0,ground=True)
# Flat roof with parapet; roof assembly can be hidden for indoor play.
box('Roof deck',(-.03,0,4.76),(7.35,11.65,.18),'roof','roof',.035)
for side in [-1,1]:
    box('Side parapet',(0,side*5.81,4.96),(7.55,.36,.48),'brick','roof')
    for i in range(8): box('Side coping',(-2.87+i*.82,side*5.83,5.24),(.80,.55,.19),'cream','roof',.027)
for end in [-1,1]:
    box('End parapet',(end*3.57,0,4.96),(.36,11.60,.48),'brick','roof')
    for i in range(12):
        u=-5.5+i
        if end<0 or abs(u)>2.5: box('End coping',(end*3.61,-u,5.24),(.54,.98,.19),'cream','roof',.027)
for x in [-3.61,3.61]:
    for y in [-5.83,5.83]: box('Corner coping cap',(x,y,5.31),(.78,.84,.25),'cream','roof',.045)
# Roof membrane seam grid raised 6 mm.
for x in [-2.7,-1.35,0,1.35,2.7]: box('Roof seam',(x,0,4.856),(.025,11.25,.012),'stone','roof',.002)
for y in [-4.5,-3,-1.5,0,1.5,3,4.5]: box('Roof seam',(-.03,y,4.870),(7.0,.025,.012),'stone','roof',.002)
# HVAC square cabinet, grilles, raised plinth, roof ventilators.
box('HVAC plinth',(-1.75,-3.22,4.94),(1.25,1.40,.19),'stone','roof')
box('HVAC cabinet',(-1.75,-3.22,5.43),(1.02,1.20,.85),'cream','roof',.045)
box('HVAC top',(-1.75,-3.22,5.88),(1.14,1.32,.09),'cream','roof')
for x,y,sx,sy in [(-1.22,-3.22,.04,.94),(-1.75,-3.835,.81,.04)]:
    box('Vent recess',(x,y,5.43),(sx,sy,.61),'dark','roof',.009)
    for i in range(9): box('Grille louver',(x+.025 if sx<.1 else x,y-.025 if sy<.1 else y,5.18+i*.060),(sx+.035,sy+.035,.023),'blue','roof',.003)
for x,y in [(1.5,3.5),(2.1,-3.1)]:
    box('Vent base',(x,y,4.96),(.63,.66,.20),'stone','roof')
    box('Vent neck',(x,y,5.14),(.39,.40,.24),'roof','roof')
    box('Vent cap',(x,y,5.28),(.60,.62,.15),'stone','roof',.035)
cylinder('Roof pipe',(-1.65,3.72,5.23),.10,.69,'stone','roof')
cylinder('Pipe collar',(-1.65,3.72,4.99),.17,.10,'stone','roof')
cylinder('Pipe cap',(-1.65,3.72,5.60),.16,.10,'stone','roof')
cylinder('Pipe dark opening',(-1.65,3.72,5.655),.105,.014,'dark','roof')
# Interior floor and simple classroom furnishings for roof hiding.
box('Interior floor',(0,0,.48),(7.04,11.27,.08),'wood','interior')
for y in [-4.3,-2.7,2.7,4.3]:
    for x in [-1.8,.1,1.9]:
        box('Desk',(x,y,1.12),(.65,1.04,.09),'wood','interior')
        for a in [-1,1]:
            for b in [-1,1]: box('Desk leg',(x+a*.24,y+b*.42,.81),(.05,.05,.58),'dark','interior',.008)
# Collider extras are empties, never rendered meshes.
col=group('col:building',(0,0,2.65)); col['collider']='cuboid'; col['size']=[7.5,12,5.3]

if DISTANCE:
    export_variant(Path(__file__).parent, DISTANCE, omit=('Side brick',), far_omit=('Running bond', 'Side brick', 'Desk', 'bolt', 'fastener', 'Paw pad', 'Paw toe', 'Roof seam', 'Grille louver', 'Warm desk silhouette','Door hinge','Room reflection'))

# Apply all modifiers then merge by material within semantic parent groups.
for obj in list(model.objects):
    if obj.type in {'MESH','FONT'}:
        bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj
        bpy.ops.object.convert(target='MESH')
        for mod in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
for parent in list(groups.values()):
    buckets={}
    for obj in list(model.objects):
        if obj.type=='MESH' and obj.parent==parent and not obj.name.endswith('_glass'):
            buckets.setdefault(obj.data.materials[0].name,[]).append(obj)
    for mat,objects in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
        objects[0].name=parent.name+'_'+mat
for obj in model.objects:
    if obj.type=='MESH':
        bm=bmesh.new(); bm.from_mesh(obj.data)
        bmesh.ops.triangulate(bm,faces=list(bm.faces))
        zero=[f for f in bm.faces if f.calc_area()<1e-10]
        if zero: bmesh.ops.delete(bm,geom=zero,context='FACES')
        bm.to_mesh(obj.data); bm.free()
bpy.context.view_layer.update()
points=[o.matrix_world@Vector(v) for o in model.objects if o.type=='MESH' for v in o.bound_box]
center=Vector(((min(v.x for v in points)+max(v.x for v in points))/2,
               (min(v.y for v in points)+max(v.y for v in points))/2,0))
for child in groups['root'].children: child.location-=center
bpy.context.view_layer.update()
# Deterministic CPU Cycles ambient occlusion baked directly into COLOR_0.
meshes=[obj for obj in model.objects if obj.type=='MESH']
for obj in meshes:
    ao=obj.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
    obj.data.color_attributes.active_color=ao
    obj.data.color_attributes.render_color_index=0
scene.render.engine='CYCLES'; scene.cycles.device='CPU'
scene.cycles.samples=32; scene.cycles.seed=17
scene.render.bake.target='VERTEX_COLORS'
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes: obj.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.bake(type='AO',use_clear=True)
# Preserve warm palette readability: AO modulates, rather than blackens, paint.
for obj in meshes:
    for c in obj.data.color_attributes['ao'].data:
        v=.65+.35*max(0,min(1,c.color[0])); c.color=(v,v,v,1)
print('AO OK')


def metrics():
    tris=0; draws=0
    for o in model.objects:
        if o.type=='MESH':
            o.data.calc_loop_triangles(); tris+=len(o.data.loop_triangles); draws+=len(o.data.materials)
    return tris,draws

def export(path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in model.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_materials='EXPORT',export_vertex_color='ACTIVE',export_all_vertex_colors=False)

export(args.glb)
triangles,draws=metrics()
report={'id':'bld.school-elementary','tier':'Hero','triangles':triangles,'draw_calls':draws,'materials':sorted(m.name for m in M.values()),'nodes_ok':all(n in groups for n in ['root','roof','interior','door_L','door_R']),'within_budget':triangles<=100000 and draws<=40,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-metrics.json').write_text(json.dumps(report,indent=2))
# Preserve closed masonry and rooftop silhouettes at play distance.

if args.render:
    scene.render.engine='CYCLES'; scene.cycles.samples=args.samples; scene.cycles.use_denoising=True
    scene.cycles.seed=47
    scene.render.resolution_x=args.width; scene.render.resolution_y=args.height; scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('Warm studio'); scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.105,.15,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
    def area(name,loc,power,color,size):
        data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.color=color; data.shape='DISK'; data.size=size
        o=bpy.data.objects.new(name,data); scene.collection.objects.link(o); o.location=loc
        o.rotation_euler=(Vector((0,0,2.2))-o.location).to_track_quat('-Z','Y').to_euler()
    area('Sun softbox',(5,-8,13),4000,(1,.66,.40),8)
    area('Fill',(2,9,10),2100,(.63,.72,1),9)
    area('Rim',(-7,-2,12),2800,(1,.83,.65),7)
    for u in [-2.13,2.13]:
        d=bpy.data.lights.new('Warm entrance','POINT'); d.energy=35; d.color=(1,.48,.12); d.shadow_soft_size=.30
        o=bpy.data.objects.new('Warm entrance',d); scene.collection.objects.link(o); o.location=Vector((4.65,-u,2.5))-center
    camdata=bpy.data.cameras.new('Review camera'); cam=bpy.data.objects.new('Review camera',camdata); scene.collection.objects.link(cam)
    target=Vector((.65,0,2.9))-center
    view={'ref':(24,-12,17),'game':(17,-21,23),'front':(24,0,8),'side':(0,-25,9),'rear':(-22,15,13)}[args.view]
    cam.location=target+Vector(view); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    camdata.type='ORTHO'; camdata.ortho_scale=23.5 if args.view!='game' else 25.5; scene.camera=cam
    scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG'; scene.render.filepath=args.render
    Path(args.render).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
    if args.view=='ref' and args.samples==24:
        cam.location=target+Vector((17,-21,23))
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        camdata.ortho_scale=25.5
        scene.render.filepath=str(Path(args.render).with_name(Path(args.render).stem.replace('-ref','-game')+'.png'))
        bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))

if args.glb and not DISTANCE:
    build_native_lods(__file__)
