"""Minor Incident female survivor — deterministic sculpted rigid-part hero.
Chibi proportions (~3.4 heads): authored in the original rest frame, then re-proportioned;
limbs are equal-radius capsules per joint so rigid hinges read as one rounded surface.
Run only through experiment/tools/blender_run.py. +X forward, -Y right, Z up.
Subdivision is applied, and static surfaces merge by material inside each joint.
"""
import bpy
import bmesh
import math
import sys
import json
from pathlib import Path
from mathutils import Matrix, Vector

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

def capsule(name, a, b, profile, mat, parent, seg=20, cap_a=True, cap_b=True):
    # Rounded limb volume along a->b. profile: (t, radius) with t in [0,1]. Hemispherical
    # ends use the end radii and are centred on a/b, so two segments that share a joint
    # with equal radii stay one continuous rounded surface at every bend angle.
    a=Vector(a); b=Vector(b); d=b-a; d.normalize()
    u=d.cross(Vector((1,0,0)) if abs(d.x)<.9 else Vector((0,1,0))).normalized(); v=d.cross(u)
    rings=[]
    if cap_a: rings+=[(a-d*profile[0][1]*math.sin(f),profile[0][1]*math.cos(f)) for f in (1.25,.95,.62,.3)]
    rings+=[(a+(b-a)*t,r) for t,r in profile]
    if cap_b: rings+=[(b+d*profile[-1][1]*math.sin(f),profile[-1][1]*math.cos(f)) for f in (.3,.62,.95,1.25)]
    vs=[]; fs=[]
    for c,r in rings:
        for j in range(seg):
            q=2*math.pi*j/seg; vs.append(c+r*(u*math.cos(q)+v*math.sin(q)))
    for k in range(len(rings)-1):
        for j in range(seg): fs.append((k*seg+j,k*seg+(j+1)%seg,(k+1)*seg+(j+1)%seg,(k+1)*seg+j))
    n=len(vs)
    if cap_a: vs.append(a-d*profile[0][1]); fs+=[((j+1)%seg,j,n) for j in range(seg)]; n+=1
    else: fs.append(tuple(reversed(range(seg))))
    last=(len(rings)-1)*seg
    if cap_b: vs.append(b+d*profile[-1][1]); fs+=[(last+j,last+(j+1)%seg,n) for j in range(seg)]
    else: fs.append(tuple(last+j for j in range(seg)))
    o=mesh(name,[tuple(x) for x in vs],fs,mat,parent)
    bm=bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(o.data); bm.free()
    for f in o.data.polygons: f.use_smooth=True
    return o

# ---- Body authored in the original rest frame, re-proportioned below. ----
# Red cotton tee: the signature colour block (mockup), fitted waist, soft shoulders.
loft('tee.shell',[(0,0,.735,.08,.125),(0,0,.745,.09,.142),(0,0,.79,.09,.133),
    (-.005,0,.88,.088,.136),(0,0,.959,.075,.158),(0,0,1.001,.058,.125),
    (0,0,1.016,.04,.064)],'survivorRed','torso',24,1)
loft('neck',[(0,0,1.005,.034,.04),(0,0,1.022,.037,.04),(0,0,1.086,.04,.044)],'skinWarm','head')
tube('ribbed neckline',[(.043,-.054,1.010),(.068,-.035,.993),(.073,0,.987),(.068,.035,.993),(.043,.054,1.010)],.008,'picketWhite','torso')
# Denim shorts seat with a leather belt and brass buckle; one red tab as the hip accent.
loft('shorts seat',[(0,0,.630,.078,.128),(0,0,.685,.092,.15),(0,0,.749,.084,.135),
    (0,0,.767,.077,.123)],'denim','hip',20,1)
loft('leather belt',[(0,0,.744,.086,.138),(0,0,.754,.088,.14),(0,0,.768,.083,.134)],'hairChestnut','hip',24,1)
box('belt buckle',(.093,0,.756),(.012,.05,.03),'brass','hip',.006)
box('utility tab',(.013,-.19,.66),(.03,.016,.11),'survivorRed','hip',.008,rot=(.10,.12,0))

