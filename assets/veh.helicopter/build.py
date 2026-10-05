"""Sunset Grove rescue helicopter. Deterministic, metres, +X nose, Z-up.
Analytic cabin patches keep glazing/paint above the rounded shell. All fixed
parts batch by material, while doors, rotors and lamps retain joint pivots.
Run through experiment/tools/blender_run.py; no textures or external assets.
"""
import argparse, json, math, struct, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ASSET = {'id': 'veh.helicopter', 'category': 'vehicle'}
p = argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--glb'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
p.add_argument('--bake', action='store_true')
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
model = bpy.data.collections.new('helicopter'); scene.collection.children.link(model)
M = {}; groups = {}

def color(h):
    c = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    return [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]

def mat(token, h, rough=.4, metal=0, emission=0):
    name = ('emi_' if emission else 'pal_')+token
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value=color(h)
    b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
    if emission:
        b.inputs['Emission Color'].default_value=color(h); b.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=color(h); M[token if not emission else 'emit_'+token]=m
    return m
mat('survivorRed','d9363e',.28); mat('picketWhite','f2e6dc',.35)
mat('uiDark','25222c',.19,.25); mat('asphalt','5b4f5c',.42,.45)
mat('sidewalk','b9a4a0',.27,.65); mat('woodWarm','b0703f',.38,.45)
mat('windowGlow','ffc773',.25,emission=3)
mat('sirenRed','ff2d2d',.22,emission=2)

def empty(name, loc=(0,0,0), parent='root'):
    o=bpy.data.objects.new(name,None); model.objects.link(o); o.location=loc
    bpy.context.view_layer.update()
    if parent:
        o.parent=groups[parent]; o.matrix_parent_inverse=groups[parent].matrix_world.inverted()
    groups[name]=o; return o
empty('root',parent=None)

def finish(o, material, group='body', bevel=0, smooth=True):
    for c in list(o.users_collection): c.objects.unlink(o)
    model.objects.link(o); o.data.materials.append(M[material])
    for f in o.data.polygons:f.use_smooth=smooth
    if bevel:
        mod=o.modifiers.new('soft manufactured edges','BEVEL'); mod.width=bevel; mod.segments=2
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
    bpy.context.view_layer.update()
    o.parent=groups[group]; o.matrix_parent_inverse=groups[group].matrix_world.inverted()
    return o

def mesh(name,vs,fs,material,group='body',bevel=0,smooth=True):
    me=bpy.data.meshes.new(name); me.from_pydata(vs,[],fs); me.update()
    bm=bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new(name,me); return finish(o,material,group,bevel,smooth)

def box(name,loc,size,material,group='body',bevel=.02,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name
    o.scale=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot:o.rotation_euler=rot
    return finish(o,material,group,min(bevel,min(size)*.4))

def ellipsoid(name,loc,size,material,group='body'):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=loc)
    o=bpy.context.object; o.name=name; o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,material,group)

def cyl(name,loc,r,depth,material,axis='Z',group='body'):
    bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=r,radius2=r,depth=depth,location=loc)
    o=bpy.context.object; o.name=name
    o.rotation_euler={'X':(0,math.pi/2,0),'Y':(math.pi/2,0,0),'Z':(0,0,0)}[axis]
    return finish(o,material,group,.008)

def tube(name,pts,r,material,group='body'):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.bevel_depth=r; cu.bevel_resolution=2
    s=cu.splines.new('POLY'); s.points.add(len(pts)-1)
    for point,co in zip(s.points,pts):point.co=(*co,1)
    o=bpy.data.objects.new(name,cu); model.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.convert(target='MESH'); return finish(o,material,group)

def beam(name,start,end,r,material,group='body'):
    return tube(name,[start,end],r,material,group)

def prism(name,pts,y,width,material,group='body',bevel=.02):
    n=len(pts); vs=[(x,y+d*width/2,z) for d in [-1,1] for x,z in pts]
    fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,vs,fs,material,group,bevel,False)

