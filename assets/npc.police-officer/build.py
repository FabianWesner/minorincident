"""Minor Incident police officer — deterministic sculpted rigid-part hero.
Run only through experiment/tools/blender_run.py. +X forward, -Y right, Z up.
Subdivision is applied, and static surfaces merge by material inside each joint.
"""
import bpy
import bmesh
import math
import sys
import json
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(key, default=None):
    return ARGS[ARGS.index(key) + 1] if key in ARGS else default

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
asset = bpy.data.collections.new('PoliceOfficer')
scene.collection.children.link(asset)
M = {}
# Use the repository palette directly. Clothing and relief are texture-free.
COLORS = {k:v.lstrip('#') for k,v in json.loads((HERE.parents[1]/'src/assets/palette.json').read_text()).items()}

def srgb(h):
    rgb = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
for token, color in COLORS.items():
    m = bpy.data.materials.new('pal_'+token)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = srgb(color)
    bs.inputs['Roughness'].default_value = .62 if token.startswith('hair') else .67
    if token == 'eyeBrown':
        bs.inputs['Roughness'].default_value = .3
    if token == 'silver':
        bs.inputs['Metallic'].default_value = .35
        bs.inputs['Roughness'].default_value = .38
    m.diffuse_color = srgb(color)
    M[token] = m

N = {}
def joint(name, p, parent=None):
    o = bpy.data.objects.new(name, None)
    asset.objects.link(o)
    o.empty_display_size = .025
    o.location = p
    bpy.context.view_layer.update()
    if parent:
        world = o.matrix_world.copy()
        o.parent = N[parent]
        o.matrix_world = world
    N[name] = o
    bpy.context.view_layer.update()
    return o
joint('root', (0,0,0))
joint('hip', (0,0,.640),'root')
joint('torso',(0,0,.680),'hip')
joint('head',(0,0,1.055),'torso')
for side,s in [('L',1),('R',-1)]:
    joint('arm'+side,(0,s*.185,1.005),'torso')
    joint('foreArm'+side,(.012,s*.241,.838),'arm'+side)
    joint('hand'+side,(.025,s*.282,.684),'foreArm'+side)
    joint('leg'+side,(0,s*.098,.620),'hip')
    joint('shin'+side,(.008,s*.118,.360),'leg'+side)
    joint('foot'+side,(-.006,s*.138,.142),'shin'+side)
    joint('weaponSocket'+side,(.061,s*.28,.620),'hand'+side)
joint('backpackSocket',(-.111,0,.924),'torso')
N['root']['asset_id']='npc.police-officer'
N['root']['forward']='+X'
N['root']['animation']='rigid-part'

# All helper geometry is authored in rest-world coordinates, then parented
# without changing its placement. Joint origins remain exactly at the anatomy.
def finish(o, mat, parent, sub=0):
    if o.name not in asset.objects:
        for c in list(o.users_collection): c.objects.unlink(o)
        asset.objects.link(o)
    o.data.materials.append(M[mat])
    for f in o.data.polygons: f.use_smooth=True
    bpy.context.view_layer.objects.active=o
    o.select_set(True)
    if sub:
        mod=o.modifiers.new('Applied sculpt smoothing','SUBSURF')
        mod.levels=sub
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update()
    world=o.matrix_world.copy()
    o.parent=N[parent]
    o.matrix_world=world
    o.select_set(False)
    return o

def mesh(name, verts, faces, mat, parent, sub=0):
    data=bpy.data.meshes.new(name)
    data.from_pydata(verts,[],faces)
    data.update()
    o=bpy.data.objects.new(name,data)
    asset.objects.link(o)
    return finish(o,mat,parent,sub)

def ell(name, c, r, mat, parent, seg=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=c)
    o=bpy.context.object
    o.name=name
    o.scale=r
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,mat,parent)

