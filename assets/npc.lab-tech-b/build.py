"""Minor Incident npc.lab-tech-b — deterministic palette-only rigid-part hero.
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

QUALITY=arg('--quality','high')
DISTANT=QUALITY=='lod2'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
ASSET_ID = HERE.name
KIND = ASSET_ID.split('.')[-1]
LAB = KIND.startswith('lab-tech')
GUARD = KIND == 'lab-guard'
FEMALE = KIND in ('lab-tech-b','depot-clerk')
asset = bpy.data.collections.new(ASSET_ID)
scene.collection.children.link(asset)
M = {}
# Every asset material reads an existing shared palette token; no textures.
COLORS = json.loads((HERE.parent.parent/'src/assets/palette.json').read_text())

def srgb(h):
    rgb = [int(h.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
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
    m.use_backface_culling = True
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
joint('hip', (0,0,.595),'root')
joint('torso',(0,0,.665),'hip')
joint('head',(0,0,1.055),'torso')
for side,s in [('L',1),('R',-1)]:
    joint('arm'+side,(0,s*.185,1.005),'torso')
    joint('foreArm'+side,(.012,s*.241,.795),'arm'+side)
    joint('hand'+side,(.025,s*.282,.625),'foreArm'+side)
    joint('leg'+side,(0,s*.098,.588),'hip')
    joint('shin'+side,(.008,s*.118,.354),'leg'+side)
    joint('foot'+side,(-.006,s*.138,.142),'shin'+side)
    joint('weaponSocket'+side,(.061,s*.28,.620),'hand'+side)
joint('backpackSocket',(-.111,0,.924),'torso')
N['root']['asset_id']=ASSET_ID
N['root']['forward']='+X'
N['root']['animation']='rigid-part'

# All helper geometry is authored in rest-world coordinates, then parented
# without changing its placement. Joint origins remain exactly at the anatomy.
def finish(o, mat, parent, sub=0):
    if DISTANT:sub=0
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
    bpy.ops.mesh.primitive_uv_sphere_add(segments=max(6,seg//3) if DISTANT else seg,ring_count=max(4,rings//3) if DISTANT else rings,location=c)
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
    b.segments=1 if DISTANT else 3
    bpy.ops.object.modifier_apply(modifier=b.name)
    w=o.modifiers.new('Corner normals','WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=w.name)
    return finish(o,mat,parent)

def loft(name, rings, mat, parent, seg=16, sub=1):
    if DISTANT:
        seg=8
        if len(rings)>4:
            keep=[0,len(rings)//3,2*len(rings)//3,len(rings)-1] if name=='face sculpt' else [0,max(range(1,len(rings)-1),key=lambda i:rings[i][3]+rings[i][4]),len(rings)-1]
            rings=[rings[i] for i in sorted(set(keep))]
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
    cu.dimensions='3D'; cu.resolution_u=1 if DISTANT or radius<.003 else 3; cu.render_resolution_u=cu.resolution_u
    cu.use_fill_caps=True; cu.bevel_depth=radius; cu.bevel_resolution=0 if DISTANT or radius<.003 else min(res,2)
    sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(points)-1)
    for p,co in zip(sp.bezier_points,points):
        p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,cu); asset.objects.link(o)
    bpy.context.view_layer.objects.active=o
    o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    return finish(o,mat,parent)

def lock(name, points, widths, depths, mat='hairWarm', normal=(1,0,0), parent='head'):
    # Flattened curved leaf/strand; rounded elliptical cross section and a tip.
    vs=[]; seg=6 if DISTANT else 10; normal=Vector(normal)
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


# Tailored shells use the accepted civilian loft/box/lock helpers. World rest
# coordinates are assigned to rigid joints without moving their anatomical pivots.
shirt = 'navy' if GUARD else 'picketWhite' if KIND=='depot-clerk' else 'backpackTeal'
trousers = 'navy' if GUARD else 'denim' if KIND=='depot-clerk' else 'backpackTeal' if KIND=='lab-tech-b' else 'khaki'
trim = 'navySeam' if GUARD else 'denimLight' if KIND=='depot-clerk' else 'tealLight' if KIND=='lab-tech-b' else 'khakiLight'
shoe = 'leather' if GUARD else 'brick' if KIND=='depot-clerk' else 'backpackTeal' if KIND=='lab-tech-b' else 'capNavy'
loft('shirt shell',[(0,0,.590,.083,.132),(0,0,.603,.098,.148),(-.006,0,.700,.104,.159),
    (-.008,0,.820,.100,.171),(0,0,.956,.083,.176),(0,0,1.016,.054,.142),(0,0,1.033,.036,.055)],shirt,'torso',24,1)
loft('neck',[(0,0,1.001,.038,.044),(0,0,1.032,.041,.045),(0,0,1.087,.046,.047)],'skinWarm','head')
# White-red horizontal bands hug the exact final subdivided blouse surface.
blouse=next(o for o in asset.objects if o.name=='shirt shell')
# White-red horizontal bands replace sections of the blouse itself instead of
# floating coplanar decals, retaining a clean striped silhouette on the back.
if KIND=='depot-clerk':
    for z in [.642,.738,.834,.930]:
        rx=.108 if z<.87 else .096; ry=.173 if z>.8 else .160
        band=loft('shirt coral stripe',[(0,0,z,rx,ry),(0,0,z+.006,rx,ry),(0,0,z+.043,rx,ry),(0,0,z+.048,rx,ry)],'brick','torso',32,0)
        bpy.context.view_layer.update();inv=band.matrix_world.inverted()
        for v in band.data.vertices:
            w=band.matrix_world@v.co;normal=Vector((w.x,w.y,0)).normalized()
            origin=Vector((normal.x*.4,normal.y*.4,w.z))
            hit,loc,_,_=blouse.ray_cast(blouse.matrix_world.inverted()@origin,blouse.matrix_world.inverted().to_3x3()@(-normal))
            if hit:v.co=inv@(blouse.matrix_world@loc+normal*.004)
# Shirt collar and open neck. Lab B wears scrubs; other staff wear a folded collar.
if KIND=='lab-tech-b':
    for s in [-1,1]:
        tube('scrub V neck',[(.035,s*.054,1.029),(.093,s*.039,.968),(.109,0,.910)],.012,'tealLight','torso',2)
else:
    for s in [-1,1]:
        verts=[(.039,s*.024,1.024),(.012,s*.060,1.039),(.077,s*.107,.977),(.109,s*.035,.989)]
        verts += [(x-.012,y,z-.006) for x,y,z in verts]
        mesh('folded shirt collar',verts,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'navySeam' if GUARD else 'brick' if KIND=='depot-clerk' else 'tealLight','torso')
    box('shirt placket',(.108,0,.825),(.014,.026,.24),shirt,'torso',.006)
    for z in [.923,.855,.787]:ell('shirt button',(.120,0,z),(.004,.006,.006),'brass' if GUARD else 'tealLight','torso',12,8)
loft('pants seat',[(0,0,.522,.075,.121),(0,0,.558,.087,.143),(0,0,.607,.085,.144),(0,0,.622,.081,.134)],trousers,'hip',24,1)
loft('waistband',[(0,0,.602,.088,.146),(0,0,.614,.089,.148),(0,0,.635,.084,.141)],'leather' if GUARD else trim,'hip',24,1)
if GUARD or KIND=='lab-tech-a':
    box('belt buckle',(.105,0,.620),(.018,.064,.036),'brass','hip',.005)
    box('buckle inset',(.117,0,.620),(.005,.045,.021),'leather','hip',.002)
for side,s in [('L',1),('R',-1)]:
    arm='arm'+side; fore='foreArm'+side; hand='hand'+side
    loft('upper arm '+side,[(.010,s*.241,.784,.043,.043),(0,s*.231,.840,.049,.048),(0,s*.196,.958,.052,.052),(0,s*.185,1.011,.045,.048)],'skinWarm',arm,20,1)
    ell('elbow '+side,(.012,s*.241,.795),(.042,.044,.042),'skinWarm',fore)
    sleeve_bottom=.848 if GUARD or KIND=='depot-clerk' else .834
    loft('shirt sleeve '+side,[(0,s*.231,sleeve_bottom,.064,.062),(0,s*.226,sleeve_bottom+.020,.066,.062),(-.006,s*.198,.971,.066,.066),(-.008,s*.181,1.013,.046,.047)],'picketWhite' if LAB else shirt,arm,24,1)
    loft('rolled sleeve cuff '+side,[(0,s*.234,sleeve_bottom-.007,.065,.064),(0,s*.234,sleeve_bottom+.001,.069,.067),(0,s*.229,sleeve_bottom+.026,.069,.066),(0,s*.226,sleeve_bottom+.033,.063,.062)],'picketWhite' if LAB else 'navySeam' if GUARD else 'brick',arm,24,1)
    if KIND=='depot-clerk':
        loft('coral sleeve stripe',[(0,s*.211,.901,.069,.065),(0,s*.210,.906,.070,.066),(0,s*.201,.931,.070,.067),(0,s*.200,.935,.068,.065)],'brick',arm,24,0)
    loft('forearm '+side,[(.025,s*.282,.620,.031,.033),(.021,s*.277,.650,.032,.034),(.014,s*.259,.736,.042,.043),(.012,s*.241,.799,.041,.042),(.012,s*.241,.816,.035,.036)],'skinWarm',fore,20,1)
    hand_mat='policeBlue' if LAB else 'skinWarm'
    if LAB:
        loft('nitrile glove cuff '+side,[(.025,s*.282,.618,.037,.039),(.025,s*.281,.623,.043,.043),(.024,s*.278,.659,.043,.043),(.025,s*.278,.668,.037,.039)],hand_mat,hand,20,1)
    ell('palm '+side,(.028,s*.292,.592),(.039,.043,.050),hand_mat,hand,24,12)
    for i in range(4):
        y=s*(.270+i*.017)
        tube('finger '+side+str(i),[(.036,y,.590),(.046,y,.552),(.040,y,.525+(.007 if i in (0,3) else 0))],.012,hand_mat,hand,2)
        ell('knuckle '+side+str(i),(.051,y,.583),(.010,.011,.012),hand_mat,hand,12,8)
    tube('thumb '+side,[(.044,s*.263,.605),(.070,s*.257,.581),(.074,s*.264,.566)],.014,hand_mat,hand,2)
    p='leg'+side
    loft('trouser thigh '+side,[(.008,s*.118,.344,.062,.064),(.007,s*.117,.362,.067,.068),(0,s*.108,.479,.076,.080),(0,s*.098,.579,.076,.080),(0,s*.098,.597,.064,.068)],trousers,p,24,1)
    loft('trouser shin '+side,[(-.008,s*.138,.166,.054,.059),(-.010,s*.138,.186,.064,.069),(-.006,s*.135,.239,.056,.063),(.003,s*.123,.310,.059,.063),(.008,s*.118,.358,.064,.065),(.008,s*.118,.372,.056,.058)],trousers,'shin'+side,24,1)
    ell('knee cloth '+side,(.008,s*.118,.354),(.061,.064,.048),trousers,'shin'+side,20,12)
    loft('trouser cuff '+side,[(-.011,s*.138,.164,.056,.061),(-.013,s*.138,.178,.067,.071),(-.011,s*.138,.200,.067,.071),(-.012,s*.138,.213,.058,.063)],trim,'shin'+side,24,1)
    tube('thigh seam',[(.001,s*.170,.574),(.002,s*.189,.451),(.003,s*.180,.362)],.0017,trim,p,1)
    tube('shin seam',[(.003,s*.181,.345),(-.005,s*.193,.250),(-.012,s*.205,.185)],.0017,trim,'shin'+side,1)
    if GUARD:
        box('cargo pocket '+side,(.011,s*.192,.470),(.101,.027,.124),'navySeam',p,.012)
        box('cargo pocket flap '+side,(.014,s*.211,.526),(.111,.015,.036),'navy',p,.009)
        ell('cargo snap '+side,(.014,s*.222,.520),(.005,.004,.005),'uiDark',p,8,6)
    foot='foot'+side;y=s*.138
    box('shoe sole '+side,(.037,y,.037),(.238,.151,.074),'leather' if GUARD else 'picketWhite',foot,.024)
    box('shoe midsole '+side,(.037,y,.063),(.236,.149,.050),'leatherEdge' if GUARD else 'picketWhite',foot,.020)
    loft('shoe upper '+side,[(.034,y,.066,.106,.066),(.035,y,.079,.114,.070),(.015,y,.125,.097,.067),(-.025,y,.160,.054,.058),(-.026,y,.187,.049,.053)],shoe,foot,24,1)
    ell('shoe toe '+side,(.112,y,.094),(.046,.064,.034),'leather' if GUARD else 'picketWhite',foot,20,12)
    box('shoe tongue '+side,(.033,y,.147),(.035,.069,.083),shoe if GUARD else 'picketWhite',foot,.014,rot=(0,-.28,0))
    for d in [-1,1]:
        if not GUARD:box('sneaker side panel '+side,(.013,y+d*.068,.105),(.065,.009,.035),'picketWhite',foot,.006,rot=(0,-.25,0))
        for j in range(6):box('sole tread '+side,(-.055+j*.032,y+d*.073,.028),(.012,.009,.014),'uiDark' if GUARD else shoe,foot,.002)
    for j in range(4):
        x=.086-j*.014;z=.123+j*.011
        for dy in [-.034,.034]:ell('lace eyelet',(x,y+dy,z),(.004,.006,.004),'brass' if GUARD else 'silver',foot,8,6)
        tube('shoe lace',[(x,y-.032,z+.005),(x+.006,y,z+.010),(x-.005,y+.032,z+.007)],.0036,'leatherEdge' if GUARD else 'picketWhite',foot,1)
    box('heel tab '+side,(-.079,y,.149),(.011,.047,.026),'leatherEdge' if GUARD else 'picketWhite',foot,.004)
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
    if DISTANT and i%3:continue
    if GUARD and c>0:continue
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
for i,(pts,widths) in enumerate([] if GUARD else bangs):
    if DISTANT and i%2:continue
    lock('swept fringe '+str(i),pts,widths,[.014]+[.024]*(len(pts)-2)+[.001], 'hairWarm' if i%2==0 else 'hairChestnut')
for s in [-1,1]:
    lock('temple sideburn',[(.012,s*.139,1.304),(.041,s*.163,1.265),(.045,s*.158,1.213),(.050,s*.14,1.182)],
         [.022,.027,.020,.001],[.013,.020,.014,.001],'hairChestnut',normal=(.3,s,0))
    lock('side flick',[(0,s*.134,1.313),(-.028,s*.166,1.288),(-.062,s*.190,1.253),(-.053,s*.201,1.267)],
         [.020,.032,.027,.001],[.012,.020,.016,.001],'hairWarm',normal=(0,s,0))
# A few silhouette tips create the tousled top without a noisy strand cage.
for pts in ([] if GUARD or FEMALE else [
    [(-.08,-.035,1.345),(-.04,-.045,1.391),(.010,-.015,1.420),(.055,.002,1.409)],
    [(-.06,.025,1.350),(-.035,.010,1.383),(-.043,-.025,1.413),(-.076,-.060,1.401)],
]):
    lock('crown tuft',pts,[.027,.034,.023,.001],[.010,.014,.012,.001],'hairWarm',normal=(0,-1,0))
for s in ([] if GUARD else [-1,1]):
    tube('fringe sheen',[(.048,s*.035,1.37),(.117,s*.083,1.335),(.13,s*.125,1.302)],.0017,'hairHighlight','head',1)

# Open-front coat sector. Solidified edges and a clean chest gap preserve the
# teal shirt while the entire coat remains owned by the torso animation joint.
def sector(name,rings,angle0,angle1,mat,parent,segments=32,thickness=.010):
    if DISTANT:segments=12
    verts=[]
    for z,rx,ry in rings:
        for j in range(segments+1):
            a=angle0+(angle1-angle0)*j/segments
            verts.append((rx*math.cos(a),ry*math.sin(a),z))
    faces=[];n=segments+1
    for k in range(len(rings)-1):
        for j in range(segments):
            a=k*n+j;faces.append((a,a+1,a+1+n,a+n))
    o=mesh(name,verts,faces,mat,parent)
    bpy.context.view_layer.objects.active=o
    sol=o.modifiers.new('Tailored shell thickness','SOLIDIFY');sol.thickness=thickness;sol.offset=0
    bpy.ops.object.modifier_apply(modifier=sol.name)
    be=o.modifiers.new('Soft shell edges','BEVEL');be.width=.003;be.segments=2
    bpy.ops.object.modifier_apply(modifier=be.name)
    return o

def panel(name,coords,mat,parent,depth=.012):
    verts=coords+[(x-depth,y,z) for x,y,z in coords];n=len(coords)
    faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    o=mesh(name,verts,faces,mat,parent)
    bpy.context.view_layer.objects.active=o
    b=o.modifiers.new('Rounded panel edge','BEVEL');b.width=.005;b.segments=1 if DISTANT else 3;bpy.ops.object.modifier_apply(modifier=b.name)
    return o

if LAB:
    sector('open laboratory coat',[(.510,.129,.184),(.526,.132,.187),(.610,.122,.178),(.760,.118,.180),(.884,.113,.189),(.980,.098,.181),(1.018,.061,.129)],.48,2*math.pi-.48,'picketWhite','torso',40,.014)
    for s in [-1,1]:
        panel('coat lapel',[(.056,s*.045,1.028),(.060,s*.096,1.018),(.110,s*.126,.946),(.132,s*.089,.904),(.139,s*.069,.831),(.122,s*.049,.913)],'picketWhite','torso')
        tube('lapel stitch',[(.066,s*.096,1.012),(.118,s*.126,.948),(.138,s*.089,.906),(.143,s*.069,.834)],.0016,'teeSeam','torso',1)
        box('coat pocket',(.109,s*.129,.622),(.031,.077,.090),'picketWhite','torso',.009,rot=(0,0,s*.24))
        tube('coat pocket welt',[(.132,s*.092,.666),(.129,s*.128,.670),(.117,s*.167,.666)],.0038,'teeSeam','torso',1)
        for z in [.738,.584]:ell('coat button',(.135,s*.071,z),(.004,.008,.008),'silver','torso',12,8)
    tube('coat back yoke',[(-.108,-.127,.930),(-.120,0,.923),(-.108,.127,.930)],.002,'teeSeam','torso',1)
    tube('coat back seam',[(-.126,0,.915),(-.136,0,.703),(-.145,0,.530)],.0015,'teeSeam','torso',1)
    for s in [-1,1]:tube('ID lanyard',[(.058,s*.042,1.015),(.115,s*.045,.922),(.126,0,.802)],.004,'tealDark','torso',2)
    box('ID holder',(.137,0,.762),(.018,.070,.090),'leather','torso',.005)
    box('ID card',(.148,0,.763),(.008,.057,.077),'picketWhite','torso',.003)
    box('ID portrait',(.155,0,.774),(.005,.021,.033),'polo','torso',.002)
    ell('ID portrait face',(.160,0,.784),(.003,.007,.008),'skinWarm','torso',8,6)
    for z in [.744,.735]:box('ID printed line',(.157,0,z),(.003,.035,.003),'silver','torso',.001)
    box('breast pen',(.110,.132,.941),(.013,.007,.051),'brick','torso',.002)
    if KIND=='lab-tech-a':
        # Goggles remain opaque palette geometry; frame is NOT uiDark/eyeBrown,
        # which the infection overlay reserves for pupil glow on the head.
        for s in [-1,1]:
            box('goggle lens',(.139,s*.069,1.340),(.023,.113,.064),'lavenderShadow','head',.018,rot=(0,.14,-s*.25))
            pts=[]
            for j in range(33):
                a=2*math.pi*j/32;pts.append((.156,s*.069+.054*math.cos(a),1.340+.032*math.sin(a)))
            tube('goggle rim',pts,.007,'silver','head',2)
            tube('goggle strap',[(.098,s*.125,1.346),(-.018,s*.184,1.335),(-.139,s*.117,1.303)],.012,'capNavy','head',2)
        tube('goggle bridge',[(.161,-.019,1.344),(.175,0,1.357),(.161,.019,1.344)],.006,'silver','head',2)
        # Clipboard and bent forearm share the right-hand joint, so gestures do
        # not detach the accessory. Rest transform is applied to the whole limb.
        box('clipboard',(.027,-.326,.613),(.023,.158,.242),'leather','handR',.008,rot=(0,-.12,-.18))
        box('clipboard paper',(.042,-.326,.620),(.006,.133,.208),'canvasTan','handR',.004,rot=(0,-.12,-.18))
        box('clipboard clip',(.056,-.326,.734),(.014,.065,.021),'silver','handR',.005)
        for z in [.673,.648,.623]:box('clipboard note',(.059,-.326,z),(.004,.088,.003),'khakiSeam','handR',.001)
        N['foreArmR'].rotation_euler.y=math.radians(-58)
        N['handR'].rotation_euler.y=math.radians(58)
    else:
        # Net shell hugs the swept crown and rear bun, open at the fringe.
        verts=[];faces=[];seg=32;rows=12
        for k in range(rows):
            phi=.045+1.58*k/(rows-1)
            for j in range(seg+1):
                a=.70+(2*math.pi-1.40)*j/seg
                verts.append((-.033+.174*math.sin(phi)*math.cos(a),.194*math.sin(phi)*math.sin(a),1.209+.188*math.cos(phi)))
        for k in range(rows-1):
            for j in range(seg):
                n=k*(seg+1)+j;faces.append((n,n+1,n+seg+2,n+seg+1))
        net=mesh('hairnet crown',verts,faces,'hairChestnut','head')
        bpy.context.view_layer.objects.active=net
        sol=net.modifiers.new('Net thickness','SOLIDIFY');sol.thickness=.006;bpy.ops.object.modifier_apply(modifier=sol.name)
        for phi in [.28,.54,.80,1.06,1.32,1.58]:
            tube('net crown latitude',[(-.033+.178*math.sin(phi)*math.cos(.70+(2*math.pi-1.40)*j/48),.198*math.sin(phi)*math.sin(.70+(2*math.pi-1.40)*j/48),1.209+.192*math.cos(phi)) for j in range(49)],.0022,'lavenderLight','head',1)
        for a in [.70+i*(2*math.pi-1.4)/12 for i in range(13)]:
            tube('net crown longitude',[(-.033+.178*math.sin(.045+1.58*j/24)*math.cos(a),.198*math.sin(.045+1.58*j/24)*math.sin(a),1.209+.192*math.cos(.045+1.58*j/24)) for j in range(25)],.0022,'lavenderLight','head',1)
        ell('hairnet bun',(-.167,.020,1.337),(.097,.110,.102),'hairChestnut','head',24,14)
        for t in [-.65,-.35,0,.35,.65]:
            r=math.sqrt(1-t*t)
            for axis in [0,1]:
                points=[]
                for j in range(33):
                    a=2*math.pi*j/32
                    p=(-.167+.100*r*math.cos(a),.020+.113*r*math.sin(a),1.337+.105*t) if axis==0 else (-.167+.100*r*math.cos(a),.020+.113*t,1.337+.105*r*math.sin(a))
                    points.append(p)
                tube('hairnet bun lattice',points,.0026,'lavenderLight','head',1)
        # Mask lowered beneath the mouth, leaving both eye materials exposed.
        panel('lowered surgical mask',[(.109,-.090,1.122),(.133,-.049,1.085),(.143,.049,1.085),(.109,.090,1.122)],'poloLight','head',.009)
        for z in [1.098,1.109]:tube('mask pleat',[(.139,-.047,z),(.148,0,z-.005),(.139,.047,z)],.0022,'picketWhite','head',1)
        for s in [-1,1]:tube('mask ear loop',[(.113,s*.088,1.117),(.061,s*.163,1.166),(.044,s*.167,1.141),(.115,s*.089,1.094)],.0028,'picketWhite','head',1)

if GUARD:
    loft('uniform cap crown',[(-.025,0,1.300,.151,.175),(-.026,0,1.315,.163,.183),(-.038,0,1.390,.148,.170),(-.053,0,1.434,.112,.136),(-.058,0,1.451,.025,.031)],'capNavy','head',32,1)
    ell('cap peak',(.145,0,1.313),(.115,.186,.014),'capNavy','head',32,12)
    tube('cap front seam',[(.141,-.110,1.338),(.149,0,1.349),(.141,.110,1.338)],.002,'navySeam','head',1)
    box('cap back closure',(-.194,0,1.324),(.015,.086,.032),'leather','head',.007)
    # Beard uses broad continuous volumes framing the mouth, never pupils.
    for s in [-1,1]:
        lock('beard side',[(.011,s*.139,1.211),(.055,s*.135,1.173),(.090,s*.115,1.128),(.105,s*.075,1.091),(.081,s*.026,1.065)],[.020,.032,.039,.046,.001],[.017,.022,.026,.025,.001],'hairChestnut',normal=(.8,s*.7,0))
        ell('moustache',(.149,s*.023,1.151),(.016,.032,.014),'hairChestnut','head',20,10)
    ell('beard chin',(.074,0,1.073),(.052,.099,.038),'hairChestnut','head',24,12)
    for s in [-1,1]:
        box('uniform epaulette',(0,s*.133,1.012),(.127,.041,.015),'navySeam','torso',.006)
        box('chest pocket',(.112,s*.093,.867),(.022,.097,.087),'navy','torso',.012)
        box('pocket flap',(.128,s*.093,.902),(.011,.102,.031),'navySeam','torso',.005)
        box('shoulder patch',(.055,s*.256,.932),(.039,.018,.068),'picketWhite','arm'+('L' if s==1 else 'R'),.009)
        box('patch inset',(.060,s*.268,.933),(.022,.008,.047),'capNavy','arm'+('L' if s==1 else 'R'),.006)
        box('duty belt pouch',(.001,s*.163,.613),(.074,.044,.089),'leather','hip',.009)
        box('duty pouch flap',(.004,s*.188,.650),(.080,.015,.027),'leatherEdge','hip',.005)
        ell('duty pouch snap',(.010,s*.198,.644),(.006,.004,.006),'brass','hip',8,6)
    box('chest GBD patch',(.143,-.085,.938),(.010,.092,.045),'picketWhite','torso',.004)
    box('shoulder radio',(.131,.121,.957),(.049,.054,.077),'uiDark','torso',.008)
    tube('radio antenna',[(.131,.130,.989),(.123,.135,1.061)],.0035,'uiDark','torso',1)
    for z in [.945,.954,.963]:box('radio grille',(.159,.120,z),(.004,.035,.003),'silver','torso',.001)
    tube('radio cable',[(.124,.147,.938),(.122,.170,.863),(.101,.179,.787),(.030,.169,.650)],.004,'uiDark','torso',2)
    box('rear duty pouch',(-.102,.086,.613),(.047,.082,.083),'leather','hip',.008)
    def text(name,value,pos,size,mat,parent,back=False):
        cu=bpy.data.curves.new(name,'FONT');cu.body=value;cu.size=size;cu.align_x='CENTER';cu.align_y='CENTER';cu.extrude=.001;cu.bevel_depth=.0004;cu.bevel_resolution=1
        o=bpy.data.objects.new(name,cu);asset.objects.link(o);o.location=pos;o.rotation_euler=(math.pi/2,0,-math.pi/2 if back else math.pi/2)
        bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
        o=finish(o,mat,parent)
        if name=='cap letters' or back:
            shell=bpy.data.objects['uniform cap crown'] if name=='cap letters' else bpy.data.objects['shirt shell']
            normal=Vector((-1,0,0)) if back else Vector((1,0,0))
            bpy.context.view_layer.update();inv=shell.matrix_world.inverted();inv_o=o.matrix_world.inverted()
            for v in o.data.vertices:
                w=o.matrix_world@v.co;hit,loc,_,_=shell.ray_cast(inv@(w+normal*.3),inv.to_3x3()@(-normal))
                if hit:v.co=inv_o@(shell.matrix_world@loc+normal*.005)
        return o
    text('cap letters','GBD',(.152,0,1.379),.043,'picketWhite','head')
    text('badge letters','GBD',(.151,-.085,.938),.022,'navy','torso')
    text('back letters','GBD',(-.123,0,.953),.060,'picketWhite','torso',True)
    text('back security','SECURITY',(-.130,0,.897),.032,'picketWhite','torso',True)

if KIND=='depot-clerk':
    # Rounded bun with layered hair locks and restrained surface highlights.
    ell('high hair bun',(-.115,.017,1.382),(.111,.118,.102),'hairChestnut','head',28,16)
    for i in range(8):
        a=i*2*math.pi/8;c=math.cos(a);s=math.sin(a)
        lock('bun lock', [(-.115+.042*c,.017+.044*s,1.476),(-.115+.099*c,.017+.106*s,1.427),(-.115+.116*c,.017+.124*s,1.382),(-.115+.091*c,.017+.098*s,1.326)],[.018,.025,.025,.001],[.012,.016,.016,.001],'hairWarm',normal=(c,s,.2))
    # Spectacles: solid dimensional rims and bridge, no opaque lenses.
    for s in [-1,1]:
        y=s*.065
        tube('round spectacle rim',[(.153,y+.047*math.cos(j*2*math.pi/48),1.207+.049*math.sin(j*2*math.pi/48)) for j in range(49)],.0052,'leather','head',2)
        tube('spectacle temple',[(.153,s*.111,1.213),(.084,s*.170,1.220),(.004,s*.181,1.192)],.004,'leather','head',2)
    tube('spectacle bridge',[(.155,-.019,1.215),(.162,0,1.222),(.155,.019,1.215)],.004,'leather','head',2)
    tube('ear pencil',[(.015,.183,1.216),(.056,.177,1.278),(.105,.166,1.348)],.005,'schoolBusYellow','head',1)
    ell('pencil eraser',(.106,.166,1.350),(.006,.006,.009),'brick','head',10,6)
    # Apron bib and rounded skirt leave the back blouse and jeans visible.
    box('apron bib',(.135,0,.821),(.035,.253,.282),'backpackTeal','torso',.018)
    sector('apron skirt',[(.430,.142,.187),(.448,.145,.191),(.581,.132,.184),(.680,.126,.178),(.700,.121,.162)],-.5*math.pi,.5*math.pi,'backpackTeal','torso',32,.013)
    for s in [-1,1]:
        tube('apron neck strap',[(.141,s*.095,.924),(.056,s*.088,1.026),(-.094,s*.091,1.000)],.018,'tealLight','torso',2)
        tube('apron crossed back strap',[(-.100,s*.094,1.008),(-.125,s*.084,.925),(-.136,-s*.071,.751),(-.142,-s*.135,.698)],.014,'backpackTeal','torso',2)
    sector('apron waist tie',[(.675,.130,.180),(.698,.131,.183),(.715,.125,.178)],.02,2*math.pi-.02,'tealLight','torso',40,.009)
    box('apron front pocket',(.151,0,.553),(.023,.224,.135),'tealLight','torso',.016)
    tube('apron pocket stitch',[(.167,-.096,.599),(.168,-.090,.507),(.173,0,.497),(.168,.090,.507),(.167,.096,.599)],.002,'backpackTeal','torso',1)
    tube('apron pocket divider',[(.173,0,.605),(.177,0,.498)],.0018,'backpackTeal','torso',1)
    box('clerk name badge',(.153,-.074,.918),(.012,.072,.033),'picketWhite','torso',.005)
    box('name badge mark',(.161,-.087,.919),(.003,.018,.008),'brick','torso',.002)
    box('name badge line',(.161,-.060,.919),(.003,.022,.003),'silver','torso',.001)
    ell('apron bow knot',(-.159,0,.690),(.014,.021,.023),'tealLight','torso',16,10)
    for s in [-1,1]:
        tube('apron bow loop',[(-.159,0,.694),(-.165,s*.074,.724),(-.167,s*.086,.686),(-.159,0,.694)],.010,'tealLight','torso',2)
        tube('apron bow tail',[(-.160,s*.012,.686),(-.168,s*.041,.632),(-.173,s*.071,.571)],.012,'backpackTeal','torso',2)
    loft('watch strap',[(.020,.281,.642,.037,.039),(.020,.279,.657,.038,.040),(.020,.277,.670,.033,.036)],'leather','foreArmL',20,1)
    ell('watch face',(.061,.279,.657),(.012,.025,.025),'leather','foreArmL',20,10)
    tube('watch hands',[(.075,.279,.670),(.075,.279,.657),(.075,.290,.653)],.0015,'picketWhite','foreArmL',1)

# Chibi breadth is built into the common face; the guard has a broader uniform.
bpy.context.view_layer.update()
worlds={o:o.matrix_world.copy() for o in asset.objects}
def reshape(p,part):
    p=p.copy()
    # Compact legs, broader hands/torso, and a slightly larger adult chibi head.
    if p.z>.14 and p.z<.60:p.z=.14+(p.z-.14)*.80
    elif p.z>=.60:p.z-=.092
    p.y*=1.12;p.x*=1.06
    if part=='head':
        p.y*=1.13;p.x*=1.08;p.z=1.128+(p.z-1.128)*1.12
    if GUARD and part!='head':p.y*=1.30;p.x*=1.22
    return p
points={n:reshape(o.matrix_world.translation,n) for n,o in N.items()}
for o,w in worlds.items():
    if o.type=='MESH':
        inv=w.inverted()
        for v in o.data.vertices:
            point=reshape(w@v.co,o.parent.name)
            if DISTANT and KIND=='depot-clerk':point.x*=.90
            v.co=inv@point
for n,o in N.items():
    w=worlds[o].copy();w.translation=points[n];o.matrix_world=w;bpy.context.view_layer.update()
for o,w in worlds.items():
    if o.type=='MESH':o.matrix_world=w
bpy.context.view_layer.update()
# Ground contact normalization (guard anatomy reshaping extends below zero).
minimum=min((o.matrix_world@v.co).z for o in asset.objects if o.type=='MESH' for v in o.data.vertices)
N['root'].location.z-=minimum
joint('front',(.19,0,.80),'root');N['front']['front']=True
if KIND=='lab-tech-a':
    # Caps live on the retained parent at the detachable joint location.
    for name in ['head','armL','armR','foreArmL','foreArmR','legL','legR']:
        node=N[name];pos=node.matrix_world.translation.copy();parent=node.parent.name
        o=ell('stump_'+name,pos,(.036,.038,.010),'blood',parent,16,8)
        if name.startswith(('arm','foreArm')):o.rotation_euler.x=math.pi/2
        o['hidden']=True;o['stump']=name;o.hide_render=True
        N['stump_'+name]=o
# The distant tier removes subpixel tailoring and ornaments, retaining every
# rigid pivot, skin surface, pupil tag and outfit/accessory silhouette.
if DISTANT:
    detail=['stitch','seam','glint small','knuckle','eyelet','shoe lace','tread','portrait','printed line','clipboard note','radio grille','watch hands','pencil eraser','cap letters','badge letters','back letters','back security','mask pleat','net crown latitude','net crown longitude','hairnet bun lattice','fringe sheen','cargo snap','nostril','nose light','lower lid','finger','side flick','coat button','coat pocket welt','nitrile glove cuff','ear inner','cheek blush','goggle rim','watch face','watch strap','name badge','apron pocket divider']
    for o in list(asset.objects):
        if o.type=='MESH' and any(word in o.name for word in detail):bpy.data.objects.remove(o,do_unlink=True)
# Applied smoothing supplies rich hero forms; budget dense shells before join.
for o in list(asset.objects):
    if o.type!='MESH' or o.name.startswith('stump_'):continue
    o.data.calc_loop_triangles()
    if len(o.data.loop_triangles)<(30 if DISTANT else 250):continue
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('Hero surface budget','DECIMATE')
    if DISTANT:
        minimum=96 if o.name=='face sculpt' else 40 if any(word in o.name for word in ['shirt shell','upper arm','forearm','pants seat','trouser thigh','trouser shin','knee cloth','shoe upper','hair scalp','palm']) else 12
        mod.ratio=min(1,max(.13,minimum/len(o.data.loop_triangles)))
    else:mod.ratio=.78
    bpy.ops.object.modifier_apply(modifier=mod.name)

# Join static surfaces per material and rigid owner; never across joints.
def consolidate():
    groups={}
    for o in list(asset.objects):
        if o.type=='MESH' and not o.name.startswith('stump_'):
            groups.setdefault((o.parent.name,o.data.materials[0].name),[]).append(o)
    for (parent,mat),objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        o=bpy.context.object;o.name=parent+'.'+mat;o.select_set(False)
consolidate()
# Recalculate outward closed-surface normals and delete zero-area bevel slivers.
for o in asset.objects:
    if o.type!='MESH':continue
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='FIXED',ngon_method='EAR_CLIP')
    bad=[f for f in bm.faces if f.calc_area()<1e-10]
    if bad:bmesh.ops.delete(bm,geom=bad,context='FACES_ONLY')
    bm.to_mesh(o.data);bm.free();o.data.update()
# CPU AO is baked into the active COLOR_0 for runtime palette shading.
if '--skip-ao' not in ARGS:
    sys.path.insert(0,str(HERE.parent.parent/'tools/blender'))
    from sslib.ao import bake_all
    bake_all([o for o in asset.objects if o.type=='MESH' and not o.name.startswith('stump_')],samples=32)
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','weaponSocketR','weaponSocketL','backpackSocket']
missing=[n for n in required if n not in asset.objects]
for o in asset.objects:
    if o.type=='MESH':o.data.calc_loop_triangles()
tris=sum(len(o.data.loop_triangles) for o in asset.objects if o.type=='MESH')
report={'id':ASSET_ID,'triangles':tris,'meshes':sum(o.type=='MESH' for o in asset.objects),'nodes_ok':not missing,'missing_nodes':missing,'palette_tokens':sorted({m.name for o in asset.objects if o.type=='MESH' for m in o.data.materials})}
(HERE/('build-stats.lod2.json' if DISTANT else 'build-stats.json')).write_text(json.dumps(report,indent=2)+'\n')
print('BUILD OK',json.dumps(report))
if arg('--glb'):
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset.objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
    print('GLB OK',arg('--glb'))

def test_pose():
    N['armL'].rotation_euler.x=math.radians(65)
    N['foreArmL'].rotation_euler.y=math.radians(-70)
    N['legR'].rotation_euler.y=math.radians(-28)
    N['shinR'].rotation_euler.y=math.radians(35)
    bpy.context.view_layer.update()

if '--pose-test' in ARGS:test_pose()
if '--infection-test' in ARGS:
    M['skinWarm'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=srgb(COLORS['infectedSkin'])
    for token in ['eyeBrown','uiDark']:
        bs=M[token].node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=srgb(COLORS['infectedEye']);bs.inputs['Emission Color'].default_value=srgb(COLORS['infectedEye']);bs.inputs['Emission Strength'].default_value=2
    N['torso'].rotation_euler.y=.17;N['armL'].rotation_euler.y=-.55;N['foreArmL'].rotation_euler.y=-.55
    bpy.context.view_layer.update()

def stage(view):
    world=bpy.data.worlds.new('Warm review studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.12,.14,.18,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
    def area(name,loc,power,size,color):
        ld=bpy.data.lights.new(name,'AREA');ld.energy=power;ld.shape='DISK';ld.size=size;ld.color=color
        o=bpy.data.objects.new(name,ld);scene.collection.objects.link(o);o.location=loc
        o.rotation_euler=(Vector((0,0,.78))-Vector(loc)).to_track_quat('-Z','Y').to_euler()
    area('soft key',(3,-4,5),420,4,(1,.83,.70));area('cool fill',(2,4,3),270,3,(.73,.83,1));area('gold rim',(-3,-1,3.7),500,3,(1,.61,.34))
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.location.z=-.005
    gm=bpy.data.materials.new('Studio');gm.diffuse_color=(.026,.023,.035,1);gm.use_nodes=True
    bs=gm.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=gm.diffuse_color;bs.inputs['Roughness'].default_value=.85;ground.data.materials.append(gm)
    cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));scene.collection.objects.link(cam);scene.camera=cam;cam.data.type='ORTHO'
    target=Vector((0,0,.74));directions={'front':(5,0,.28),'side':(0,-5,.28),'back':(-5,0,.28),'ref':(6.3,-4.7,2.0),'game':(5,-5,5.14)}
    cam.location=target+Vector(directions[view]);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=int(arg('--width',960));scene.render.resolution_y=int(arg('--height',540));scene.render.resolution_percentage=100
    cam.data.ortho_scale=1.68*scene.render.resolution_x/scene.render.resolution_y
    scene.render.engine='CYCLES' if '--cpu-render' in ARGS else 'BLENDER_EEVEE'
    scene.cycles.device='CPU';scene.cycles.samples=int(arg('--samples',24));scene.cycles.use_denoising=True
    if hasattr(scene,'eevee') and hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=int(arg('--samples',24))
    scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    return target,directions
if arg('--render'):
    target,views=stage(arg('--view','game'));dest=Path(arg('--render')).resolve();dest.parent.mkdir(parents=True,exist_ok=True)
    scene.render.filepath=str(dest);bpy.ops.render.render(write_still=True);print('RENDER OK',str(dest))
    if '--deliverables' in ARGS:
        scene.render.resolution_x=960;scene.render.resolution_y=540;scene.camera.data.ortho_scale=1.68*960/540
        if hasattr(scene,'eevee') and hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=24
        for label in ['front','side','back','ref','game']:
            scene.camera.location=target+Vector(views[label]);scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(HERE/'renders'/('final-'+label+'.png'));bpy.ops.render.render(write_still=True)
        test_pose();scene.render.filepath=str(HERE/'renders'/'pose-test.png');bpy.ops.render.render(write_still=True)
        print('DELIVERABLES OK',ASSET_ID)