def text(name,body,loc,size,material,side=1,group='body'):
    cu=bpy.data.curves.new(name,'FONT'); cu.body=body; cu.size=size; cu.extrude=.004; cu.bevel_depth=.001
    cu.resolution_u=4; cu.align_x='CENTER'; cu.align_y='CENTER'; cu.space_character=1.05
    o=bpy.data.objects.new(name,cu); model.objects.link(o); o.location=loc
    o.rotation_euler=(math.pi/2,0,0) if side==-1 else (math.pi/2,0,math.pi)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.convert(target='MESH'); return finish(o,material,group)

empty('body')
# Cabin cross sections: (x, half-width, center-height, half-height).
PROFILE=[(-1.85,.03,1.85,.10),(-1.65,.65,1.75,.78),(-1.3,.88,1.73,1.02),(-.75,.94,1.73,1.08),
         (0,1.0,1.72,1.12),(.65,.98,1.71,1.10),(1.15,.9,1.65,1.04),(1.6,.77,1.51,.86),
         (2.0,.61,1.37,.67),(2.35,.40,1.28,.48),(2.58,.18,1.26,.30),(2.68,.025,1.25,.11)]
def section(x):
    for i in range(len(PROFILE)-1):
        a,b=PROFILE[i:i+2]
        if a[0]<=x<=b[0]:
            f=(x-a[0])/(b[0]-a[0]); return [a[j]*(1-f)+b[j]*f for j in range(1,4)]
    return PROFILE[0 if x<PROFILE[0][0] else -1][1:]

def surf(x,t,proud=0):
    w,z,h=section(x); st,ct=math.sin(t),math.cos(t)
    # Mild superellipse gives flat-sided doors but rounded shoulders/belly.
    y=w*math.copysign(abs(st)**.72,st); zz=z+h*math.copysign(abs(ct)**.82,ct)
    return (x,y+proud*st,zz+proud*ct)

def patch(name,x0,x1,t0,t1,material,group='body',proud=.012,nx=12,nt=8):
    vs=[surf(x0+(x1-x0)*i/nx,t0+(t1-t0)*j/nt,proud) for i in range(nx+1) for j in range(nt+1)]
    fs=[(i*(nt+1)+j,(i+1)*(nt+1)+j,(i+1)*(nt+1)+j+1,i*(nt+1)+j+1) for i in range(nx) for j in range(nt)]
    return mesh(name,vs,fs,material,group)
# Rings sampled at every profile breakpoint prevent drift between the shell and patches.
xs=[]
for j in range(len(PROFILE)-1):
    xs += [PROFILE[j][0]+(PROFILE[j+1][0]-PROFILE[j][0])*i/4 for i in range(4)]
