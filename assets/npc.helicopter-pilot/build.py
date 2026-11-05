"""Hero rescue pilot. Deterministic, rigid joint hierarchy; +X forward, Z up.
All sculpt subdivisions are applied. No textures or external build dependencies.
Use experiment/tools/blender_run.py; --pose renders a joint articulation test.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
for key in ['render', 'glb']:
    parser.add_argument('--' + key)
parser.add_argument('--view', default='hero')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--pose', action='store_true')
a = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
parts, objects = {}, []
colors = json.loads((HERE.parents[1] / 'src/assets/palette.json').read_text())

def material(token, rough=.65, metal=0):
    m = bpy.data.materials.new('pal_' + token)
    m.use_nodes = True
    rgb = [int(colors[token][i:i+2], 16)/255 for i in [1,3,5]]
    c = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb] + [1]
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = c
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    m.diffuse_color = c
    return m
M = {n: material(n) for n in ['apronOlive','apronSage','uiDark','asphalt','navySeam','skinWarm','skinShadow','skinBlush','hairChestnut','mouth','picketWhite','survivorRed','policeBlue','brass','silver','eyeBrown']}
M['picketWhite'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .32
M['silver'].node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = .65
M['brass'].node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = .55
# Opaque smoky polycarbonate is stable on both render backends.
M['uiDark'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .32

def parent_keep(o, parent):
    bpy.context.view_layer.update()
    world = o.matrix_world.copy()
    o.parent = parts[parent]
    o.matrix_world = world

def node(name, p, parent=None):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    o.location = p
    if parent: parent_keep(o, parent)
    parts[name] = o
    return o

def finish(o, name, token, parent, sub=0):
    o.name = name
    o.data.materials.append(M[token])
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if sub:
        mod = o.modifiers.new('applied sculpt smoothing','SUBSURF')
        mod.levels = sub
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons: f.use_smooth = True
    parent_keep(o, parent)
    objects.append(o)
    return o

def ell(n,p,size,m,par,seg=14,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p)
    o=bpy.context.object; o.scale=size
    return finish(o,n,m,par,0)

def box(n,p,size,m,par,bevel=.008,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p)
    o=bpy.context.object; o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot: o.rotation_euler=rot
    mod=o.modifiers.new('rounded edges','BEVEL');mod.width=bevel;mod.segments=2
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    # Weighted normals retain the broad flat cloth/hardware panels.
    mod=o.modifiers.new('panel normals','WEIGHTED_NORMAL');mod.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,n,m,par)

def mesh(n,v,f,m,par,sub=1):
    me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update()
    o=bpy.data.objects.new(n,me);scene.collection.objects.link(o)
    return finish(o,n,m,par,sub)

def tube(n,points,radii,m,par,N=10,sub=1):
    N=min(N,6)
    if max(max(r) if isinstance(r,tuple) else r for r in radii)<.006:sub=0
    if sub and len(points) >= 2:
        # End support loops keep garment openings full rather than pinched.
        points = [points[0], Vector(points[0]).lerp(Vector(points[1]), .08), *points[1:-1], Vector(points[-1]).lerp(Vector(points[-2]), .08), points[-1]]
        radii = [radii[0], radii[0], *radii[1:-1], radii[-1], radii[-1]]
    v=[];f=[]
    for j,p in enumerate(points):
        t=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(j-1,0)])
        t.normalize();u=t.cross(Vector((1,0,0)))
        if u.length<.1:u=t.cross(Vector((0,1,0)))
        u.normalize();w=t.cross(u)
        r=radii[j];rx,ry=(r,r) if isinstance(r,(float,int)) else r
        for i in range(N):
            angle=i*math.tau/N
            v.append(Vector(p)+u*rx*math.cos(angle)+w*ry*math.sin(angle))
    for j in range(len(points)-1):
        for i in range(N):
            k=j*N+i;kk=j*N+(i+1)%N;f.append((k,kk,kk+N,k+N))
    f += [tuple(range(N-1,-1,-1)),tuple((len(points)-1)*N+i for i in range(N))]
    return mesh(n,v,f,m,par,sub)

def patch(n,points,m,par,depth=.01):
    count=len(points)
    v=points+[(x-depth,y,z) for x,y,z in points]
    f=[tuple(range(count)),tuple(range(count*2-1,count-1,-1))]
    f += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    o=mesh(n,v,f,m,par,0)
    mod=o.modifiers.new('soft patch border','BEVEL');mod.width=.003;mod.segments=2
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def ring(n,p,ry,rz,m,par,r=.004,N=24,xvar=0):
    points=[(p[0]+xvar*math.sin(i*math.tau/N),p[1]+ry*math.cos(i*math.tau/N),p[2]+rz*math.sin(i*math.tau/N)) for i in range(N+1)]
    return tube(n,points,[r]*(N+1),m,par,N=6,sub=0)

def buckle(n,p,w,h,par):
    x,y,z=p
    box(n+' strap',p,(.013,w+.009,h*.75),'uiDark',par,.004)
    for yy in [-1,1]:box(n+' side'+str(yy),(x+.009,y+yy*w/2,z),(.01,.005,h),'silver',par,.002)
    for zz in [-1,1]:box(n+' rail'+str(zz),(x+.009,y,z+zz*h/2),(.01,w,.005),'silver',par,.002)
    box(n+' tongue',(x+.014,y,z),(.008,.004,h*.8),'silver',par,.001)

node('root',(0,0,0))
node('hip',(0,0,.58),'root')
node('torso',(0,0,.70),'hip')
node('head',(0,0,1.035),'torso')
node('backpackSocket',(-.135,0,.86),'torso')
# Tailored flight suit, neck opening, open pointed collar and zipper.
ell('seat',(0,0,.585),(.115,.175,.105),'apronOlive','hip')
ell('flight suit torso',(0,0,.825),(.123,.180,.202),'apronOlive','torso',24,12)
ell('neck',(0,0,1.021),(.054,.062,.067),'skinWarm','head')
ell('undershirt',(.02,0,1.009),(.071,.09,.035),'asphalt','torso')
for s in [-1,1]:
    patch('collar'+str(s),[(.083,s*.019,1.041),(.117,s*.083,1.022),(.142,s*.057,.950),(.124,s*.012,.985)],'apronSage','torso',.018)
    box('chest pocket'+str(s),(.115,s*.095,.897),(.028,.088,.105),'apronOlive','torso',.009)
    box('chest pocket flap'+str(s),(.135,s*.095,.941),(.014,.092,.023),'apronSage','torso',.005)
    ell('pocket snap'+str(s),(.146,s*.095,.942),(.005,.006,.006),'brass','torso',8,6)
    tube('side tailoring'+str(s),[(-.10,s*.117,.702),(-.122,s*.144,.86),(-.088,s*.144,.970)],[.003]*3,'apronSage','torso',6,0)
box('zipper tape',(.130,0,.848),(.012,.014,.256),'apronSage','torso',.003)
for j in range(18):box('zip tooth'+str(j),(.140,0,.73+j*.012),(.006,.009,.003),'brass','torso',.001)
box('zip pull',(.148,0,.943),(.009,.011,.020),'silver','torso',.003)
# Broad harness shoulder webbing; curved to fit the suit and separated from it.
for s in [-1,1]:
    tube('shoulder webbing'+str(s),[(-.133,s*.10,.755),(-.15,s*.13,.940),(-.057,s*.14,1.021),(.072,s*.131,1.010),(.145,s*.114,.924),(.148,s*.095,.78)],[ (.009,.023)]*6,'uiDark','torso',8,1)
    box('webbing chest end'+str(s),(.149,s*.097,.86),(.020,.052,.091),'asphalt','torso',.006)
    buckle('shoulder adjuster'+str(s),(.151,s*.12,.935),.040,.040,'torso')
    box('harness end stitch'+str(s),(.164,s*.097,.868),(.006,.023,.004),'navySeam','torso',.001)
    tube('lower diagonal strap'+str(s),[(.145,s*.096,.825),(.143,s*.141,.750),(.07,s*.184,.686)],[ (.008,.021)]*3,'uiDark','torso',8)
    ring('rescue D ring'+str(s),(.172,s*.134,.783),.016,.025,'silver','torso',.003,16)
    tube('retention cord'+str(s),[(.160,s*.139,.770),(.17,s*.17,.728),(.115,s*.18,.687)],[.003]*3,'brass','torso',6)
for z in [.861,.770]:
    box('chest cross strap'+str(z),(.157,0,z),(.020,.257,.037),'uiDark','torso',.006)
    buckle('chest clasp'+str(z),(.17,0,z),.035,.029,'torso')
# Belt follows the waist as a rounded elliptical loop.
pts=[(.126*math.cos(i*math.tau/40),.176*math.sin(i*math.tau/40),.665) for i in range(41)]
tube('waist utility belt',pts,[(.011,.023)]*41,'uiDark','hip',8)
buckle('belt buckle',(.152,0,.665),.052,.036,'hip')
for s in [-1,1]:
    for j,y in enumerate([.082,.148]):box('belt loop'+str(s)+str(j),(.116,s*y,.665),(.028,.018,.055),'asphalt','hip',.004)
    box('belt survival pouch'+str(s),(.009,s*.200,.684),(.091,.039,.090),'asphalt','hip',.015)
    box('pouch flap'+str(s),(.024,s*.218,.710),(.072,.016,.029),'navySeam','hip',.006)
    ell('pouch snap'+str(s),(.060,s*.221,.705),(.006,.008,.008),'silver','hip',8,6)
# Tailored rear seat pockets remain attached to the pelvis.
for sign in [-1,1]:
    box('rear seat pocket'+str(sign),(-.112,sign*.080,.596),(.018,.078,.076),'apronOlive','hip',.009)
    box('rear pocket welt'+str(sign),(-.127,sign*.080,.631),(.010,.075,.009),'apronSage','hip',.003)
tube('rear seat seam',[(-.124,0,.626),(-.127,0,.583),(-.097,0,.547)],[.0025]*3,'apronSage','hip',6,0)
# Legs and large black leather rescue boots, cuff piping, tread and lacing.
for s,side in [(1,'L'),(-1,'R')]:
    hp=(0,s*.105,.573);kn=(.004,s*.125,.348);ank=(0,s*.138,.131)
    node('leg'+side,hp,'hip');node('shin'+side,kn,'leg'+side);node('foot'+side,ank,'shin'+side)
    tube('flight thigh'+side,[hp,(0,s*.108,.532),(.001,s*.117,.426),kn],[.094,.100,.087,.079],'apronOlive','leg'+side,12)
    ell('knee fabric'+side,kn,(.079,.082,.058),'apronOlive','shin'+side,12,8)
    tube('flight calf'+side,[kn,(.003,s*.130,.312),(.005,s*.133,.280),(-.010,s*.136,.231),(.002,s*.137,.188),ank],[.080,.089,.079,.092,.073,.081],'apronOlive','shin'+side,12)
    box('cargo pocket'+side,(.044,s*.188,.481),(.100,.030,.117),'apronOlive','leg'+side,.013)
    box('cargo flap'+side,(.05,s*.207,.532),(.107,.014,.031),'apronSage','leg'+side,.007)
    box('thigh holster'+side,(-.029,s*.209,.483),(.065,.038,.151),'uiDark','leg'+side,.011)
    box('holster flap'+side,(-.03,s*.232,.529),(.055,.013,.035),'asphalt','leg'+side,.005)
    ell('holster snap'+side,(.004,s*.236,.532),(.006,.007,.007),'brass','leg'+side,8,6)
    pts=[(.095*math.cos(i*math.tau/24),s*.108+.101*math.sin(i*math.tau/24),.498) for i in range(25)]
    tube('thigh retaining strap'+side,pts,[(.006,.013)]*25,'asphalt','leg'+side,6,0)
    box('knee reinforced panel'+side,(.081,s*.126,.353),(.018,.093,.082),'apronSage','shin'+side,.014)
    for j,z in enumerate([.426,.293,.215]):
        tube('trouser fold'+side+str(j),[(.052,s*.073,z+.015),(.090,s*.129,z),(.047,s*.195,z-.008)],[.003,.009,.003],'apronOlive','leg'+side if j==0 else 'shin'+side,8)
    tube('ankle cuff'+side,[(-.003,s*.138,.162),(-.003,s*.138,.139)],[.082,.080],'apronSage','shin'+side,12)
    box('boot sole'+side,(.054,s*.14,.026),(.248,.166,.052),'uiDark','foot'+side,.024)
    box('boot welt'+side,(.054,s*.14,.056),(.248,.167,.022),'asphalt','foot'+side,.009)
    ell('leather boot'+side,(.043,s*.14,.093),(.126,.081,.056),'uiDark','foot'+side)
    ell('boot toecap'+side,(.116,s*.14,.085),(.063,.078,.037),'asphalt','foot'+side)
    tube('boot upper'+side,[(-.005,s*.14,.085),(-.01,s*.14,.153)],[.074,.061],'uiDark','foot'+side,12)
    box('boot tongue'+side,(.043,s*.14,.144),(.071,.074,.018),'asphalt','foot'+side,.006,rot=(0,-.45,0))
    for j in range(5):
        x=.012+j*.017;z=.178-j*.012
        tube('boot lace'+side+str(j),[(x,s*.105,z-.010),(x+.009,s*.14,z),(x,s*.175,z-.010)],[.003]*3,'navySeam','foot'+side,6,0)
        for ss in [-1,1]:ell('boot eyelet'+side+str(j)+str(ss),(x,s*.14+ss*.036,z-.013),(.005,.006,.005),'silver','foot'+side,8,6)
    for j in range(6):
        for ss in [-1,1]:box('tread lug'+side+str(j)+str(ss),(-.043+j*.039,s*.14+ss*.067,.012),(.019,.031,.024),'uiDark','foot'+side,.003)
# Relaxed sleeves, cuffs, knuckle guards and individually curved glove fingers.
for s,side in [(1,'L'),(-1,'R')]:
    sh=(0,s*.175,.968);el=(.006,s*.238,.805);wr=(.013,s*.292,.655)
    node('arm'+side,sh,'torso');node('foreArm'+side,el,'arm'+side);node('hand'+side,wr,'foreArm'+side)
    tube('upper sleeve'+side,[sh,(0,s*.192,.949),(.006,s*.215,.860),el],[.078,.084,.072,.064],'apronOlive','arm'+side,12)
    ell('elbow fabric'+side,el,(.066,.066,.063),'apronOlive','foreArm'+side,12,8)
    tube('lower sleeve'+side,[el,(.009,s*.263,.749),wr],[.064,.075,.058],'apronOlive','foreArm'+side,12)
    for j,z in enumerate([.866,.810,.721]):
        y=s*(.223 if j==0 else .240 if j==1 else .274)
        tube('sleeve crease'+side+str(j),[(.040,y-s*.042,z+.008),(.073,y,z),(.036,y+s*.043,z-.011)],[.004,.010,.003],'apronOlive','arm'+side if j==0 else 'foreArm'+side,8)
    tube('sleeve cuff'+side,[(.013,s*.286,.677),wr],[.063,.061],'apronSage','foreArm'+side,12)
    tube('glove cuff'+side,[(.014,s*.294,.651),(.014,s*.299,.626)],[.057,.058],'uiDark','hand'+side,12)
    ell('glove palm'+side,(.018,s*.303,.598),(.046,.054,.057),'uiDark','hand'+side)
    box('glove back guard'+side,(-.026,s*.303,.603),(.016,.067,.044),'asphalt','hand'+side,.010)
    for j in range(4):
        y=s*(.267+j*.021)
        z=.574+(abs(j-1.5)*.005)
        tube('glove finger'+side+str(j),[(.022,y,z),(.022,y,z-.027),(.041,y,z-.041),(.058,y,z-.027)],[.012,.013,.011,.009],'uiDark','hand'+side,8)
        ell('glove knuckle'+side+str(j),(-.012,y,z+.007),(.013,.013,.014),'asphalt','hand'+side,8,6)
    tube('glove thumb'+side,[(.045,s*.265,.613),(.069,s*.260,.595),(.071,s*.274,.578)],[.018,.017,.012],'uiDark','hand'+side,10)
    node('weaponSocket'+side,(.05,s*.303,.594),'hand'+side)
    # Shoulder rescue insignia: metal-edged embroidered disk, raised star.
    yy=s*.257
    ell('patch piping'+side,(.011,yy,.926),(.054,.009,.056),'silver','arm'+side)
    ell('patch disk'+side,(.011,yy+s*.009,.926),(.049,.007,.051),'policeBlue' if side=='R' else 'survivorRed','arm'+side)
    # Star mesh lies in the side X/Z plane, at least 3 mm above its patch.
    verts=[]
    for j in range(10):
        t=math.pi/2+j*math.pi/5;r=.039 if j%2==0 else .017
        verts.append((.011+r*math.cos(t),yy+s*.019,.926+r*math.sin(t)))
    star=mesh('rescue star'+side,verts,[tuple(range(10))],'picketWhite','arm'+side,0)
    mod=star.modifiers.new('embroidered thickness','SOLIDIFY');mod.thickness=.004
    bpy.context.view_layer.objects.active=star;bpy.ops.object.modifier_apply(modifier=mod.name)
# Real face remains underneath the opaque lowered goggles.
ell('face',(0,0,1.174),(.144,.147,.165),'skinWarm','head',24,16)
ell('soft chin',(.058,0,1.070),(.092,.104,.055),'skinWarm','head')
for s in [-1,1]:
    ell('ear'+str(s),(0,s*.148,1.166),(.034,.025,.046),'skinWarm','head')
    ell('cheek'+str(s),(.113,s*.075,1.125),(.034,.047,.037),'skinWarm','head')
    ell('cheek blush'+str(s),(.141,s*.089,1.128),(.005,.022,.009),'skinBlush','head',12,8)
    ell('eye white'+str(s),(.132,s*.061,1.212),(.013,.035,.026),'picketWhite','head')
    ell('iris'+str(s),(.145,s*.060,1.213),(.008,.015,.020),'eyeBrown','head')
    ell('pupil'+str(s),(.153,s*.060,1.213),(.004,.007,.013),'uiDark','head',12,8)
    tube('eyebrow'+str(s),[(.13,s*.032,1.251),(.129,s*.070,1.260),(.108,s*.104,1.246)],[.008,.009,.004],'hairChestnut','head',8)
ell('nose bridge',(.141,0,1.184),(.022,.023,.042),'skinWarm','head')
ell('round nose',(.163,0,1.156),(.025,.028,.019),'skinWarm','head')
for s in [-1,1]:ell('nostril'+str(s),(.174,s*.016,1.147),(.004,.006,.003),'skinShadow','head',8,6)
tube('smile',[(.143,-.052,1.108),(.154,-.022,1.100),(.159,0,1.099),(.154,.024,1.102),(.140,.050,1.113)],[.003]*5,'mouth','head',8)
ell('lower lip',(.154,0,1.091),(.007,.036,.006),'skinBlush','head',12,8)
# Brown nape volumes visible below the helmet's padded rim.
for j in range(7):
    t=1.35+j*.58
    tube('nape lock'+str(j),[(-.014+.112*math.cos(t),.137*math.sin(t),1.166),(-.014+.127*math.cos(t),.146*math.sin(t),1.112),(-.01+.106*math.cos(t),.134*math.sin(t),1.072)],[.018,.028,.003],'hairChestnut','head',8)
# Flight helmet shell has an actual front face opening and continuous rear bowl.
verts=[];faces=[];N=32;J=10
for j in range(J):
    frac=.025+.975*j/(J-1)
    for i in range(N):
        t=i*math.tau/N
        theta=frac*(1.82-.50*math.cos(t))
        verts.append((-.018+.176*math.sin(theta)*math.cos(t),.192*math.sin(theta)*math.sin(t),1.172+.223*math.cos(theta)))
for j in range(J-1):
    for i in range(N):
        k=j*N+i;kk=j*N+(i+1)%N;faces.append((k,kk,kk+N,k+N))
faces.append(tuple(range(N-1,-1,-1)))
helmet=mesh('ivory helmet shell',verts,faces,'picketWhite','head',1)
mod=helmet.modifiers.new('shell wall','SOLIDIFY');mod.thickness=.012
bpy.context.view_layer.objects.active=helmet;bpy.ops.object.modifier_apply(modifier=mod.name)
rim=[verts[(J-1)*N+i] for i in range(N)]+[verts[(J-1)*N]]
tube('helmet black edge seal',rim,[.010]*(N+1),'uiDark','head',8)
# Central front-to-back fabric helmet spine follows the dome, with rear adjustment tabs.
spine=[]
for j in range(19):
    t=-2.30+j*(3.62/18)
    spine.append((-.018+.192*math.sin(t),0,1.172+.241*math.cos(t)))
tube('helmet center strap',spine,[(.019,.006)]*19,'asphalt','head',8)
box('helmet rear adjustment',(-.192,0,1.178),(.015,.043,.080),'asphalt','head',.006)
box('helmet rear tab',(-.188,0,1.080),(.016,.065,.021),'uiDark','head',.004)
buckle('helmet brow clasp',(.170,0,1.286),.033,.023,'head')
for s in [-1,1]:
    # Ear defenders: thick cushioned ring, pearl shell, circular cover, pivot bolt.
    ell('earcup gasket'+str(s),(-.006,s*.194,1.171),(.070,.035,.090),'uiDark','head')
    ell('earcup shell'+str(s),(-.008,s*.211,1.179),(.067,.030,.085),'picketWhite','head')
    ell('earcup cover'+str(s),(-.007,s*.237,1.177),(.057,.012,.072),'asphalt','head')
    ell('earcup fastener'+str(s),(.008,s*.250,1.182),(.012,.009,.012),'brass','head',12,8)
    box('earcup hinge'+str(s),(.065,s*.206,1.178),(.027,.025,.042),'uiDark','head',.007)
    for j in range(3):ell('shell screw'+str(s)+str(j),(.101-j*.063,s*(.104+j*.035),1.293-j*.039),(.005,.005,.005),'silver','head',8,6)
    tube('chin strap'+str(s),[(.022,s*.183,1.102),(.072,s*.122,1.054),(.134,s*.050,1.052)],[ (.007,.014)]*3,'asphalt','head',8)
    tube('headset coiled lead'+str(s),[(-.025,s*.234,1.106),(-.025,s*.24,1.04),(-.095,s*.185,.974)],[.0035]*3,'uiDark','head',8)
    for j in range(8):ell('wire coil'+str(s)+str(j),(-.026,s*.24,1.055+j*.006),(.006,.006,.003),'brass','head',8,6)
# Goggle silhouette: curved lens patch with lower nose notch and raised border.
outline=[(-.148,1.249),(-.114,1.267),(-.051,1.268),(0,1.262),(.051,1.268),(.114,1.267),(.148,1.249),(.149,1.205),(.124,1.155),(.078,1.143),(.047,1.148),(.019,1.185),(0,1.195),(-.019,1.185),(-.047,1.148),(-.078,1.143),(-.124,1.155),(-.149,1.205)]
outline=[(y*1.10,1.207+(z-1.207)*1.08) for y,z in outline]
def lens_x(y,z):return .193-.90*y*y+.008*math.sin((z-1.15)*20)
# Radial quad surface builds a softly bulging smoked lens, no flattened decal.
v=[(lens_x(y,z),y,z) for y,z in outline];center=(.210,0,1.224)
v.append(center);f=[(j,(j+1)%len(outline),len(outline)) for j in range(len(outline))]
goggle=mesh('smoked visor',v,f,'uiDark','head',1)
mod=goggle.modifiers.new('polycarbonate thickness','SOLIDIFY');mod.thickness=.009
bpy.context.view_layer.objects.active=goggle;bpy.ops.object.modifier_apply(modifier=mod.name)
border=[(lens_x(y,z)+.002,y,z) for y,z in outline];border.append(border[0])
tube('goggles outer rubber rim',border,[.012]*len(border),'asphalt','head',8)
inner=[(x+.004,y,z) for x,y,z in border]
tube('goggle silver pinstripe',inner,[.003]*len(inner),'silver','head',6)
# Boom mic reaches the mouth without occluding the nose or smile.
tube('microphone articulated boom',[(.055,-.220,1.110),(.127,-.161,1.071),(.178,-.080,1.052),(.185,-.024,1.054)],[.009,.008,.007,.006],'uiDark','head',10)
ell('microphone foam',(.188,-.023,1.056),(.017,.025,.017),'asphalt','head')
box('chin buckle',(.135,.049,1.051),(.021,.028,.020),'silver','head',.004)
# Small rescue backpack: inset compartments, seams, flap, wing insignia and zips.
box('rescue pack',(-.172,0,.836),(.091,.245,.269),'asphalt','torso',.031)
box('pack border',(-.225,0,.844),(.027,.224,.242),'navySeam','torso',.021)
box('pack upper flap',(-.245,0,.900),(.025,.202,.100),'asphalt','torso',.017)
box('pack lower pocket',(-.247,0,.783),(.036,.197,.084),'uiDark','torso',.015)
for s in [-1,1]:
    tube('pack piping'+str(s),[(-.262,s*.10,.775),(-.260,s*.104,.89),(-.25,s*.08,.95)],[.003]*3,'silver','torso',6)
    box('pack zip'+str(s),(-.269,s*.074,.813),(.009,.007,.043),'brass','torso',.002)
    box('pack side loop'+str(s),(-.197,s*.133,.819),(.035,.015,.075),'uiDark','torso',.005)
    # Mirrored raised gold wings on rear flap.
    tube('pilot wing'+str(s),[(-.263,0,.891),(-.265,s*.031,.881),(-.263,s*.068,.900)],[.004,.006,.003],'brass','torso',6)
    for j in range(3):tube('wing feather'+str(s)+str(j),[(-.268,s*(.021+j*.014),.884+j*.004),(-.268,s*(.031+j*.014),.897+j*.004)],[.003,.002],'brass','torso',6,0)
ell('pack center diamond',(-.269,0,.905),(.005,.011,.021),'silver','torso',8,6)
box('pack handle',(-.166,0,.980),(.029,.081,.013),'uiDark','torso',.005)
# Small flight badge on the right chest.
ell('flight badge',(.168,-.054,.930),(.009,.017,.017),'silver','torso',12,8)
ell('flight badge center',(.178,-.054,.930),(.005,.009,.009),'uiDark','torso',8,6)
# Applied geometry, joined only within each rigid joint. No cross-joint merge.
for o in objects:
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='FIXED',ngon_method='EAR_CLIP')
    tiny=[f for f in bm.faces if f.calc_area()<1e-10]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
    bm.to_mesh(o.data);bm.free()
buckets={}
for o in objects:buckets.setdefault(o.parent.name,[]).append(o)
objects=[]
for parent,group in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]
    bpy.ops.object.join()
    o=group[0];o.name=parent+'__geometry';o.data.name=o.name;objects.append(o)
    # Joining transforms into the active mesh's frame; clean float-rounding remnants.
    bm=bmesh.new();bm.from_mesh(o.data)
    tiny=[f for f in bm.faces if f.calc_area()<1e-10]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
    bm.to_mesh(o.data);bm.free();o.data.update()
bpy.context.view_layer.update()
floor=min((o.matrix_world@v.co).z for o in objects for v in o.data.vertices)
parts['hip'].location.z-=floor
bpy.context.view_layer.update()
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','weaponSocketR','weaponSocketL','backpackSocket']
bpy.context.view_layer.update()
bounds=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
triangles=sum(len(f.vertices)-2 for o in objects for f in o.data.polygons)
stats={'id':'npc.helicopter-pilot','triangles':triangles,'meshes':len(objects),'nodes_ok':all(n in parts for n in required),'missing_nodes':[n for n in required if n not in parts]}
(HERE/'build-stats.json').write_text(json.dumps(stats,indent=2))
(HERE/'rig-rest.json').write_text(json.dumps({'height':max(v.z for v in bounds),'feet_min_z':min(v.z for v in bounds),'pivots':{n:list(o.matrix_world.translation) for n,o in parts.items()},'hierarchy':{n:o.parent.name if o.parent else None for n,o in parts.items()}},indent=2))
if a.glb:
    # Shared deterministic vertex AO baker, without image textures.
    sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
    from sslib.ao import bake_all
    bake_all(objects,samples=32)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
def apply_pose():
    parts['armL'].rotation_euler.x=.60
    parts['armL'].rotation_euler.y=-.35
    parts['foreArmL'].rotation_euler.y=-1.05
    parts['legR'].rotation_euler.y=-.40
    parts['shinR'].rotation_euler.y=.28
    (HERE/'pose-test.json').write_text(json.dumps({'armL':[.60,-.35,0],'foreArmL':[0,-1.05,0],'legR':[0,-.40,0],'hierarchy_ok':parts['foreArmL'].parent==parts['armL'] and parts['handL'].parent==parts['foreArmL']},indent=2))
if a.pose: apply_pose()
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;scene.world=world
    world.node_tree.nodes['Background'].inputs[0].default_value=(.065,.057,.077,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);scene.collection.objects.link(o)
        o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size
        o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),420,(1,.83,.70),3)
    light('cool fill',(1,4,3),230,(.66,.74,1),3)
    light('golden rim',(-3,1,3.5),500,(1,.53,.28),2)
    bpy.ops.mesh.primitive_plane_add(size=200)
    floor=bpy.context.object;floor.name='studio floor'
    fm=bpy.data.materials.new('studio');fm.diffuse_color=(.055,.046,.065,1);fm.use_nodes=True
    fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=fm.diffuse_color
    floor.data.materials.append(fm)
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));scene.collection.objects.link(cam);scene.camera=cam
    views={'hero':(6,-4,2.9),'front':(6,0,.85),'side':(0,-6,.85),'back':(-6,0,.85)}
    cam.location=views.get(a.view,views['hero'])
    cam.rotation_euler=(Vector((0,0,.71))-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO';cam.data.ortho_scale=1.69*a.width/a.height
    scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG';scene.render.filepath=a.render
    # One delivery run shares the studio, saving rebuilds and render-slot churn.
    if a.view=='deliver':
        jobs=[(v,960,540,24,HERE/'renders'/('review-hero.png' if v=='hero' else v+'.png')) for v in ['front','side','back','hero']]
        jobs += [('hero',1600,900,96,Path(a.render)),('pose',960,540,24,HERE/'renders/pose-test.png')]
    elif a.view=='all':
        path=Path(a.render)
        jobs=[(v,a.width,a.height,a.samples,path.with_name(path.stem.replace('-hero','')+'-'+v+'.png')) for v in ['front','side','back','hero']]
    else:
        jobs=[(a.view,a.width,a.height,a.samples,Path(a.render))]
    for view,width,height,samples,path in jobs:
        if view=='pose':apply_pose()
        cam.location=views.get(view,views['hero'])
        cam.rotation_euler=(Vector((0,0,.71))-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.ortho_scale=1.69*width/height
        scene.cycles.samples=samples
        scene.render.resolution_x=width;scene.render.resolution_y=height
        scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
    if a.view=='deliver':
        # Composite the four orthographic review renders, without another render.
        import numpy as np
        panels=[]
        for name in ['front.png','side.png','back.png','review-hero.png']:
            im=bpy.data.images.load(str(HERE/'renders'/name))
            width,height=im.size
            pixels=np.empty(width*height*4,dtype=np.float32)
            im.pixels.foreach_get(pixels)
            panels.append(pixels.reshape(height,width,4)[:,width//2-180:width//2+180,:])
        pixels=np.concatenate(panels,axis=1)
        sheet=bpy.data.images.new('turnaround',width=pixels.shape[1],height=pixels.shape[0],alpha=True)
        sheet.pixels.foreach_set(pixels.ravel())
        sheet.filepath_raw=str(HERE/'renders/turnaround.png');sheet.file_format='PNG';sheet.save()
print('OK',json.dumps(stats))