def box(name,c,size,mat,parent,bevel=.01,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=c)
    o=bpy.context.object
    o.name=name
    o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot: o.rotation_euler=rot
    b=o.modifiers.new('Soft tailoring','BEVEL')
    b.width=bevel
    b.segments=3
    bpy.ops.object.modifier_apply(modifier=b.name)
    w=o.modifiers.new('Corner normals','WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=w.name)
    return finish(o,mat,parent)

def loft(name, rings, mat, parent, seg=16, sub=1):
    # rings: (x,y,z, x-radius,y-radius). Closed, smoothly sculpted volumes.
    vs=[]
    for x,y,z,rx,ry in rings:
        for j in range(seg):
            a=2*math.pi*j/seg
            cx=math.cos(a)
            if name == 'face sculpt' and cx > 0: cx=cx**.45
            vs.append((x+rx*cx,y+ry*math.sin(a),z))
    fs=[]
    for k in range(len(rings)-1):
        for j in range(seg):
            a=k*seg+j; b=k*seg+(j+1)%seg
            fs.append((a,b,b+seg,a+seg))
    fs.extend([tuple(reversed(range(seg))),tuple((len(rings)-1)*seg+j for j in range(seg))])
    return mesh(name,vs,fs,mat,parent,sub)

def tube(name, points, radius, mat, parent, res=3):
    cu=bpy.data.curves.new(name,'CURVE')
    cu.dimensions='3D'; cu.resolution_u=3; cu.render_resolution_u=3
    cu.use_fill_caps=True; cu.bevel_depth=radius; cu.bevel_resolution=min(res,2)
    sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(points)-1)
    for p,co in zip(sp.bezier_points,points):
        p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,cu); asset.objects.link(o)
    bpy.context.view_layer.objects.active=o
    o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    return finish(o,mat,parent)

def lock(name, points, widths, depths, mat='hairWarm', normal=(1,0,0), parent='head'):
    # Flattened curved leaf/strand; rounded elliptical cross section and a tip.
    vs=[]; seg=10; normal=Vector(normal)
    for k,point in enumerate(points):
        p=Vector(point)
        tangent=Vector(points[min(k+1,len(points)-1)])-Vector(points[max(0,k-1)])
        tangent.normalize()
        across=tangent.cross(normal).normalized()
        out=across.cross(tangent).normalized()
        for j in range(seg):
            a=2*math.pi*j/seg
            v=p+across*(widths[k]*math.cos(a))+out*(depths[k]*math.sin(a))
            vs.append(v)
    fs=[]
    for k in range(len(points)-1):
        for j in range(seg):
            fs.append((k*seg+j,k*seg+(j+1)%seg,(k+1)*seg+(j+1)%seg,(k+1)*seg+j))
    fs.extend([tuple(reversed(range(seg))),tuple((len(points)-1)*seg+j for j in range(seg))])
    return mesh(name,vs,fs,mat,parent,1)


# Smooth navy shirt, shoulder tailoring, folded collar and ballistic vest shells.
loft('uniform shirt',[(0,0,.646,.087,.132),(0,0,.665,.093,.146),(0,0,.80,.104,.156),(-.007,0,.94,.096,.179),(0,0,1.009,.060,.153),(0,0,1.027,.038,.056)],'capNavy','torso',24)
loft('neck',[(0,0,1.008,.042,.047),(0,0,1.065,.046,.05),(0,0,1.09,.044,.048)],'skinWarm','head')
loft('collar stand',[(0,0,1.003,.048,.063),(0,0,1.029,.047,.066),(0,0,1.037,.040,.059)],'capNavy','torso',24)
for s in [-1,1]:
    box('folded collar',(.062,s*.049,1.006),(.035,.056,.071),'denimBlue','torso',.009,rot=(s*.4,-.35,0))
    ell('collar brass pin',(.086,s*.057,1.013),(.004,.007,.009),'brass','torso',12,8)
    box('shoulder strap',(.065,s*.133,.962),(.041,.043,.140),'uiDark','torso',.009,rot=(s*.15,-.3,0))
    box('strap trim',(.089,s*.133,.949),(.009,.033,.088),'navySeam','torso',.004)
    box('strap buckle',(.090,s*.134,.921),(.011,.046,.020),'brass','torso',.004)
box('vest front',(.110,0,.819),(.064,.291,.248),'uiDark','torso',.035)
box('vest back',(-.107,0,.819),(.060,.286,.270),'uiDark','torso',.031)
for s in [-1,1]:
    box('vest side',(-.005,s*.152,.782),(.175,.039,.188),'uiDark','torso',.015)
    for z in [.716,.756,.797]: box('side webbing',(.012,s*.176,z),(.157,.008,.015),'navySeam','torso',.003)
for z in [.715,.751,.787,.823]:
    box('front vest webbing',(.148,0,z),(.008,.256,.019),'navySeam','torso',.004)
    box('rear vest webbing',(-.142,0,z),(.008,.253,.020),'navySeam','torso',.004)