xs.append(PROFILE[-1][0]); n=64
vs=[surf(x,2*math.pi*k/n) for x in xs for k in range(n)]
fs=[(i*n+k,(i+1)*n+k,(i+1)*n+(k+1)%n,i*n+(k+1)%n) for i in range(len(xs)-1) for k in range(n)]
fs += [tuple(range(n-1,-1,-1)),tuple((len(xs)-1)*n+k for k in range(n))]
mesh('rounded ivory cabin',vs,fs,'picketWhite')
patch('red nose',1.82,2.675,-math.pi,math.pi,'survivorRed',proud=.070,nx=14,nt=64)
patch('red windshield center pillar',.84,1.83,-.063,.063,'survivorRed',proud=.140,nx=16,nt=4)
patch('nose white stripe',1.83,2.675,-.065,.065,'picketWhite',proud=.150,nx=20,nt=4)
for s in [-1,1]:
    # Raised perimeter seals with smaller glazing patches, all well above shell.
    patch('cockpit windscreen seal',.84,2.38,s*.07,s*.84,'asphalt',proud=.070)
    patch('cockpit glazing',.89,2.34,s*.10,s*.80,'uiDark',proud=.150)
    # Split pilot and sliding rescue doors, origins at front hinges / rail joints.
    for label,x0,x1 in [('pilot',.55,1.5),('rescue',-.57,.49)]:
        gn=('doorL' if s==1 else 'doorR') if label=='pilot' else ('doorRescueL' if s==1 else 'doorRescueR')
        empty(gn,surf(x1,s*1.75,.025)); groups[gn]['hinge_axis']='Z'; groups[gn]['role']=label
        patch(label+' door perimeter',x0-.025,x1+.02,s*.90,s*2.13,'asphalt',proud=.055)
        patch(label+' ivory door',x0,x1,s*.92,s*2.11,'picketWhite',gn,proud=.115)
        patch(label+' rubber window seal',x0+.07,x1-.08,s*.98,s*1.64,'asphalt',gn,proud=.185)
        patch(label+' dark window',x0+.105,x1-.115,s*1.015,s*1.60,'uiDark',gn,proud=.260)
        patch(label+' lower red stripe',x0+.01,x1-.01,s*1.95,s*2.045,'survivorRed',gn,proud=.190,nx=12,nt=3)
        hx=x0+.16; loc=surf(hx,s*1.8,.195)
        box('recessed handle bezel',loc,(.17,.045,.115),'uiDark',gn,.03)
        box('door handle',(loc[0],loc[1]+s*.035,loc[2]),(.115,.035,.038),'asphalt',gn,.012)
        for z in [1.05,1.70]:cyl('door hinge',(x1,s*.97,z),.035,.13,'asphalt','Z',gn)
        for x in [x0+.035,x1-.035]:
            pos=surf(x,s*2.08,.06); cyl('door retaining screw',pos,.018,.015,'asphalt','Y',gn)
    patch('aft red stripe',-1.52,-.61,s*1.97,s*2.065,'survivorRed',proud=.090,nx=14,nt=3)
    # Conformal medical insignia follows the rear cabin, with distinct offsets.
    patch('medical white panel',-1.54,-.63,s*.90,s*1.96,'picketWhite',proud=.055)
    patch('medical cross vertical',-1.17,-1.02,s*1.04,s*1.51,'survivorRed',proud=.130,nx=5,nt=12)
    patch('medical cross horizontal',-1.40,-.78,s*1.20,s*1.34,'survivorRed',proud=.205,nx=14,nt=4)
    mark=text('RESCUE','RESCUE',(-1.04,s*.90,1.33),.22,'survivorRed',s)
    bpy.context.view_layer.update()
    for vertex in mark.data.vertices:
        world=mark.matrix_world@vertex.co; w,zc,h=section(world.x)
        ct=math.copysign(min(.99,abs((world.z-zc)/h))**(1/.82),world.z-zc)
        world.y=s*(w*(1-ct*ct)**.36+.140+vertex.co.z)
        vertex.co=mark.matrix_world.inverted()@world
    # Side-step and skid mount plates.
    tube('boarding step',[(-.64,s*1.04,.70),(-.64,s*1.27,.59),(.50,s*1.27,.59),(.50,s*1.04,.70)],.035,'asphalt')
