"""Reproducible texture-free Hero helipad. +X forward, metres, Z-up.
Static parts join by material; four serviceable landing lamps retain base pivots.
Paint, chips and cracks are raised >= 3 mm. LODs preserve the same node contract.
"""
import argparse
import json
import math
import random
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

p = argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
p.add_argument('--glb')
args = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
rng = random.Random(733)


def material(token, color, emission=0, metallic=0):
    rgb = [int(color[i:i+2],16)/255 for i in (1,3,5)]
    rgb = [c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb]
    m = bpy.data.materials.new(('emi_' if emission else 'pal_')+token)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb,1)
    b.inputs['Roughness'].default_value = .78 if not metallic else .36
    b.inputs['Metallic'].default_value = metallic
    if emission:
        b.inputs['Emission Color'].default_value = (*rgb,1)
        b.inputs['Emission Strength'].default_value = emission
    m.diffuse_color = (*rgb,1)
    return m

M = {t:material(t,c) for t,c in {
    'asphalt':'#5b4f5c','sidewalk':'#b9a4a0','picketWhite':'#f2e6dc',
    'schoolBusYellow':'#f2b630','uiDark':'#25222c','woodWarm':'#b0703f',
    'grass':'#6f8f3a'}.items()}
M['glow'] = material('windowGlow','#ffc773',3)
M['uiDark'].node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.25


def empty(name, loc=(0,0,0), parent=None):
    o = bpy.data.objects.new(name,None); scene.collection.objects.link(o)
    o.location=loc; o.parent=parent
    return o

root = empty('root'); root['asset_id']='bld.helipad'; root['category']='building'
root['tier']='Hero'; root['forward']='+X'
body = empty('body',parent=root)
collider = empty('col:platform',(0,0,.375),root)
collider['collider'] = 'cuboid'
collider['size'] = [10,10,.75]


def mesh(name, vertices, faces, token, parent=body, bevel=0):
    if DISTANCE: bevel = 0
    data=bpy.data.meshes.new(name); data.from_pydata(vertices,[],faces); data.update()
    o=bpy.data.objects.new(name,data); scene.collection.objects.link(o)
    o.data.materials.append(M[token]); o.parent=parent
    if name.startswith(('Fresnel lens rib','Worn paint fleck','Circle paint chip','H paint chip','Deck crack','Crack branch','Concrete fixing recess','Concrete spall','Foot bolt')):
        group=o.vertex_groups.new(name='LOD_detail'); group.add(list(range(len(vertices))),1,'REPLACE')
    if name.startswith(('Deck panel','Raised yellow hazard stripe')):
        group=o.vertex_groups.new(name='LOD_preserve'); group.add(list(range(len(vertices))),1,'REPLACE')
    if name in ('Foundation','Dark expansion bed'):
        group=o.vertex_groups.new(name='LOD_support'); group.add(list(range(len(vertices))),1,'REPLACE')
    if bevel:
        b=o.modifiers.new('Soft manufactured edges','BEVEL'); b.width=bevel; b.segments=2
        b.limit_method='ANGLE'
        n=o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL'); n.keep_sharp=True
    return o


def box(name, c, size, token, parent=body, bevel=.025):
    if DISTANCE: bevel = 0
    x,y,z=[s/2 for s in size]
    vs=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    o=mesh(name,vs,[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],token,parent,min(bevel,min(size)*.3))
    o.location=c
    return o


def cylinder(name, c, r, height, token, parent=body, sides=24, bevel=.01):
    if DISTANCE: bevel = 0; sides = min(sides, 12 if DISTANCE == 1 else 8)
    vs=[(r*math.cos(2*math.pi*i/sides),r*math.sin(2*math.pi*i/sides),z) for z in (-height/2,height/2) for i in range(sides)]
    fs=[tuple(reversed(range(sides))),tuple(range(sides,2*sides))]
    fs += [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    o=mesh(name,vs,fs,token,parent,bevel); o.location=c
    if bevel: o.modifiers['Soft manufactured edges'].segments=1
    for f in o.data.polygons:
        if len(f.vertices)==4: f.use_smooth=True
    return o


def polygon(name, points, z, token, parent=body):
    # Paint has a solid 4 mm thickness; no underlying coplanar face.
    n=len(points); vs=[(x,y,h) for h in (z,z+.004) for x,y in points]
    fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    fs += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,vs,fs,token,parent)