box('rear plate flap',(-.145,0,.908),(.014,.252,.075),'navy','torso',.010)
for s in [-1,1]:
    for z in [.882,.935]: ell('rear rivet',(-.156,s*.109,z),(.003,.004,.004),'brass','torso',8,6)
box('police plaque border',(.156,0,.883),(.025,.260,.094),'navySeam','torso',.012)
box('police plaque',(.171,0,.885),(.010,.244,.075),'uiDark','torso',.006)
# Raised lettering: local text X runs toward +Y, local Y toward +Z, normal +X.
from mathutils import Matrix
cu=bpy.data.curves.new('POLICE relief','FONT');cu.body='POLICE';cu.align_x='CENTER';cu.align_y='CENTER';cu.size=.088;cu.extrude=.0007;cu.bevel_depth=.0003
font=Path('/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf')
if font.exists(): cu.font=bpy.data.fonts.load(str(font))
o=bpy.data.objects.new('POLICE relief',cu);asset.objects.link(o);o.location=(.180,0,.885)
o.rotation_euler=Matrix(((0,0,1),(1,0,0),(0,1,0))).to_euler()
bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);finish(o,'picketWhite','torso')
for s in [-1,1]:
    box('vest magazine pouch',(.175,s*.084,.745),(.048,.068,.109),'navy','torso',.009)
    box('pouch flap',(.203,s*.084,.788),(.015,.078,.034),'navySeam','torso',.006)
    ell('pouch snap',(.214,s*.084,.783),(.003,.005,.005),'brass','torso',8,6)
    tube('pouch seam',[(.202,s*.11,.77),(.204,s*.11,.70),(.204,s*.06,.70),(.202,s*.06,.77)],.0015,'uiDark','torso',1)
# Shoulder radio and coiled cable.
box('radio housing',(.111,-.139,.990),(.057,.069,.088),'uiDark','torso',.011,rot=(0,-.17,-.12))
box('radio face',(.143,-.138,.991),(.008,.054,.063),'navySeam','torso',.004)
box('radio display',(.150,-.138,1.006),(.006,.031,.015),'denimLight','torso',.003)
for z in [.969,.976,.983]: box('speaker grille',(.153,-.138,z),(.005,.036,.002),'uiDark','torso',.001)
tube('radio antenna',[(.093,-.158,1.027),(.094,-.168,1.108)],.004,'uiDark','torso',1)
ell('antenna tip',(.094,-.168,1.108),(.004,.004,.005),'brass','torso',8,6)
tube('radio cord',[(.091,-.155,.955),(.078,-.190,.920),(.053,-.178,.890)],.004,'uiDark','torso',1)
# Padded seat, duty belt and large hollow buckle.
loft('pants seat',[(0,0,.552,.078,.129),(0,0,.585,.095,.15),(0,0,.645,.096,.145),(0,0,.664,.086,.138)],'capNavy','hip',24)
loft('duty belt',[(0,0,.632,.099,.152),(0,0,.641,.105,.159),(0,0,.676,.10,.154)],'uiDark','hip',24)
for z in [.637,.675]: box('buckle horizontal',(.121,0,z),(.015,.064,.007),'silver','hip',.002)
for y in [-.029,.029]: box('buckle vertical',(.121,y,.656),(.015,.007,.045),'silver','hip',.002)
tube('buckle pin',[(.13,0,.656),(.13,.026,.656)],.0025,'silver','hip',1)
for s in [-1,1]:
    for x,y in [(.102,s*.097),(-.103,s*.083)]:
        box('duty pouch',(x,y,.640),(.057,.066,.107),'uiDark','hip',.012)
        box('duty flap',(x+.03,y,.677),(.013,.071,.033),'navySeam','hip',.006)
        ell('belt pouch snap',(x+.039,y,.674),(.004,.006,.006),'brass','hip',8,6)
    box('hip pouch',(0,s*.167,.647),(.081,.052,.103),'navy','hip',.012)
    box('belt loop',(.08,s*.14,.662),(.018,.022,.05),'navySeam','hip',.004)