# Chunky high-top sneakers: one thick white sole, red upper, white toe cap, red collar.
for side,s in [('L',1),('R',-1)]:
    foot='foot'+side; y=s*.13
    box('sole '+side,(.026,y,.032),(.212,.13,.064),'picketWhite',foot,.022)
    loft('sneaker upper '+side,[(.018,y,.072,.093,.055),(.013,y,.085,.091,.057),
        (-.01,y,.12,.069,.052),(-.025,y,.165,.044,.048),(-.026,y,.185,.041,.046)],'survivorRed',foot,20,1)
    ell('rubber toe '+side,(.088,y,.088),(.046,.056,.03),'picketWhite',foot)
    loft('shoe padded collar '+side,[(-.023,y,.162,.046,.049),(-.023,y,.176,.05,.052),
        (-.023,y,.188,.048,.05)],'survivorRed',foot,20,1)
    box('shoe tongue '+side,(.027,y,.138),(.03,.07,.09),'survivorRed',foot,.015,rot=(0,-.28,0))
    for j in range(3):
        x=.072-j*.02; z=.108+j*.016
        tube('lace '+side,[(x,y-.036,z+.003),(x+.004,y,z+.007),(x-.004,y+.036,z+.01)],.0045,'picketWhite',foot,2)

# Face: rounded cheeks, narrower chin, broad forehead.
headrings=[(-.004,0,1.057,.041,.052),(0,0,1.072,.077,.090),(.004,0,1.105,.112,.135),
    (0,0,1.155,.134,.153),(-.008,0,1.213,.137,.150),(-.013,0,1.277,.127,.141),
    (-.018,0,1.323,.095,.105),(-.019,0,1.340,.040,.045)]
loft('face sculpt',headrings,'skinWarm','head',32,1)
for s in [-1,1]:
    ell('ear',(-.012,s*.150,1.174),(.031,.021,.043),'skinWarm','head')
    ell('ear inset',(.013,s*.162,1.176),(.011,.011,.027),'skinShadow','head')
def face_x(y,z):
    return .130*max(.1,1-(y/.153)**2)**.225 - .005
# Big, dark, glossy eyes read at the game camera (mockup); bold upper lash line.
for s in [-1,1]:
    y=s*.060; z=1.205; x=face_x(y,z)
    ell('eye sclera', (x+.004,y,z),(.008,.034,.048),'picketWhite','head',20,12)
    ell('iris', (x+.013,y-.002*s,z-.002),(.0038,.026,.040),'eyeBrown','head',20,12)
    ell('pupil', (x+.016,y-.002*s,z-.002),(.0028,.014,.027),'uiDark','head',20,12)
    ell('eye glint', (x+.019,y-.010*s,z+.016),(.0028,.010,.012),'picketWhite','head',8,6)
    ell('eye glint small',(x+.019,y+.009*s,z-.014),(.002,.004,.005),'picketWhite','head',8,6)
    pts=[]
    for j in range(7):
        q=math.pi*j/6
        yy=y+.036*math.cos(q); zz=z+.048*math.sin(q)
        pts.append((face_x(yy,zz)+.012,yy,zz))
    tube('upper lashes',pts,.0062,'hairChestnut','head',2)
    tube('outer lash',[(face_x(y+s*.031,z)+.012,y+s*.031,z+.02),(face_x(y+s*.04,z)+.01,y+s*.043,z+.026)],.0042,'hairChestnut','head',2)
    tube('brow',[(face_x(y-s*.029,z)+.007,y-s*.030,1.275),(face_x(y,z)+.008,y,1.284),(face_x(y+s*.030,z)+.008,y+s*.032,1.274)],.0065,'hairChestnut','head',2)
    ell('cheek blush',(face_x(s*.093,1.15)+.008,s*.094,1.15),(.0007,.024,.011),'skinBlush','head',16,8)
for o in list(asset.objects):
    if o.type=='MESH' and o.name.startswith(('eye sclera','iris','pupil','eye glint')):
        o.rotation_euler.z=.18 if o.matrix_world.translation.y>0 else -.18
ell('nose tip',(.138,0,1.172),(.013,.015,.012),'skinWarm','head')
tube('smile',[(.119,-.030,1.126),(.131,-.016,1.12),(.135,0,1.118),(.131,.016,1.12),(.119,.030,1.127)],.0034,'mouth','head',2)

# Hair: a thick rounded mass (scalp cap) plus a few big soft clumps with rounded ends.
vs=[]; fs=[]; segments=32; rows=9
for k in range(rows):
    t=k/(rows-1)
    for j in range(segments):
        a=2*math.pi*j/segments
        # theta=0 is forward; rear extends below the ears. Lower rows swell into soft lobes.
        edge=1.00+.72*(1-math.cos(a))/2
        ph=.025+(edge-.025)*t
        bulge=1.03+.035*t*t*(.5+.5*math.cos(6*a))
        vs.append((-.024+.151*bulge*math.sin(ph)*math.cos(a),.172*bulge*math.sin(ph)*math.sin(a),1.199+.172*bulge*math.cos(ph)))
