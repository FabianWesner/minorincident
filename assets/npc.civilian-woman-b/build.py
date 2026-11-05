"""Civilian woman B: deterministic, sculpted rigid-part hero. +X front, -Y right.
Run exclusively with experiment/tools/blender_run.py. All subdivision is applied.
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
parser.add_argument('--render'); parser.add_argument('--glb')
parser.add_argument('--view', default='hero')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--pose', action='store_true')
a = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
asset = bpy.data.collections.new('Civilian woman B'); scene.collection.children.link(asset)
COLORS = {
    'picketWhite':'f2e6dc', 'survivorRed':'d9363e', 'uiDark':'25222c',
    'skinWarm':'f2ad87', 'skinBlush':'e8947e', 'skinShadow':'c97a62',
    'hairChestnut':'4a2925', 'hairWarm':'63392d', 'hairHighlight':'82513b',
    'lavender':'a6a4d5', 'lavenderLight':'bebbe6', 'lavenderShadow':'8b89b3',
    'navy':'343449', 'navySeam':'454558', 'leather':'302c31',
    'leatherEdge':'514039', 'brass':'b58a51', 'eyeBrown':'683326', 'mouth':'ae5c57',
}
M = {}
for token, color in COLORS.items():
    c = [int(color[i:i+2],16)/255 for i in (0,2,4)]
    c = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
    m = bpy.data.materials.new('pal_'+token); m.use_nodes=True; m.diffuse_color=c
    bs = m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=c
    bs.inputs['Roughness'].default_value=.68
    if token.startswith('hair'): bs.inputs['Roughness'].default_value=.45
    if token in ['eyeBrown','uiDark','leather']: bs.inputs['Roughness'].default_value=.33
    if token=='brass': bs.inputs['Metallic'].default_value=.55; bs.inputs['Roughness'].default_value=.36
    M[token]=m
N={}
def joint(name, pos, parent=None):
    o=bpy.data.objects.new(name,None); asset.objects.link(o); o.location=pos; o.empty_display_size=.025
    bpy.context.view_layer.update()
    if parent:
        world=o.matrix_world.copy(); o.parent=N[parent]; o.matrix_world=world
    N[name]=o; bpy.context.view_layer.update(); return o
joint('root',(0,0,0)); joint('hip',(0,0,.69),'root'); joint('torso',(0,0,.745),'hip')
joint('head',(0,0,1.035),'torso'); joint('backpackSocket',(-.115,0,.94),'torso')
for side,s in [('L',1),('R',-1)]:
    joint('arm'+side,(0,s*.175,.978),'torso')
    joint('foreArm'+side,(.004,s*.236,.822),'arm'+side)
    joint('hand'+side,(.028,s*.283,.66),'foreArm'+side)
    joint('leg'+side,(0,s*.089,.665),'hip')
    joint('shin'+side,(.012,s*.108,.408),'leg'+side)
    joint('foot'+side,(0,s*.121,.123),'shin'+side)
    joint('weaponSocket'+side,(.072,s*.289,.62),'hand'+side)
N['root']['asset_id']='npc.civilian-woman-b'; N['root']['animation']='rigid-part'; N['root']['forward']='+X'
def finish(o,name,mat,parent,sub=0):
    o.name=name
    for c in list(o.users_collection): c.objects.unlink(o)
    asset.objects.link(o); o.data.materials.append(M[mat])
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    if sub:
        mod=o.modifiers.new('Applied sculpt smoothing','SUBSURF'); mod.levels=sub
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in o.data.polygons: p.use_smooth=True
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bpy.context.view_layer.update(); world=o.matrix_world.copy(); o.parent=N[parent]; o.matrix_world=world
    o.select_set(False); return o

def mesh(name,verts,faces,mat,parent,sub=0):
    data=bpy.data.meshes.new(name); data.from_pydata(verts,[],faces); data.update()
    o=bpy.data.objects.new(name,data); asset.objects.link(o); return finish(o,name,mat,parent,sub)

def ell(name,p,r,mat,parent,seg=12,rings=6,rot=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p)
    o=bpy.context.object; o.scale=r
    if rot: o.rotation_euler=rot
    return finish(o,name,mat,parent,1)

def box(name,p,size,mat,parent,bevel=.01,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p); o=bpy.context.object; o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot: o.rotation_euler=rot
    b=o.modifiers.new('Soft tailoring','BEVEL'); b.width=bevel; b.segments=3
    bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name)
    w=o.modifiers.new('Corner normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=w.name)
    return finish(o,name,mat,parent)

def loft(name,rings,mat,parent,seg=16,sub=1):
    vs=[]
    for x,y,z,rx,ry in rings:
        for j in range(seg):
            t=2*math.pi*j/seg; c=math.cos(t)
            if name=='face' and c>0: c=c**.5
            vs.append((x+rx*c,y+ry*math.sin(t),z))
    fs=[]
    for k in range(len(rings)-1):
        for j in range(seg):
            q=k*seg+j; q2=k*seg+(j+1)%seg; fs.append((q,q2,q2+seg,q+seg))
    fs += [tuple(reversed(range(seg))),tuple((len(rings)-1)*seg+j for j in range(seg))]
    return mesh(name,vs,fs,mat,parent,sub)

def tube(name,points,radius,mat,parent,res=2):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.resolution_u=2
    cu.bevel_depth=radius; cu.bevel_resolution=res
    sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(points)-1)
    for p,co in zip(sp.bezier_points,points): p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,cu); asset.objects.link(o)
    bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH')
    return finish(o,name,mat,parent)

def lock(name,points,widths,depths,mat='hairWarm',normal=(1,0,0)):
    vs=[]; seg=8; normal=Vector(normal)
    for k,point in enumerate(points):
        tangent=(Vector(points[min(k+1,len(points)-1)])-Vector(points[max(k-1,0)])).normalized()
        across=tangent.cross(normal).normalized(); out=across.cross(tangent).normalized()
        for j in range(seg):
            t=j*2*math.pi/seg; vs.append(Vector(point)+across*widths[k]*math.cos(t)+out*depths[k]*math.sin(t))
    fs=[]
    for k in range(len(points)-1):
        for j in range(seg): fs.append((k*seg+j,k*seg+(j+1)%seg,(k+1)*seg+(j+1)%seg,(k+1)*seg+j))
    fs += [tuple(reversed(range(seg))),tuple((len(points)-1)*seg+j for j in range(seg))]
    return mesh(name,vs,fs,mat,'head',1)

def patch(name,points,mat,parent,depth=.012):
    count=len(points); vs=points+[(x-depth,y,z) for x,y,z in points]
    fs=[tuple(range(count)),tuple(range(2*count-1,count-1,-1))]
    fs += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    o=mesh(name,vs,fs,mat,parent); b=o.modifiers.new('Rounded edge','BEVEL'); b.width=.004; b.segments=3
    bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name); return o

# Fitted blouse: contoured shoulders and separate collar, cuffs and folded seams.
loft('blouse',[(0,0,.717,.083,.123),(0,0,.728,.096,.142),(0,0,.768,.088,.135),
    (0,0,.851,.105,.152),(-.008,0,.929,.093,.172),(-.008,0,.985,.072,.145),
    (0,0,1.004,.04,.061)],'lavender','torso',24)
loft('neck',[(0,0,.983,.038,.043),(0,0,1.006,.041,.047),(0,0,1.077,.043,.05)],'skinWarm','head')
# Skin visible at the open V of the neckline, geometry follows the blouse surface.
patch('open neckline',[(.057,-.047,1.011),(.105,-.034,.968),(.114,0,.938),(.105,.034,.968),(.057,.047,1.011)],'skinWarm','torso')
for s in [-1,1]:
    patch('collar'+str(s),[(.045,s*.041,1.021),(.064,s*.092,.999),(.116,s*.103,.962),(.13,s*.058,.976),(.109,s*.024,.947)],'lavenderLight','torso',.015)
    tube('collar seam'+str(s),[(.067,s*.087,.995),(.117,s*.098,.967),(.129,s*.058,.981)],.0025,'lavenderShadow','torso',1)
    tube('waist fold'+str(s),[(.079,s*.067,.738),(.095,s*.1,.752),(.074,s*.13,.776)],.004,'lavenderLight','torso',1)
    tube('back dart'+str(s),[(-.086,s*.08,.739),(-.104,s*.09,.84),(-.089,s*.102,.947)],.0023,'lavenderShadow','torso',1)
box('button placket',(.105,0,.826),(.012,.024,.217),'lavenderLight','torso',.006)
for z,x in [(.918,.119),(.861,.115),(.803,.109),(.749,.102)]:
    ell('blouse button', (x+.006,0,z),(.005,.006,.006),'picketWhite','torso',8,6)
# Small breast pocket and fictional employee pin.
patch('chest pocket',[(.098,.078,.902),(.083,.123,.902),(.089,.121,.857),(.109,.076,.859)],'lavender','torso')
tube('pocket top seam',[(.102,.078,.901),(.087,.122,.901)],.003,'lavenderLight','torso',1)
box('chest pin',(.118,.084,.919),(.013,.038,.015),'picketWhite','torso',.003)
box('chest pin amber',(.127,.094,.919),(.006,.017,.008),'brass','torso',.002)
tube('blouse shoulder yoke',[(-.081,-.11,.97),(-.105,0,.96),(-.081,.11,.97)],.0024,'lavenderLight','torso',1)
# Slacks, belt, belt loops and pockets.
loft('slacks seat',[(0,0,.601,.09,.134),(0,0,.63,.1,.155),(0,0,.7,.086,.147),(0,0,.724,.084,.136)],'navy','hip',24)
loft('belt',[(0,0,.706,.091,.145),(0,0,.709,.094,.148),(0,0,.73,.094,.148),(0,0,.734,.09,.144)],'leather','hip',24)
box('belt buckle',(.1,0,.72),(.015,.038,.025),'brass','hip',.004)
box('buckle inset',(.11,0,.72),(.005,.026,.014),'leather','hip',.002)
for s in [-1,1]:
    box('belt loop',(.079,s*.108,.717),(.017,.018,.043),'navy','hip',.005)
    tube('rear pocket seam'+str(s),[(-.085,s*.053,.675),(-.059,s*.127,.675),(-.082,s*.124,.622),(-.104,s*.089,.608),(-.107,s*.054,.62),(-.085,s*.053,.675)],.002,'navySeam','hip',1)
    tube('front pocket'+str(s),[(.079,s*.126,.696),(.096,s*.127,.666),(.099,s*.085,.619)],.0024,'navySeam','hip',1)
tube('fly',[(.106,0,.697),(.109,.013,.662),(.111,.012,.606)],.0025,'navySeam','hip',1)
for side,s in [('L',1),('R',-1)]:
    # Gentle A pose gives clearance for each sleeve and the shoulder bag.
    loft('sleeve'+side,[(0,s*.168,.976,.066,.065),(0,s*.182,.956,.071,.069),
        (0,s*.209,.898,.064,.064),(.004,s*.238,.834,.059,.062),(.004,s*.243,.821,.055,.059)],'lavender','arm'+side,16)
    ell('elbow fold'+side,(.008,s*.23,.845),(.062,.064,.028),'lavenderLight','arm'+side,rot=(s*.17,0,0))
    loft('rolled cuff'+side,[(.006,s*.235,.842,.06,.063),(.009,s*.243,.828,.067,.071),
        (.011,s*.251,.802,.067,.07),(.011,s*.253,.794,.059,.062)],'lavenderLight','foreArm'+side,16)
    tube('cuff fold'+side,[(.06,s*.219,.812),(.075,s*.245,.812),(.054,s*.285,.814)],.003,'lavenderShadow','foreArm'+side,1)
    loft('forearm'+side,[(.011,s*.251,.807,.042,.045),(.02,s*.263,.769,.043,.046),
        (.028,s*.279,.695,.032,.036),(.028,s*.283,.657,.032,.033)],'skinWarm','foreArm'+side,12)
    ell('palm'+side,(.034,s*.288,.627),(.036,.043,.052),'skinWarm','hand'+side)
    for j in range(4):
        y=s*(.263+j*.018); z=.608+(.006 if j in [0,3] else 0)
        tube('finger'+side+str(j),[(.045,y,z),(.052,y,z-.033),(.071,y,z-.043),(.082,y,z-.031)],.012 if j<3 else .010,'skinWarm','hand'+side,1)
    tube('thumb'+side,[(.047,s*.25,.651),(.079,s*.245,.636),(.087,s*.252,.612)],.016,'skinWarm','hand'+side,1)
    # Side seams, tapered legs and ankle turnups follow the original civilian.
    loft('trouser thigh'+side,[(0,s*.089,.674,.078,.074),(0,s*.092,.646,.083,.078),
        (.007,s*.103,.545,.072,.071),(.012,s*.108,.433,.064,.062),(.012,s*.108,.392,.063,.061),(.012,s*.108,.378,.062,.061)],'navy','leg'+side,16)
    loft('trouser calf'+side,[(.012,s*.108,.443,.062,.061),(.012,s*.108,.431,.064,.062),(.01,s*.112,.366,.064,.062),
        (.002,s*.122,.211,.06,.058),(0,s*.122,.152,.064,.061),(0,s*.122,.139,.062,.06)],'navy','shin'+side,16)
    loft('trouser cuff'+side,[(0,s*.122,.141,.064,.062),(0,s*.122,.148,.069,.066),
        (0,s*.122,.178,.069,.066),(0,s*.122,.184,.064,.062)],'navySeam','shin'+side,16)
    tube('pressed crease thigh'+side,[(.074,s*.096,.607),(.08,s*.102,.542),(.072,s*.108,.442)],.0018,'navySeam','leg'+side,1)
    tube('outside seam'+side,[(.013,s*.17,.395),(.006,s*.183,.26),(0,s*.184,.18)],.0018,'navySeam','shin'+side,1)
    loft('ankle'+side,[(0,s*.122,.091,.036,.039),(0,s*.122,.12,.038,.04),(0,s*.122,.159,.038,.04)],'skinWarm','foot'+side,12)
    # Loafers: broad toe, recessed heel arch, sole, vamp and stitching.
    loft('front sole'+side,[(.032,s*.124,.001,.1,.061),(.032,s*.124,.009,.129,.074),(.032,s*.124,.032,.129,.074),(.032,s*.124,.042,.116,.069)],'leatherEdge','foot'+side,24)
    box('heel'+side,(-.055,s*.124,.021),(.084,.135,.042),'leather','foot'+side,.01)
    ell('shoe upper'+side,(.034,s*.124,.066),(.12,.073,.051),'leather','foot'+side)
    ell('loafer vamp'+side,(.077,s*.124,.094),(.064,.059,.018),'leather','foot'+side)
    tube('vamp piping'+side,[(.042,s*.071,.084),(.104,s*.076,.083),(.141,s*.123,.08),(.105,s*.173,.083),(.042,s*.178,.084)],.003,'leatherEdge','foot'+side,1)
    box('loafer strap'+side,(.048,s*.124,.106),(.025,.108,.009),'leatherEdge','foot'+side,.004)
# Right watch, left simple bracelet.
loft('watch band',[(.026,-.28,.694,.034,.037),(.026,-.28,.713,.037,.04),(.026,-.28,.718,.034,.037)],'leather','foreArmR',16)
ell('watch case',(.061,-.283,.704),(.009,.028,.029),'brass','foreArmR')
ell('watch dial',(.07,-.283,.704),(.006,.024,.025),'uiDark','foreArmR')
tube('watch hand',[(.078,-.283,.721),(.078,-.283,.704),(.078,-.269,.703)],.0018,'picketWhite','foreArmR',1)
loft('bracelet',[(.027,.282,.686,.035,.037),(.027,.282,.694,.036,.038),(.027,.282,.701,.034,.037)],'brass','foreArmL',16)
# Red flat lanyard with clasp and separate rounded white ID insert.
for s in [-1,1]:
    patch('lanyard'+str(s),[(.12,s*.079,.982),(.134,s*.093,.969),(.132,s*.018,.826),(.126,s*.003,.824)],'survivorRed','torso',.006)
box('lanyard clip',(.143,0,.816),(.023,.018,.037),'uiDark','torso',.005)
ell('clip ring',(.15,0,.795),(.009,.01,.012),'brass','torso',8,6)
box('ID holder',(.147,0,.754),(.027,.078,.095),'leather','torso',.008)
box('ID card',(.164,0,.753),(.006,.062,.078),'picketWhite','torso',.003)
ell('ID portrait',(.17,0,.771),(.004,.009,.01),'survivorRed','torso',8,6)
for s in [-1,1]:
    tube('ID pictogram'+str(s),[(.171,0,.758),(.171,s*.011,.752),(.171,s*.01,.734)],.004,'survivorRed','torso',1)
box('ID footer',(.171,0,.721),(.004,.04,.004),'skinBlush','torso',.001)
# Bag is owned by torso and hip clearance is maintained in the rest pose.
box('shoulder bag',(-.066,.228,.61),(.136,.127,.24),'leather','torso',.031,rot=(0,.08,0))
box('bag front flap',(-.001,.24,.66),(.023,.122,.126),'leatherEdge','torso',.016,rot=(0,.08,0))
box('bag flap facing',(.013,.24,.666),(.008,.109,.108),'leather','torso',.013,rot=(0,.08,0))
tube('bag piping',[(.001,.295,.717),(.014,.303,.61),(.009,.291,.513),(.017,.187,.515),(.024,.178,.61)],.003,'leatherEdge','torso',1)
box('bag clasp',(.027,.24,.627),(.012,.021,.028),'brass','torso',.004)
# Broad leather ribbon loops over left shoulder: edges do not occupy cloth planes.
vs=[]; path=[(.008,.255,.719),(.1,.183,.798),(.095,.153,.916),(.017,.155,1.011),(-.073,.162,.96),(-.119,.181,.833),(-.127,.246,.721)]
for x,y,z in path: vs += [(x,y-.019,z),(x,y+.019,z)]
fs=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(path)-1)]
o=mesh('bag shoulder strap',vs,fs,'leather','torso',2)
mod=o.modifiers.new('Strap thickness','SOLIDIFY'); mod.thickness=.007; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
tube('strap edge',[(x+.004,y-.017,z+.003) for x,y,z in path],.002,'leatherEdge','torso',1)
for z,x,y in [(.843,.109,.183),(.743,.045,.24)]:
    box('strap buckle',(x,y,z),(.018,.043,.029),'brass','torso',.005)
    box('buckle leather center',(x+.011,y,z),(.006,.027,.015),'leather','torso',.002)
# Single smooth sculpted face with rounded chin and broad forehead.
loft('face',[(.019,0,1.046,.047,.057),(.027,0,1.061,.079,.097),(.022,0,1.101,.119,.154),
    (.013,0,1.166,.135,.177),(.004,0,1.229,.139,.177),(0,0,1.283,.121,.146),
    (-.013,0,1.318,.087,.105),(-.013,0,1.331,.033,.046)],'skinWarm','head',32,1)
for s in [-1,1]:
    ell('ear'+str(s),(.004,s*.163,1.153),(.039,.03,.052),'skinWarm','head')
    ell('inner ear'+str(s),(.031,s*.174,1.153),(.012,.013,.031),'skinBlush','head')
    ell('cheek blush'+str(s),(.145,s*.116,1.118),(.004,.022,.012),'skinBlush','head')
    ell('eye white'+str(s),(.148,s*.074,1.199),(.022,.044,.051),'picketWhite','head',16,10)
    ell('iris'+str(s),(.17,s*.073,1.198),(.009,.024,.032),'eyeBrown','head',12,8)
    ell('pupil'+str(s),(.179,s*.073,1.198),(.005,.013,.022),'uiDark','head',12,8)
    ell('eye shine'+str(s),(.184,s*.079,1.212),(.003,.007,.008),'picketWhite','head',8,6)
    tube('upper eyelid'+str(s),[(.153,s*.031,1.203),(.166,s*.067,1.242),(.137,s*.112,1.221)],.0045,'hairChestnut','head',1)
    tube('eyebrow'+str(s),[(.144,s*.028,1.266),(.15,s*.067,1.276),(.114,s*.121,1.26)],.008,'hairChestnut','head',2)
    # Open lenses keep the pupils readable without alpha sorting or textures.
    pts=[]
    for j in range(23):
        t=2*math.pi*j/22; y=s*.074+.06*math.cos(t)
        pts.append((.19-.13*max(0,abs(y)-.07),y,1.199+.059*math.sin(t)))
    tube('round glasses'+str(s),pts,.0055,'leather','head',2)
    tube('glasses temple'+str(s),[(.183,s*.133,1.218),(.082,s*.168,1.221),(.008,s*.176,1.198)],.005,'leather','head',1)
    ell('hinge'+str(s),(.184,s*.134,1.216),(.006,.007,.008),'brass','head',8,6)
tube('glasses bridge',[(.194,-.017,1.206),(.203,0,1.214),(.194,.017,1.206)],.005,'leather','head',2)
ell('nose bridge',(.16,0,1.176),(.022,.02,.039),'skinWarm','head')
ell('nose tip',(.187,0,1.154),(.027,.027,.019),'skinWarm','head')
for s in [-1,1]: ell('nostril'+str(s),(.19,s*.018,1.144),(.004,.005,.003),'skinShadow','head',8,6)
tube('smile',[(.13,-.048,1.104),(.15,-.025,1.093),(.156,0,1.09),(.15,.025,1.093),(.13,.048,1.104)],.0033,'mouth','head',2)
tube('lower lip',[(.149,-.026,1.084),(.154,0,1.082),(.149,.026,1.084)],.003,'skinBlush','head',1)
# Sculpted hair masses. Base stays behind the face; swept leaf locks create the fringe.
ell('hair back',(-.069,0,1.211),(.12,.174,.158),'hairChestnut','head',20,12)
# Contoured scalp cap exposes the forehead and avoids a horizontal helmet edge.
vs=[]; fs=[]; seg=32
for k in range(9):
    for j in range(seg):
        t=j*2*math.pi/seg
        theta=(.99+1.55*(1-math.cos(t))/2)*(.035+.965*k/8)
        vs.append((-.027+.153*math.sin(theta)*math.cos(t),.18*math.sin(theta)*math.sin(t),1.219+.151*math.cos(theta)))
for k in range(8):
    for j in range(seg): fs.append((k*seg+j,(k+1)*seg+j,(k+1)*seg+(j+1)%seg,k*seg+(j+1)%seg))
o=mesh('scalp cap',vs,fs,'hairChestnut','head',1)
mod=o.modifiers.new('Hair shell thickness','SOLIDIFY'); mod.thickness=.012; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
for s in [-1,1]:
    for j in range(4):
        lock('side swept lock'+str(s)+str(j),[(-.035,s*.044,1.365-j*.012),(-.055,s*.123,1.33-j*.024),
            (-.064,s*.179,1.265-j*.025),(-.083,s*.16,1.194-j*.018),(-.097,s*.09,1.174-j*.016)],
            [.016,.049,.053,.038,.003],[.012,.027,.031,.022,.003],normal=(0,s,0),mat='hairWarm' if j%2==0 else 'hairChestnut')
    tube('temple curl'+str(s),[(.032,s*.151,1.258),(.061,s*.161,1.204),(.036,s*.166,1.154),(.057,s*.174,1.111),(.031,s*.174,1.074),(.035,s*.153,1.059)],.010,'hairWarm','head',2)
    tube('temple strand'+str(s),[(.047,s*.154,1.251),(.07,s*.161,1.206),(.048,s*.172,1.165)],.002,'hairHighlight','head',1)
# Swooping fringe: broad asymmetric overlapping flattened shapes, not thin strands.
for j in range(3):
    off=j*.023
    points=[(.023,.074-off*.22,1.353-off*.12),(.101,.027-off*.5,1.336-off*.24),
            (.149,-.055-off*.8,1.299-off*.27),(.134,-.134-off*.2,1.239-off*.27),(.07,-.179,1.218-off*.16)]
    lock('swept fringe'+str(j),points,[.015,.061,.063,.042,.003],[.01,.028,.031,.026,.003],mat='hairWarm' if j==0 else 'hairChestnut')
    tube('fringe groove'+str(j),[(x+.03,y,z+.003) for x,y,z in points[1:-1]],.0015,'hairHighlight','head',1)
for j in range(3):
    lock('right part'+str(j),[(.004,.051,1.366),(.081,.115+j*.008,1.328-j*.011),(.102,.161,1.282-j*.02),(.052,.171,1.235-j*.022)],
         [.01,.041,.034,.002],[.006,.024,.025,.003],mat='hairWarm')
# Gathered bun with purposeful rounded lobes and restrained strand ridges.
ell('bun core',(-.103,.023,1.351),(.072,.089,.084),'hairChestnut','head',16,10)
for j in range(8):
    t=j*2*math.pi/8
    lock('bun fold'+str(j),[(-.084,.021,1.403),(-.139,.024+.08*math.cos(t),1.36+.081*math.sin(t)),
        (-.187,.025+.073*math.cos(t+.55),1.344+.073*math.sin(t+.55)),(-.15,.023,1.299)],
        [.014,.039,.04,.009],[.009,.025,.026,.006],normal=(-1,0,0),mat='hairWarm' if j%2==0 else 'hairChestnut')
tube('bun loose loop',[(-.076,-.042,1.372),(-.104,-.055,1.437),(-.161,-.005,1.431),(-.159,.04,1.39)],.0045,'hairWarm','head',2)
# Layered nape volumes follow the gathered direction, covering the back shell.
for j in range(7):
    y=(j-3)*.043
    pts=[(-.125,y*.87,1.124+abs(j-3)*.008),(-.181,y,1.175),
         (-.205,y*.86,1.237),(-.177,y*.56,1.298),(-.13,.022+y*.18,1.33)]
    lock('gathered nape'+str(j),pts,[.003,.031,.037,.031,.004],[.003,.016,.018,.017,.003],normal=(-1,0,0),mat='hairWarm' if j%3==1 else 'hairChestnut')
    if j%2==0:
        tube('nape ridge'+str(j),[(x-.019,yy,z) for x,yy,z in pts[1:-1]],.0015,'hairHighlight','head',1)

# Normalize the reference silhouette to exactly 1.4 m, retaining true joint pivots.
bpy.context.view_layer.update()
meshes=[o for o in asset.objects if o.type=='MESH']
max_z=max((o.matrix_world@v.co).z for o in meshes for v in o.data.vertices)
scale=1.4/max_z
# Bake world-space geometry, then rebuild parent-local transforms with unit scale.
positions={name:o.matrix_world.translation.copy()*scale for name,o in N.items()}
parents={name:o.parent.name if o.parent else None for name,o in N.items()}
mesh_parents={o.name:o.parent.name for o in meshes}
for o in meshes:
    world=o.matrix_world.copy()
    for v in o.data.vertices: v.co=(world@v.co)*scale
    o.parent=None; o.location=(0,0,0); o.rotation_euler=(0,0,0); o.scale=(1,1,1)
for name,o in N.items():
    o.parent=None; o.location=positions[name]
for name,o in N.items():
    if parents[name]: o.parent=N[parents[name]]; o.location=positions[name]-positions[parents[name]]
bpy.context.view_layer.update()
for o in meshes:
    parent=N[mesh_parents[o.name]]; o.parent=parent
    for v in o.data.vertices: v.co-=positions[parent.name]
    o.location=(0,0,0); o.rotation_euler=(0,0,0); o.scale=(1,1,1)
# Merge by joint and material to limit draw calls without crossing animation pivots.
groups={}
for o in meshes: groups.setdefault((o.parent.name,o.data.materials[0].name),[]).append(o)
for (parent,material),items in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in items: o.select_set(True)
    bpy.context.view_layer.objects.active=items[0]
    if len(items)>1: bpy.ops.object.join()
    bpy.context.object.name=parent+'.'+material
for o in asset.objects:
    if o.type!='MESH': continue
    bm=bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='FIXED',ngon_method='EAR_CLIP')
    bad=[f for f in bm.faces if f.calc_area()<1e-12]
    if bad: bmesh.ops.delete(bm,geom=bad,context='FACES_ONLY')
    bm.to_mesh(o.data); bm.free(); o.data.update()
meshes=[o for o in asset.objects if o.type=='MESH']
triangles=sum(len(o.data.polygons) for o in meshes)
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','weaponSocketR','weaponSocketL','backpackSocket']
missing=[n for n in required if n not in N]
(HERE/'build-stats.json').write_text(json.dumps({'triangles':triangles,'meshes':len(meshes),'missing_nodes':missing},indent=2)+'\n')
(HERE/'rig-rest.json').write_text(json.dumps({'height':1.4,'pivots':{n:list(o.matrix_world.translation) for n,o in N.items()},'parents':parents},indent=2)+'\n')
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
def apply_pose():
    N['armL'].rotation_euler.x=math.radians(55)
    N['armL'].rotation_euler.y=math.radians(-25)
    N['foreArmL'].rotation_euler.y=math.radians(-75)
    N['legR'].rotation_euler.y=math.radians(-28)
    N['shinR'].rotation_euler.y=math.radians(32)
    bpy.context.view_layer.update()
if a.pose: apply_pose()
def write_turnaround(path):
    import numpy as np
    panels=[]
    for name in ['front','side','back','review-hero']:
        im=bpy.data.images.load(str(HERE/'renders'/f'{name}.png')); w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32); im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-400)//2:(w+400)//2,:])
    data=np.concatenate(panels,axis=1)
    im=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
    im.pixels.foreach_set(data.ravel()); im.filepath_raw=str(Path(path).resolve()); im.file_format='PNG'; im.save()
if a.render and a.view=='turnaround':
    write_turnaround(a.render); print('OK turnaround'); sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('Warm studio'); world.use_nodes=True; scene.world=world
    world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.14,.19,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.4
    def area(name,loc,power,size,color):
        d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.shape='DISK'; d.size=size; d.color=color
        o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=loc
        o.rotation_euler=(Vector((0,0,.75))-o.location).to_track_quat('-Z','Y').to_euler()
    area('soft key',(3,-4,5),430,4,(1,.83,.71))
    area('cool fill',(2,4,3),280,3,(.73,.81,1))
    area('golden rim',(-3,1,3.5),530,3,(1,.56,.3))
    bpy.ops.mesh.primitive_plane_add(size=200); ground=bpy.context.object; ground.name='Studio floor'; ground.location.z=-.003
    gm=bpy.data.materials.new('Studio slate'); gm.use_nodes=True
    bs=gm.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=(.035,.03,.046,1); bs.inputs['Roughness'].default_value=.88
    ground.data.materials.append(gm)
    cam=bpy.data.objects.new('Review camera',bpy.data.cameras.new('Review camera')); scene.collection.objects.link(cam); scene.camera=cam
    target=Vector((-.02,0,.70)); directions={'hero':(6,-4,2.35),'front':(6,0,.25),'side':(0,6,.25),'back':(-6,0,.25)}
    cam.location=target+Vector(directions.get(a.view,directions['hero']))
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=1.67*a.width/a.height
    scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='METAL'; prefs.get_devices()
        for d in prefs.devices: d.use=True
        scene.cycles.device='GPU'
    except Exception: pass
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(Path(a.render).resolve())
    Path(scene.render.filepath).parent.mkdir(parents=True,exist_ok=True)
    def save_view(view,path,width,height,samples):
        cam.location=target+Vector(directions[view])
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.ortho_scale=1.67*width/height
        scene.render.resolution_x=width; scene.render.resolution_y=height
        scene.cycles.samples=samples; scene.render.filepath=str(Path(path).resolve())
        bpy.ops.render.render(write_still=True)
    if a.view in ['review','delivery']:
        for view,filename in [('front','front.png'),('side','side.png'),('back','back.png'),('hero','review-hero.png')]:
            save_view(view,HERE/'renders'/filename,960,540,24)
        if a.view=='delivery':
            save_view('hero',a.render,a.width,a.height,a.samples)
            apply_pose()
            save_view('hero',HERE/'renders'/'pose-test.png',960,540,24)
            write_turnaround(HERE/'renders'/'turnaround.png')
    else:
        bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(meshes),'meshes')