placed_chips = []

def chip(name,x,y,rx,ry,z,token,n=7):
    # Reject overlapping wear polygons on the same height to prevent z-fighting.
    if any(abs(z-h)<.03 and abs(x-a)<1.12*(rx+r) and abs(y-b)<1.12*(ry+t) for a,b,r,t,h in placed_chips):
        return None
    placed_chips.append((x,y,rx,ry,z))
    angles=[2*math.pi*i/n for i in range(n)]
    pts=[(x+rx*math.cos(a)*rng.uniform(.65,1.1),y+ry*math.sin(a)*rng.uniform(.65,1.1)) for a in angles]
    o=polygon(name,pts,z,token)
    if token!='woodWarm':
        group=o.vertex_groups.get('LOD_detail') or o.vertex_groups.new(name='LOD_detail')
        group.add(list(range(len(o.data.vertices))),1,'REPLACE')
    return o


def ribbon(name, points, width, z, token):
    # One continuous strip keeps bends free of overlapping coplanar quads.
    left=[]; right=[]
    for i,point in enumerate(points):
        a=points[max(0,i-1)]; b=points[min(len(points)-1,i+1)]
        dx,dy=b[0]-a[0],b[1]-a[1]; d=math.hypot(dx,dy)
        nx,ny=-dy/d*width/2,dx/d*width/2
        left.append((point[0]+nx,point[1]+ny)); right.append((point[0]-nx,point[1]-ny))
    polygon(name,left+list(reversed(right)),z,token)

# Load-bearing slab and sixteen flat paving quads; seams retain their original width.
box('Foundation',(0,0,.34),(9.98,9.98,.68),'sidewalk',bevel=.075)
box('Dark expansion bed',(0,0,.67),(9.46,9.46,.12),'uiDark',bevel=.025)
for i in range(4):
    for j in range(4):
        x,y=-3.45+2.3*i,-3.45+2.3*j
        half=1.123  # Keep the previous flat tile face and visible expansion seams.
        mesh('Deck panel %d %d'%(i,j),[(x-half,y-half,.75),(x+half,y-half,.75),(x+half,y+half,.75),(x-half,y+half,.75)],[(0,1,2,3)],'asphalt')

# Concrete curb sections follow the reference: flush top, hefty beveled edges.
for side in range(4):
    for i in range(6):
        u=-4.17+i*1.668 if side%2==0 else -3.8833+i*1.5533
        c=(u,-4.83,.375) if side==0 else (4.83,u,.375) if side==1 else (u,4.83,.375) if side==2 else (-4.83,u,.375)
        size=(1.65,.34,.75) if side%2==0 else (.34,1.535,.75)
        box('Curb section',c,size,'sidewalk',bevel=.055)
        # Small concrete pores and chipped top-edge detail.
        pore=cylinder('Concrete fixing recess', (u,-5.013,.47) if side==0 else (5.013,u,.47) if side==1 else (u,5.013,.47) if side==2 else (-5.013,u,.47), .024,.014,'asphalt',sides=8,bevel=0)
        pore.rotation_euler=(math.pi/2,0,0) if side%2==0 else (0,math.pi/2,0)
        tx,ty=(u,-4.90) if side==0 else (4.90,u) if side==1 else (u,4.90) if side==2 else (-4.90,u)
        chip('Curb top chip',tx,ty,.046,.025,.754,'asphalt',n=6)
        # Small exposed aggregate chips at the lower edge, face proud of concrete.
        for k in range(3):
            q=u-.48+k*.48+rng.uniform(-.06,.06); z=rng.uniform(.06,.20)
            pts=[(-.10,0),(-.13,.09),(-.06,.15),(.03,.12),(.09,.18),(.13,.07),(.08,0)]
            verts=[(q+a,-5.004,z+b) if side==0 else (5.004,q+a,z+b) if side==1 else (q+a,5.004,z+b) if side==2 else (-5.004,q+a,z+b) for a,b in pts]
            face=tuple(reversed(range(len(verts)))) if side<2 else tuple(range(len(verts)))
            mesh('Concrete spall',verts,[face],'asphalt')
        for k in range(2):
            q=u+rng.uniform(-.6,.6)
            c2=(q,-5.006,.04) if side==0 else (5.006,q,.04) if side==1 else (q,5.006,.04) if side==2 else (-5.006,q,.04)
            size2=(rng.uniform(.04,.12),.014,.047) if side%2==0 else (.014,rng.uniform(.04,.12),.047)
            box('Moss at concrete foot',c2,size2,'grass',bevel=0)