for k in range(rows-1):
    for j in range(segments): fs.append(((k+1)*segments+j,(k+1)*segments+(j+1)%segments,k*segments+(j+1)%segments,k*segments+j))
# Outward winding: runtime palette materials are single-sided.
fs.append(tuple(range(segments)))
mesh('hair scalp',vs,fs,'hairChestnut','head',1)
def clump(name,pts,width,depth,mat='hairWarm',normal=(1,0,0)):
    # Soft swelling clump: thin root, fat belly, rounded (not pointed) tip.
    n=len(pts); prof=[math.sin(math.pi*(.1+.8*k/(n-1)))**.7 for k in range(n)]
    lock(name,pts,[width*p for p in prof],[depth*p for p in prof],mat,normal)
# Three big sweeping bangs from an off-centre part.
clump('fringe a',[(.05,.03,1.362),(.125,-.015,1.34),(.15,-.07,1.30),(.142,-.115,1.268)],.072,.022)
clump('fringe b',[(.05,.03,1.362),(.135,.035,1.338),(.155,.07,1.296),(.148,.097,1.27)],.06,.022,'hairChestnut')
clump('fringe c',[(.04,.02,1.365),(.115,.10,1.338),(.135,.14,1.295),(.125,.158,1.262)],.065,.022)
for s in [-1,1]:
    clump('temple clump',[(.0,s*.13,1.315),(.05,s*.165,1.26),(.065,s*.162,1.2),(.085,s*.15,1.165)],.055,.022)
# Five broad crown clumps sweep back to the tie: soft grooves, no shards.
for i in range(5):
    a=1.25+i*.95
    c=math.cos(a); q=math.sin(a)
    pts=[(-.03+.03*c,.03*q,1.375),(-.035+.105*c,.12*q,1.345),
         (-.04+.15*c,.17*q,1.27),(-.05+.135*c,.155*q,1.195)]
    clump('crown clump '+str(i),pts,.085,.022,'hairWarm' if i%2 else 'hairChestnut',normal=(c,q,.25))
# High ponytail: fat root, red scrunchie, three big curling locks.
ell('ponytail root',(-.135,-.095,1.325),(.064,.058,.06),'hairChestnut','head')
for i in range(6):
    a=2*math.pi*i/6
    ell('scrunchie fold',(-.143+.012*math.cos(a),-.095+.05*math.sin(a),1.33+.047*math.cos(a)),(.02,.024,.022),'survivorRed','head',12,8)
for i in range(3):
    off=(i-1)*.03
    pts=[(-.15+off,-.10,1.33),(-.19+off,-.165,1.35),(-.225+off,-.225,1.30),
         (-.235+off,-.245,1.215),(-.205+off,-.22,1.15)]
    clump('ponytail lock '+str(i),pts,.075,.045,'hairWarm' if i%2 else 'hairChestnut',normal=(1,-.2,0))

# Teal canvas backpack: big rounded block, a flap, a pouch, side pockets, corgi badge.
bp='backpackSocket'
box('backpack body',(-.164,0,.878),(.14,.262,.30),'backpackTeal',bp,.045)
box('backpack side gusset',(-.174,0,.873),(.15,.272,.26),'tealDark',bp,.035)
box('badge flap',(-.245,0,.93),(.035,.22,.16),'tealLight',bp,.022)
box('lower pouch',(-.255,0,.79),(.045,.2,.085),'backpackTeal',bp,.02)
box('pouch buckle',(-.28,0,.80),(.012,.04,.026),'brass',bp,.005)
tube('carry handle',[(-.155,-.045,1.013),(-.16,-.036,1.055),(-.16,.036,1.055),(-.155,.045,1.013)],.013,'tealDark',bp,3)
for s in [-1,1]:
    box('side pouch',(-.174,s*.142,.832),(.09,.025,.10),'tealLight',bp,.012)
    # Broad padded shoulder straps over shoulders and chest.
    lock('strap padding',[(-.12,s*.116,1.016),(-.042,s*.135,1.035),(.044,s*.135,.998),(.094,s*.12,.919),(.072,s*.128,.805),(-.081,s*.148,.79)],[.024]*6,[.012]*6,'tealDark',parent='torso')
    box('strap adjustment buckle',(.115,s*.123,.891),(.011,.04,.028),'brass','torso',.005)
