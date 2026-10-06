"""Minor Incident female survivor — deterministic sculpted rigid-part hero.
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
asset = bpy.data.collections.new('Survivor')
scene.collection.children.link(asset)
M = {}
# Identity tokens use spec values; additional flat palette entries describe skin,
# hair, denim and small trims absent from the starter palette (no textures).
COLORS = {
    'survivorRed':'d9363e', 'backpackTeal':'2f6e6a', 'picketWhite':'f2e6dc',
    'uiDark':'25222c', 'woodWarm':'b0703f', 'skinWarm':'f2a77f',
    'skinBlush':'e49b8c', 'skinShadow':'cf795b', 'hairChestnut':'4a2925',
    'hairWarm':'63362b', 'hairHighlight':'85503a', 'denim':'48516c',
    'denimLight':'616b85', 'denimStitch':'9591a1', 'tealDark':'234f50',
    'tealLight':'448580', 'brass':'d49a57', 'redDark':'9e2938',
    'corgiOrange':'ec9b48', 'eyeBrown':'542920', 'mouth':'a34743',
    'bandage':'eac19f', 'sockBlue':'434e69',
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
    if token == 'brass':
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
    joint('arm'+side,(0,s*.172,1.005),'torso')
    joint('foreArm'+side,(.012,s*.235,.843),'arm'+side)
    joint('hand'+side,(.025,s*.282,.680),'foreArm'+side)
    joint('leg'+side,(0,s*.094,.658),'hip')
    joint('shin'+side,(.008,s*.112,.425),'leg'+side)
    joint('foot'+side,(-.006,s*.13,.142),'shin'+side)
    joint('weaponSocket'+side,(.061,s*.28,.620),'hand'+side)
joint('backpackSocket',(-.111,0,.924),'torso')
N['root']['asset_id']='char.survivor-female'
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
    cu.bevel_depth=radius; cu.bevel_resolution=min(res,2)
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

# Torso and white cotton tee: a fitted waist, flared hem, smooth shoulders.
loft('tee.shell',[(0,0,.745,.075,.12),(0,0,.753,.085,.135),(0,0,.79,.086,.127),
    (-.005,0,.88,.085,.131),(0,0,.959,.072,.154),(0,0,1.001,.055,.122),
    (0,0,1.016,.037,.061)],'picketWhite','torso',24,1)
loft('neck',[(0,0,1.005,.034,.04),(0,0,1.022,.037,.04),(0,0,1.086,.04,.044)],'skinWarm','head')
tube('ribbed neckline',[(.043,-.052,1.010),(.066,-.035,.993),(.071,0,.987),(.066,.035,.993),(.043,.052,1.010)],.009,'sockBlue','torso')
# Red open jacket follows the back and sides; front leaves the white tee exposed.
for s in [-1,1]:
    loft('jacket side', [(-.039,s*.108,.756,.056,.035),(-.032,s*.117,.765,.059,.045),
        (-.034,s*.122,.876,.067,.044),(-.025,s*.125,.967,.055,.046),
        (-.031,s*.103,1.007,.035,.034)],'survivorRed','torso',16,1)
    tube('jacket open edge',[(.012,s*.13,.765),(.024,s*.15,.87),(.021,s*.141,.958)],.006,'redDark','torso')
box('jacket back',(-.082,0,.878),(.047,.25,.24),'survivorRed','torso',.028)
# White folded hood sitting over the red back panel.
loft('hood folded', [(-.068,0,.972,.048,.080),(-.070,0,.987,.065,.112),
    (-.069,0,1.021,.064,.121),(-.044,0,1.046,.040,.097)],'picketWhite','torso',20,1)
tube('hood edge',[(-.02,-.10,1.032),(-.097,-.08,1.029),(-.13,0,1.009),(-.097,.08,1.029),(-.02,.10,1.032)],.006,'denimLight','torso')
# Chest emblem modeled in relief.
ell('tee red emblem',(.092,-.052,.91),(.008,.026,.030),'survivorRed','torso')
ell('emblem drip',(.094,-.052,.882),(.007,.007,.014),'survivorRed','torso',8,6)

# Shorts with separate leg shells, turned cuffs, waistband, belt and tailoring.
loft('shorts seat',[(0,0,.642,.074,.123),(0,0,.685,.088,.145),(0,0,.749,.080,.13),
    (0,0,.767,.074,.119)],'denim','hip',20,1)
for side,s in [('L',1),('R',-1)]:
    p='leg'+side
    loft('shorts '+side,[(0,s*.096,.573,.082,.087),(0,s*.096,.585,.079,.086),
        (0,s*.094,.65,.075,.083),(0,s*.087,.694,.074,.08)],'denim',p,20,1)
    loft('cuff '+side,[(0,s*.096,.571,.085,.09),(0,s*.096,.579,.085,.09),
        (0,s*.096,.592,.081,.086)],'denimLight',p,20,1)
    tube('cuff stitch '+side,[(.079,s*.096-.055,.592),(.086,s*.096,.592),(.079,s*.096+.055,.592)],.0014,'denimStitch',p,1)
    # Curved front pockets and raised belt loops.
    tube('pocket seam '+side,[(.068,s*.116,.739),(.087,s*.112,.718),(.086,s*.068,.702)],.002,'denimLight','hip',2)
    tube('rear pocket '+side,[(-.080,s*.042,.729),(-.093,s*.047,.669),(-.092,s*.086,.654),(-.084,s*.125,.675),(-.074,s*.125,.729)],.002,'denimLight','hip',2)
    box('belt loop',(.072,s*.105,.753),(.012,.016,.04),'denimLight','hip',.003)
loft('leather belt',[(0,0,.744,.082,.133),(0,0,.754,.084,.135),(0,0,.768,.079,.129)],'hairChestnut','hip',24,1)
# Buckle is a true open rectangle, with pin.
tube('belt buckle',[(.092,-.026,.745),(.095,-.027,.770),(.095,.027,.770),(.092,.027,.745),(.092,-.026,.745)],.004,'brass','hip',2)
tube('buckle pin',[(.098,0,.766),(.1,0,.749)],.0023,'brass','hip',2)
tube('fly seam',[(.089,.009,.74),(.098,.008,.689),(.084,.012,.648)],.0015,'denimLight','hip',1)
# Red utility tab hanging from right hip.
box('utility tab',(.013,-.188,.649),(.026,.013,.132),'survivorRed','hip',.006,rot=(.10,.12,0))
for z in [.611,.691]: ell('utility rivet',(.031,-.198,z),(.005,.004,.005),'brass','hip',8,6)

for side,s in [('L',1),('R',-1)]:
    arm='arm'+side; fore='foreArm'+side; hand='hand'+side
    # Short sleeve shell around upper arm, rolled hem, elbow volume.
    ell('elbow blend '+side,(.012,s*.235,.843),(.035,.034,.038),'skinWarm',fore)
    loft('upper arm '+side,[(.009,s*.228,.836,.035,.034),(.008,s*.213,.889,.040,.041),
        (0,s*.178,.974,.047,.048),(0,s*.171,1.002,.042,.046)],'skinWarm',arm)
    loft('tee sleeve '+side,[(0,s*.207,.93,.05,.048),(0,s*.201,.937,.053,.05),
        (-.003,s*.181,.993,.058,.054),(0,s*.166,1.01,.048,.049)],'picketWhite',arm,20,1)
    loft('sleeve roll '+side,[(0,s*.21,.928,.053,.052),(0,s*.21,.941,.054,.054),
        (0,s*.205,.949,.052,.051)],'denimLight',arm,20,1)
    loft('forearm '+side,[(.026,s*.282,.675,.024,.026),(.022,s*.270,.711,.027,.029),
        (.019,s*.249,.791,.037,.035),(.013,s*.236,.843,.035,.034),(.012,s*.235,.855,.029,.03)],'skinWarm',fore)
    cuffmat='survivorRed' if s<0 else 'tealDark'
    loft('wrist band '+side,[(.024,s*.274,.690,.03,.033),(.024,s*.274,.695,.032,.035),
        (.024,s*.273,.721,.033,.035),(.023,s*.272,.728,.029,.032)],cuffmat,fore)
    box('wrist clasp '+side,(.055,s*.274,.709),(.012,.037,.022),'brass',fore,.004)
    for dy in [-.010,.010]: ell('wrist rivet',(.064,s*.274+dy,.710),(.003,.003,.003),'picketWhite',fore,8,6)
    # Palm and individually shaped fingers, with a curled thumb.
    ell('palm '+side,(.027,s*.289,.646),(.027,.035,.040),'skinWarm',hand)
    for i in range(4):
        y=s*(.270+i*.013)
        z=.620+(.003 if i in (0,3) else 0)
        ell('finger '+side+str(i),(.032,y,z),(.012,.009,.029-(.005 if i==3 else 0)),'skinWarm',hand,8,6)
    tube('thumb '+side,[(.041,s*.269,.659),(.060,s*.262,.644),(.063,s*.263,.625)],.011,'skinWarm',hand,2)
    # Bare thighs are tapered, with a gently forward knee.
    loft('thigh '+side,[(.008,s*.112,.413,.039,.043),(.008,s*.11,.445,.046,.045),
        (0,s*.098,.535,.053,.052),(0,s*.096,.601,.059,.058),
        (0,s*.095,.657,.054,.057)],'skinWarm','leg'+side,20,1)
    loft('calf '+side,[(-.006,s*.13,.138,.025,.031),(-.005,s*.128,.174,.029,.032),
        (-.010,s*.122,.254,.040,.039),(-.004,s*.115,.349,.035,.037),
        (.008,s*.112,.413,.039,.043),(.008,s*.112,.434,.036,.040)],'skinWarm','shin'+side,20,1)
    ell('knee blend '+side,(.008,s*.112,.425),(.038,.043,.045),'skinWarm','shin'+side)
    # Athletic sock shell plus stripes conforming to its taper.
    loft('sock '+side,[(-.006,s*.13,.138,.030,.034),(-.008,s*.128,.177,.033,.035),
        (-.01,s*.121,.254,.041,.040),(-.009,s*.119,.299,.04,.04),
        (-.009,s*.119,.309,.038,.039)],'picketWhite','shin'+side,20,1)
    for z,mat in [(.294,'sockBlue'),(.270,'survivorRed' if s>0 else 'sockBlue')]:
        loft('sock stripe '+side,[(-.009,s*.12,z-.008,.041,.042),(-.009,s*.12,z,.042,.043),
            (-.009,s*.12,z+.007,.041,.042)],mat,'shin'+side,20,1)
    # Layered high-top sneaker: sole, upper, toe cap, heel, padded collar, tongue.
    foot='foot'+side; y=s*.13
    box('outsole '+side,(.026,y,.026),(.208,.126,.050),'picketWhite',foot,.017)
    box('midsole '+side,(.027,y,.054),(.204,.121,.030),'picketWhite',foot,.012)
    tube('sole piping '+side,[(.111,y-.049,.064),(.128,y,.064),(.111,y+.049,.064)],.003,'bandage',foot,2)
    loft('sneaker upper '+side,[(.018,y,.061,.091,.052),(.013,y,.075,.089,.054),
        (-.01,y,.111,.067,.049),(-.025,y,.161,.041,.045),(-.026,y,.181,.038,.043)],'survivorRed',foot,20,1)
    ell('rubber toe '+side,(.093,y,.081),(.041,.052,.027),'picketWhite',foot)
    box('heel reinforcement '+side,(-.057,y,.108),(.019,.092,.078),'redDark',foot,.012)
    loft('shoe padded collar '+side,[(-.023,y,.159,.043,.046),(-.023,y,.173,.047,.049),
        (-.023,y,.184,.046,.048)],'survivorRed',foot,20,1)
    box('shoe tongue '+side,(.027,y,.133),(.027,.067,.09),'survivorRed',foot,.013,rot=(0,-.28,0))
    box('tongue badge '+side,(.047,y,.162),(.005,.031,.020),'picketWhite',foot,.005)
    ell('tongue red mark '+side,(.051,y,.164),(.004,.006,.006),'survivorRed',foot,8,6)
    for j in range(4):
        x=.081-j*.013; z=.099+j*.011
        for dy in [-.036,.036]: ell('eyelet', (x,y+dy,z),(.005,.005,.003),'brass',foot,8,6)
        tube('lace '+side,[(x,y-.033,z+.004),(x+.006,y,z+.007),(x-.006,y+.033,z+.011)],.0028,'picketWhite',foot,2)
    tube('lace bow '+side,[(.041,y,.145),(.046,y-.025,.151),(.055,y-.020,.141),(.041,y,.145),(.047,y+.024,.151),(.054,y+.020,.142),(.041,y,.145)],.0028,'picketWhite',foot,2)
    for d in [-1,1]:
        tube('shoe panel '+side,[(.060,y+d*.051,.09),(.015,y+d*.057,.12),(-.024,y+d*.05,.104)],.003,'redDark',foot,2)
    for j in range(7):
        box('sole tread notch',(-.058+j*.025,y+s*.06,.014),(.007,.006,.016),'denimLight',foot,.0015)
# Knee adhesive bandage on the right side, with inset pad and perforations.
box('knee bandage',(.051,-.113,.438),(.012,.067,.056),'bandage','legR',.010,rot=(.05,.10,0))
box('bandage pad',(.059,-.113,.439),(.005,.030,.034),'picketWhite','legR',.005)
for yy in [-.138,-.088]:
    for zz in [.427,.446]: ell('bandage perforation',(.059,yy,zz),(.002,.002,.002),'skinShadow','legR',8,6)

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
    tube('outer lash',[(face_x(y+s*.028,z)+.012,y+s*.028,z+.018),(face_x(y+s*.035,z)+.01,y+s*.038,z+.021)],.003,'hairChestnut','head',2)
    tube('lower lid',[(face_x(y-.026,z)+.01,y-.026,z-.021),(x+.013,y,z-.044),(face_x(y+.026,z)+.01,y+.026,z-.021)],.002,'skinShadow','head',2)
    tube('brow',[(face_x(y-s*.029,z)+.007,y-s*.030,1.268),(face_x(y,z)+.008,y,1.277),(face_x(y+s*.030,z)+.008,y+s*.032,1.267)],.006,'hairChestnut','head',2)
    ell('cheek blush',(face_x(s*.093,1.165)+.008,s*.094,1.165),(.0007,.022,.009),'skinBlush','head',16,8)
for o in list(asset.objects):
    if o.type=='MESH' and o.name.startswith(('eye sclera','iris','pupil','eye glint')):
        o.rotation_euler.z=.18 if o.matrix_world.translation.y>0 else -.18
# Rounded nose bridges smoothly into a small button tip.
ell('nose bridge',(.128,0,1.188),(.012,.011,.022),'skinWarm','head')
ell('nose tip',(.143,0,1.176),(.012,.013,.011),'skinWarm','head')
ell('nose light',(.158,-.003,1.180),(.002,.007,.004),'bandage','head',8,6)
for s in [-1,1]: ell('nostril',(.148,s*.012,1.169),(.003,.003,.002),'skinShadow','head',8,6)
tube('smile',[(.119,-.030,1.130),(.131,-.016,1.125),(.135,0,1.123),(.131,.016,1.125),(.119,.030,1.131)],.0025,'mouth','head',2)
tube('lower lip',[(.126,-.012,1.119),(.130,0,1.118),(.125,.014,1.120)],.002,'skinBlush','head',2)

# Scalp cap with an open face region and a low nape at the rear.
vs=[]; fs=[]; segments=32; rows=9
for k in range(rows):
    t=k/(rows-1)
    for j in range(segments):
        a=2*math.pi*j/segments
        # theta=0 is forward; rear extends below the ears.
        edge=1.00+.72*(1-math.cos(a))/2
        ph=.025+(edge-.025)*t
        vs.append((-.024+.151*math.sin(ph)*math.cos(a),.172*math.sin(ph)*math.sin(a),1.199+.172*math.cos(ph)))
for k in range(rows-1):
    for j in range(segments): fs.append(((k+1)*segments+j,(k+1)*segments+(j+1)%segments,k*segments+(j+1)%segments,k*segments+j))
# Outward winding: runtime palette materials are single-sided, so an inward cap
# is culled from outside and exposes the skin beneath it. The radii clear the
# face sculpt at the temples by about 1 cm so the scalp never z-fights it.
fs.append(tuple(range(segments)))
cap=mesh('hair scalp',vs,fs,'hairChestnut','head',1)
# Sweeping bangs from the off-center part, with leaf tips around the temples.
bangs=[
    ([(.043,.024,1.351),(.122,-.02,1.335),(.142,-.084,1.296),(.116,-.130,1.251),(.080,-.155,1.230)],[.027,.041,.043,.028,.001]),
    ([(.045,.028,1.346),(.132,-.004,1.322),(.149,-.050,1.282),(.131,-.10,1.257)],[.025,.036,.033,.001]),
    ([(.050,.030,1.346),(.13,.079,1.323),(.139,.126,1.280),(.1,.15,1.224),(.07,.14,1.198)],[.030,.04,.032,.023,.001]),
    ([(.057,.035,1.341),(.148,.055,1.308),(.158,.079,1.263),(.143,.091,1.239)],[.020,.024,.026,.001]),
]
for i,(pts,widths) in enumerate(bangs):
    lock('swept fringe '+str(i),pts,widths,[.012 if j in (0,len(pts)-1) else .025 for j in range(len(pts))], 'hairWarm' if i%2==0 else 'hairChestnut')
# Temple curls (longer, tapering face-framing wisps).
for s in [-1,1]:
    lock('temple curl',[(.008,s*.124,1.31),(.05,s*.163,1.254),(.054,s*.158,1.173),(.071,s*.153,1.107),(.089,s*.145,1.099)],
         [.024,.026,.019,.012,.001],[.016,.020,.016,.008,.001],'hairWarm')
# Broad overlapping crown leaves cover the scalp and converge at the tie.
for i in range(11):
    a=.65+i*.49
    c=math.cos(a); q=math.sin(a)
    pts=[(-.027+.034*c,.034*q,1.366),(-.027+.104*c,.117*q,1.337),
         (-.027+.146*c,.163*q,1.274),(-.036+.146*c,.164*q,1.218),
         (-.045+.122*c,.148*q,1.176+(.025 if c>0 else 0))]
    lock('layered crown '+str(i),pts,[.023,.041,.045,.031,.001],
         [.010,.019,.022,.016,.001], 'hairWarm' if i%3 else 'hairChestnut',normal=(c,q,.2))
# Ponytail root and a red, softly scalloped scrunchie.
ell('ponytail root',(-.133,-.095,1.322),(.058,.052,.055),'hairChestnut','head')
for i in range(8):
    a=2*math.pi*i/8
    ell('scrunchie fold',(-.141+.012*math.cos(a),-.095+.046*math.sin(a),1.327+.043*math.cos(a)),(.015,.019,.017),'survivorRed','head',12,8)
# Side-swept cascade made of broad overlapping locks, with varied curled tips.
for i in range(5):
    off=(i-2)*.018
    pts=[(-.145+off,-.10,1.335),(-.180+off,-.160,1.374-abs(off)*.1),
         (-.212+off,-.221,1.319),(-.230+off,-.244,1.231),
         (-.213+off,-.218,1.162),(-.160+off,-.225,1.137+abs(off)*.6)]
    lock('ponytail cascade '+str(i),pts,[.023,.049,.047,.041,.025,.001],
         [.014,.025,.028,.024,.016,.001], 'hairWarm' if i%2 else 'hairChestnut',normal=(1,-.2,0))
# Few restrained highlight grooves describe strands, not a wire cage.
for s in [-1,1]:
    tube('hair fine sweep',[(.054,s*.031,1.361),(.115,s*.069,1.340),(.132,s*.113,1.306)],.0018,'hairHighlight','head',2)
tube('pony fine strand',[(-.14,-.153,1.355),(-.177,-.20,1.35),(-.195,-.273,1.28),(-.193,-.27,1.21),(-.16,-.221,1.161)],.002,'hairHighlight','head',2)

# Canvas backpack, back panel and raised piping, pockets, hardware, corgi badge.
bp='backpackSocket'
box('backpack body',(-.164,0,.878),(.134,.252,.293),'backpackTeal',bp,.034)
box('backpack side gusset',(-.174,0,.873),(.144,.264,.255),'tealDark',bp,.027)
box('backpack face',(-.237,0,.887),(.027,.227,.248),'backpackTeal',bp,.024)
tube('backpack piping',[(-.252,-.092,.753),(-.252,-.114,.785),(-.252,-.113,.983),(-.252,-.090,1.011),(-.252,.09,1.011),(-.252,.113,.983),(-.252,.114,.785),(-.252,.092,.753)],.004,'tealLight',bp,2)
box('badge flap',(-.261,0,.925),(.025,.186,.148),'tealLight',bp,.018)
box('lower pouch',(-.263,0,.793),(.035,.193,.074),'backpackTeal',bp,.016)
tube('pouch flap edge',[(-.285,-.084,.811),(-.289,0,.800),(-.285,.084,.811)],.003,'tealDark',bp,2)
box('pouch webbing',(-.287,0,.784),(.012,.026,.086),'brass',bp,.004)
box('pouch buckle',(-.298,0,.804),(.015,.044,.027),'woodWarm',bp,.004)
box('buckle bright face',(-.308,0,.804),(.006,.034,.018),'brass',bp,.002)
tube('carry handle',[(-.155,-.042,1.013),(-.16,-.034,1.051),(-.16,.034,1.051),(-.155,.042,1.013)],.012,'tealDark',bp,3)
for s in [-1,1]:
    box('side pouch',(-.174,s*.139,.832),(.083,.021,.099),'tealLight',bp,.01)
    box('pouch flap',(-.18,s*.151,.874),(.08,.008,.021),'backpackTeal',bp,.006)
    box('side compression webbing',(-.178,s*.138,.959),(.015,.014,.079),'brass',bp,.003)
    box('side buckle',(-.187,s*.146,.95),(.027,.008,.029),'woodWarm',bp,.004)
    tube('zip track',[(-.243,s*.12,.809),(-.243,s*.125,.91),(-.219,s*.115,.99)],.0025,'brass',bp,2)
    box('zip pull',(-.229,s*.133,.945),(.016,.007,.028),'brass',bp,.003)
    # Broad sculpted padded shoulder straps curving over shoulders and chest.
    lock('strap padding',[(-.12,s*.113,1.016),(-.042,s*.132,1.033),(.040,s*.132,.996),(.088,s*.117,.919),(.066,s*.126,.805),(-.081,s*.145,.79)],[.020]*6,[.010]*6,'tealDark',parent='torso')
    lock('strap canvas',[(-.12,s*.113,1.024),(-.039,s*.132,1.041),(.051,s*.131,.994),(.10,s*.117,.919),(.077,s*.126,.807)],[.014]*5,[.005]*5,'backpackTeal',parent='torso')
    box('strap adjustment buckle',(.111,s*.121,.891),(.010,.036,.027),'brass','torso',.004)
    box('strap buckle opening',(.117,s*.121,.891),(.004,.022,.013),'tealDark','torso',.002)
    box('strap loose tab',(.081,s*.135,.812),(.011,.025,.045),'tealDark','torso',.003)
# Three dimensional corgi patch on the rear flap, facing -X.
ell('corgi badge ground',(-.281,0,.930),(.005,.055,.05),'tealDark',bp)
ell('corgi head',(-.288,0,.93),(.009,.042,.039),'corgiOrange',bp)
for s in [-1,1]:
    # triangular ears with smoothed corners made as pointed leaf volumes
    pts=[(-.287,s*.025,.947),(-.289,s*.037,.977),(-.291,s*.041,.942)]
    vs=[(x+d,y,z) for d in [-.006,.006] for x,y,z in pts]
    mesh('corgi ear',vs,[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],'corgiOrange',bp,1)
    ell('corgi inner ear',(-.299,s*.032,.958),(.003,.009,.013),'skinBlush',bp,8,6)
    ell('corgi muzzle',(-.298,s*.015,.914),(.005,.019,.017),'picketWhite',bp,16,10)
    ell('corgi eye',(-.300,s*.020,.934),(.003,.006,.008),'uiDark',bp,8,6)
    ell('corgi glint',(-.303,s*.018,.937),(.0015,.002,.002),'picketWhite',bp,8,6)
ell('corgi blaze',(-.298,0,.945),(.004,.009,.027),'picketWhite',bp,16,10)
ell('corgi nose',(-.305,0,.918),(.003,.007,.005),'uiDark',bp,8,6)
tube('corgi smile',[(-.305,-.012,.910),(-.306,0,.906),(-.305,.012,.910)],.0018,'uiDark',bp,1)
ell('corgi tongue',(-.306,0,.902),(.0025,.006,.009),'skinBlush',bp,8,6)
for y in [-.081,.081]: ell('flap rivet',(-.281,y,.974),(.003,.004,.004),'brass',bp,8,6)

bpy.context.view_layer.update()
for side in ['L','R']:
    pivot=N['hand'+side].matrix_world.translation
    for o in asset.objects:
        if o.type=='MESH' and o.parent==N['hand'+side]:
            inv=o.matrix_world.inverted()
            for v in o.data.vertices:
                v.co=inv @ (pivot+(o.matrix_world @ v.co-pivot)*1.14)

# Broaden the chibi head as one cohesive sculpt, including facial relief/hair.
bpy.context.view_layer.update()
for o in asset.objects:
    if o.type == 'MESH' and o.parent == N['head']:
        inv=o.matrix_world.inverted()
        for v in o.data.vertices:
            w=o.matrix_world @ v.co
            w.x *= 1.06
            w.y *= 1.20
            w.z = 1.19+(w.z-1.19)*1.075
            v.co=inv @ w

# Simplify the applied smooth surfaces for the hero budget. Tiny trim meshes
# stay intact; collapse preserves the already-computed smooth vertex normals.
for o in list(asset.objects):
    if o.type != 'MESH': continue
    o.data.calc_loop_triangles()
    if len(o.data.loop_triangles) < 300: continue
    bpy.context.view_layer.objects.active=o
    dec=o.modifiers.new('Hero surface budget','DECIMATE')
    dec.ratio=.86 if o.name == 'face sculpt' else .72
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
    bad=[f for f in bm.faces if f.calc_area()<1e-12]
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
report={'id':'char.survivor-female','triangles':tris,'meshes':sum(o.type=='MESH' for o in asset.objects),'nodes_ok':not missing,'missing_nodes':missing,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2)+'\n')
print('BUILD OK',json.dumps(report))
if arg('--glb'):
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    print('GLB OK',arg('--glb'))

if '--pose-test' in ARGS:
    N['armL'].rotation_euler.x=math.radians(65)
    N['armL'].rotation_euler.y=math.radians(-20)
    N['foreArmL'].rotation_euler.y=math.radians(-80)
    N['legR'].rotation_euler.y=math.radians(-28)
    N['shinR'].rotation_euler.y=math.radians(35)
    bpy.context.view_layer.update()

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