# Fuselage roof cowling and twin turbine housings.
box('red engine deck',(-.48,0,2.77),(2.25,1.30,.42),'survivorRed',bevel=.22)
prism('transmission roof',[(-1.2,2.93),(-.85,3.40),(.32,3.43),(.75,3.12)],0,1.0,'survivorRed',bevel=.10)
for s in [-1,1]:
    box('turbine cowling',(-.72,s*.55,3.03),(1.86,.66,.60),'survivorRed',bevel=.16)
    box('turbine side vent',(-.58,s*.894,3.08),(.45,.024,.22),'uiDark',bevel=.035)
    for i in range(7):box('turbine vent rib',(-.77+i*.063,s*.911,3.08),(.015,.020,.16),'asphalt',bevel=.003)
    cyl('exhaust outer',(-1.56,s*.56,3.05),.23,.36,'asphalt','X')
    cyl('exhaust silver rim',(-1.756,s*.56,3.05),.234,.035,'sidewalk','X')
    cyl('exhaust dark throat',(-1.78,s*.56,3.05),.184,.014,'uiDark','X')
    box('engine intake bezel',(.27,s*.70,3.10),(.47,.038,.24),'asphalt',bevel=.045)
    for i in range(7):box('intake louvre',(.08+i*.061,s*.73,3.10),(.025,.033,.175),'uiDark',bevel=.003)
    box('transmission access grille',(-.38,s*.51,3.30),(.32,.03,.16),'uiDark',bevel=.02)
    for i in range(6):box('grille cooling slat',(-.51+i*.05,s*.535,3.30),(.014,.018,.125),'asphalt',bevel=.003)
    for x in [-1.20,-.55,.1]:
        box('engine service panel seam',(x,s*.805,2.94),(.012,.012,.23),'asphalt',bevel=.002)
        for z in [2.87,3.03]:cyl('service panel fastener',(x+.05,s*.815,z),.014,.012,'sidewalk','Y')
# Tapered tail boom with long, rounded continuous red silhouette.
PROFILE_TAIL=[(-1.45,.39,2.10,.35),(-2.0,.33,2.18,.32),(-3.0,.25,2.35,.25),(-4.2,.17,2.53,.18),(-5.65,.11,2.65,.12)]
nt=48; vs=[]
for x,w,z,h in PROFILE_TAIL:
    vs.extend((x,w*math.sin(2*math.pi*k/nt),z+h*math.cos(2*math.pi*k/nt)) for k in range(nt))
fs=[(j*nt+k,(j+1)*nt+k,(j+1)*nt+(k+1)%nt,j*nt+(k+1)%nt) for j in range(len(PROFILE_TAIL)-1) for k in range(nt)]
fs += [tuple(range(nt-1,-1,-1)),tuple((len(PROFILE_TAIL)-1)*nt+k for k in range(nt))]
mesh('tapered red tail boom',vs,fs,'survivorRed')
for s in [-1,1]:
    mark=text('tail registration','N472RE',(-3.32,s*.30,2.40),.26,'picketWhite',s)
    bpy.context.view_layer.update()
    def tailsection(x):
        for j in range(len(PROFILE_TAIL)-1):
            left,right=PROFILE_TAIL[j:j+2]
            if right[0]<=x<=left[0]:
                f=(x-left[0])/(right[0]-left[0]); return [left[q]*(1-f)+right[q]*f for q in range(1,4)]
        return PROFILE_TAIL[-1][1:]
    for vertex in mark.data.vertices:
        world=mark.matrix_world@vertex.co; w,zc,h=tailsection(world.x)
        world.z+=zc-2.40
        world.y=s*(w*math.sqrt(max(.02,1-((world.z-zc)/h)**2))+.080+vertex.co.z)
        vertex.co=mark.matrix_world.inverted()@world
    beam('tail paint keyline',(-4.45,s*.20,2.55),(-4.94,s*.17,2.62),.018,'picketWhite')
prism('vertical tail fin',[(-5.34,2.48),(-5.47,1.63),(-5.93,1.71),(-5.75,2.67),(-6.24,4.15),(-5.71,4.19),(-5.16,2.77)],0,.15,'survivorRed',bevel=.045)
for s in [-1,1]:
    beam('fin panel seam',(-6.07,s*.082,3.78),(-5.56,s*.082,3.81),.008,'asphalt')
    # Fictional feather emblem in white mesh, matching the reference's white fin badge.
    for dx,dz in [(-.10,0),(.07,.04)]:
        prism('rescue feather',[(-5.80+dx,3.18+dz),(-5.94+dx,3.38+dz),(-5.91+dx,3.64+dz),(-5.80+dx,3.70+dz),(-5.78+dx,3.43+dz),(-5.68+dx,3.26+dz)],s*.085,.012,'picketWhite',bevel=.005)
    for z in [1.91,2.14]:cyl('tail fin fastener',(-5.58,s*.087,z),.015,.012,'sidewalk','Y')