# Corgi patch on the rear flap (facing -X): head, ears, muzzle, eyes, blaze, nose.
ell('corgi head',(-.266,0,.93),(.01,.046,.043),'corgiOrange',bp)
for s in [-1,1]:
    pts=[(-.265,s*.027,.949),(-.267,s*.041,.982),(-.269,s*.045,.944)]
    vs=[(x+d,y,z) for d in [-.006,.006] for x,y,z in pts]
    mesh('corgi ear',vs,[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],'corgiOrange',bp,1)
    ell('corgi muzzle',(-.276,s*.016,.914),(.005,.021,.019),'picketWhite',bp,16,10)
    ell('corgi eye',(-.278,s*.022,.935),(.003,.007,.009),'uiDark',bp,8,6)
ell('corgi blaze',(-.276,0,.946),(.004,.01,.029),'picketWhite',bp,16,10)
ell('corgi nose',(-.283,0,.918),(.003,.008,.006),'uiDark',bp,8,6)

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

# ---- Re-proportion to ~3.4 heads (mockup): big head, compact torso, short chunky legs,
# big shoes. Total source height stays ~1.41 m (runtime sourceScale -> 1.8 m). ----
HEAD_SCALE=1.24; SHOE_SCALE=1.25; BODY_XY=(1.1,1.08)
ZKNOTS=[(0,0),(.142,.1775),(.425,.355),(.658,.575),(.705,.62),(1.005,.93),(1.10,1.05)]
def zmap(z):
    for (z0,n0),(z1,n1) in zip(ZKNOTS,ZKNOTS[1:]):
        if z<=z1 or (z1,n1)==ZKNOTS[-1]: return n0+(z-z0)*(n1-n0)/(z1-z0)
def body(p): return Vector((p.x*BODY_XY[0],p.y*BODY_XY[1],zmap(p.z)))
OLD_HEAD=Vector((0,0,1.055)); NEW_HEAD=Vector((0,0,.964))
NEW={'root':(0,0,0),'hip':(0,0,.62),'torso':(0,0,.672),'head':tuple(NEW_HEAD)}
for side,s in [('L',1),('R',-1)]:
    NEW.update({'arm'+side:(0,s*.186,.93),'foreArm'+side:(.012,s*.232,.785),'hand'+side:(.024,s*.262,.648),
        'weaponSocket'+side:(.074,s*.262,.568),'leg'+side:(0,s*.10,.575),'shin'+side:(.012,s*.112,.355),
        'foot'+side:(-.006,s*.125,.1775)})
NEW['backpackSocket']=tuple(body(N['backpackSocket'].matrix_world.translation))
bpy.context.view_layer.update()
owners=[]
for o in list(asset.objects):
    if o.type!='MESH': continue
    owner=o.parent.name
    assert owner in ('hip','torso','head','backpackSocket','footL','footR'), owner
    o.data.transform(o.matrix_world); o.parent=None; o.matrix_world=Matrix.Identity(4)
    for v in o.data.vertices:
        p=Vector(v.co)
        if owner=='head': v.co=NEW_HEAD+(p-OLD_HEAD)*HEAD_SCALE
        elif owner.startswith('foot'):
            old=N[owner].matrix_world.translation; new=Vector(NEW[owner])
            v.co=Vector((new.x,new.y,0))+(p-Vector((old.x,old.y,0)))*SHOE_SCALE
        else: v.co=body(p)
    owners.append((o,owner))
parents={n:(o.parent.name if o.parent else None) for n,o in N.items()}
for n,o in N.items():
    w=o.matrix_world.translation.copy(); o.parent=None; o.location=w
for n,o in N.items(): o.location=NEW[n]
bpy.context.view_layer.update()
for n,o in N.items():
    if parents[n]:
        o.parent=N[parents[n]]; bpy.context.view_layer.update(); o.matrix_world=Matrix.Translation(Vector(NEW[n]))
bpy.context.view_layer.update()
for o,owner in owners:
    o.parent=N[owner]; o.matrix_world=Matrix.Identity(4)
bpy.context.view_layer.update()

