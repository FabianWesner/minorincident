"""Sunset Grove compact sedan. +X nose, +Z up; 4.42 x 1.82 x 1.68 m.
No textures or brands. Four hinged doors and four axle-centered wheels.
All nonmoving parts are joined by material; trim is raised >= 0.003 m.
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
p.add_argument('--lod', type=int, default=0)
p.add_argument('--render'); p.add_argument('--glb'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
M = {}; parts = {}; groups = {}

def mat(token, color, rough=.45, metal=0, emission=0, alpha=1):
    name = ('emi_' if emission else 'pal_') + token
    m = bpy.data.materials.new(name); m.use_nodes = True
    rgb = [int(color[i:i+2],16)/255 for i in (0,2,4)]
    c = [(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in rgb]+[alpha]
    bs = m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=c
    bs.inputs['Metallic'].default_value=metal; bs.inputs['Roughness'].default_value=rough
    bs.inputs['Coat Weight'].default_value=.12
    if emission:
        bs.inputs['Emission Color'].default_value=c; bs.inputs['Emission Strength'].default_value=emission
    if alpha<1:
        bs.inputs['Alpha'].default_value=alpha; m.surface_render_method='DITHERED'
    m.diffuse_color=c; M[token]=m

# Palette colors retain material identity; the blue starts from policeBlue.
mat('policeBlue','4167c0',.46,.05)
M['policeBlue'].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.05
M['policeBlue'].node_tree.nodes['Principled BSDF'].inputs['Coat Weight'].default_value=0
mat('uiDark','25222c',.6)
mat('asphalt','5b4f5c',.42,.35)
mat('sidewalk','b9a4a0',.34,.55)
mat('backpackTeal','263b56',.28,.0,alpha=.64)
mat('picketWhite','f2e6dc',.5)
mat('windowGlow','ffc773',.26,emission=.65)
mat('schoolBusYellow','f2b630',.3,emission=.25)
mat('sirenRed','ff2d2d',.3,emission=.25)

def empty(name, loc=(0,0,0), parent=None):
    o=bpy.data.objects.new(name,None); scene.collection.objects.link(o); o.location=loc
    if parent: o.parent=parent
    groups[name]=o; return o
root=empty('veh.sedan-blue')
root['ss_physics']=json.dumps({'class':'heavy','mass':1150,'friction':.8,'restitution':.05,'centerOfMass':[0,.65,0],'pushable':False,'kickable':False,'flammable':True})
body=empty('body',parent=root)

def finish(o, token, group='body', bevel=.015):
    if DISTANCE: bevel = 0
    o.data.materials.append(M[token]); scene.collection.objects.link(o)
    if bevel:
        b=o.modifiers.new('soft edges','BEVEL'); b.width=bevel; b.segments=3
        b=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); b.keep_sharp=True
    for f in o.data.polygons: f.use_smooth=True
    parts.setdefault((group,token),[]).append(o)
    return o

def mesh(name, vs, fs, token, group='body', bevel=.015):
    me=bpy.data.meshes.new(name); me.from_pydata(vs,[],fs); me.update()
    bm=bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(me); bm.free()
    return finish(bpy.data.objects.new(name,me),token,group,bevel)

def box(name, loc, size, token, group='body', bevel=.025):
    vs=[(loc[0]+x*size[0]/2,loc[1]+y*size[1]/2,loc[2]+z*size[2]/2) for x,y,z in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    return mesh(name,vs,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],token,group,min(bevel,min(size)*.4))

def prism(name, pts, y0,y1, token, group='body', bevel=.015):
    n=len(pts); vs=[(x,y,z) for y in (y0,y1) for x,z in pts]
    return mesh(name,vs,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],token,group,bevel)

def panel(name, vs, token, group='body', thickness=.012):
    # Closed slab; winding/rear pane lies away from its visible face.
    n=len(vs); normal=(Vector(vs[1])-Vector(vs[0])).cross(Vector(vs[2])-Vector(vs[0])).normalized()
    back=[tuple(Vector(v)-normal*thickness) for v in vs]
    return mesh(name,vs+back,[tuple(range(n)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],token,group,.005)

def frame(name, vs, token, group='body'):
    # A hollow window seal, leaving a real opening into the cabin.
    center=sum((Vector(v) for v in vs),Vector())/len(vs)
    inner=[tuple(center+(Vector(v)-center)*.88) for v in vs]
    normal=(Vector(vs[1])-Vector(vs[0])).cross(Vector(vs[2])-Vector(vs[0])).normalized()
    front=vs+inner; back=[tuple(Vector(v)-normal*.022) for v in front]
    faces=[]
    for i in range(4):
        j=(i+1)%4
        faces.extend([(i,j,j+4,i+4),(i+8,i+12,j+12,j+8),(i,i+8,j+8,j),(i+4,j+4,j+12,i+12)])
    return mesh(name,front+back,faces,token,group,.004)

def beam(name,start,end,width,token,group='body'):
    mid=(Vector(start)+Vector(end))/2; length=(Vector(end)-Vector(start)).length
    o=box(name,(0,0,0),(width,width,length),token,group,width*.22)
    o.location=mid; o.rotation_euler=(Vector(end)-Vector(start)).to_track_quat('Z','Y').to_euler(); return o

def lathe(name,x,y,z,profile,token,group,segments=48):
    if DISTANCE: segments = min(segments, 12 if DISTANCE == 1 else 6)
    vs=[(x+r*math.cos(k*math.tau/segments),y+d,z+r*math.sin(k*math.tau/segments)) for r,d in profile for k in range(segments)]
    fs=[(j*segments+k,j*segments+(k+1)%segments,(j+1)*segments+(k+1)%segments,(j+1)*segments+k) for j in range(len(profile)-1) for k in range(segments)]
    return mesh(name,vs,fs,token,group,0)

# Body silhouette has actual open wheel arches, rather than tires through boxes.
outline=[(-2.10,.35),(-2.10,1.00),(-1.83,1.10),(-1.24,1.12),(.88,1.12),(1.86,1.04),(2.10,.95),(2.10,.35)]
for axle in [1.34,-1.36]:
    outline += [(axle+.49,.35),(axle+.49,.43)]
    outline += [(axle+.49*math.cos(t),.43+.49*math.sin(t)) for t in [k*math.pi/20 for k in range(1,21)]]
    outline += [(axle-.49,.35)]
prism('body shell',outline,-.86,.86,'policeBlue',bevel=.035)
box('underbody',(0,0,.39),(3.6,1.36,.18),'uiDark')
# Raised hood and trunk with soft perimeter, restrained creases.
prism('hood',[(.87,1.115),(1.99,1.035),(1.99,1.065),(.87,1.145)],-.82,.82,'policeBlue',bevel=.012)
box('trunk',(-1.73,0,1.095),(.72,1.65,.075),'policeBlue',bevel=.025)
box('roof',(-.23,0,1.633),(1.65,1.47,.094),'policeBlue',bevel=.045)
# Cabin corners at belt and roof.
for s in [-1,1]:
    for tag,b,t in [('A',(.99,s*.83,1.13),(.56,s*.70,1.60)),('C',(-1.34,s*.83,1.13),(-1.03,s*.70,1.60))]:
        beam(tag+' pillar',b,t,.095,'policeBlue')
    beam('roof rail',(-1.02,s*.717,1.62),(.58,s*.717,1.62),.065,'policeBlue')
    beam('belt seal',(-1.31,s*.867,1.135),(.95,s*.867,1.135),.045,'uiDark')
# Front and rear glass: seals underneath, glass proud of gasket.
for tag,bl,tl in [('windshield',1.00,.57),('rearGlass',-1.35,-1.035)]:
    offset=.012 if tag=='windshield' else -.012
    v=[(bl,-.805,1.145),(bl,.805,1.145),(tl,.695,1.60),(tl,-.695,1.60)]
    frame(tag+' seal',v,'uiDark')
    v=[(bl+offset,-.753,1.171),(bl+offset,.753,1.171),(tl+offset,.65,1.565),(tl+offset,-.65,1.565)]
    panel(tag,v,'backpackTeal')
# Four complete separate door assemblies; origins at front hinges.
for s,suffix in [(-1,'L'),(1,'R')]:
    for front in [True,False]:
        g='door'+suffix if front else 'doorRear'+suffix
        hinge=.93 if front else -.13
        empty(g,(hinge,s*.86,1.05),root)
        x0,x1=(-.11,.90) if front else (-1.21,-.15)
        pts=[(x0,.41),(x1,.41),(x1,1.115),(x0,1.115)]
        if not front: pts=[(-.88,.41),(-.15,.41),(-.15,1.115),(-1.23,1.115),(-1.15,.94),(-.89,.76)]
        prism('door panel',pts,s*.872-.008,s*.872+.008,'policeBlue',g,.014)
        window=[(x0+.03,1.17),(x1-.035,1.17),(.55 if front else -.19,1.575),(-.075 if front else -1.015,1.575)]
        # tapered cabin y follows height; seals and glazing are distinct slabs.
        verts=[(x,s*(.853-(z-1.17)*.31),z) for x,z in window]
        frame('door window gasket',verts,'uiDark',g)
        cx=sum(x for x,z in window)/4; cz=sum(z for x,z in window)/4
        inner=[(cx+(x-cx)*.89,cz+(z-cz)*.86) for x,z in window]
        panel('door glazing',[(x,s*(.866-(z-1.17)*.31),z) for x,z in inner],'backpackTeal',g)
        hx=x0+.18
        box('handle recess',(hx,s*.889,1.018),(.22,.028,.095),'uiDark',g,.012)
        box('door handle',(hx,s*.91,1.032),(.185,.038,.040),'sidewalk',g,.010)
        box('side moulding',((x0+x1)/2,s*.904,.62),(x1-x0-.10 if front else .70,.035,.040),'asphalt',g,.012)
        if front:
            box('mirror stalk',(.83,s*.89,1.205),(.15,.15,.09),'uiDark',g)
            box('mirror housing',(.82,s*1.00,1.24),(.23,.16,.145),'policeBlue',g,.035)
            box('mirror glass',(.697,s*1.00,1.24),(.012,.114,.097),'sidewalk',g,.005)
    box('rocker strip',(0,s*.88,.37),(1.83,.045,.065),'policeBlue')
    box('fuel flap',(-1.80,s*.88,.975),(.235,.018,.18),'policeBlue',bevel=.012)
# Sculpted arch lips span the open cutout.
for x in [1.34,-1.36]:
    for s in [-1,1]:
        vs=[]
        for y in [s*.864,s*.908]:
            for r in [.493,.548]:
                vs += [(x+r*math.cos(t),y,.43+r*math.sin(t)) for t in [k*math.pi/24 for k in range(25)]]
        fs=[]
        for i in range(24):
            fs.extend([(i,i+1,26+i,25+i),(50+i,75+i,76+i,51+i),(i,50+i,51+i,i+1),(25+i,26+i,76+i,75+i)])
        fs.extend([(0,25,75,50),(24,74,99,49)])
        mesh('fender lip',vs,fs,'policeBlue',bevel=.009)
# Tires, dish-shaped hubcaps, outer rings, six readable ventilation slots.
for x,f in [(1.34,'F'),(-1.36,'R')]:
    for s,l in [(-1,'L'),(1,'R')]:
        g='wheel'+f+l; empty(g,(x,s*.81,.415),root)
        prof=[(.001,-.135),(.30,-.135),(.38,-.12),(.415,-.075),(.415,.075),(.38,.135),(.29,.145),(.001,.145)]
        lathe('tire',x,s*.81,.415,prof,'uiDark',g)
        # Outside face in signed Y.
        lathe('hubcap',x,s*.81,.415,[(.001,s*.155),(.16,s*.165),(.235,s*.15),(.273,s*.145),(.284,s*.133),(.273,s*.124),(.001,s*.124)],'sidewalk',g)
        lathe('rim inset',x,s*.81,.415,[(.256,s*.152),(.265,s*.152),(.265,s*.156),(.256,s*.156)],'uiDark',g)
        for k in range(6):
            t=k*math.tau/6
            o=box('hub slot',(x+.228*math.cos(t),s*.975,.415+.228*math.sin(t)),(.073,.009,.024),'uiDark',g,.006)
            # Slot plate is oriented tangentially around axle.
            center=Vector((x+.228*math.cos(t),s*.975,.415+.228*math.sin(t)))
            for v in o.data.vertices: v.co-=center
            o.location=center; o.rotation_euler.y=-t+math.pi/2
        lathe('center cap',x,s*.81,.415,[(.001,s*.173),(.087,s*.173),(.097,s*.165),(.087,s*.158),(.001,s*.158)],'sidewalk',g,32)
# Front fascia with raised slatted grille.
for x in [2.095,-2.105]:
    box('bumper',(x,0,.49),(.22,1.79,.255),'asphalt',bevel=.065)
    box('bumper rub strip',(x+( .116 if x>0 else -.116),0,.46),(.016,1.55,.034),'uiDark',bevel=.007)
    px=x+(.137 if x>0 else -.137)
    box('plate mount',(px,0,.48),(.035,.43,.23),'uiDark',bevel=.012)
    box('blank registration',(px+(.025 if x>0 else -.025),0,.49),(.018,.38,.185),'picketWhite',bevel=.008)
box('grille bezel',(2.111,0,.866),(.055,.80,.305),'sidewalk',bevel=.018)
box('grille cavity',(2.143,0,.866),(.018,.745,.25),'uiDark',bevel=.008)
for z in [.77,.825,.88,.935]: box('grille slat',(2.157,0,z),(.023,.70,.015),'asphalt',bevel=.004)
for y in [-.27,-.135,0,.135,.27]: box('grille divider',(2.16,y,.855),(.025,.014,.23),'asphalt',bevel=.003)
empty('lightsFront',(2.1,0,.88),root); empty('lightsBrake',(-2.1,0,.88),root)
for s in [-1,1]:
    box('headlight surround',(2.105,s*.612,.87),(.055,.37,.29),'sidewalk')
    box('headlight lens',(2.145,s*.598,.878),(.036,.29,.225),'windowGlow','lightsFront',.018)
    box('front indicator',(2.134,s*.81,.869),(.038,.115,.226),'schoolBusYellow','lightsFront',.015)
    box('tail surround',(-2.107,s*.694,.874),(.045,.30,.30),'uiDark')
    box('brake lens',(-2.14,s*.694,.825),(.036,.267,.17),'sirenRed','lightsBrake',.012)
    box('rear indicator',(-2.14,s*.694,.952),(.036,.267,.066),'schoolBusYellow','lightsBrake',.01)
    # Wipers raised above the windshield, each angled up from cowl.
    beam('wiper arm',(1.022,s*.50,1.187),(.987,s*.22,1.222),.018,'uiDark')
    beam('wiper blade',(.993,s*.37,1.220),(.993,s*.02,1.220),.024,'uiDark')
    for pos,token in [('headlight','light_led_white'),('brake','light_siren_red')]:
        e=empty('light:'+pos+('L' if s<0 else 'R'),((2.17 if pos=='headlight' else -2.17),s*.60,.88),root)
        e.rotation_euler=(Vector((1,0,-.12)) if pos=='headlight' else Vector((-1,0,0))).to_track_quat('-Z','Y').to_euler()
        e['ss_light']=json.dumps({'type':'spot' if pos=='headlight' else 'point','color':token,'intensity':1.5,'range':14 if pos=='headlight' else 2,'angle':48,'penumbra':.35,'pool':True,'beam':'soft' if pos=='headlight' else 'none','shadow':'hero','powerGroup':'self','emissiveNodes':(['lightsFront_windowGlow','lightsFront_schoolBusYellow'] if pos=='headlight' else ['lightsBrake_sirenRed','lightsBrake_schoolBusYellow'])})
box('rear trunk handle',(-2.122,0,1.016),(.035,.17,.038),'sidewalk',bevel=.008)
beam('exhaust',(-1.85,.56,.29),(-2.21,.56,.29),.082,'asphalt')
box('exhaust opening',(-2.254,.56,.29),(.008,.052,.049),'uiDark',bevel=.014)
# Interior silhouettes behind transparent panes.
for y in [-.37,.37]:
    box('seat cushion',(.1,y,1.02),(.47,.45,.14),'asphalt',bevel=.06)
    box('seat back',(-.12,y,1.25),(.16,.43,.43),'asphalt',bevel=.055)
    box('headrest',(-.13,y,1.49),(.14,.26,.16),'asphalt',bevel=.038)
box('rear bench',(-.88,0,1.2),(.25,1.35,.35),'asphalt',bevel=.05)
box('dashboard',(.77,0,1.14),(.25,1.43,.17),'uiDark')
beam('steering column',(.7,-.37,1.19),(.50,-.37,1.31),.045,'uiDark')
# Steering ring is an actual torus oriented toward driver.
bpy.ops.mesh.primitive_torus_add(major_radius=.13,minor_radius=.018,major_segments=(16 if DISTANCE == 1 else 12) if DISTANCE else 32,minor_segments=(4 if DISTANCE == 1 else 3) if DISTANCE else 8,location=(.50,-.37,1.32),rotation=(0,math.pi/2,0))
o=bpy.context.object
for c in list(o.users_collection): c.objects.unlink(o)
finish(o,'uiDark',bevel=0)
box('rearview mirror',(.78,0,1.48),(.07,.20,.08),'asphalt')
for name,loc in [('driverSeat',(.05,-.38,.96)),('exitL',(.1,-1.25,0)),('exitR',(.1,1.25,0))]: empty(name,loc,root)
c=empty('col:body',(0,0,.84),root); c['collider']='cuboid'; c['shape']='cuboid'; c['size']=[4.35,1.75,1.65]

if DISTANCE:
    export_variant(Path(__file__).parent, DISTANCE, omit=('tread', 'lug', 'rivet', 'bolt', 'seat', 'steering', 'sidewall', 'rim lip'), far_omit=('wiper', 'handle', 'seam', 'badge', 'text', 'letter', 'logo', 'stripe', 'rib', 'hub', 'rim', 'gasket', 'dashboard', 'headrest', 'axle', 'differential', 'grille bar', 'vent', 'hinge', 'clamp', 'spoke'), flat_parts=('*rim*',), owners={groups[g]: [o for (owner, token), objects in parts.items() if owner == g for o in objects] for g in groups})

# Apply once then merge by material within each motion assembly.
for (group,token),objects in parts.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        bpy.context.view_layer.objects.active=o
        for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
        o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
    o=bpy.context.object; o.name=group+'_'+token
    pivot=groups[group]
    scene.cursor.location=pivot.location; bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    mw=o.matrix_world.copy(); o.parent=pivot; o.matrix_world=mw
meshes=[o for o in scene.objects if o.type=='MESH']
# Deterministic vertex AO for the runtime palette shader (no image textures).
if a.glb:
    scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.seed=0
    scene.render.bake.target='VERTEX_COLORS'; scene.render.bake.use_clear=True
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
        o.data.color_attributes.active_color=attr
        o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.object.bake(type='AO')
# Optional distance exports use the same named motion assemblies.
if a.lod:
    for o in meshes:
        bpy.context.view_layer.objects.active=o
        d=o.modifiers.new('distance simplification','DECIMATE'); d.ratio=.15 if a.lod==1 else .05
        bpy.ops.object.modifier_apply(modifier=d.name)
triangles=0
for o in meshes:
    o.data.calc_loop_triangles(); triangles+=len(o.data.loop_triangles)
report={'id':'veh.sedan-blue','tier':'Hero','triangles':triangles,'draw_calls':len(meshes),'materials':sorted(m.name for m in M.values()),'nodes_ok':all(n in groups for n in ['body','wheelFL','wheelFR','wheelRL','wheelRR','lightsFront','lightsBrake','driverSeat','exitL','exitR']),'within_budget':triangles<=80000 and len(meshes)<=40,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/('metrics.json' if not a.lod else f'metrics.lod{a.lod}.json')).write_text(json.dumps(report,indent=2)+'\n')
if a.glb:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    print('GLB OK',triangles,len(meshes))
if a.render:
    world=bpy.data.worlds.new('studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.095,.083,.115,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
    for name,loc,power,size,col in [('key',(4,-5,7),600,5,(1,.84,.68)),('fill',(-3,-4,4),400,5,(.60,.70,1)),('rim',(-3,4,5),700,4,(1,.57,.37))]:
        ld=bpy.data.lights.new(name,'AREA'); ld.energy=power; ld.shape='DISK'; ld.size=size; ld.color=col
        o=bpy.data.objects.new(name,ld); scene.collection.objects.link(o); o.location=loc; o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200)
    ground=bpy.context.object; ground.name='studio ground'; ground.location.z=-.006; ground.data.materials.append(M['uiDark'])
    M['uiDark'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85
    camera=bpy.data.objects.new('camera',bpy.data.cameras.new('camera')); scene.collection.objects.link(camera); scene.camera=camera
    views={'ref':(6,-8,4.6),'game':(7,-7,9),'front':(9,0,2.6),'side':(0,-10,2.5),'rear':(-6,-7,4)}
    camera.location=views[a.view]; camera.rotation_euler=(Vector((0,0,.78))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=6.2 if a.view!='game' else 6.5
    scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='METAL'; prefs.get_devices()
    for device in prefs.devices: device.use=True
    scene.cycles.device='GPU'; scene.view_settings.view_transform='AgX'
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(a.render).resolve()); bpy.ops.render.render(write_still=True); print('RENDER OK')

# Every full source export refreshes the native distance tiers.
if "--glb" in sys.argv and not DISTANCE:
    build_native_lods(__file__)