for side,s in [('L',1),('R',-1)]:
    arm='arm'+side;fore='foreArm'+side;hand='hand'+side;leg='leg'+side;shin='shin'+side;foot='foot'+side
    loft('shirt sleeve',[(0,s*.230,.866,.064,.062),(0,s*.225,.892,.065,.062),(0,s*.19,.985,.067,.064),(0,s*.183,1.009,.046,.048)],'capNavy',arm,20)
    loft('rolled cuff',[(0,s*.232,.861,.065,.064),(0,s*.231,.875,.069,.066),(0,s*.224,.894,.066,.064)],'denimBlue',arm,20)
    ell('elbow',(.01,s*.241,.838),(.041,.044,.043),'skinWarm',fore)
    loft('bare forearm',[(.024,s*.282,.680,.029,.032),(.024,s*.278,.716,.033,.036),(.015,s*.261,.779,.044,.046),(.01,s*.241,.839,.042,.044),(.01,s*.237,.86,.038,.039)],'skinWarm',fore,20)
    loft('glove wrist',[(.024,s*.28,.681,.034,.037),(.024,s*.278,.696,.038,.040),(.023,s*.274,.718,.035,.038)],'uiDark',hand,20)
    box('glove wrist tab',(.059,s*.278,.702),(.016,.069,.022),'navySeam',hand,.004)
    ell('glove palm',(.026,s*.29,.649),(.034,.039,.045),'uiDark',hand,20,12)
    box('glove back pad',(.059,s*.29,.657),(.016,.052,.05),'navySeam',hand,.011)
    for i in range(4):
        y=s*(.269+i*.016)
        tube('glove finger',[(.030,y,.638),(.049,y,.611),(.040,y,.594+(.006 if i==3 else 0))],.011,'uiDark',hand,1)
        ell('finger knuckle',(.054,y,.633),(.007,.009,.011),'navySeam',hand,12,8)
    tube('glove thumb',[(.04,s*.266,.668),(.063,s*.254,.646),(.067,s*.258,.631)],.012,'uiDark',hand,1)
    ell('thumb exposed tip',(.066,s*.258,.627),(.010,.011,.011),'skinWarm',hand,12,8)
    loft('trouser thigh',[(.006,s*.118,.348,.064,.065),(.008,s*.115,.37,.068,.069),(0,s*.11,.49,.077,.077),(0,s*.098,.62,.082,.081)],'capNavy',leg,20)
    loft('trouser shin',[(-.006,s*.138,.165,.054,.058),(-.012,s*.138,.189,.062,.068),(-.015,s*.136,.237,.058,.065),(-.001,s*.127,.296,.057,.060),(.008,s*.118,.355,.066,.067),(.008,s*.118,.372,.063,.064)],'capNavy',shin,20)
    ell('knee fold',(.008,s*.118,.36),(.060,.063,.042),'capNavy',shin)
    box('knee reinforcement',(.067,s*.119,.362),(.024,.089,.097),'denimBlue',shin,.018)
    ell('knee stud',(.083,s*.153,.394),(.003,.004,.004),'navySeam',shin,8,6)
    loft('trouser cuff',[(-.012,s*.138,.165,.059,.063),(-.012,s*.138,.176,.067,.07),(-.012,s*.138,.198,.064,.067)],'denimBlue',shin,20)
    for z,x in [(.226,.045),(.29,.047)]:
        tube('cloth fold',[(x,s*.09,z+.009),(x+.013,s*.13,z),(x,s*.173,z-.006)],.004,'capNavy',shin,1)
    box('cargo pocket',(0,s*.194,.468),(.113,.029,.127),'denimBlue',leg,.011)
    box('cargo flap',(.001,s*.213,.526),(.119,.016,.033),'capNavy',leg,.005)
    tube('cargo piping',[(.049,s*.213,.508),(.049,s*.214,.418),(-.045,s*.214,.418),(-.045,s*.213,.508)],.002,'navySeam',leg,1)
    ell('cargo snap',(.018,s*.224,.525),(.005,.003,.005),'brass',leg,8,6)
    # Chunky ankle boots, welt, toe shell, heel and visible eyelets/laces.
    y=s*.138
    box('boot outsole',(.029,y,.022),(.231,.145,.044),'uiDark',foot,.017)
    box('boot welt',(.029,y,.047),(.235,.147,.027),'navySeam',foot,.012)
    loft('boot upper',[(.027,y,.057,.103,.063),(.026,y,.083,.098,.065),(-.012,y,.124,.071,.06),(-.025,y,.167,.054,.055),(-.024,y,.18,.05,.05)],'uiDark',foot,24)
    ell('polished toe',(.104,y,.093),(.047,.065,.039),'navy',foot,20,12)
    box('heel counter',(-.066,y,.113),(.028,.109,.069),'navy',foot,.012)
    box('boot tongue',(.024,y,.142),(.035,.069,.083),'navy',foot,.01,rot=(0,-.4,0))
    for d in [-1,1]:
        tube('boot stitching',[(.10,y+d*.059,.08),(.025,y+d*.068,.104),(-.046,y+d*.06,.132)],.002,'navySeam',foot,1)
        for j in range(7): box('sole lug',(-.062+j*.029,y+d*.07,.018),(.018,.014,.027),'uiDark',foot,.003)
    for j in range(4):
        x=.078-j*.016;z=.114+j*.01
        for dy in [-.03,.03]: ell('lace eyelet',(x,y+dy,z),(.004,.005,.004),'brass',foot,8,6)
        tube('boot lace',[(x,y-.03,z+.005),(x-.005,y,z+.009),(x,y+.03,z+.005)],.003,'uiDark',foot,1)
