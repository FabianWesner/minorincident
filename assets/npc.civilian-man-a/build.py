"""Minor Incident civilian man A — deterministic sculpted rigid-part hero.
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
asset = bpy.data.collections.new('CivilianManA')
scene.collection.children.link(asset)
M = {}
# Identity tokens use spec values; additional flat palette entries describe skin,
# hair, khaki cloth and small trims absent from the starter palette (no textures).
COLORS = {
    'picketWhite':'f2e6dc', 'uiDark':'25222c', 'skinWarm':'f2a77f',
    'skinBlush':'e49b8c', 'skinShadow':'cf795b', 'hairChestnut':'4a2925',
    'hairWarm':'63362b', 'hairHighlight':'85503a', 'eyeBrown':'542920',
    'mouth':'a34743', 'bandage':'eac19f', 'polo':'36768a',
    'poloLight':'4b8794', 'poloDark':'285c70', 'khaki':'b9966d',
    'khakiLight':'c4a27d', 'khakiSeam':'8c704e', 'leather':'493128',
    'silver':'bbb5ab', 'orange':'eda04f',
}

def srgb(h):
    rgb = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
for token, color in COLORS.items():
    m = bpy.data.materials.new('pal_'+token)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = srgb(color)
    bs.inputs['Roughness'].default_value = .62 if token.startswith('hair') else .67
    if token in ('eyeBrown', 'uiDark'):
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
joint('hip', (0,0,.705),'root')
joint('torso',(0,0,.755),'hip')
joint('head',(0,0,1.055),'torso')
for side,s in [('L',1),('R',-1)]:
    joint('arm'+side,(0,s*.185,1.005),'torso')
    joint('foreArm'+side,(.012,s*.241,.838),'arm'+side)
    joint('hand'+side,(.025,s*.282,.684),'foreArm'+side)
    joint('leg'+side,(0,s*.098,.668),'hip')
    joint('shin'+side,(.008,s*.118,.420),'leg'+side)
    joint('foot'+side,(-.006,s*.138,.142),'shin'+side)
    joint('weaponSocket'+side,(.061,s*.28,.620),'hand'+side)
joint('backpackSocket',(-.111,0,.924),'torso')
N['root']['asset_id']='npc.civilian-man-a'
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
            fs.append(((k+1)*seg+j,(k+1)*seg+(j+1)%seg,k*seg+(j+1)%seg,k*seg+j))
    # Outward winding (single-sided runtime materials cull inward faces).
    fs.extend([tuple(range(seg)),tuple(reversed(range((len(points)-1)*seg,len(points)*seg)))])
    return mesh(name,vs,fs,mat,parent,1)

# Tucked polo shell: full shoulders, slight waist taper, soft cloth hem.
loft('polo shell',[(0,0,.752,.079,.126),(0,0,.765,.090,.143),(-.004,0,.812,.096,.147),
    (-.012,0,.875,.093,.153),(-.007,0,.960,.084,.169),(0,0,1.003,.058,.145),
    (0,0,1.027,.035,.057)],'polo','torso',24,1)
loft('neck',[(0,0,1.005,.038,.044),(0,0,1.032,.041,.045),(0,0,1.087,.046,.047)],'skinWarm','head')
# Collar stand and two folded points, with dimensional hems.
loft('collar stand',[(0,0,1.000,.045,.060),(-.010,0,1.017,.045,.065),(-.01,0,1.036,.041,.061)],'poloLight','torso',24,1)
for s in [-1,1]:
    verts=[(.039,s*.024,1.023),(.013,s*.062,1.038),(.071,s*.104,.985),(.094,s*.036,.998)]
    verts += [(x-.009,y,z-.007) for x,y,z in verts]
    o=mesh('folded collar',verts,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'poloLight','torso')
    bpy.context.view_layer.objects.active=o
    be=o.modifiers.new('Collar softened edge','BEVEL'); be.width=.006; be.segments=3
    bpy.ops.object.modifier_apply(modifier=be.name)
    tube('collar hem',[(.041,s*.026,1.025),(.095,s*.036,.999),(.071,s*.104,.986)],.0016,'poloDark','torso',1)
box('button placket',(.093,0,.953),(.012,.034,.104),'poloDark','torso',.005)
box('placket top',(.100,0,.960),(.009,.026,.088),'polo','torso',.004)
for z in [.988,.956]: ell('polo button',(.107,0,z),(.0035,.005,.005),'picketWhite','torso',12,8)
# Chest pocket relief lies clear of the underlying shell.
box('chest pocket',(.090,.084,.912),(.016,.071,.079),'polo','torso',.012)
tube('pocket stitch',[(.102,.052,.943),(.102,.053,.884),(.107,.084,.872),(.102,.116,.885),(.101,.115,.943)],.0013,'poloLight','torso',1)
tube('pocket welt',[(.104,.052,.943),(.108,.083,.944),(.104,.115,.943)],.003,'poloDark','torso',1)
# Tiny fictional orange wing marking as in the crop, no added text.
tube('chest marking',[(.112,.059,.938),(.113,.069,.938),(.114,.078,.928),(.114,.087,.938),(.113,.098,.938)],.003,'orange','torso',1)
tube('chest marking tip',[(.114,.093,.933),(.114,.104,.936)],.003,'orange','torso',1)
for s in [-1,1]:
    tube('shoulder seam',[(.021,s*.070,1.027),(.026,s*.143,1.006),(.024,s*.173,.983)],.0016,'poloLight','torso',1)
    tube('side seam',[(-.017,s*.151,.80),(-.025,s*.162,.887),(-.015,s*.171,.962)],.0013,'poloDark','torso',1)

loft('pants seat',[(0,0,.634,.072,.122),(0,0,.671,.087,.144),(0,0,.743,.083,.139),(0,0,.764,.077,.131)],'khaki','hip',24,1)
loft('belt',[(0,0,.750,.085,.138),(0,0,.759,.087,.140),(0,0,.782,.082,.135)],'leather','hip',24,1)
for z in [.752,.780]: box('buckle horizontal',(.100,0,z),(.009,.062,.005),'silver','hip',.002)
for y in [-.029,.029]: box('buckle vertical',(.100,y,.766),(.009,.005,.031),'silver','hip',.002)
tube('buckle pin',[(.105,0,.766),(.105,.026,.766)],.002,'silver','hip',1)
for s in [-1,1]:
    for x,y in [(.070,s*.108),(-.077,s*.105)]:
        box('belt loop',(x,y,.766),(.016,.016,.043),'khakiLight','hip',.003)
    tube('front pocket opening',[(.065,s*.119,.747),(.091,s*.111,.709),(.090,s*.075,.692)],.0023,'khakiSeam','hip',1)
    box('rear pocket',(-.087,s*.075,.696),(.016,.077,.079),'khaki','hip',.009)
    tube('rear pocket stitches',[(-.099,s*.040,.730),(-.102,s*.041,.671),(-.106,s*.076,.660),(-.102,s*.110,.673),(-.099,s*.11,.730)],.0015,'khakiSeam','hip',1)
tube('fly stitch',[(.091,.014,.743),(.101,.014,.692),(.086,.010,.647)],.0015,'khakiSeam','hip',1)
for y in [-.060,-.042,-.024]: ell('belt punched hole',(.094,y,.767),(.002,.002,.002),'uiDark','hip',8,6)

for side,s in [('L',1),('R',-1)]:
    arm='arm'+side; fore='foreArm'+side; hand='hand'+side
    loft('upper arm '+side,[(.009,s*.241,.831,.040,.040),(.005,s*.232,.865,.047,.045),
        (0,s*.203,.938,.052,.050),(0,s*.185,1.009,.046,.046)],'skinWarm',arm,20,1)
    ell('elbow '+side,(.010,s*.241,.838),(.039,.041,.040),'skinWarm',fore)
    loft('polo sleeve '+side,[(0,s*.218,.924,.060,.059),(0,s*.214,.940,.061,.061),(-.007,s*.191,.994,.066,.063),
        (-.010,s*.178,1.013,.048,.045)],'polo',arm,20,1)
    loft('sleeve cuff '+side,[(0,s*.222,.922,.063,.061),(0,s*.219,.934,.064,.063),(0,s*.213,.945,.061,.061)],'poloLight',arm,20,1)
    tube('sleeve cuff stitch',[(.057,s*.192,.933),(.064,s*.222,.933),(.055,s*.252,.933)],.0015,'poloDark',arm,1)
    loft('forearm '+side,[(.024,s*.282,.680,.026,.029),(.023,s*.278,.714,.028,.031),(.015,s*.261,.782,.040,.041),
        (.01,s*.241,.838,.039,.039),(.010,s*.241,.851,.033,.035)],'skinWarm',fore,20,1)
    ell('palm '+side,(.025,s*.290,.650),(.031,.036,.043),'skinWarm',hand,20,12)
    for i in range(4):
        y=s*(.273+i*.014)
        z=.620+(.004 if i in (0,3) else 0)
        tube('finger '+side+str(i),[(.029,y,.644),(.041,y,.611),(.036,y,.590+(.006 if i==3 else 0))],.010,'skinWarm',hand,2)
        ell('knuckle '+side+str(i),(.047,y,.639),(.008,.010,.011),'skinWarm',hand,12,8)
    tube('thumb '+side,[(.040,s*.267,.666),(.062,s*.258,.648),(.066,s*.26,.634)],.012,'skinWarm',hand,2)
    # Full-length trousers, roomy thigh and softly gathered ankle.
    p='leg'+side
    loft('khaki thigh '+side,[(.006,s*.118,.408,.059,.060),(.007,s*.118,.435,.063,.063),
        (-.001,s*.113,.505,.065,.066),(0,s*.102,.593,.072,.073),(0,s*.098,.680,.076,.077)],'khaki',p,24,1)
    loft('khaki shin '+side,[(-.006,s*.138,.176,.050,.054),(-.010,s*.138,.196,.058,.062),(-.017,s*.137,.245,.056,.061),
        (-.005,s*.130,.308,.049,.052),(.007,s*.120,.371,.060,.059),(.009,s*.118,.422,.062,.062),
        (.007,s*.118,.437,.056,.058)],'khaki','shin'+side,24,1)
    ell('knee cloth '+side,(.007,s*.118,.421),(.058,.060,.051),'khaki','shin'+side,20,12)
    loft('trouser cuff '+side,[(-.010,s*.138,.178,.053,.058),(-.013,s*.138,.188,.062,.064),
        (-.011,s*.138,.204,.064,.065),(-.013,s*.138,.219,.057,.060)],'khakiLight','shin'+side,24,1)
    tube('pants outer seam',[(0,s*.176,.431),(-.012,s*.188,.315),(-.016,s*.199,.223)],.0014,'khakiSeam','shin'+side,1)
    tube('thigh seam',[(0,s*.173,.650),(0,s*.182,.544),(.002,s*.181,.443)],.0014,'khakiSeam',p,1)
    # Cargo bellows, flap, stitching and button on the outside of each thigh.
    box('cargo pocket '+side,(.005,s*.187,.551),(.103,.030,.117),'khakiLight',p,.012)
    box('cargo pocket flap '+side,(.011,s*.202,.606),(.111,.014,.037),'khaki',p,.008)
    tube('cargo pocket piping',[(.049,s*.206,.589),(.050,s*.208,.503),(-.042,s*.208,.503),(-.045,s*.206,.589)],.0015,'khakiSeam',p,1)
    box('cargo bellows '+side,(-.026,s*.206,.547),(.013,.011,.082),'khaki',p,.003)
    ell('cargo button '+side,(.020,s*.213,.604),(.005,.003,.005),'khakiSeam',p,12,8)
    foot='foot'+side; y=s*.138
    # Three sole layers, rounded toe cap, tongue and relief lacing.
    box('rubber outsole '+side,(.029,y,.021),(.228,.136,.042),'uiDark',foot,.017)
    box('sneaker midsole '+side,(.030,y,.047),(.226,.135,.042),'picketWhite',foot,.016)
    box('midsole rim '+side,(.030,y,.068),(.222,.132,.020),'picketWhite',foot,.009)
    loft('sneaker upper '+side,[(.025,y,.072,.100,.058),(.018,y,.089,.092,.059),(-.010,y,.122,.071,.055),
        (-.026,y,.163,.046,.050),(-.025,y,.184,.043,.048)],'polo',foot,24,1)
    ell('sneaker toe '+side,(.106,y,.093),(.044,.058,.033),'picketWhite',foot,20,12)
    box('heel counter '+side,(-.062,y,.111),(.027,.104,.077),'poloDark',foot,.014)
    loft('shoe collar '+side,[(-.027,y,.160,.049,.052),(-.026,y,.176,.053,.056),(-.025,y,.186,.050,.053)],'poloLight',foot,24,1)
    box('padded tongue '+side,(.026,y,.150),(.030,.065,.090),'picketWhite',foot,.014,rot=(0,-.28,0))
    box('tongue teal badge '+side,(.047,y,.174),(.008,.033,.028),'polo',foot,.007)
    for d in [-1,1]:
        for j in range(2):
            box('sneaker side stripe '+side,(.035-j*.030,y+d*.060,.110+j*.002),(.016,.008,.063),'picketWhite',foot,.003,rot=(0,-.40,0))
        tube('sneaker side seam',[(.087,y+d*.056,.098),(.025,y+d*.066,.136),(-.038,y+d*.054,.113)],.002,'poloLight',foot,1)
        for j in range(7): box('tread notch',(-.062+j*.028,y+d*.066,.020),(.010,.007,.015),'uiDark',foot,.002)
    for j in range(4):
        x=.088-j*.013; z=.114+j*.009
        for dy in [-.033,.033]: ell('lace eyelet',(x,y+dy,z),(.004,.005,.004),'silver',foot,8,6)
        tube('shoe lace',[(x,y-.033,z+.005),(x+.003,y,z+.008),(x-.004,y+.033,z+.007)],.0034,'picketWhite',foot,1)
    tube('lace bow',[(.049,y,.154),(.053,y-.024,.162),(.063,y-.019,.151),(.049,y,.154),(.054,y+.022,.160),(.061,y+.018,.150),(.049,y,.154)],.003,'picketWhite',foot,1)
    box('heel tab '+side,(-.075,y,.154),(.010,.040,.020),'picketWhite',foot,.004)
# Left wristwatch: fitted dark strap, round bezel, face and tiny dial hands.
loft('watch strap',[(.023,.279,.704,.032,.035),(.023,.276,.713,.034,.037),(.022,.273,.735,.034,.037),(.022,.271,.742,.031,.034)],'uiDark','foreArmL',20,1)
ell('watch bezel',(.060,.277,.722),(.012,.026,.026),'uiDark','foreArmL',24,12)
ell('watch dial',(.071,.277,.722),(.006,.022,.022),'uiDark','foreArmL',24,12)
tube('watch hands',[(.078,.278,.737),(.078,.277,.722),(.078,.266,.719)],.0014,'picketWhite','foreArmL',1)
ell('watch crown',(.061,.304,.722),(.006,.005,.006),'silver','foreArmL',12,8)
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
    tube('brow',[(face_x(y-s*.029,z)+.007,y-s*.030,1.268),(face_x(y,z)+.008,y,1.277),(face_x(y+s*.030,z)+.008,y+s*.032,1.267)],.006,'hairChestnut','head',2)
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

# Open-faced scalp cap with thick layered crown, nape and swept fringe.
vs=[]; fs=[]; segments=32; rows=9
for k in range(rows):
    t=k/(rows-1)
    for j in range(segments):
        a=2*math.pi*j/segments
        edge=.96+1.12*(1-math.cos(a))/2
        ph=.025+(edge-.025)*t
        vs.append((-.024+.152*math.sin(ph)*math.cos(a),.174*math.sin(ph)*math.sin(a),1.199+.172*math.cos(ph)))
for k in range(rows-1):
    for j in range(segments): fs.append(((k+1)*segments+j,(k+1)*segments+(j+1)%segments,k*segments+(j+1)%segments,k*segments+j))
# Outward winding: runtime palette materials are single-sided, so an inward cap
# is culled from outside and exposes the skin beneath it. The radii clear the
# face sculpt at the temples by about 1 cm so the scalp never z-fights it.
fs.append(tuple(range(segments)))
mesh('hair scalp',vs,fs,'hairChestnut','head',1)
for i in range(13):
    a=.70+i*.40; c=math.cos(a); q=math.sin(a)
    pts=[(-.012+.035*c,.036*q,1.372),(-.023+.109*c,.121*q,1.342),
         (-.026+.157*c,.168*q,1.282),(-.04+.153*c,.168*q,1.221),
         (-.038+.132*c,.153*q,1.127+.030*math.sin(a*3)+(.075 if c>0 else 0))]
    lock('layered crown '+str(i),pts,[.027,.044,.043,.028,.001],[.013,.021,.025,.018,.001],
         'hairWarm' if i%3 else 'hairChestnut',normal=(c,q,.3))
# Broad front locks sweep outwards from a right-of-center part.
bangs=[
    ([(.040,-.029,1.363),(.113,-.012,1.349),(.151,.047,1.314),(.131,.122,1.286),(.090,.167,1.298)], [ .027,.037,.038,.026,.001]),
    ([(.052,-.027,1.351),(.138,.014,1.320),(.157,.059,1.278),(.138,.082,1.239)], [.024,.032,.026,.001]),
    ([(.042,-.038,1.360),(.132,-.082,1.328),(.143,-.132,1.285),(.10,-.168,1.272),(.074,-.182,1.288)], [.027,.037,.031,.024,.001]),
    ([(.045,-.042,1.354),(.139,-.044,1.323),(.155,-.033,1.281),(.131,-.045,1.241)], [.020,.030,.021,.001]),
    ([(.016,.040,1.369),(.074,.089,1.357),(.110,.149,1.336),(.053,.189,1.345)], [.025,.042,.032,.001]),
]
for i,(pts,widths) in enumerate(bangs):
    lock('swept fringe '+str(i),pts,widths,[.014]+[.024]*(len(pts)-2)+[.001], 'hairWarm' if i%2==0 else 'hairChestnut')
for s in [-1,1]:
    lock('temple sideburn',[(.012,s*.139,1.304),(.041,s*.163,1.265),(.045,s*.158,1.213),(.050,s*.14,1.182)],
         [.022,.027,.020,.001],[.013,.020,.014,.001],'hairChestnut',normal=(.3,s,0))
    lock('side flick',[(0,s*.134,1.313),(-.028,s*.166,1.288),(-.062,s*.190,1.253),(-.053,s*.201,1.267)],
         [.020,.032,.027,.001],[.012,.020,.016,.001],'hairWarm',normal=(0,s,0))
# A few silhouette tips create the tousled top without a noisy strand cage.
for pts in [
    [(-.08,-.035,1.345),(-.04,-.045,1.391),(.010,-.015,1.420),(.055,.002,1.409)],
    [(-.06,.025,1.350),(-.035,.010,1.383),(-.043,-.025,1.413),(-.076,-.060,1.401)],
]:
    lock('crown tuft',pts,[.027,.034,.023,.001],[.010,.014,.012,.001],'hairWarm',normal=(0,-1,0))
for s in [-1,1]:
    tube('fringe sheen',[(.048,s*.035,1.37),(.117,s*.083,1.335),(.13,s*.125,1.302)],.0017,'hairHighlight','head',1)
# Broaden the unified head slightly to keep a readable chibi adult silhouette.
bpy.context.view_layer.update()
for o in asset.objects:
    if o.type=='MESH' and o.parent==N['head']:
        inv=o.matrix_world.inverted()
        for v in o.data.vertices:
            w=o.matrix_world@v.co; w.y*=1.10
            v.co=inv@w

# Match the turnaround: waist lower, torso longer, compact trouser legs and big hands.
def proportion(point, part):
    p=point.copy()
    if part=='torso' or part=='backpackSocket':
        p.z=1.015+(p.z-1.015)*1.40; p.y*=1.12
    elif part=='hip':
        p.z-=.110; p.y*=1.10
    elif part.startswith(('leg','shin')):
        p.z=.180+(p.z-.180)*.78
        center=.118 if part.startswith('leg') else .138
        sign=1 if part.endswith('L') else -1
        p.y=sign*center+(p.y-sign*center)*1.12; p.x*=1.08
    elif part.startswith(('arm','foreArm','hand','weaponSocket')) and p.z<.94:
        p.z=.94+(p.z-.94)*1.40
    return p
bpy.context.view_layer.update()
worlds={o:o.matrix_world.copy() for o in asset.objects}
jointpoints={name:proportion(o.matrix_world.translation,name) for name,o in N.items()}
for o in asset.objects:
    if o.type!='MESH': continue
    inv=worlds[o].inverted()
    for v in o.data.vertices:
        p=proportion(worlds[o]@v.co,o.parent.name)
        if o.parent.name.startswith('hand'):
            pivot=jointpoints[o.parent.name]
            p=pivot+(p-pivot)*1.15
        v.co=inv@p
# Restore world mesh frames after placing the joint origins in the reshaped body.
for name,o in N.items():
    w=worlds[o].copy(); w.translation=jointpoints[name]; o.matrix_world=w
    bpy.context.view_layer.update()
for o,w in worlds.items():
    if o.type=='MESH': o.matrix_world=w
bpy.context.view_layer.update()

# Simplify the applied smooth surfaces for the hero budget. Tiny trim meshes
# stay intact; collapse preserves the already-computed smooth vertex normals.
for o in list(asset.objects):
    if o.type != 'MESH': continue
    o.data.calc_loop_triangles()
    if len(o.data.loop_triangles) < 300: continue
    bpy.context.view_layer.objects.active=o
    dec=o.modifiers.new('Hero surface budget','DECIMATE')
    dec.ratio=.90 if o.name == 'face sculpt' else .80
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
report={'id':'npc.civilian-man-a','triangles':tris,'meshes':sum(o.type=='MESH' for o in asset.objects),'nodes_ok':not missing,'missing_nodes':missing,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
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
    prefs.compute_device_type='METAL'; prefs.get_devices()
    for d in prefs.devices: d.use=True
    scene.cycles.device='GPU'; scene.cycles.samples=int(arg('--samples',24)); scene.cycles.use_denoising=True
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