# Two inset-looking chevron plates; every stripe stands 6 mm above its dark plate.
def hazard(side,u,width=1.60):
    box('Hazard backing',(u,-5.012,.375) if side==0 else (5.012,u,.375),(width,.025,.65) if side==0 else (.025,width,.65),'uiDark',bevel=.02)
    # Clip diagonal bands to the plate rectangle in (u,z) space.
    def clip(poly, axis, limit, greater):
        out=[]
        for a,b in zip(poly,poly[1:]+poly[:1]):
            ina=a[axis]>=limit if greater else a[axis]<=limit
            inb=b[axis]>=limit if greater else b[axis]<=limit
            if ina: out.append(a)
            if ina != inb:
                t=(limit-a[axis])/(b[axis]-a[axis]); out.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
        return out
    for k in range(-3,5):
        a=k*.47
        poly=[(a-.16,0),(a+.09,0),(a+.61,.65),(a+.36,.65)]
        poly=clip(clip(poly,0,-width/2,True),0,width/2,False)
        if len(poly)<3 or abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(poly,poly[1:]+poly[:1])))<1e-8: continue
        vs=[(u+x,-5.034,z+.05) if side==0 else (5.034,u+x,z+.05) for x,z in poly]
        mesh('Raised yellow hazard stripe',vs,[tuple(range(len(vs)))],'schoolBusYellow')
    for q in (-width/2+.08,width/2-.08):
        o=cylinder('Hazard plate fastener',(u+q,-5.041,.65) if side==0 else (5.041,u+q,.65),.028,.018,'sidewalk',sides=8,bevel=0)
        o.rotation_euler=(math.pi/2,0,0) if side==0 else (0,math.pi/2,0)
hazard(0,-2.502); hazard(1,.0,3.27)

# Broad landing circle and square-ended H, separately raised above the pavement.
N=(48 if DISTANCE==1 else 32) if DISTANCE else 96; outer=3.72; inner=3.44
vs=[(r*math.cos(2*math.pi*i/N),r*math.sin(2*math.pi*i/N),z) for z in (.759,.767) for r in (inner,outer) for i in range(N)]
fs=[]
for i in range(N):
    j=(i+1)%N
    fs += [(2*N+i,3*N+i,3*N+j,2*N+j),(i,j,N+j,N+i),(i,2*N+i,2*N+j,j),(N+i,N+j,3*N+j,3*N+i)]
mesh('Yellow landing circle',vs,fs,'schoolBusYellow')
# H runs along X; +X is the approach direction.
outline=[(-1.68,-1.16),(1.68,-1.16),(1.68,-.59),(.29,-.59),(.29,.59),(1.68,.59),(1.68,1.16),(-1.68,1.16),(-1.68,.59),(-.29,.59),(-.29,-.59),(-1.68,-.59)]
outline=[(-y,x) for x,y in outline]
polygon('White H marking',outline,.759,'picketWhite')

# Geometric abrasion: modest scale changes, seeded, never coplanar.
for i in range(150):
    x,y=rng.uniform(-4.52,4.52),rng.uniform(-4.52,4.52)
    r=math.hypot(x,y)
    in_h=(abs(y)<1.68 and .59<abs(x)<1.16) or (abs(y)<.29 and abs(x)<1.16)
    painted=inner<r<outer or in_h
    if painted:
        chip('Worn paint fleck',x,y,rng.uniform(.02,.085),rng.uniform(.018,.065),.774,'asphalt')
    elif i%3==0:
        chip('Pavement aggregate',x,y,rng.uniform(.02,.095),rng.uniform(.015,.065),.755,'sidewalk')