# Right thigh drop holster with two fitted straps and safe, stowed sidearm.
for z in [.477,.526]:
    loft('holster leg strap',[(0,-.108,z-.010,.082,.083),(0,-.108,z+.010,.082,.083)],'uiDark','legR',20)
    box('holster strap buckle',(.085,-.143,z),(.015,.035,.029),'navySeam','legR',.004)
box('drop holster',(0,-.226,.494),(.085,.067,.175),'uiDark','legR',.012)
box('holster rim',(.013,-.262,.548),(.069,.012,.047),'navySeam','legR',.004)
box('stowed pistol grip',(-.015,-.229,.598),(.034,.030,.052),'uiDark','legR',.006,rot=(0,-.18,0))
box('retention tab',(.027,-.265,.578),(.025,.013,.060),'navy','legR',.004)
ell('retention snap',(.028,-.275,.589),(.005,.003,.005),'silver','legR',8,6)
# Character face: rounded cheeks, narrower chin, broad forehead.
headrings=[(-.004,0,1.057,.041,.052),(0,0,1.072,.077,.090),(.004,0,1.105,.112,.135),
    (0,0,1.155,.134,.153),(-.008,0,1.213,.137,.150),(-.013,0,1.277,.127,.141),
    (-.018,0,1.323,.095,.105),(-.019,0,1.340,.040,.045)]
loft('face sculpt',headrings,'skinWarm','head',32,1)
# Ears have an inset inner bowl and a small tragus.
for s in [-1,1]:
    ell('ear',(-.012,s*.150,1.174),(.031,.021,.043),'skinWarm','head')
    ell('ear inset',(.013,s*.162,1.176),(.011,.011,.027),'skinShadow','head')
    ell('ear inner',(.020,s*.16,1.169),(.007,.009,.015),'skinBlush','head')
    ell('tragus',(.023,s*.15,1.162),(.009,.008,.013),'skinWarm','head',8,6)
# Surface x coordinate near eyes. Narrow depth keeps the eyes nestled in face.
def face_x(y,z):
    return .130*max(.1,1-(y/.153)**2)**.225 - .005
for s in [-1,1]:
    y=s*.062; z=1.210; x=face_x(y,z)
    ell('eye sclera', (x+.004,y,z),(.008,.031,.043),'picketWhite','head',20,12)
    ell('iris', (x+.013,y-.003*s,z-.001),(.0035,.019,.032),'eyeBrown','head',20,12)
    ell('pupil', (x+.016,y-.003*s,z),(.0025,.010,.024),'uiDark','head',20,12)
    ell('eye glint', (x+.019,y-.009*s,z+.014),(.0025,.007,.009),'picketWhite','head',8,6)
    ell('eye glint small',(x+.019,y+.007*s,z-.010),(.002,.003,.004),'picketWhite','head',8,6)
    pts=[]
    for j in range(7):
        a=math.pi*j/6
        yy=y+.032*math.cos(a); zz=z+.043*math.sin(a)
        pts.append((face_x(yy,zz)+.012,yy,zz))
    tube('upper lashes',pts,.0048,'hairChestnut','head',2)
    tube('lower lid',[(face_x(y-.026,z)+.01,y-.026,z-.021),(x+.013,y,z-.044),(face_x(y+.026,z)+.01,y+.026,z-.021)],.002,'skinShadow','head',2)
    tube('brow',[(face_x(y-s*.029,z)+.007,y-s*.030,1.260),(face_x(y,z)+.008,y,1.274),(face_x(y+s*.030,z)+.008,y+s*.032,1.267)],.008,'uiDark','head',2)
    ell('cheek blush',(face_x(s*.093,1.165)+.008,s*.094,1.165),(.0007,.022,.009),'skinBlush','head',16,8)
