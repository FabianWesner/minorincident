"""Sunset Grove family sedan. Deterministic bpy source, +X forward, metres, Z up.
Static geometry joins by palette; doors, wheels and lamps retain joint pivots.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector, Matrix, Euler

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.distance import tier_argument, export_variant, build_native_lods
DISTANCE = tier_argument()
if '--lod-only' in sys.argv:
    build_native_lods(__file__)
    sys.exit(0)

HERE = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
p.add_argument('--glb')
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
rng = random.Random(29)
parts, groups = [], {}

def linear(h):
    rgb = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    return [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]+[1]

def mat(token,h,rough=.5,metal=0,emission=0):
    m=bpy.data.materials.new(('emi_' if emission else 'pal_')+token); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=linear(h); bs.inputs['Roughness'].default_value=rough
    bs.inputs['Metallic'].default_value=metal
    if emission:
        bs.inputs['Emission Color'].default_value=linear(h); bs.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=linear(h)
    return m

M={'paint':mat('backpackTeal','396e60',.36,.15), 'dark':mat('uiDark','25222c',.65),
   'glass':mat('asphalt','40374e',.31,0), 'silver':mat('sidewalk','b9a4a0',.28,.65),
   'rust':mat('woodWarm','b0703f',.85), 'amber':mat('schoolBusYellow','f2b630',.27),
   'head':mat('windowGlow','ffc773',.22,0,2.5), 'red':mat('sirenRed','ff2d2d',.28,0,.6)}

# Single-shell tinted glazing reveals cabin silhouettes without stacked decal planes.
M['glass'].node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.64
M['glass'].surface_render_method='DITHERED'
M['glass'].use_backface_culling=False
M['glass'].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.18

def empty(name,pos=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None); scene.collection.objects.link(o); o.location=pos; o.parent=parent
    return o
root=empty('veh.sedan-green')
root['ss_physics']=json.dumps({'class':'heavy','mass':1350,'friction':.7,'restitution':.05,'centerOfMass':[0,.65,0],'pushable':False,'kickable':False,'flammable':True})
groups['body']=empty('body',parent=root)
for name,pos in [('wheelFL',(1.40,.83,.42)),('wheelFR',(1.40,-.83,.42)),('wheelRL',(-1.40,.83,.42)),('wheelRR',(-1.40,-.83,.42)),('doorL',(.80,.855,1.12)),('doorR',(.80,-.855,1.12)),('doorRL',(-.30,.855,1.12)),('doorRR',(-.30,-.855,1.12)),('lightsFront',(2.21,0,1.04)),('lightsBrake',(-2.20,0,1.04))]:
    groups[name]=empty(name,pos,root); groups[name]['animated']=True
# Lamp assemblies remain separate; their material meshes are merged only inside each joint.
for s in (-1,1):
    suffix='L' if s==1 else 'R'
    groups['lampHead'+suffix]=empty('lampHead'+suffix,(2.23,s*.62,1.08),groups['lightsFront'])
    groups['lampHead'+suffix].location=Vector((2.23,s*.62,1.08))-groups['lightsFront'].location
    groups['lampBrake'+suffix]=empty('lampBrake'+suffix,(-2.22,s*.65,1.09),groups['lightsBrake'])
    groups['lampBrake'+suffix].location=Vector((-2.22,s*.65,1.09))-groups['lightsBrake'].location
bpy.context.view_layer.update()

def finish(o,name,key,group='body',bevel=0,detail=0):
    if DISTANCE: bevel = 0
    o.name=name; o.data.materials.append(M[key])
    if bevel:
        mod=o.modifiers.new('soft bevel','BEVEL'); mod.width=bevel
        broad={'roof','hood','trunk','door skin','bumper','mirror housing','front fascia','rear fascia','seat cushion','seat back','headrest'}
        fine={'rolled wheel arch','rim pocket','lug nut','plate bolt','cowl vent','lens rib','tail lens groove','intake fin','grille fin'}
        mod.segments=3 if name in broad else 1 if name in fine or detail==2 else 2
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    layer=o.data.attributes.new(name='detail',type='INT',domain='FACE')
    for f in layer.data: f.value=detail
    world=o.matrix_world.copy(); o.parent=groups[group]; o.matrix_world=world
    parts.append(o); return o

def box(name,pos,size,key,bevel=.015,group='body',detail=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,key,group,bevel,detail)

def mesh(name,verts,faces,key,group='body',bevel=0,detail=0):
    d=bpy.data.meshes.new(name); d.from_pydata(verts,[],faces); d.update()
    bm=bmesh.new(); bm.from_mesh(d); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(d); bm.free()
    o=bpy.data.objects.new(name,d); scene.collection.objects.link(o)
    return finish(o,name,key,group,bevel,detail)

def slab(name,verts,depth,key,group='body',bevel=.01,detail=0):
    n=len(verts); offset=Vector(depth)
    vs=[Vector(v)-offset/2 for v in verts]+[Vector(v)+offset/2 for v in verts]
    fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,vs,fs,key,group,bevel,detail)

def panel(name,pts,y,depth,key='paint',group='body',bevel=.015,detail=0):
    return slab(name,[(x,y,z) for x,z in pts],(0,depth,0),key,group,bevel,detail)

def beam(name,v1,v2,w,key,group='body',detail=0):
    v1,v2=Vector(v1),Vector(v2)
    o=box(name,(v1+v2)/2,(w,w,(v2-v1).length),key,min(w/3,.015),group,detail)
    o.rotation_euler=(v2-v1).to_track_quat('Z','Y').to_euler(); return o

def cyl(name,pos,r,depth,key,group='body',axis='Y',n=40,detail=0):
    if DISTANCE: n = min(n, 12 if DISTANCE == 1 else 6)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=depth,location=pos)
    o=bpy.context.object; o.rotation_euler=(math.pi/2,0,0) if axis=='Y' else (0,math.pi/2,0) if axis=='X' else (0,0,0)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,key,group,.005,detail)

def ring(name,x,y,z,profile,key,group='body',n=64,detail=0):
    if DISTANCE: n = min(n, 12 if DISTANCE == 1 else 6)
    vs=[(x+r*math.sin(i*math.tau/n),y+dy,z+r*math.cos(i*math.tau/n)) for r,dy in profile for i in range(n)]
    fs=[(j*n+i,j*n+(i+1)%n,((j+1)%len(profile))*n+(i+1)%n,((j+1)%len(profile))*n+i) for j in range(len(profile)) for i in range(n)]
    o=mesh(name,vs,fs,key,group,detail=detail)
    for f in o.data.polygons: f.use_smooth=True
    return o

# Chassis, open wheel wells and rounded lower body.
box('underbody',(0,0,.54),(4.18,1.42,.25),'dark',.04)
box('cabin floor',(-.28,0,.65),(2.32,1.52,.14),'dark',.035)
for x in (-1.4,1.4):
    cyl('axle',(x,0,.42),.06,1.74,'dark')
    for s in (-1,1):
        box('wheel well',(x,s*.66,.83),(.96,.12,.28),'dark',.05)
        beam('suspension',(x-.12,s*.64,.43),(x+.10,s*.64,.82),.055,'silver',detail=2)
for s in (-1,1):
    # Each arch is a real cutout bounded by a continuous rolled lip.
    for x,lo,hi,label in [(1.4,.82,2.17,'front'),(-1.4,-2.17,-.97,'rear')]:
        arch=[(x+.49*math.cos(i*math.pi/16),.42+.49*math.sin(i*math.pi/16)) for i in range(17)]
        outline=[(lo,1.18),(hi,1.18),(hi,.48),(x+.49,.48)]+arch+[(lo,.48)]
        panel(label+' quarter',outline,s*.812,.105)
        for i in range(16):
            ang1=i*math.pi/16; ang2=(i+1)*math.pi/16
            pts=[(x+r*math.cos(t),.42+r*math.sin(t)) for r,t in [(.49,ang1),(.49,ang2),(.545,ang2),(.545,ang1)]]
            panel('rolled wheel arch',pts,s*.876,.042,bevel=.009)
    box('rocker',(-.05,s*.804,.46),(2.05,.13,.13),'paint',.025)
    box('sill rubber',(-.05,s*.866,.48),(1.89,.022,.035),'dark',.009)
# Crowned hood and trunk built as shallow closed volumes.
def deck(name,x1,x2,z1,z2):
    vs=[(x,y,z+.035*(1-(y/.83)**2)) for x,z in [(x1,z1),(x2,z2)] for y in (-.82,0,.82)]
    vs += [(x,y,z-.1) for x,z in [(x1,z1),(x2,z2)] for y in (-.82,0,.82)]
    fs=[(0,3,4,1),(1,4,5,2),(6,7,10,9),(7,8,11,10),(0,1,2,8,7,6),(3,9,10,11,5,4),(0,6,9,3),(2,5,11,8)]
    mesh(name,vs,fs,'paint',bevel=.022)
deck('hood',.83,2.17,1.205,1.11)
deck('trunk',-2.17,-1.53,1.13,1.195)
# Broad crowned roof has a soft perimeter, not a flat overhanging board.
roof_verts=[]; roof_faces=[]
n,m=(4,3) if DISTANCE == 1 else (2,2) if DISTANCE == 2 else (8,6)
for level in (0,1):
    for i in range(n+1):
        x=-1.22+1.68*i/n
        for j in range(m+1):
            y=-.735+1.47*j/m
            z=1.775 if level==0 else 1.82+.072*(1-(y/.735)**2)+.018*(1-((x+.38)/.84)**2)
            roof_verts.append((x,y,z))
count=(n+1)*(m+1)
for i in range(n):
    for j in range(m):
        k=i*(m+1)+j
        roof_faces.extend([(k,k+1,k+m+2,k+m+1),(k+count,k+m+1+count,k+m+2+count,k+1+count)])
edge=list(range(m+1))+[i*(m+1)+m for i in range(1,n+1)]+[n*(m+1)+j for j in range(m-1,-1,-1)]+[i*(m+1) for i in range(n-1,0,-1)]
for i,k in enumerate(edge):
    nxt=edge[(i+1)%len(edge)]; roof_faces.append((k,nxt,nxt+count,k+count))
roof=mesh('roof',roof_verts,roof_faces,'paint',bevel=.022)
for face in roof.data.polygons: face.use_smooth=True
for sign in (-1,1):
    beam('hood crease',(.97,sign*.54,1.216),(2.08,sign*.64,1.123),.018,'paint')
# Four fully framed doors. Glass slopes inward; no gasket sheet beneath pane.
def window_y(z,s): return s*(.852-(z-1.20)*.205)
for s in (-1,1):
    suffix='L' if s==1 else 'R'
    for back in (False,True):
        g='doorR'+suffix if back else 'door'+suffix
        if back:
            pts=[(-.32,.54),(-.95,.54),(-.96,.77),(-1.09,.94),(-1.45,1.11),(-1.47,1.19),(-.32,1.19)]
            win=[(-.36,1.24),(-1.42,1.24),(-1.06,1.764),(-.37,1.764)]
            hx=-.97
        else:
            pts=[(-.29,.54),(.81,.54),(.81,1.185),(-.29,1.185)]
            win=[(-.24,1.24),(.75,1.24),(.22,1.764),(-.24,1.764)]
            hx=-.08
        panel('door skin',pts,s*.839,.063,group=g,bevel=.019)
        verts=[(x,window_y(z,s),z) for x,z in win]
        # Paint frame and rubber seals are perimeter beams, leaving genuine openings.
        for i in range(4):
            v1,v2=Vector(verts[i]),Vector(verts[(i+1)%4])
            beam('door frame',v1,v2,.055,'paint',g)
            v1.y+=s*.023; v2.y+=s*.023
            beam('glass gasket',v1,v2,.018,'dark',g)
        center=sum((Vector(v) for v in verts),Vector())/4
        pane=[center+(Vector(v)-center)*.936+Vector((0,s*.010,0)) for v in verts]
        mesh('side glass',pane,[tuple(range(4))],'glass',g)
        if back:
            beam('quarter glass divider',(-1.19,window_y(1.25,s)+s*.03,1.25),(-.955,window_y(1.75,s)+s*.03,1.75),.030,'dark',g)
        box('handle pocket',(hx,s*.885,1.09),(.24,.022,.085),'dark',.018,g)
        box('door handle',(hx,s*.906,1.104),(.197,.032,.036),'silver',.012,g)
        box('belt moulding',((-.90 if back else .25),s*.888,.718),((1.01 if back else 1.08),.031,.054),'dark',.012,g)
        box('moulding bright edge',((-.90 if back else .25),s*.908,.743),((1.00 if back else 1.06),.016,.014),'silver',.004,g)
    g='door'+suffix
    beam('mirror stalk',(.70,s*.875,1.24),(.66,s*.983,1.30),.055,'dark',g)
    box('mirror housing',(.65,s*1.004,1.33),(.25,.16,.16),'paint',.038,g)
    box('mirror face',(.514,s*1.006,1.334),(.012,.126,.119),'silver',.014,g)
    beam('A pillar',(.85,s*.823,1.21),(.27,s*.714,1.80),.068,'paint')
    beam('C pillar',(-1.57,s*.822,1.21),(-1.14,s*.714,1.80),.090,'paint')
    beam('B pillar',(-.30,s*.824,1.2),(-.30,s*.712,1.80),.049,'dark')
    box('fender trim',(1.82,s*.880,.735),(.52,.03,.05),'dark',.008)
    box('rear trim',(-1.99,s*.881,.735),(.34,.031,.05),'dark',.008)
    box('side indicator',(1.035,s*.885,1.03),(.094,.02,.046),'amber',.009)
    if s==-1:
        box('fuel recess',(-1.77,s*.879,1.038),(.23,.018,.227),'dark',.030)
        box('fuel flap',(-1.77,s*.897,1.038),(.205,.017,.202),'paint',.026)
# Front and rear glazing: inset inside physical seals; panes at least 8mm clear.
for label,vs in [('windshield',[(.833,-.795,1.245),(.833,.795,1.245),(.273,.697,1.785),(.273,-.697,1.785)]),('rear screen',[(-1.57,.78,1.25),(-1.57,-.78,1.25),(-1.14,-.691,1.785),(-1.14,.691,1.785)])]:
    for i in range(4): beam(label+' seal',vs[i],vs[(i+1)%4],.036,'dark')
    center=sum((Vector(v) for v in vs),Vector())/4
    mesh(label,[center+(Vector(v)-center)*.956 for v in vs],[tuple(range(4))],'glass')
for y in (-.42,.36):
    beam('wiper arm',(.879,y-.18,1.24),(.809,y+.05,1.29),.018,'dark',detail=2)
    beam('wiper blade',(.809,y-.18,1.291),(.809,y+.25,1.291),.024,'dark')
box('cowl',(.81,0,1.215),(.14,1.58,.045),'paint')
for y in [i*.07 for i in range(-9,10)]: box('cowl vent',(.82,y,1.243),(.043,.024,.006),'dark',.002,detail=2)
# Furnished cabin for opening doors, kept static and joined by material.
box('dashboard',(.61,0,1.15),(.26,1.50,.17),'dark',.045)
for x in (.05,-.89):
    for y in (-.42,.42):
        box('seat cushion',(x,y,.78),(.45,.48,.16),'dark',.06)
        box('seat back',(x-.19,y,1.10),(.16,.47,.57),'dark',.055)
        box('headrest',(x-.18,y,1.46),(.14,.29,.22),'dark',.045)
box('center console',(.05,0,.90),(.66,.16,.16),'dark',.025)
beam('gear lever',(.25,0,.96),(.24,0,1.12),.023,'silver',detail=2)
cyl('gear knob',(.24,0,1.14),.039,.05,'dark',axis='Z',n=24,detail=2)
ring('steering wheel',.49,.41,1.28,[(.15,-.015),(.17,-.015),(.17,.015),(.15,.015)],'dark',n=40)
box('rearview mirror',(.32,0,1.65),(.06,.23,.085),'dark',.014)
# End caps, grille, warm rectangular lamps and bright thin bumper strips.
box('front fascia',(2.16,0,.984),(.12,1.64,.29),'paint',.028)
box('rear fascia',(-2.16,0,1.00),(.12,1.64,.32),'paint',.026)
box('grille surround',(2.233,0,1.047),(.042,.90,.28),'silver',.027)
box('grille recess',(2.259,0,1.047),(.025,.833,.228),'dark',.019)
for z in (.974,1.044,1.114): box('grille blade',(2.276,0,z),(.027,.812,.017),'silver',.005)
for y in (-.30,-.15,.15,.30): box('grille fin',(2.270,y,1.042),(.02,.017,.197),'dark',.004,detail=2)
# Fictional diamond, not a real automotive marque.
slab('diamond badge',[(2.296,-.059,1.05),(2.296,0,1.12),(2.296,.059,1.05),(2.296,0,.98)],(.021,0,0),'silver',bevel=.007)
for s in (-1,1):
    suffix='L' if s==1 else 'R'
    box('headlamp bezel',(2.237,s*.611,1.053),(.045,.328,.279),'silver',.026)
    box('headlamp lens',(2.270,s*.596,1.059),(.039,.266,.231),'head',.018,'lampHead'+suffix)
    for y in [s*.596+i*.042 for i in range(-2,3)]: box('lens rib',(2.294,y,1.059),(.011,.008,.198),'head',.003,'lampHead'+suffix,2)
    box('front turn lamp',(2.257,s*.803,1.048),(.050,.101,.236),'amber',.018,'lightsFront')
    box('rear bezel',(-2.225,s*.623,1.064),(.029,.384,.261),'dark',.019)
    box('brake lens',(-2.251,s*.592,1.101),(.035,.286,.139),'red',.014,'lampBrake'+suffix)
    box('rear amber',(-2.252,s*.797,1.101),(.034,.086,.14),'amber',.012,'lightsBrake')
    box('reverse lens',(-2.254,s*.623,.989),(.036,.347,.069),'silver',.009,'lightsBrake')
    for z in (1.068,1.13): box('tail lens groove',(-2.273,s*.592,z),(.010,.249,.007),'red',.002,'lampBrake'+suffix,2)
    box('fog recess',(2.29,s*.657,.657),(.055,.25,.108),'dark',.016)
    box('fog lens',(2.324,s*.657,.657),(.024,.177,.066),'amber',.009,'lightsFront')
for x in (-2.23,2.23):
    box('bumper',(x,0,.782),(.20,1.79,.164),'paint',.037)
    box('bumper rubber',(x+(.105 if x>0 else -.105),0,.801),(.027,1.69,.049),'dark',.009)
    box('bumper bright strip',(x+(.118 if x>0 else -.118),0,.829),(.016,1.67,.014),'silver',.004)
    box('lower valance',(x-.016,0,.605),(.13,1.64,.186),'paint',.026)
    box('plate',(x+(.137 if x>0 else -.137),0,.745 if x>0 else 1.049),(.025,.345,.185),'silver',.014)
    for y in (-.136,.136): cyl('plate bolt',(x+(.154 if x>0 else -.154),y,.795 if x>0 else 1.105),.009,.008,'dark',axis='X',n=12,detail=2)
box('lower intake',(2.306,0,.607),(.027,.905,.097),'dark',.013)
for y in (-.34,-.17,0,.17,.34): box('intake fin',(2.326,y,.61),(.018,.018,.077),'silver',.003,detail=2)
cyl('tailpipe',(-2.17,-.54,.425),.051,.28,'silver',axis='X')
cyl('exhaust opening',(-2.317,-.54,.425),.036,.011,'dark',axis='X')
# Rounded multi-ring tires, staggered treads, stamped steel rims and recessed vents.
for g in ('wheelFL','wheelFR','wheelRL','wheelRR'):
    x,y,z=groups[g].location; s=1 if y>0 else -1
    ring('tire',x,y,z,[(.25,-.135),(.33,-.135),(.39,-.106),(.414,-.071),(.42,-.04),(.42,.04),(.414,.071),(.39,.106),(.33,.135),(.25,.135)],'dark',g,n=80)
    for row in (-1,0,1):
        for i in range(48):
            ang=math.tau*(i+.33*(row%2))/48
            center=Vector((x+.418*math.sin(ang),y+row*.063,z+.418*math.cos(ang)))
            rot=Euler((0,ang,.13 if row else -.13)).to_matrix()
            outline=[(-.015,-.022),(.015,-.022),(.019,-.018),(.019,.018),(.015,.022),(-.015,.022),(-.019,.018),(-.019,-.018)]
            vs=[center+rot@Vector((u,v,h)) for h in (-.0065,.0065) for u,v in outline]
            fs=[tuple(reversed(range(8))),tuple(range(8,16))]+[(j,(j+1)%8,(j+1)%8+8,j+8) for j in range(8)]
            mesh('tread',vs,fs,'dark',g,detail=2)
    outer=y+s*.135
    ring('rim lip',x,outer,z,[(.238,-.003*s),(.268,.006*s),(.278,.019*s),(.272,.032*s),(.248,.039*s),(.231,.014*s)],'silver',g)
    cyl('rim dish',(x,outer+s*.018,z),.246,.023,'silver',g,n=64)
    for i in range(8):
        ang=i*math.tau/8
        o=cyl('rim pocket',(x+.193*math.sin(ang),outer+s*.035,z+.193*math.cos(ang)),.030,.009,'dark',g,n=24,detail=2)
        o.scale.z=1.4
    cyl('hub dome',(x,outer+s*.042,z),.130,.052,'silver',g,n=48)
    for i in range(4):
        ang=i*math.tau/4+.4
        cyl('lug nut',(x+.084*math.sin(ang),outer+s*.077,z+.084*math.cos(ang)),.014,.019,'silver',g,n=6,detail=2)
    cyl('center badge',(x,outer+s*.075,z),.035,.009,'silver',g,n=24,detail=2)
    ring('sidewall ridge',x,y+s*.133,z,[(.314,0),(.322,s*.005),(.328,s*.005),(.331,0)],'dark',g,n=80,detail=2)
# Small irregular raised chips: all minimum 6mm above the finished paint.
def chip(x,y,z,r,group='body',horizontal=False):
    n=7; pts=[]
    for i in range(n):
        ang=i*math.tau/n; rr=r*rng.uniform(.55,1)
        pts.append((x+math.cos(ang)*rr,y+math.sin(ang)*rr*.48,z) if horizontal else (x+math.cos(ang)*rr,y,z+math.sin(ang)*rr*.5))
    mesh('rust chip',pts,[tuple(range(n))],'rust',group,detail=2)
for s in (-1,1):
    for x,z,r in [(2.03,.97,.048),(1.02,1.10,.033),(-1.92,1.14,.063),(-2.03,.53,.065),(.86,.49,.06)]: chip(x,s*.903,z,r)
    for x in (-.9,-.5,-.08,.25,.56): chip(x,s*.881,.421,.052)
    # Door chips intentionally limited to rear doors, avoiding extra front draw calls.
    g='doorR'+('L' if s==1 else 'R')
    for x,z,r in [(-.65,.57,.054),(-.88,1.16,.032),(-.47,.65,.023)]: chip(x,s*.880,z,r,g)
for x,y,r in [(2.01,.58,.10),(1.56,-.63,.044),(.99,-.55,.09),(1.38,.45,.052),(1.95,-.18,.033)]:
    z=1.205+(x-.83)/(2.17-.83)*(1.11-1.205)+.035*(1-(y/.83)**2)+.009
    chip(x,y,z,r,horizontal=True)
for x,y,r in [(-.90,-.55,.055),(-.1,.61,.047),(.26,-.54,.064),(-.8,.4,.025)]:
    z=1.82+.072*(1-(y/.735)**2)+.018*(1-((x+.38)/.84)**2)+.009
    chip(x,y,z,r,horizontal=True)
for sign in (-1,1):
    panel('rocker edge wear',[(-.88,.425),(-.81,.444),(-.58,.437),(-.47,.449),(-.36,.432),(-.12,.445),(.08,.434),(.17,.446),(.38,.439),(.49,.448),(.70,.425),(.42,.417),(.1,.425),(-.31,.416),(-.60,.426)],sign*.882,.006,'rust',bevel=0,detail=2)
# Sockets and simulation-only collider empties.
for name,pos in [('driverSeat',(.05,.42,.86)),('exitL',(.15,1.28,0)),('exitR',(.15,-1.28,0))]: empty(name,pos,root)
col=empty('col:chassis',(0,0,.94),root); col['collider']='cuboid'; col['shape']='cuboid'; col['size']=[4.3,1.6,1.65]
for s in (-1,1):
    suffix='L' if s==1 else 'R'
    for typ,g,token,intensity,direction in [('headlight','lampHead'+suffix,'light_window_warm',6,(1,0,-.12)),('brake','lampBrake'+suffix,'light_siren_red',2,(-1,0,0))]:
        e=empty('light:'+typ+suffix,parent=groups[g]); e.rotation_euler=Vector(direction).to_track_quat('-Z','Y').to_euler()
        e['ss_light']=json.dumps({'type':'spot' if typ=='headlight' else 'point','color':token,'intensity':intensity,'range':18 if typ=='headlight' else 3,'angle':48,'penumbra':.35,'pool':True,'beam':'soft' if typ=='headlight' else 'none','flare':True,'reflect':True,'shadow':'hero' if typ=='headlight' else 'none','heroPriority':2,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':[g+'_'+M['head' if typ=='headlight' else 'red'].name],'tiers':'all'})
if DISTANCE:
    export_variant(Path(__file__).parent, DISTANCE, fit_dimensions=True, omit=('tread', 'lug', 'rivet', 'bolt', 'seat', 'steering', 'sidewall', 'rim lip'), far_omit=('wiper', 'handle', 'seam', 'badge', 'text', 'letter', 'logo', 'stripe', 'rib', 'hub', 'rim', 'gasket', 'dashboard', 'headrest', 'axle', 'differential', 'grille bar', 'vent', 'hinge', 'clamp', 'spoke'), flat_parts=('*rim*',))

# Merge by material within the appropriate rigid motion group.
joined=[]
for group,parent in groups.items():
    for m in M.values():
        batch=[o for o in parts if o.parent==parent and o.data.materials[0]==m]
        if not batch: continue
        parts[:]=[o for o in parts if o not in batch]
        bpy.ops.object.select_all(action='DESELECT')
        for o in batch: o.select_set(True)
        bpy.context.view_layer.objects.active=batch[0]; bpy.ops.object.join()
        o=bpy.context.object; o.name=group+'_'+m.name; joined.append(o)
        mod=o.modifiers.new('triangles','TRIANGULATE'); bpy.ops.object.modifier_apply(modifier=mod.name)
        ao=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER')
        for c in ao.data: c.color=(1,1,1,1)
# Fit manifest frame, including mirrors, to 4.4 x 1.8 x 1.9m; ground at exactly zero.
bpy.context.view_layer.update()
coords=[o.matrix_world@v.co for o in joined for v in o.data.vertices]
lo=Vector([min(v[i] for v in coords) for i in range(3)]); hi=Vector([max(v[i] for v in coords) for i in range(3)])
scale=Vector((4.4/(hi.x-lo.x),1.8/(hi.y-lo.y),1.9/(hi.z-lo.z)))
S=Matrix.Diagonal((*scale,1)); S.translation=Vector((-(hi.x+lo.x)*.5*scale.x,-(hi.y+lo.y)*.5*scale.y,-lo.z*scale.z))
worlds={o:o.matrix_world.copy() for o in list(scene.objects)}
def hierarchy_depth(o):
    return 0 if not o.parent else 1+hierarchy_depth(o.parent)
for o in sorted((o for o in scene.objects if o.type=='EMPTY'),key=hierarchy_depth):
    o.matrix_world=S@worlds[o]
    o.scale=(1,1,1)
    bpy.context.view_layer.update()
bpy.context.view_layer.update()
for o in joined:
    # Transform vertex coordinates directly: S @ rotated object matrix may contain
    # shear, which cannot be represented by a glTF TRS node or Blender decomposition.
    o.data.transform(o.parent.matrix_world.inverted() @ S @ worlds[o])
    o.matrix_parent_inverse=Matrix.Identity(4)
    o.matrix_basis=Matrix.Identity(4)
    o.data.update()
bpy.context.view_layer.update()
col['size']=[4.25,1.6,1.65]
asset_objects=list(scene.objects)
tris=sum(len(o.data.polygons) for o in joined)
print('GEOMETRY OK',tris,'triangles',len(joined),'draw calls')
required=['body','wheelFL','wheelFR','wheelRL','wheelRR','lightsFront','lightsBrake','driverSeat','exitL','exitR','doorL','doorR','doorRL','doorRR']
report={'id':'veh.sedan-green','tier':'Hero','triangles':tris,'draw_calls':len(joined),'materials':sorted(m.name for m in M.values()),'nodes_ok':all(bpy.data.objects.get(n) for n in required),'within_budget':tris<=80000 and len(joined)<=40,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
if a.glb:
    target=Path(a.glb).resolve(); target.parent.mkdir(parents=True,exist_ok=True)
    scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.seed=29
    scene.render.bake.target='VERTEX_COLORS'
    bpy.ops.object.select_all(action='DESELECT')
    for o in joined:
        o.select_set(True); o.data.color_attributes.active_color_index=o.data.color_attributes.find('ao')
    bpy.context.view_layer.objects.active=joined[0]; bpy.ops.object.bake(type='AO',use_clear=True)
    def export(path):
        bpy.ops.object.select_all(action='DESELECT')
        for o in asset_objects: o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_texcoords=False,export_vertex_color='NAME',export_vertex_color_name='ao',export_all_vertex_colors=False)
    export(target)
    for level,ratio in [(1,.125),(2,.04)]:
        originals={o:o.data for o in joined}
        for o in joined:
            o.data=o.data.copy()
            if level==2:
                bm=bmesh.new(); bm.from_mesh(o.data); layer=bm.faces.layers.int.get('detail')
                if layer: bmesh.ops.delete(bm,geom=[f for f in bm.faces if f[layer]>=2],context='FACES')
                bm.to_mesh(o.data); bm.free()
            # Retain tiny planar panes; collapsing them erases an entire window.
            if len(o.data.polygons)>16:
                mod=o.modifiers.new('LOD','DECIMATE'); mod.ratio=ratio
                bpy.context.view_layer.objects.active=o
                bpy.ops.object.modifier_apply(modifier=mod.name)
            # Quadric collapse can extrapolate vertices. Keep the production frame.
            inverse=o.matrix_world.inverted()
            for v in o.data.vertices:
                world=o.matrix_world@v.co
                world.x=max(-2.2,min(2.2,world.x))
                world.y=max(-.9,min(.9,world.y))
                world.z=max(0,min(1.9,world.z))
                v.co=inverse@world
        export(target.with_name(target.stem+f'.lod{level}.glb'))
        for o,data in originals.items():
            temp=o.data; o.data=data; bpy.data.meshes.remove(temp)
    (HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    print('EXPORT OK',tris,'triangles',len(joined),'draw calls')
if a.render:
    studio=mat('studio','2a2730',.87)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.018)); bpy.context.object.data.materials.append(studio)
    scene.world=bpy.data.worlds.new('studio'); scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes['Background']; bg.inputs[0].default_value=(.19,.17,.23,1); bg.inputs[1].default_value=.65
    for name,pos,power,color,size in [('key',(4,-5,7),1000,(1,.79,.60),5),('fill',(1,5,4),750,(.68,.78,1),5),('rim',(-5,-1,5),1100,(1,.65,.39),4)]:
        d=bpy.data.lights.new(name,'AREA'); o=bpy.data.objects.new(name,d); scene.collection.objects.link(o)
        o.location=pos; d.energy=power; d.color=color; d.shape='DISK'; d.size=size; o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
    views={'ref':(8,10,5.5),'game':(9,-9,12),'front':(10,0,3),'rear':(-10,-1,3.6),'side':(0,-12,3)}
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera')); scene.collection.objects.link(cam); scene.camera=cam
    target=Vector((0,0,.98)); cam.location=views[a.view]; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'; cam.data.ortho_scale=6.8 if a.view=='game' else 5.9
    scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.render.filepath=str(Path(a.render).resolve()); Path(a.render).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True); print('RENDER OK',a.render)
    rp=Path(a.render)
    if a.view=='ref' and (rp.stem.startswith('round') or rp.stem=='hero'):
        cam.location=views['game']; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.ortho_scale=6.8
        scene.render.filepath=str(rp.with_name('game.png' if rp.stem=='hero' else rp.stem.replace('-ref','-game')+'.png').resolve())
        if rp.stem=='hero':
            scene.render.resolution_x=960; scene.render.resolution_y=540; scene.cycles.samples=24
        bpy.ops.render.render(write_still=True)
        print('RENDER OK',scene.render.filepath)

# Every full source export refreshes the native distance tiers.
if "--glb" in sys.argv and not DISTANCE:
    build_native_lods(__file__)
