"""Sunset Grove compact sedan. Metres, +X nose, Z up; deterministic, texture-free.
Reference: 4.40 x 1.86 x 1.58 m, wheelbase 2.66 m, 0.74 m tyres.
All geometry is grouped by moving assembly and material before export.
"""
import argparse
import json
import math
from pathlib import Path
import sys
# Decay uses closed authored sedan tiers and a deterministic impact transform.
if '--decay' in sys.argv and sys.argv[sys.argv.index('--decay') + 1] == 'wrecked':
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
    from sslib.rescue_wrecks import build_wreck
    build_wreck(Path(__file__).resolve().parent, sys.argv[sys.argv.index('--glb') + 1])
    raise SystemExit(0)

import bpy
import bmesh
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.distance import tier_argument, export_variant, build_native_lods
DISTANCE = tier_argument()
if '--lod-only' in sys.argv:
    build_native_lods(__file__)
    sys.exit(0)

HERE = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--glb'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'


def linear(h):
    return tuple((v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4) for v in [int(h[i:i+2],16)/255 for i in (0,2,4)])


def material(token, color, rough=.45, metal=0, emission=0, alpha=1):
    m=bpy.data.materials.new(('emi_' if emission else 'pal_')+token)
    m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']
    c=(*linear(color),1)
    b.inputs['Base Color'].default_value=c
    b.inputs['Roughness'].default_value=rough
    b.inputs['Metallic'].default_value=metal
    b.inputs['Alpha'].default_value=alpha
    if emission:
        b.inputs['Emission Color'].default_value=c
        b.inputs['Emission Strength'].default_value=emission
    if alpha<1: m.surface_render_method='DITHERED'
    m.diffuse_color=(*linear(color),alpha)
    return m

M={
    'red':material('survivorRed','d9363e',.31),
    'darkred':material('blood','b3121f',.4),
    'black':material('uiDark','25222c',.72),
    'trim':material('asphalt','5b4f5c',.45),
    'rim':material('sidewalk','938698',.38,.42),
    'glass':material('backpackTeal','38394e',.35,.06,alpha=.74),
    'head':material('windowGlow','ffc773',.29,emission=.7),
    'amber':material('schoolBusYellow','f2b630',.34,emission=.22),
    'brake':material('sirenRed','ff2d2d',.32,emission=.22),
    'cream':material('picketWhite','f2e6dc',.5),
}
# Smoked slate glazing matches the reference.
M['glass'].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.18


def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None); scene.collection.objects.link(o)
    o.location=loc
    if parent: o.parent=parent
    return o

root=empty('veh.sedan-red')
root['ss_physics']=json.dumps({'class':'heavy','mass':1150,'friction':.75,'restitution':.05,'centerOfMass':[0,.55,0], 'pushable':False,'kickable':False,'flammable':True})
body=empty('body',parent=root)


def finish(o,name,mat,parent=body,bevel=.02):
    if DISTANCE: bevel = 0
    o.name=name
    o.data.materials.append(M[mat])
    if bevel:
        mod=o.modifiers.new('Soft edges','BEVEL'); mod.width=bevel; mod.segments=2
        mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
    bpy.context.view_layer.update()
    mw=o.matrix_world.copy(); o.parent=parent; o.matrix_world=mw
    return o


def box(name,loc,size,mat,parent=body,bevel=.02,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object; o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot: o.rotation_euler=rot
    return finish(o,name,mat,parent,min(bevel,min(size)*.4))


def mesh(name,verts,faces,mat,parent=body,bevel=.01):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me); scene.collection.objects.link(o)
    return finish(o,name,mat,parent,bevel)


def prism(name,points,y0,y1,mat,parent=body,bevel=.02):
    n=len(points)
    verts=[(x,y,z) for y in (y0,y1) for x,z in points]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,verts,faces,mat,parent,bevel)


def rod(name,start,end,width,mat,parent=body):
    d=Vector(end)-Vector(start)
    o=box(name,(Vector(end)+Vector(start))/2,(width,width,d.length),mat,parent,width*.25)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return o