for o in list(asset.objects):
    if o.type=='MESH' and o.name.startswith(('eye sclera','iris','pupil','eye glint')):
        o.rotation_euler.z=.18 if o.matrix_world.translation.y>0 else -.18
# Rounded nose bridges smoothly into a small button tip.
ell('nose bridge',(.128,0,1.188),(.012,.011,.022),'skinWarm','head')
ell('nose tip',(.144,0,1.176),(.016,.016,.013),'skinWarm','head')
ell('nose light',(.158,-.003,1.180),(.002,.007,.004),'bandage','head',8,6)
for s in [-1,1]: ell('nostril',(.148,s*.012,1.169),(.003,.003,.002),'skinShadow','head',8,6)
tube('smile',[(.119,-.044,1.135),(.133,-.024,1.126),(.138,0,1.123),(.133,.024,1.126),(.119,.044,1.135)],.0025,'mouth','head',2)
tube('smile teeth',[(.133,-.027,1.130),(.139,0,1.126),(.133,.027,1.130)],.0023,'picketWhite','head',1)
tube('lower lip',[(.126,-.012,1.119),(.130,0,1.118),(.125,.014,1.120)],.002,'skinBlush','head',2)


# Short dark hair under the cap: a scalp, chunky nape locks and sideburns.
ell('hair back',(-.048,0,1.24),(.108,.150,.109),'uiDark','head',24,16)
for j in range(9):
    a=math.pi*.55+j*math.pi*.9/8
    x=-.019+.127*math.cos(a);y=.153*math.sin(a)
    lock('nape lock',[(x,y,1.283),(x-.025,y*1.01,1.237),(x-.018,y*.92,1.173+(.009 if j%2 else -.006))], [.030,.034,.001],[.012,.016,.001],'uiDark',normal=(-1,0,0))
for s in [-1,1]:
    lock('sideburn',[(.020,s*.136,1.288),(.038,s*.153,1.240),(.041,s*.140,1.184)], [.020,.025,.001],[.012,.014,.001],'uiDark',normal=(.3,s,0))
    lock('temple lock',[(.068,s*.090,1.296),(.092,s*.116,1.269),(.063,s*.144,1.242)], [.02,.024,.001],[.01,.014,.001],'uiDark')
for j in range(5):
    y=(j-2)*.049
    lock('lower nape layering',[(-.139,y,1.244),(-.152,y-.012,1.205),(-.119,y-.018,1.148)], [.030,.032,.001],[.011,.015,.001],'uiDark',normal=(-1,0,0))
# Navy peaked cap: separate band, broad crown, shaped visor and brass details.
loft('cap band',[(-.020,0,1.288,.135,.154),(-.020,0,1.30,.146,.165),(-.020,0,1.331,.144,.164)],'uiDark','head',32)
loft('cap crown',[(-.022,0,1.325,.143,.166),(-.030,0,1.338,.174,.192),(-.033,0,1.355,.186,.203),(-.026,0,1.391,.172,.186),(-.023,0,1.415,.105,.120),(-.023,0,1.418,.045,.055)],'capNavy','head',32)
ell('cap visor',(.115,0,1.290),(.106,.162,.020),'uiDark','head',32,12)
tube('visor stitched edge',[(.109+.103*math.cos(a),.153*math.sin(a),1.293) for a in [-1.3,-1,-.65,0,.65,1,1.3]],.002,'navySeam','head',1)
tube('cap chin cord',[(.111,-.135,1.311),(.134,-.082,1.312),(.139,0,1.313),(.134,.082,1.312),(.111,.135,1.311)],.004,'navySeam','head',1)
for s in [-1,1]: ell('cap brass button',(.096,s*.147,1.313),(.008,.006,.008),'brass','head',12,8)
# Extruded shield silhouettes, inset blue centers and raised seal relief.
def shield(name,c,w,h,mat,parent,axis='front'):
    pts=[(-.5,.42),(-.32,.39),(0,.52),(.32,.39),(.5,.42),(.45,-.13),(.25,-.37),(0,-.52),(-.25,-.37),(-.45,-.13)]
    verts=[]
    for depth in [0,.007]:
        for u,v in pts:
            verts.append((c[0]+depth,c[1]+u*w,c[2]+v*h) if axis=='front' else (c[0]+u*w,c[1]+(depth-v*h*.42)*(1 if c[1]>0 else -1),c[2]+v*h))
    n=len(pts);faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    o=mesh(name,verts,faces,mat,parent)
    # Relief follows the applied curved shell, retaining 4mm clearance.
    if name.startswith('cap shield') or axis=='side':
        shell = bpy.data.objects['cap crown'] if axis=='front' else next(obj for obj in asset.objects if obj.type=='MESH' and obj.name.startswith('shirt sleeve') and obj.parent==N[parent])
        normal=Vector((1,0,0)) if axis=='front' else Vector((0,1 if c[1]>0 else -1,0))
        extra=c[0]-.139 if axis=='front' else abs(c[1])-.267
        bpy.context.view_layer.update()
        inv=shell.matrix_world.inverted(); inv_o=o.matrix_world.inverted()
        for i,v in enumerate(o.data.vertices):
            w=o.matrix_world@v.co
            hit,loc,_,_=shell.ray_cast(inv@(w+normal*.25),inv.to_3x3()@(-normal))
            if hit: v.co=inv_o@(shell.matrix_world@loc+normal*(.004+extra+(.007 if i>=n else 0)))
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('badge rounded edge','BEVEL');mod.width=.002;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
shield('cap shield',(.139,0,1.370),.052,.068,'brass','head')
shield('cap shield inset',(.149,0,1.370),.035,.048,'schoolBusYellow','head')
ell('cap shield seal',(.160,0,1.37),(.003,.011,.013),'brass','head',12,8)
for side,s in [('L',1),('R',-1)]:
    shield('sleeve shield',(0,s*.267,.946),.067,.092,'brass','arm'+side,axis='side')
    shield('sleeve blue inset',(0,s*(.267+.010),.946),.051,.073,'policeBlue','arm'+side,axis='side')
    ell('sleeve seal',(0,s*(.267+.021),.945),(.014,.004,.020),'brass','arm'+side,12,8)