box('horizontal stabilizer',(-5.38,0,2.59),(.55,1.83,.095),'survivorRed',bevel=.04)
box('stabilizer leading edge',(-5.08,0,2.60),(.065,1.70,.045),'asphalt',bevel=.016)
beam('tail antenna',(-5.89,0,4.13),(-5.94,0,4.51),.012,'woodWarm')
# Four-blade main rotor; all blades and articulated hub share the mast pivot.
empty('mainRotor',(-.30,0,3.90)); groups['mainRotor']['rotation_axis']='Z'
cyl('mast socket',(-.30,0,3.45),.27,.13,'asphalt')
cyl('transmission flange',(-.30,0,3.55),.21,.10,'woodWarm')
cyl('mast',(-.30,0,3.74),.115,.40,'sidewalk')
cyl('main hub',(-.30,0,3.99),.30,.24,'asphalt','Z','mainRotor')
ellipsoid('red rotor hub cap',(-.30,0,4.13),(.34,.34,.075),'survivorRed','mainRotor')
for k in range(4):
    ang=math.radians(22)+k*math.pi/2; u=Vector((math.cos(ang),math.sin(ang),0)); v=Vector((-u.y,u.x,0)); c=Vector((-.30,0,4.01))
    def rp(r,w=0,z=0):return tuple(c+u*r+v*w+Vector((0,0,z)))
    beam('rotor spindle',rp(.16),rp(.78),.075,'sidewalk','mainRotor')
    for r in [.38,.66]:
        o=box('articulated hub collar',rp(r),(.17,.23,.19),'asphalt','mainRotor',.025); o.rotation_euler.z=ang
        cyl('pitch bolt',rp(r,0,.105),.04,.035,'woodWarm','Z','mainRotor')
    beam('pitch linkage',rp(.30,.10,-.10),rp(.71,.11,-.04),.025,'woodWarm','mainRotor')
    blade=[rp(.73,-.12,-.025),rp(4.98,-.24,-.055),rp(5.13,.08,-.055),rp(.74,.11,-.025)]
    mesh('main rotor blade',blade+[tuple(Vector(q)+Vector((0,0,.045))) for q in blade],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'asphalt','mainRotor',.016,False)
    for r,wid,material in [(4.60,.065,'picketWhite'),(4.89,.47,'survivorRed')]:
        o=box('rotor tip paint',rp(r,-.065,.045),(wid,.325,.060),material,'mainRotor',.015); o.rotation_euler.z=ang
    beam('rotor leading edge',rp(.83,-.126,.028),rp(4.57,-.229,-.002),.009,'woodWarm','mainRotor')
    beam('mast control rod',(-.30+u.x*.22,u.y*.22,3.55),rp(.40,0,-.15),.018,'woodWarm')
# Four-blade tail rotor, axis transverse to boom.
empty('tailRotor',(-5.59,.25,2.72)); groups['tailRotor']['rotation_axis']='Y'
cyl('tail rotor gearbox',(-5.59,.16,2.72),.20,.30,'asphalt','Y')
cyl('tail rotor hub',(-5.59,.38,2.72),.16,.17,'sidewalk','Y','tailRotor')
cyl('tail rotor red cap',(-5.59,.48,2.72),.095,.045,'survivorRed','Y','tailRotor')
for k in range(4):
    t=.45+k*math.pi/2; u=Vector((math.sin(t),0,math.cos(t))); v=Vector((math.cos(t),0,-math.sin(t))); c=Vector((-5.59,.41,2.72))
    points=[tuple(c+u*r+v*w) for r,w in [(.12,-.07),(.94,-.12),(1.04,.12),(.19,.09)]]
    mesh('tail rotor paddle',[(x,y+d*.025,z) for d in [-1,1] for x,y,z in points],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'asphalt','tailRotor',.014,False)
    pos=c+u*.95; o=box('tail rotor safety tip',pos,(.20,.065,.16),'survivorRed','tailRotor',.015); o.rotation_euler.y=t