# ---- Limbs authored on the new joints. Equal-radius capsule ends at shoulder, elbow,
# hip, knee and ankle hide the rigid hinges; sleeves, shorts and socks cover the tops. ----
J={n:Vector(NEW[n]) for n in NEW}
for side,s in [('L',1),('R',-1)]:
    sh,el,wr=J['arm'+side],J['foreArm'+side],J['hand'+side]
    capsule('upper arm '+side,sh,el,[(0,.05),(.5,.048),(1,.044)],'skinWarm','arm'+side)
    capsule('tee sleeve '+side,sh+Vector((0,-s*.006,.004)),el,[(0,.07),(.42,.068),(.5,.066),(.53,.058),(.55,.046)],'survivorRed','arm'+side,cap_b=False)
    capsule('forearm '+side,el,wr,[(0,.044),(.35,.045),(1,.038)],'skinWarm','foreArm'+side)
    capsule('wrist band '+side,wr+(el-wr)*.16,wr+(el-wr)*.34,[(0,.047),(.15,.05),(.85,.05),(1,.047)],'survivorRed' if s<0 else 'tealDark','foreArm'+side,cap_a=False,cap_b=False)
    # Chunky mitten hand: palm, curled finger block, thumb (grip socket sits in the fist).
    h=J['hand'+side]
    ell('palm '+side,h+Vector((.004,s*.003,-.04)),(.038,.036,.05),'skinWarm','hand'+side)
    ell('fingers '+side,h+Vector((.034,s*.004,-.078)),(.036,.035,.034),'skinWarm','hand'+side)
    ell('thumb '+side,h+Vector((.042,-s*.026,-.04)),(.02,.017,.03),'skinWarm','hand'+side)
    hp,kn,an=J['leg'+side],J['shin'+side],J['foot'+side]
    capsule('thigh '+side,hp,kn,[(0,.068),(.4,.066),(1,.056)],'skinWarm','leg'+side)
    capsule('shorts '+side,hp,kn,[(0,.088),(.35,.092),(.42,.093),(.46,.088),(.48,.066)],'denim','leg'+side,cap_b=False)
    capsule('cuff '+side,hp+(kn-hp)*.36,hp+(kn-hp)*.44,[(0,.094),(.5,.097),(1,.094)],'denimLight','leg'+side,cap_a=False,cap_b=False)
    capsule('calf '+side,kn,an,[(0,.056),(.3,.058),(1,.045)],'skinWarm','shin'+side)
    capsule('sock '+side,kn+(an-kn)*.5,an,[(0,.055),(.06,.058),(.12,.056),(1,.051)],'picketWhite','shin'+side,cap_a=False)
    for t,mat in [(.6,'sockBlue'),(.7,'survivorRed' if s>0 else 'sockBlue')]:
        capsule('sock stripe '+side,kn+(an-kn)*t,kn+(an-kn)*(t+.05),[(0,.0585),(1,.0575)],mat,'shin'+side,cap_a=False,cap_b=False)

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

# Distant LOD2 is authored here, reproducibly, from the finished LOD0: each joint mesh is
# collapsed to a few percent (tiny face/trim parts keep a small floor). `assets:pack`
# keeps it because it is within the 4.5% delivery contract; LOD1 is generated by pack.
if arg('--lod2'):
    for o in [o for o in asset.objects if o.type=='MESH']:
        o.data.calc_loop_triangles(); n=len(o.data.loop_triangles)
        if n <= 24: continue
        bpy.context.view_layer.objects.active=o
        # The hair/head silhouette (and so the catalog height) keeps a higher floor.
        floor=(.035,18) if o.parent.name=='head' else (.015,8)
        dec=o.modifiers.new('LOD2','DECIMATE'); dec.ratio=max(floor[0],min(1,floor[1]/n))
        zs=[v.co.z for v in o.data.vertices]; z0,z1=min(zs),max(zs)
        bpy.ops.object.modifier_apply(modifier=dec.name)
        # Collapse shrinks rounded ends; restore each part's vertical extent so the tier
        # keeps the catalog height and ground contact.
        zs=[v.co.z for v in o.data.vertices]; n0,n1=min(zs),max(zs)
        if n1-n0>1e-4:
            for v in o.data.vertices: v.co.z=z0+(v.co.z-n0)*(z1-z0)/(n1-n0)
    bpy.context.view_layer.update()
    print('LOD2 TRIS',sum(len(o.data.polygons) for o in asset.objects if o.type=='MESH'))
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--lod2')).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    print('LOD2 OK',arg('--lod2'))