shield('chest badge',(.12,.083,.975),.026,.033,'brass','torso')
# Readable chibi head and broad hands; bake proportion changes into vertices.
bpy.context.view_layer.update()
for o in asset.objects:
    if o.type!='MESH': continue
    part=o.parent.name
    if part!='head' and not part.startswith('hand'): continue
    pivot=N[part].matrix_world.translation
    inv=o.matrix_world.inverted()
    for v in o.data.vertices:
        w=o.matrix_world@v.co
        if part=='head':
            w.x=pivot.x+(w.x-pivot.x)*1.06
            w.y=pivot.y+(w.y-pivot.y)*1.13
        else: w=pivot+(w-pivot)*1.20
        v.co=inv@w
# Apply silhouette simplification before material consolidation; no modifiers export.
for o in list(asset.objects):
    if o.type!='MESH': continue
    o.data.calc_loop_triangles()
    if len(o.data.loop_triangles)>150:
        bpy.context.view_layer.objects.active=o
        dec=o.modifiers.new('Hero budget','DECIMATE');dec.ratio=.60
        bpy.ops.object.modifier_apply(modifier=dec.name)
# Merge same-material static geometry within each rigid joint, preserving
# separate shells in the source and every animation/socket node in the GLB.
def consolidate():
    groups={}
    for o in list(asset.objects):
        if o.type=='MESH':
            key=(o.parent.name,o.data.materials[0].name)
            groups.setdefault(key,[]).append(o)
    for (parent,mat),objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects: o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1: bpy.ops.object.join()
        o=bpy.context.object
        o.name=parent+'.'+mat
        o.select_set(False)
consolidate()
# Explicit triangles and clean bevel/cap slivers avoid exporter-created zero-area
# faces. This changes no visible silhouette and keeps each joint mesh separate.
for o in asset.objects:
    if o.type != 'MESH': continue
    bm=bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='FIXED',ngon_method='EAR_CLIP')
    bad=[f for f in bm.faces if (f.verts[1].co-f.verts[0].co).cross(f.verts[2].co-f.verts[0].co).length<2e-8]
    if bad: bmesh.ops.delete(bm,geom=bad,context='FACES_ONLY')
    bm.to_mesh(o.data); bm.free(); o.data.update()