def cyl(name,loc,r,depth,mat,parent=body,axis='Y',vertices=48):
    if DISTANCE: vertices = min(vertices, 12 if DISTANCE == 1 else 6)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc)
    o=bpy.context.object
    if axis=='Y':o.rotation_euler.x=math.pi/2
    if axis=='X':o.rotation_euler.y=math.pi/2
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return finish(o,name,mat,parent,.008)


def torus(name,loc,major,minor,mat,parent=body):
    bpy.ops.mesh.primitive_torus_add(major_segments=(16 if DISTANCE == 1 else 12) if DISTANCE else 64,minor_segments=(4 if DISTANCE == 1 else 3) if DISTANCE else 12,location=loc,major_radius=major,minor_radius=minor,rotation=(math.pi/2,0,0))
    o=bpy.context.object
    for f in o.data.polygons:f.use_smooth=True
    return finish(o,name,mat,parent,0)

# Continuous sculpted lower shell, genuine wheel openings.
shell=prism('Coachwork',[(-2.13,.28),(2.13,.28),(2.17,.89),(2.06,1.02),(1.25,1.10),(-1.42,1.10),(-2.12,1.00)],-.9,.9,'red',bevel=.045)
for x in (-1.32,1.34):
    cutter=cyl('cut',(x,0,.37),.435,2.2,'black')
    for mod in list(cutter.modifiers):cutter.modifiers.remove(mod)
    bpy.context.view_layer.objects.active=shell
    mod=shell.modifiers.new('Wheel opening','BOOLEAN'); mod.operation='DIFFERENCE'; mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