# Local larger worn patches at panel edges, in the reference's warm concrete hues.
for x,y in [(-4.1,2.9),(-3.6,-3.8),(4.1,-2.8),(3.8,3.7),(-1.0,3.7),(2.8,-3.5)]:
    chip('Deck abrasion',x,y,.32,.23,.756,'sidewalk',n=13)
    chip('Warm deck scuff',x+.36,y+.23,.12,.08,.756,'woodWarm',n=8)
for i in range(30):
    a=rng.uniform(0,2*math.pi); r=rng.uniform(inner+.025,outer-.025)
    chip('Circle paint chip',r*math.cos(a),r*math.sin(a),.045,.03,.774,'asphalt')
for x,y in [(-1.34,-.83),(.8,-.9),(-.08,.4),(1.2,.8),(-.9,.9)]:
    chip('H paint chip',-y,x,.10,.055,.771,'asphalt')
# Hairline branching cracks travel across paint at a higher, non-flickering layer.
for x,y,dx,dy in [(-4.5,-1.9,1,.25),(1.7,4.4,-.28,-1),(4.4,.4,-1,.15),(-1.3,-4.4,.25,1)]:
    pts=[(x,y)]
    for j in range(7):
        x+=dx*rng.uniform(.20,.36); y+=dy*rng.uniform(.20,.36)+rng.uniform(-.08,.08); pts.append((x,y))
    ribbon('Deck crack',pts,.016,.782,'uiDark')
    a=pts[3]; ribbon('Crack branch',[a,(a[0]+.23,a[1]+.16),(a[0]+.43,a[1]+.19)],.011,.790,'uiDark')

# Four multi-part amber landing beacons, each grouped at its mounting joint.
for index,(x,y) in enumerate([(-4.35,-4.35),(4.35,-4.35),(4.35,4.35),(-4.35,4.35)]):
    lamp=empty('lamp_%d'%index,(x,y,.75),root)
    lamp['pivot_description']='mounting_base'; lamp['serviceable']=True
    cylinder('Beacon foot',(0,0,.06),.42,.12,'uiDark',lamp)
    cylinder('Foot rim',(0,0,.122),.395,.035,'sidewalk',lamp)
    cylinder('Amber ballast housing',(0,0,.24),.29,.21,'woodWarm',lamp)
    cylinder('Ballast collar',(0,0,.33),.32,.07,'schoolBusYellow',lamp)
    cylinder('Luminous amber lens',(0,0,.57),.25,.42,'glow',lamp,sides=32,bevel=.022)
    cylinder('Lens lower gasket',(0,0,.376),.27,.035,'schoolBusYellow',lamp)
    cylinder('Rounded amber cap',(0,0,.802),.269,.075,'schoolBusYellow',lamp,bevel=.025)
    cylinder('Cap glow inset',(0,0,.842),.217,.015,'glow',lamp,bevel=.003)
    for j in range(9):
        cylinder('Fresnel lens rib',(0,0,.408+.043*j),.258,.012,'schoolBusYellow',lamp,sides=24,bevel=0)
    for a in [0,math.pi/2,math.pi,3*math.pi/2]:
        box('Lens protective upright',(.258*math.cos(a),.258*math.sin(a),.586),(.024,.024,.40),'schoolBusYellow',lamp,bevel=0)
    for j in range(6):
        a=2*math.pi*j/6
        cylinder('Foot bolt',(.342*math.cos(a),.342*math.sin(a),.15),.025,.023,'woodWarm',lamp,sides=8,bevel=0)
    anchor=empty('light:landing_%d'%index,(0,0,.60),lamp)
    anchor['ss_light']=json.dumps({'type':'point','color':'light_sodium','intensity':2.5,'range':3.5,'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'none','heroPriority':1,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':['lamp_%d_emi_windowGlow'%index],'tiers':'all'})