# Pale landing skids: curved tube ends, four arch supports, bolted saddles.
for s in [-1,1]:
    skid=[(-1.68,s*1.30,.29),(-1.58,s*1.30,.16),(-1.43,s*1.30,.085),(-1.21,s*1.30,.07),(1.77,s*1.30,.07),(1.97,s*1.30,.12),(2.13,s*1.30,.27)]
    tube('landing skid',skid,.070,'picketWhite')
    for x in [-1.03,1.15]:
        tube('arched landing strut',[(x,s*.70,.94),(x,s*.90,.76),(x,s*1.06,.54),(x,s*1.23,.23),(x,s*1.30,.13)],.075,'sidewalk')
        box('skid saddle',(x,s*1.30,.14),(.28,.22,.12),'woodWarm',bevel=.03)
        for dx in [-.095,.095]:cyl('saddle bolt',(x+dx,s*1.30,.211),.025,.021,'sidewalk')
        cyl('body strut mount',(x,s*.70,.94),.105,.12,'asphalt','Y')
    box('skid wear runner',(.15,s*1.30,.032),(2.80,.09,.025),'asphalt',bevel=.006)
# Beacon and gimballed rescue searchlight, with genuine lamp anchors.
empty('sirenL',(1.03,0,2.82)); empty('sirenR',(-5.57,0,3.00))
cyl('beacon base',(1.03,0,2.82),.13,.075,'sidewalk','Z','sirenL')
ellipsoid('roof beacon lens',(1.03,0,2.94),(.10,.10,.14),'emit_windowGlow','sirenL')
cyl('beacon cap',(1.03,0,3.08),.056,.024,'picketWhite','Z','sirenL')
ellipsoid('tail warning lens',(-5.57,0,3.01),(.062,.065,.077),'emit_sirenRed','sirenR')
empty('lightsBrake',(-5.70,0,2.58))
ellipsoid('tail navigation lens',(-5.77,0,2.58),(.05,.06,.08),'emit_windowGlow','lightsBrake')
empty('lightsFront',(2.22,0,.75)); empty('searchlight',(2.22,0,.72),'lightsFront'); groups['searchlight']['rotation_axis']='Y'
beam('searchlight bracket',(2.15,0,1.02),(2.15,0,.70),.055,'asphalt')
cyl('searchlight housing',(2.29,0,.72),.205,.34,'asphalt','X','searchlight')
cyl('searchlight rim',(2.48,0,.72),.209,.055,'sidewalk','X','searchlight')
cyl('searchlight luminous lens',(2.513,0,.72),.167,.018,'emit_windowGlow','X','searchlight')
cyl('lamp center',(2.526,0,.72),.063,.007,'picketWhite','X','searchlight')
for s in [-1,1]:cyl('searchlight gimbal bearing',(2.24,s*.22,.72),.052,.04,'sidewalk','Y','searchlight')
# Cockpit wipers, recessed nose equipment and airframe fasteners.
for s in [-1,1]:
    tube('windscreen wiper',[surf(2.12,s*.38,.240),surf(1.89,s*.53,.240),surf(1.58,s*.59,.240)],.018,'asphalt')
    patch('nose lower equipment hatch',2.26,2.54,s*.95,s*1.67,'asphalt',proud=.145,nx=7,nt=7)
    patch('nose sensor window',2.30,2.51,s*1.05,s*1.58,'uiDark',proud=.220,nx=6,nt=6)
    for x in [-1.1,-.6,0,.6,1.15]:
        pt=surf(x,s*.67,.027); cyl('cabin roof rivet',pt,.014,.017,'sidewalk')