# Open lower door apertures so hinged doors reveal the cabin instead of a red wall.
for side in (-1,1):
    for lo,hi in [(-.87,.08),(.10,1.16)]:
        cutter=box('Door aperture',((lo+hi)/2,side*.91,.74),(hi-lo,.30,.80),'red',bevel=0)
        bpy.context.view_layer.objects.active=shell
        mod=shell.modifiers.new('Door opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter,do_unlink=True)
# Boolean cutters must not introduce a second material into the painted shell.
for face in shell.data.polygons:face.material_index=0
while len(shell.data.materials)>1:shell.data.materials.pop(index=1)
box('Underbody',(0,0,.30),(3.73,1.43,.15),'black',bevel=.035)
# Hood and trunk sit >3mm above the shell, with raised creases.
prism('Hood',[(1.20,1.106),(2.06,1.026),(2.06,1.043),(1.20,1.121)],-.84,.84,'red',bevel=.018)
prism('Trunk',[(-2.05,1.015),(-1.42,1.111),(-1.42,1.139),(-2.05,1.046)],-.83,.83,'red',bevel=.018)
for s in (-1,1):
    rod('Hood crease',(1.24,s*.70,1.126),(2.02,s*.70,1.049),.013,'red')
    box('Sill',(-.03,s*.913,.315),(1.80,.047,.065),'trim',bevel=.012)
    # Raised arch lip and dark inner flange, open at the bottom.
    for x in (-1.32,1.34):
        verts=[(x+r*math.cos(i*math.pi/32),s*y,.37+r*math.sin(i*math.pi/32)) for y in (.904,.927) for r in (.431,.467) for i in range(33)]
        faces=[]
        for j in range(32):
            faces.extend([(j,j+1,j+34,j+33),(j+66,j+99,j+100,j+67),(j,j+66,j+67,j+1),(j+33,j+34,j+100,j+99)])
        faces.extend([(0,33,99,66),(32,98,131,65)])
        mesh('Arch lip',verts,faces,'red',bevel=.007)
# Cabin: roof panel and pillars, without hidden solid block behind glazing.
box('Roof',(-.12,0,1.565),(1.77,1.49,.085),'red',bevel=.045)
for s in (-1,1):
    rod('A pillar',(1.20,s*.875,1.11),(.73,s*.728,1.555),.075,'red')
    rod('C pillar',(-1.48,s*.875,1.11),(-.96,s*.728,1.555),.098,'red')
    rod('Roof rail',(-.96,s*.729,1.564),(.72,s*.729,1.564),.045,'red')

# Four individual doors, including window seals and glass, hinges at the front edge.
for s,side in [(-1,'L'),(1,'R')]:
    for front in (True,False):
        name=('door'+side) if front else ('doorRear'+side)
        g=empty(name,(1.16 if front else .12,s*.90,1.0),root)
        lo,hi=(.10,1.16) if front else (-.87,.08)
        if front:
            end=math.acos((hi-1.34)/.443)
            panel=[(lo,.36),(.897,.36)]+[(1.34+.443*math.cos(math.pi+(end-math.pi)*i/12),.37+.443*math.sin(math.pi+(end-math.pi)*i/12)) for i in range(13)]+[(hi,1.085),(lo,1.085)]
        else:
            panel=[(lo,.36),(hi,.36),(hi,1.085),(lo,1.085)]
        prism('Door skin',panel,min(s*.906,s*.924),max(s*.906,s*.924),'red',g,.014)
        trim_hi=.94 if front else hi
        box('Door moulding',((lo+trim_hi)/2,s*.946,.60),(trim_hi-lo-.025,.033,.062),'trim',g,.009)
        # Diagonal A/C edges define trapezoidal windows.
        coords=([( .14,1.105),(1.12,1.105),(.69,1.51),(.14,1.51)] if front else [(-1.37,1.105),(.035,1.105),(.035,1.51),(-.93,1.51)])
        vs=[(x,s*(.885-(z-1.105)*.34),z) for x,z in coords]
        o=mesh('Door glass',vs,[(0,1,2,3)],'glass',g,0)
        sol=o.modifiers.new('Glass thickness','SOLIDIFY'); sol.thickness=.009
        for i in range(4):rod('Window seal',vs[i],vs[(i+1)%4],.032,'black',g)
        if not front:
            rod('Quarter divider',(-.98,s*.89,1.11),(-.80,s*.75,1.50),.033,'black',g)
        rod('Door pillar',(lo,s*.90,1.09),(lo,s*.744,1.535),.045,'red',g)
        box('Handle',(lo+.20,s*.958,.953),(.175,.038,.051),'black',g,.011)
        box('Handle glint',(lo+.20,s*.981,.966),(.13,.008,.01),'trim',g,.002)
        if front:
            box('Mirror foot',(.98,s*.966,1.145),(.16,.15,.10),'black',g,.023)
            box('Mirror housing',(.99,s*1.069,1.185),(.23,.15,.16),'red',g,.035)
            box('Mirror inset',(.878,s*1.075,1.185),(.012,.115,.114),'trim',g,.013)

# Front and rear glazing fitted between pillars.
for front in (True,False):
    x0,x1=(1.181,.727) if front else (-1.457,-.971)
    v=[(x0,-.834,1.13),(x0,.834,1.13),(x1,.70,1.524),(x1,-.70,1.524)]
    o=mesh('Windshield' if front else 'Rear glass',v,[(0,1,2,3)],'glass',bevel=0)
    mod=o.modifiers.new('Glass thickness','SOLIDIFY');mod.thickness=.012
    for i in range(4):rod('Glass seal',v[i],v[(i+1)%4],.034,'black')
# Interior purposefully visible through the smoked windows.
box('Dashboard',(.97,0,1.075),(.32,1.60,.13),'black',bevel=.045)
for y in (-.40,.40):
    box('Seat base',(.20,y,.86),(.45,.44,.15),'trim',bevel=.045)
    box('Seat back',(-.04,y,1.09),(.15,.44,.42),'trim',bevel=.045,rot=(0,-.10,0))
    box('Headrest',(-.06,y,1.36),(.12,.26,.16),'trim',bevel=.035)
box('Rear bench',(-.85,0,1.00),(.40,1.33,.29),'trim',bevel=.06)
for y in (-.45,.45):box('Rear headrest',(-1.0,y,1.29),(.12,.26,.14),'trim',bevel=.025)
steer=torus('Steering',(.76,-.40,1.16),.145,.018,'black');steer.rotation_euler=(0,math.pi/2,0)
rod('Steering spoke',(.76,-.54,1.16),(.76,-.26,1.16),.025,'black')
box('Rear view mirror',(.74,0,1.44),(.06,.21,.087),'black',bevel=.013)
for y in (-.40,.37):
    rod('Wiper arm',(1.185,y,1.142),(1.07,y+.20,1.235),.014,'black')
    rod('Wiper blade',(1.066,y+.05,1.24),(1.066,y+.42,1.24),.021,'black')
for y in [i*.12 for i in range(-5,6)]:box('Cowl vent',(1.24,y,1.123),(.09,.042,.012),'black',bevel=.003)
# Multi-part tyres with shoulder rings, tread, vented hubcaps and wheel-centre pivots.
for x,ax in [(1.34,'F'),(-1.32,'R')]:
    for s,side in [(-1,'L'),(1,'R')]:
        g=empty('wheel'+ax+side,(x,s*.91,.37),root)
        torus('Tyre',(x,s*.91,.37),.285,.085,'black',g)
        cyl('Tyre core',(x,s*.91,.37),.30,.22,'black',g)
        yf=s*1.032
        torus('Sidewall ring',(x,yf,.37),.29,.012,'black',g)
        cyl('Rim bed',(x,yf,.37),.227,.020,'trim',g)
        torus('Rim lip',(x,s*1.051,.37),.213,.014,'rim',g)
        cyl('Hubcap',(x,s*1.059,.37),.194,.025,'rim',g)
        cyl('Centre boss',(x,s*1.077,.37),.079,.021,'rim',g)
        for j in range(10):
            t=2*math.pi*j/10
            o=box('Hub vent',(x+.165*math.sin(t),s*1.077,.37+.165*math.cos(t)),(.044,.013,.024),'trim',g,.004)
            o.rotation_euler.y=t
        for j in range(48):
            t=2*math.pi*j/48
            o=box('Tread',(x+.353*math.sin(t),s*.91,.37+.353*math.cos(t)),(.012,.10,.006),'black',g,0)
            o.rotation_euler.y=t
# Front bumper, deeply recessed grille and paired rectangular headlamps.
for x in (-2.16,2.18):
    box('Bumper',(x,0,.47),(.18,1.94,.18),'trim',bevel=.042)
    box('Bumper upper edging',(x+.004,0,.558),(.185,1.85,.020),'rim',bevel=.008)
box('Grille surround',(2.165,0,.843),(.073,.91,.335),'darkred',bevel=.034)
box('Grille recess',(2.209,0,.843),(.027,.824,.266),'black',bevel=.016)
for z in (.745,.815,.885,.955):box('Grille slat',(2.234,0,z),(.022,.786,.020),'trim',bevel=.006)
for y in (-.30,-.15,0,.15,.30):box('Grille upright',(2.224,y,.85),(.018,.020,.245),'trim',bevel=.003)
lf=empty('lightsFront',(2.18,0,.85),root)
lb=empty('lightsBrake',(-2.16,0,.82),root)
for s,side in [(-1,'L'),(1,'R')]:
    box('Lamp bezel',(2.16,s*.66,.854),(.075,.39,.29),'black',bevel=.024)
    box('Headlamp',(2.207,s*.622,.862),(.038,.275,.236),'head',lf,.025)
    box('Headlamp centre',(2.231,s*.622,.862),(.013,.125,.125),'head',lf,.018)
    box('Indicator',(2.19,s*.834,.846),(.060,.103,.235),'amber',lf,.018)
    for y in (-.06,0,.06):box('Lens fluting',(2.232,s*.622+y,.862),(.007,.005,.192),'head',lf,.002)
    box('Taillamp bezel',(-2.153,s*.68,.83),(.075,.39,.215),'black',bevel=.018)
    box('Brake lens',(-2.197,s*.62,.839),(.03,.255,.164),'brake',lb,.015)
    box('Rear indicator',(-2.199,s*.818,.839),(.033,.125,.164),'amber',lb,.013)
    box('Reverse lens',(-2.218,s*.64,.80),(.010,.108,.062),'cream',lb,.007)
    anchor=empty('light:headlight'+side,(2.24,s*.622,.86),lf)
    anchor.matrix_world.translation=(2.24,s*.622,.86)
    anchor.rotation_euler=(0,-math.pi/2+.055,0)
    anchor['ss_light']=json.dumps({'type':'spot','color':'light_led_white','intensity':3,'range':18,'angle':48,'penumbra':.35,'pool':True,'beam':'soft','flare':True,'reflect':True,'shadow':'hero','powerGroup':'self','breakable':True,'emissiveNodes':['lightsFront_emi_windowGlow'],'tiers':'all'})
    anchor=empty('light:brake'+side,parent=lb);anchor.matrix_world.translation=(-2.24,s*.62,.84)
    anchor['ss_light']=json.dumps({'type':'point','color':'light_siren_red','intensity':.7,'range':2,'pool':True,'beam':'none','reflect':True,'shadow':'none','powerGroup':'self','breakable':True,'emissiveNodes':['lightsBrake_emi_sirenRed'],'tiers':'all'})
for x in (-2.274,2.284):
    box('Plate surround',(x,0,.48),(.038,.43,.215),'black',bevel=.011)
    box('Plate',(x+(.024 if x>0 else -.024),0,.48),(.012,.36,.159),'rim',bevel=.008)
    for y in (-.147,.147):cyl('Plate screw',(x+(.034 if x>0 else -.034),y,.535),.008,.008,'black',axis='X',vertices=12)
box('Lower air intake',(2.183,0,.322),(.024,.97,.075),'black',bevel=.012)
for s in (-1,1):box('Lower amber lamp',(2.201,s*.63,.327),(.024,.17,.067),'amber',lf,.008)
cyl('Exhaust',(-2.10,.57,.25),.045,.27,'trim',axis='X')
cyl('Exhaust dark bore',(-2.244,.57,.25),.032,.015,'black',axis='X')
box('Fuel flap',(-1.78,.917,.997),(.22,.012,.14),'darkred',bevel=.016)
box('Fuel flap face',(-1.78,.928,.997),(.195,.012,.118),'red',bevel=.012)
for name,loc in [('driverSeat',(.2,-.4,.87)),('exitL',(.35,-1.35,0)),('exitR',(.35,1.35,0))]:empty(name,loc,root)
col=empty('col:chassis',(0,0,.78),root);col['collider']='cuboid';col['shape']='cuboid';col['size']=[4.4,1.8,1.48]

def clean_mesh(o):
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bad=[f for f in bm.faces if f.calc_area()<1e-9]
    if bad:bmesh.ops.delete(bm,geom=bad,context='FACES')
    bm.to_mesh(o.data);bm.free();o.data.update()

if DISTANCE:
    export_variant(Path(__file__).parent, DISTANCE, omit=('tread', 'lug', 'rivet', 'bolt', 'seat', 'steering', 'sidewall', 'rim lip'), far_omit=('Arch lip', 'Window seal', 'Door moulding', 'Lens fluting', 'wiper', 'handle', 'seam', 'badge', 'text', 'letter', 'logo', 'stripe', 'rib', 'hub', 'rim', 'gasket', 'dashboard', 'headrest', 'axle', 'differential', 'grille bar', 'vent', 'hinge', 'clamp', 'spoke'), flat_parts=('*rim*',))

# Apply modifiers then join only within each joint/material partition.
for o in list(scene.objects):
    if o.type!='MESH':continue
    bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
    clean_mesh(o)
partitions={}
for o in list(scene.objects):
    if o.type=='MESH':partitions.setdefault((o.parent.name,o.data.materials[0].name),[]).append(o)
for (parent,mat),objects in partitions.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    o=bpy.context.object;o.name=parent+'_'+mat
    # Every assembly's mesh origin sits at the same motion joint as its parent.
    scene.cursor.location=o.parent.matrix_world.translation
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    if mat.startswith('emi_') and 'schoolBusYellow' in mat:o['decorativeEmissive']=True
scene.cursor.location=(0,0,0)
# Deterministic 32-sample Cycles AO bake, stored as the active vertex colour.
if a.glb:
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=0
    scene.render.bake.target='VERTEX_COLORS'
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects:
        if o.type=='MESH':
            attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
            o.data.color_attributes.active_color=attr
            o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.bake(type='AO',target='VERTEX_COLORS',use_clear=True)
    # Keep baked contact shading gentle in the warm miniature palette.
    for o in scene.objects:
        if o.type=='MESH':
            for color in o.data.color_attributes['ao'].data:
                color.color=tuple(.9+.1*max(0,min(1,c)) for c in color.color[:3])+(1,)
    # Transparent panes do not receive solid-surface occlusion.
    for o in scene.objects:
        if o.type=='MESH' and o.data.materials[0]==M['glass']:
            for color in o.data.color_attributes['ao'].data:color.color=(1,1,1,1)
    print('AO OK')

for o in scene.objects:
    if o.type=='MESH':o.data.calc_loop_triangles()
triangles=sum(len(o.data.loop_triangles) for o in scene.objects if o.type=='MESH')
report={'id':'veh.sedan-red','tier':'Hero','triangles':triangles,'draw_calls':len(partitions),'materials':sorted(m.name for m in M.values()),'nodes_ok':all(bpy.data.objects.get(n) for n in ['body','wheelFL','wheelFR','wheelRL','wheelRR','doorL','lightsFront','lightsBrake','driverSeat','exitL','exitR']),'within_budget':triangles<=80000 and len(partitions)<=40,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2)+'\n')
if a.glb:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False,export_vertex_color='NAME',export_vertex_color_name='ao',export_all_vertex_colors=False)
    # Independently exported LODs preserve all node names and joint transforms.
    meshes=[o for o in scene.objects if o.type=='MESH']
    originals={o:o.data for o in meshes}
    for suffix,ratio in [('lod1',.15),('lod2',.045)]:
        for o in meshes:
            o.data=originals[o].copy()
        for o in scene.objects:
            if o.type=='MESH':
                d=o.modifiers.new('LOD','DECIMATE');d.ratio=ratio
                bpy.context.view_layer.objects.active=o
                bpy.ops.object.modifier_apply(modifier=d.name)
                clean_mesh(o)
        bpy.ops.export_scene.gltf(filepath=str(HERE/('model.'+suffix+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False,export_vertex_color='NAME',export_vertex_color_name='ao',export_all_vertex_colors=False)
        for o in meshes:
            reduced=o.data;o.data=originals[o];bpy.data.meshes.remove(reduced)
    print('GLB OK',report)
if a.render:
    world=bpy.data.worlds.new('Studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.12,.105,.14,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
    def light(loc,energy,size,color):
        ld=bpy.data.lights.new('Studio softbox','AREA');ld.energy=energy;ld.shape='DISK';ld.size=size;ld.color=color
        o=bpy.data.objects.new('Studio softbox',ld);scene.collection.objects.link(o);o.location=loc
        o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
    light((1,-4,7),1100,5,(1,.87,.75));light((-3,-1,4),650,5,(.75,.81,1));light((1,4,5),1300,4,(1,.72,.48))
    ground=box('Studio floor',(0,0,-.07),(200,200,.1),'black',parent=root,bevel=0)
    ground.data.materials.clear();gm=material('studio','302c36',.85);ground.data.materials.append(gm)
    cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));scene.collection.objects.link(cam);scene.camera=cam
    views={'ref':(6,-8,4.7),'game':(7,-7,8.4),'front':(9,0,2.8),'rear':(-8,-5,3.8),'side':(0,-10,2.3)}
    cam.data.type='ORTHO'
    scene.render.engine='CYCLES';scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
    for d in prefs.devices:d.use=True
    scene.cycles.device='GPU'
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.30
    requests=[(a.view,Path(a.render).resolve(),a.width,a.height,a.samples)]
    # Produce both final deliverables while holding one shared render lease.
    if Path(a.render).name=='hero.png':
        requests.append(('game',HERE/'renders/game.png',960,540,24))
    for view,path,width,height,samples in requests:
        cam.location=views[view]
        cam.rotation_euler=(Vector((0,0,.78))-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.ortho_scale=6.7 if view=='game' else 6.3
        scene.cycles.samples=samples
        scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100
        scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
        print('RENDER OK',path)

# Every full source export refreshes the native distance tiers.
if "--glb" in sys.argv and not DISTANCE:
    build_native_lods(__file__)