if DISTANCE:
    export_variant(Path(__file__).parent, DISTANCE, omit=('Fresnel lens rib', 'Worn paint fleck', 'Circle paint chip', 'H paint chip', 'Deck crack', 'Crack branch', 'Concrete fixing recess', 'Concrete spall', 'Foot bolt'), far_omit=('Bolt', 'fixing', 'lamp guard','Concrete pore','Lens protective upright','Lens lower gasket','Foot rim'))

# Apply bevels and join static geometry by material and parent motion group.
for o in list(scene.objects):
    if o.type=='MESH':
        bpy.context.view_layer.objects.active=o
        for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
groups={}
for o in list(scene.objects):
    if o.type=='MESH': groups.setdefault((o.parent,o.data.materials[0]),[]).append(o)
for (parent,mat),objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join(); o=bpy.context.object
    o.name=parent.name+'_'+mat.name
    # Origin for every lamp mesh is its mounting joint, not its geometry center.
    scene.cursor.location=parent.matrix_world.translation
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
meshes=[o for o in scene.objects if o.type=='MESH']


def statistics():
    return {'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),
            'draw_calls':sum(len(o.data.materials) for o in meshes),
            'materials':sorted({m.name for o in meshes for m in o.data.materials}),
            'nodes':sorted(o.name for o in scene.objects)}

if args.glb:
    sys.path.insert(0,str(HERE.parents[1]/'tools'/'blender'))
    from sslib import ao
    ao.bake_all(meshes,samples=32)
    base=statistics(); lods={}
    assert base['triangles']<=20000, 'Helipad LOD0 exceeds its 20k triangle budget'

if args.render:
    # Studio-only objects are added after GLB export.
    box('Studio floor',(0,0,-.10),(200,200,.16),'uiDark',bevel=0)
    scene.render.engine='CYCLES'; scene.cycles.samples=args.samples
    scene.cycles.use_denoising=True; scene.cycles.seed=733
    scene.world=bpy.data.worlds.new('Studio world'); scene.world.color=(.18,.18,.18)
    def light(name,loc,power,color,size):
        d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.color=color; d.shape='DISK'; d.size=size
        o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=loc
        o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
    light('Warm key',(-3,-5,12),2100,(1,.75,.53),7)
    light('Cool fill',(5,4,9),1100,(.65,.72,1),8)
    light('Amber edge',(-6,5,6),1400,(1,.55,.26),5)
    for x,y in [(-4.35,-4.35),(4.35,-4.35),(4.35,4.35),(-4.35,4.35)]:
        d=bpy.data.lights.new('Landing glow','POINT'); d.energy=22; d.color=(1,.40,.06); d.shadow_soft_size=.30
        o=bpy.data.objects.new('Landing glow',d); scene.collection.objects.link(o); o.location=(x,y,1.25)
    c=bpy.data.cameras.new('Review camera'); cam=bpy.data.objects.new('Review camera',c); scene.collection.objects.link(cam)
    views={'ref':(11,-20,13),'game':(15,-15,21),'front':(18,0,9),'side':(0,-18,10),'rear':(-16,12,13)}
    cam.location=views.get(args.view,views['ref']); target=Vector((0,0,.4))
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    c.type='ORTHO'; c.ortho_scale=20.5 if args.view=='game' else 16.8
    scene.camera=cam; scene.render.resolution_x=args.width; scene.render.resolution_y=args.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    tree=bpy.data.node_groups.new('Landing light glow','CompositorNodeTree')
    scene.compositing_node_group=tree
    tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
    rl=tree.nodes.new('CompositorNodeRLayers'); gl=tree.nodes.new('CompositorNodeGlare')
    gl.inputs['Type'].default_value='Fog Glow'; gl.inputs['Threshold'].default_value=1.2; gl.inputs['Strength'].default_value=.3
    output=tree.nodes.new('NodeGroupOutput')
    tree.links.new(rl.outputs['Image'],gl.inputs['Image']); tree.links.new(gl.outputs['Image'],output.inputs['Image'])
    scene.render.filepath=args.render; bpy.ops.render.render(write_still=True)
    print('OK rendered '+args.render)

if args.glb and not DISTANCE:
    build_native_lods(__file__)