beam('roof aerial',(-1.12,.30,3.16),(-1.18,.30,3.59),.012,'asphalt')
# Game contracts: wheel names are skid contact sockets, never visible wheels.
for name,x,s in [('wheelFL',1.15,1),('wheelFR',1.15,-1),('wheelRL',-1.03,1),('wheelRR',-1.03,-1)]:
    empty(name,(x,s*1.30,.07)); groups[name]['role']='skidContact'
for name,loc in [('driverSeat',(1.00,.40,1.50)),('exitL',(.1,1.6,.05)),('exitR',(.1,-1.6,.05))]:empty(name,loc)
root=groups['root']; root['asset_id']=ASSET['id']; root['forward']='+X'
root['ss_physics']={'class':'heavy','mass':2200,'friction':.75,'restitution':.05,'pushable':False,'kickable':False,'flammable':True,'centerOfMass':[0,0,1.8]}
col=empty('col:cabin',(.33,0,1.68)); col['collider']='cuboid'; col['shape']='cuboid'; col['size']=[4.8,2.0,2.3]
col=empty('col:tail',(-3.8,0,2.42)); col['collider']='cuboid'; col['shape']='cuboid'; col['size']=[4.0,.52,.52]
# Apply modifiers and join each motion/material pair, keeping all pivots intact.
for o in list(model.objects):
    if o.type!='MESH':continue
    bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
for group in list(groups.values()):
    for material in M.values():
        batch=[o for o in model.objects if o.type=='MESH' and o.parent==group and o.data.materials[0]==material]
        if not batch:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in batch:o.select_set(True)
        bpy.context.view_layer.objects.active=batch[0]; bpy.ops.object.join()
        bpy.context.object.name=group.name+'_'+material.name
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
meshes=[o for o in model.objects if o.type=='MESH']
# Center visual bounds on XY; landing skid bottoms exactly touch Z=0.
bpy.context.view_layer.update()
pts=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
shift=Vector((-(min(v.x for v in pts)+max(v.x for v in pts))/2,-(min(v.y for v in pts)+max(v.y for v in pts))/2,-min(v.z for v in pts)))
for o in list(model.objects):
    if o.parent==root:o.location+=shift
bpy.context.view_layer.update()
# Triangulate, discard microscopic bevel slivers, then bake AO if requested.
for o in meshes:
    bm=bmesh.new(); bm.from_mesh(o.data); bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bad=[f for f in bm.faces if f.calc_area()<1e-10]
    if bad:bmesh.ops.delete(bm,geom=bad,context='FACES')
    bm.to_mesh(o.data); bm.free(); o.data.calc_loop_triangles()
    ao=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
    for c in ao.data:c.color=(1,1,1,1)
    o.data.color_attributes.active_color=ao
if a.bake or a.glb:
    scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.seed=0
    scene.render.bake.target='VERTEX_COLORS'
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.object.bake(type='AO',target='VERTEX_COLORS')
    print('AO OK')
# Bind lights to the actual post-batch emissive mesh names.
def light(name,parent,loc,token,nodes,kind='beacon'):
    o=empty('light:'+name,loc,parent)
    o['ss_light']={'type':kind,'color':token,'intensity':6 if kind=='spot' else 2,'range':24 if kind=='spot' else 3,'angle':42,'penumbra':.4,'pool':True,'beam':'strong' if kind=='spot' else 'none','flare':True,'reflect':True,'shadow':'hero' if kind=='spot' else 'none','heroPriority':2,'flicker':'none','powerGroup':'self','breakable':True,'emissiveNodes':nodes,'tiers':'all'}
    if kind=='spot':o.rotation_euler=(Vector((1,0,-.55))).to_track_quat('-Z','Y').to_euler()
    return o