bpy.context.view_layer.update()
tris=0
for o in asset.objects:
    if o.type=='MESH':
        o.data.calc_loop_triangles()
        tris+=len(o.data.loop_triangles)
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','weaponSocketR','weaponSocketL','backpackSocket']
missing=[n for n in required if n not in asset.objects]
report={'id':'npc.police-officer','triangles':tris,'meshes':sum(o.type=='MESH' for o in asset.objects),'nodes_ok':not missing,'missing_nodes':missing,'rounds':int(arg('--round',4)),'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2)+'\n')
print('BUILD OK',json.dumps(report))
if arg('--glb'):
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    print('GLB OK',arg('--glb'))

def test_pose():
    N['armL'].rotation_euler.x=math.radians(65)
    N['armL'].rotation_euler.y=math.radians(-20)
    N['foreArmL'].rotation_euler.y=math.radians(-80)
    N['legR'].rotation_euler.y=math.radians(-28)
    N['shinR'].rotation_euler.y=math.radians(35)
    bpy.context.view_layer.update()

if '--pose-test' in ARGS: test_pose()

# Studio is separate from exported collection. Orthographic consistent views.
def stage(view):
    world=bpy.data.worlds.new('Warm dusk studio'); scene.world=world
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.14,.16,.21,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
    def area(name,loc,power,size,color):
        ld=bpy.data.lights.new(name,'AREA'); ld.energy=power; ld.shape='DISK'; ld.size=size; ld.color=color
        o=bpy.data.objects.new(name,ld); scene.collection.objects.link(o); o.location=loc
        o.rotation_euler=(Vector((0,0,.78))-Vector(loc)).to_track_quat('-Z','Y').to_euler()
    area('soft key',(3,-4,5),420,4,(1,.83,.70))
    area('cool fill',(2,4,3),270,3,(.73,.83,1))
    area('golden rim',(-3,-1,3.7),500,3,(1,.61,.34))
    bpy.ops.mesh.primitive_plane_add(size=200)
    ground=bpy.context.object; ground.name='Studio floor'; ground.location.z=-.005
    gm=bpy.data.materials.new('Studio slate'); gm.diffuse_color=(.036,.032,.048,1); gm.use_nodes=True
    bs=gm.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=(.036,.032,.048,1); bs.inputs['Roughness'].default_value=.85
    ground.data.materials.append(gm)
    cam=bpy.data.objects.new('Review camera',bpy.data.cameras.new('Review camera'))
    scene.collection.objects.link(cam); scene.camera=cam; cam.data.type='ORTHO'
    target=Vector((-.035,0,.70))
    directions={'front':(5,0,.28),'side':(0,-5,.28),'back':(-5,0,.28),'ref':(6.3,-4.7,2.0)}
    cam.location=target+Vector(directions[view])
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=int(arg('--width',960)); scene.render.resolution_y=int(arg('--height',540))
    cam.data.ortho_scale=1.65*scene.render.resolution_x/scene.render.resolution_y
    scene.render.engine='CYCLES'
    prefs=bpy.context.preferences.addons['cycles'].preferences
    scene.cycles.device='CPU'; scene.cycles.samples=int(arg('--samples',24)); scene.cycles.use_denoising=True
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.image_settings.file_format='PNG'
if arg('--render'):
    stage(arg('--view','ref'))
    scene.render.filepath=str(Path(arg('--render')).resolve())
    Path(scene.render.filepath).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print('RENDER OK',arg('--render'))
    if '--four-views' in ARGS:
        target=Vector((-.035,0,.70))
        views={'front':(5,0,.28),'side':(0,-5,.28),'back':(-5,0,.28),'ref':(6.3,-4.7,2.0)}
        for label,direction in views.items():
            scene.camera.location=target+Vector(direction)
            scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
            base=Path(arg('--render')).resolve()
            scene.render.filepath=str(base.with_name(base.stem+'-'+label+'.png'))
            bpy.ops.render.render(write_still=True)
            print('RENDER OK',scene.render.filepath)

    if '--deliverables' in ARGS:
        # Hero above is full resolution. Remaining reviews use the agreed light settings.
        scene.cycles.samples=24
        scene.render.resolution_x=960; scene.render.resolution_y=540
        target=Vector((-.035,0,.70))
        views={'front':(5,0,.28),'side':(0,-5,.28),'back':(-5,0,.28),'ref':(6.3,-4.7,2.0)}
        for label,direction in views.items():
            scene.camera.location=target+Vector(direction)
            scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(HERE/'renders'/('final-'+label+'.png'))
            bpy.ops.render.render(write_still=True)
            print('RENDER OK',scene.render.filepath)
        test_pose()
        scene.render.filepath=str(HERE/'renders'/'pose-test.png')
        bpy.ops.render.render(write_still=True)
        print('POSE OK',scene.render.filepath)