# Their locations are in world space, after the centering translation.
light('searchlight','searchlight',tuple(Vector((2.53,0,.72))+shift),'light_window_warm',['searchlight_emi_windowGlow'],'spot')
light('beacon','sirenL',tuple(Vector((1.03,0,2.94))+shift),'light_window_warm',['sirenL_emi_windowGlow'])
light('tailWarning','sirenR',tuple(Vector((-5.57,0,3.01))+shift),'light_siren_red',['sirenR_emi_sirenRed'])
light('tailNav','lightsBrake',tuple(Vector((-5.77,0,2.58))+shift),'light_window_warm',['lightsBrake_emi_windowGlow'],'point')
triangles=sum(len(o.data.loop_triangles) for o in meshes)
required=['body','wheelFL','wheelFR','wheelRL','wheelRR','lightsFront','lightsBrake','driverSeat','exitL','exitR','sirenL','sirenR']
report={'id':ASSET['id'],'tier':'Hero','triangles':triangles,'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(n in groups for n in required),'within_budget':triangles<=80000 and len(meshes)<=40,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2)+'\n')
print('BUILD OK',triangles,'triangles;',len(meshes),'draw calls')

def export(path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in model.objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_lights=False,export_cameras=False,export_vertex_color='NAME',export_vertex_color_name='ao',export_all_vertex_colors=False)
    blob=path.read_bytes(); length=struct.unpack_from('<I',blob,12)[0]
    doc=json.loads(blob[20:20+length])
    return sum(doc['accessors'][p['indices']]['count']//3 for mesh in doc['meshes'] for p in mesh['primitives'])
if a.glb:
    out=Path(a.glb).resolve(); export(out)
    # Apply target ratios to every independent mesh; joint nodes survive all LODs.
    originals={o:o.data.copy() for o in meshes}
    lodstats={}
    for lod,ratio in [(1,.12),(2,.03)]:
        for o in meshes:
            o.data=originals[o].copy(); bpy.context.view_layer.objects.active=o
            d=o.modifiers.new('LOD simplification','DECIMATE'); d.ratio=ratio; d.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=d.name); o.data.calc_loop_triangles()
        count=export(out.with_name(out.stem+'.lod'+str(lod)+'.glb'))
        lodstats['lod'+str(lod)]={'triangles':count,'target_ratio':ratio}
    for o in meshes:o.data=originals[o]
    (HERE/'lod-stats.json').write_text(json.dumps(lodstats,indent=2)+'\n')
if a.render:
    world=bpy.data.worlds.new('warm studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.026,.022,.035,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
    def area(name,loc,energy,size,tint):
        data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size; data.color=tint
        o=bpy.data.objects.new(name,data); scene.collection.objects.link(o); o.location=loc
        o.rotation_euler=(Vector((0,0,2))-Vector(loc)).to_track_quat('-Z','Y').to_euler()
    area('warm key',(5,-7,10),1800,7,(1,.82,.65)); area('cool fill',(1,6,8),1400,6,(.67,.78,1)); area('tail rim',(-7,-2,8),2000,5,(1,.43,.20))
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015)); ground=bpy.context.object
    gm=bpy.data.materials.new('studio floor'); gm.use_nodes=True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color('2a2730')
    gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85
    ground.data.materials.append(gm)
    cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera')); scene.collection.objects.link(cam); scene.camera=cam
    target=Vector((0,0,2.0)); views={'ref':(12,17,12),'game':(15,-15,22),'front':(18,0,5),'side':(0,-22,5),'rear':(-15,-15,9)}
    cam.location=views[a.view]; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'; cam.data.ortho_scale=17.5 if a.view=='game' else (13.7 if a.view!='front' else 12.4)
    scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True; scene.cycles.seed=0
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(a.render).resolve()); bpy.ops.render.render(write_still=True); print('RENDER OK')

    if a.view=='ref':
        cam.data.ortho_scale=17.5
        cam.location=views['game']; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.cycles.samples=24; scene.render.resolution_x=960; scene.render.resolution_y=540
        render_path=Path(a.render).resolve()
        game_name='game.png' if render_path.stem=='hero' else render_path.stem.replace('-ref','')+'-game.png'
        scene.render.filepath=str(render_path.with_name(game_name)); bpy.ops.render.render(write_still=True)
        print('GAME RENDER OK')
