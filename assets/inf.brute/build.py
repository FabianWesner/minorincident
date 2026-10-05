"""Minor Incident / inf.brute: deterministic, rigid-part hero construction worker.
Build/render only via experiment/tools/blender_run.py. All dimensions in metres.
Applied subdivision; +X front, -Y right, Z up. No texture maps or armature.
Stump meshes have zero rest scale and ss_hidden metadata; restore ss_visible_scale.
"""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(k,d=None): return ARGS[ARGS.index(k)+1] if k in ARGS else d
bpy.ops.wm.read_factory_settings(use_empty=True)
SC=bpy.context.scene
COL=bpy.data.collections.new('Brute'); SC.collection.children.link(COL)
G={}; pieces={}
def rgb(h):
    c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
def mat(token,h,rough=.72,emit=0):
    m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token); m.diffuse_color=rgb(h); m.use_nodes=True
    n=m.node_tree.nodes['Principled BSDF']; n.inputs['Base Color'].default_value=rgb(h); n.inputs['Roughness'].default_value=rough
    if emit: n.inputs['Emission Color'].default_value=rgb(h); n.inputs['Emission Strength'].default_value=emit
    return m
M={'skin':mat('infectedSkin','c9a39a'),'cloth':mat('asphalt','5b4f5c'),'orange':mat('woodWarm','b0703f'),
   'yellow':mat('schoolBusYellow','f2b630'),'silver':mat('sidewalk','b9a4a0'), 'dark':mat('uiDark','25222c'),
   'blood':mat('blood','b3121f',.5),'red':mat('survivorRed','d9363e'), 'white':mat('picketWhite','f2e6dc'),
   'eye':mat('infectedEye','ff3b2f',.25,5)}
def adopt(o,parent):
    bpy.context.view_layer.update(); w=o.matrix_world.copy(); o.parent=G[parent]; o.matrix_world=w
    pieces.setdefault(parent,[]).append(o); return o
def group(n,p,parent=None):
    o=bpy.data.objects.new(n,None); COL.objects.link(o); o.location=p; o.empty_display_size=.07
    G[n]=o
    if parent: bpy.context.view_layer.update(); w=o.matrix_world.copy(); o.parent=G[parent]; o.matrix_world=w
    return o
def finish(o,n,m,parent,sub=0):
    o.name=n
    for c in list(o.users_collection): c.objects.unlink(o)
    COL.objects.link(o); o.data.materials.append(M[m])
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if sub:
        md=o.modifiers.new('Applied sculpt smoothing','SUBSURF'); md.levels=sub; bpy.ops.object.modifier_apply(modifier=md.name)
    for p in o.data.polygons: p.use_smooth=True
    return adopt(o,parent)
def ell(n,p,s,m,parent,rot=(0,0,0),seg=16,rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p); o=bpy.context.object; o.scale=s; o.rotation_euler=rot
    return finish(o,n,m,parent)
def box(n,p,s,m,parent,b=.025,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p); o=bpy.context.object; o.scale=s; o.rotation_euler=rot
    finish(o,n,m,parent)
    md=o.modifiers.new('Soft edges','BEVEL'); md.width=b; md.segments=3
    bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=md.name)
    md=o.modifiers.new('Corner normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=md.name)
    return o
def loft(n,sections,m,parent,steps=16,sub=1,jag=0):
    # Horizontal sculpt rings, elliptical in XY, followed by applied subdivision.
    v=[]
    for j,(x,y,z,rx,ry) in enumerate(sections):
        for i in range(steps):
            a=i*2*math.pi/steps; zz=z
            if j==0 and jag: zz+=jag*(.45*math.sin(i*2.7)+.55*math.cos(i*1.9))
            v.append((x+rx*math.cos(a),y+ry*math.sin(a),zz))
    f=[tuple(range(steps-1,-1,-1))]
    for j in range(len(sections)-1):
        for i in range(steps): a=j*steps+i; b=j*steps+(i+1)%steps; f.append((a,b,b+steps,a+steps))
    f.append(tuple(range((len(sections)-1)*steps,len(v))))
    me=bpy.data.meshes.new(n); me.from_pydata(v,[],f); me.update(); o=bpy.data.objects.new(n,me); COL.objects.link(o)
    return finish(o,n,m,parent,sub)
def tube(n,pts,r,m,parent):
    cu=bpy.data.curves.new(n,'CURVE'); cu.dimensions='3D'; cu.resolution_u=4; cu.bevel_depth=r; cu.bevel_resolution=1
    sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts)-1)
    for bp,p in zip(sp.bezier_points,pts): bp.co=p; bp.handle_left_type='AUTO'; bp.handle_right_type='AUTO'
    o=bpy.data.objects.new(n,cu); COL.objects.link(o); bpy.context.view_layer.objects.active=o; o.select_set(True)
    bpy.ops.object.convert(target='MESH'); o.select_set(False); return finish(o,n,m,parent)
def tape(n,pts,width,m,parent):
    vs=[]
    for j,p in enumerate(pts):
        a=Vector(pts[max(0,j-1)]); b=Vector(pts[min(len(pts)-1,j+1)])
        d=b-a; side=Vector((0,-d.z,d.y)).normalized()*width*.5
        vs.extend([Vector(p)-side,Vector(p)+side])
    faces=[(j*2,j*2+1,j*2+3,j*2+2) for j in range(len(pts)-1)]
    me=bpy.data.meshes.new(n); me.from_pydata(vs,[],faces); me.update()
    o=bpy.data.objects.new(n,me); COL.objects.link(o); finish(o,n,m,parent)
    md=o.modifiers.new('Tape thickness','SOLIDIFY'); md.thickness=.004
    bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=md.name)
    return o
def patch(n,pts,m,parent,thick=.012):
    me=bpy.data.meshes.new(n); me.from_pydata(pts,[],[tuple(range(len(pts)))]); me.update(); o=bpy.data.objects.new(n,me); COL.objects.link(o)
    finish(o,n,m,parent)
    md=o.modifiers.new('Fabric shell','SOLIDIFY'); md.thickness=thick
    bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=md.name)
    md=o.modifiers.new('Soft cloth edge','BEVEL'); md.width=.008; md.segments=2; bpy.ops.object.modifier_apply(modifier=md.name)
    return o
# Core hierarchy, joints placed at shoulder/elbow/wrist/hip/knee/ankle.
group('root',(0,0,0)); group('hip',(0,0,.84),'root'); group('torso',(-.04,0,1.09),'hip')
group('head',(.12,0,1.70),'torso'); group('backpackSocket',(-.33,0,1.45),'torso')
loft('trouserSeat',[(0,0,.72,.22,.30),(0,0,.77,.25,.35),(0,0,.91,.25,.37),(0,0,1.00,.23,.33)],'cloth','hip')
loft('barrelShirt',[(-.01,0,.94,.23,.34),(-.01,0,1.0,.25,.36),(-.02,0,1.17,.30,.40),(-.06,0,1.40,.34,.48),(-.08,0,1.55,.31,.53),(-.07,0,1.66,.22,.38)],'cloth','torso',20,1,.018)
ell('bullNeck',(.03,0,1.69),(.23,.25,.20),'skin','torso')
# Dark collar framing the exposed infected neck.
for s in (-1,1):
    tube('shirtCollar',[(.27,s*.02,1.50),(.24,s*.12,1.57),(.11,s*.22,1.69),(-.08,s*.25,1.69)],.037,'dark','torso')
    # Front open safety vest: substantial orange cloth, shoulder cap, folded lapel.
    patch('vestFront',[(.29,s*.16,1.05),(.29,s*.30,1.0),(.32,s*.39,1.06),(.35,s*.41,1.36),(.26,s*.46,1.60),(.04,s*.43,1.70),(.12,s*.26,1.68),(.34,s*.24,1.46)],'orange','torso',.027)
    tube('vestOuterHem',[(.33,s*.39,1.07),(.36,s*.41,1.35),(.27,s*.46,1.60),(.03,s*.43,1.70)],.009,'yellow','torso')
    tube('vestLapels',[(.31,s*.16,1.06),(.34,s*.20,1.33),(.36,s*.24,1.48),(.19,s*.28,1.66)],.013,'orange','torso')
    # Broad reflective stripes with yellow borders.
    path=[(.34,s*.29,1.07),(.37,s*.31,1.29),(.37,s*.33,1.46),(.23,s*.36,1.64),(-.04,s*.35,1.73)]
    tape('reflectiveBorder',path,.06,'yellow','torso'); tape('reflectiveTape',[(x+.007,y,z) for x,y,z in path],.036,'silver','torso')
    tape('waistTapeBorder',[(.31,s*.16,1.12),(.35,s*.30,1.12),(.33,s*.40,1.14)],.025,'yellow','torso')
    tape('waistTape',[(.323,s*.16,1.12),(.363,s*.30,1.12),(.343,s*.40,1.14)],.012,'silver','torso')
    ell('vestSnap',(.35,s*.20,1.16),(.018,.018,.018),'dark','torso',seg=12,rings=8)
# Back orange shell, draped convex shape, cross hi-vis tapes.
loft('vestBack', [(-.29,0,1.07,.032,.32),(-.34,0,1.12,.034,.35),(-.40,0,1.39,.035,.43),(-.39,0,1.57,.035,.44),(-.23,0,1.68,.035,.32)],'orange','torso',20,1,.015)
for s in (-1,1):
    p=[(-.40,s*.31,1.63),(-.42,s*.23,1.49),(-.445,0,1.32),(-.39,-s*.23,1.12)]
    tape('backReflectiveBorder',p,.06,'yellow','torso'); tape('backReflectiveTape',[(x-.012,y,z) for x,y,z in p],.036,'silver','torso')
    tape('backWaistBorder',[(-.39,s*.32,1.14),(-.40,0,1.14)],.025,'yellow','torso')
    tape('backWaistTape',[(-.403,s*.32,1.14),(-.413,0,1.14)],.012,'silver','torso')
# Belt, buckle, loops, button and fly.
loft('leatherBelt',[(0,0,.936,.253,.354),(0,0,.946,.263,.365),(0,0,.99,.263,.365),(0,0,1.0,.25,.35)],'dark','hip',24,1)
box('brassBuckle',(.277,0,.967),(.045,.15,.086),'yellow','hip',.012); box('buckleInset',(.306,0,.967),(.014,.108,.046),'dark','hip',.008)
box('buckleTongue',(.316,-.005,.967),(.012,.075,.012),'yellow','hip',.003)
for s in (-1,1):
    box('beltLoop',(.235,s*.20,.967),(.025,.035,.096),'cloth','hip',.008)
    patch('rearPocket',[(-.259,s*.12,.89),(-.269,s*.28,.89),(-.25,s*.27,.785),(-.257,s*.19,.77),(-.252,s*.12,.79)],'cloth','hip',.015)
    tape('rearPocketTop',[(-.272,s*.13,.875),(-.278,s*.27,.875)],.014,'dark','hip')
    tube('pocketOpening',[(.22,s*.18,.90),(.24,s*.29,.83)],.012,'dark','hip')
tube('fly',[(.26,0,.93),(.269,0,.83),(.23,0,.77)],.01,'dark','hip')
# Arms: broad short sleeves, enormous biceps/forearms and individually curled fingers.
for s,label in [(1,'L'),(-1,'R')]:
    shoulder=(-.05,s*.47,1.57); elbow=(.04,s*.68,1.21); wrist=(.13,s*.83,.86)
    group('arm'+label,shoulder,'torso'); group('foreArm'+label,elbow,'arm'+label); group('hand'+label,wrist,'foreArm'+label)
    loft('upperArm',[(.05,s*.69,1.16,.145,.15),(.03,s*.66,1.24,.20,.20),(-.02,s*.59,1.43,.23,.23),(-.05,s*.50,1.61,.22,.24)],'skin','arm'+label,20,1)
    loft('tornSleeve',[(.01,s*.64,1.30,.211,.216),(-.02,s*.60,1.40,.26,.255),(-.08,s*.51,1.59,.27,.285),(-.10,s*.43,1.65,.21,.20)],'cloth','arm'+label,20,1,.06)
    tube('rolledSleeveSeam',[(.205,s*.60,1.36),(.19,s*.69,1.39),(.07,s*.82,1.41),(-.1,s*.81,1.42)],.018,'cloth','arm'+label)
    loft('massiveForearm',[(.14,s*.83,.84,.135,.135),(.14,s*.82,.91,.17,.17),(.10,s*.77,1.02,.218,.21),(.06,s*.70,1.16,.21,.21),(.04,s*.68,1.23,.17,.16)],'skin','foreArm'+label,20,1)
    ell('elbowBone',(-.04,s*.72,1.19),(.14,.17,.13),'skin','foreArm'+label)
    ell('palm',(.17,s*.86,.77),(.155,.145,.16),'skin','hand'+label)
    for k in range(4):
        yy=s*(.775+k*.056)
        # Three knuckle lobes, bent claw at the front of each dangling finger.
        ell('fingerKnuckle',(.22,yy,.70),(.075,.037,.067),'skin','hand'+label,seg=14,rings=8)
        tube('curledFinger',[(.215,yy,.71),(.24,yy,.64),(.30,yy,.625),(.335,yy,.67)],.033,'skin','hand'+label)
        ell('dirtyNail',(.357,yy,.673),(.012,.025,.031),'silver','hand'+label,seg=12,rings=8)
    tube('thumb',[(.23,s*.76,.82),(.31,s*.727,.79),(.345,s*.75,.73)],.052,'skin','hand'+label)
    ell('thumbNail',(.38,s*.75,.734),(.011,.03,.029),'silver','hand'+label,seg=12,rings=8)
    # Wounds, tears and short irregular scar seams. No realistic texture overlays.
    ell('forearmWound',(.279,s*.77,1.07),(.008,.079,.102),'blood','foreArm'+label,rot=(s*.3,0,0),seg=16,rings=10)
    ell('woundCore',(.286,s*.77,1.085),(.005,.047,.047),'red','foreArm'+label,seg=14,rings=8)
    tube('bloodTrail',[(.283,s*.77,1.05),(.283,s*.75,1.00),(.267,s*.78,.97)],.018,'blood','foreArm'+label)
    for k in range(5):
        ell('handSplatter',(.307,s*(.80+k*.025),.79+(k%2)*.034),(.013,.018,.025),'blood','hand'+label,seg=10,rings=6)
    for k in range(3):
        yy=s*(.48+k*.075); z=1.60-k*.066
        ell('sleeveRip',(.147,yy,z),(.043,.037,.022),'dark','arm'+label,seg=12,rings=8)
        ell('exposedSleeveSkin',(.179,yy,z),(.016,.022,.015),'skin','arm'+label,seg=12,rings=8)
    # Trouser legs, baggy cropped knees and exposed ankle.
    hip=(0,s*.24,.86); knee=(.04,s*.33,.49); ankle=(.07,s*.37,.19)
    group('leg'+label,hip,'hip'); group('shin'+label,knee,'leg'+label); group('foot'+label,ankle,'shin'+label)
    loft('baggyThigh',[(.04,s*.33,.46,.175,.185),(.03,s*.32,.53,.21,.215),(0,s*.27,.73,.215,.225),(0,s*.23,.89,.20,.22)],'cloth','leg'+label,20,1,.03)
    loft('croppedPants',[(.06,s*.36,.27,.144,.17),(.055,s*.35,.31,.18,.19),(.05,s*.34,.44,.19,.20),(.04,s*.33,.52,.17,.18)],'cloth','shin'+label,20,1,.025)
    loft('rolledCuff',[(.06,s*.36,.285,.166,.186),(.06,s*.36,.305,.187,.207),(.055,s*.35,.35,.185,.20),(.055,s*.35,.37,.17,.18)],'cloth','shin'+label,20,1,.01)
    ell('ankle',(.065,s*.37,.23),(.118,.13,.12),'skin','shin'+label)
    ell('rippedKneeHole',(.209,s*.33,.515),(.025,.103,.09),'dark','leg'+label)
    ell('exposedKnee',(.23,s*.33,.519),(.025,.086,.072),'skin','leg'+label)
    ell('kneeAbrasion',(.249,s*.32,.513),(.011,.046,.045),'blood','leg'+label,seg=14,rings=8)
    for k in range(3):
        tube('trouserFold',[(.18,s*(.27+k*.022),.66-k*.09),(.223,s*.32,.63-k*.09),(.18,s*.41,.65-k*.09)],.012,'dark','leg'+label)
    tube('sideSeam',[(-.06,s*.46,.83),(-.05,s*.51,.66),(-.035,s*.50,.50)],.008,'silver','leg'+label)
    # Chunky red canvas shoes, separate soles/toecaps/eyelets/laces/tread.
    box('sneakerSole',(.15,s*.38,.057),(.43,.30,.114),'white','foot'+label,.045)
    box('rubberOutsole',(.15,s*.38,.019),(.432,.305,.038),'dark','foot'+label,.012)
    ell('redShoeUpper',(.115,s*.38,.142),(.198,.14,.11),'red','foot'+label)
    box('toeCap',(.31,s*.38,.117),(.13,.27,.105),'white','foot'+label,.043)
    box('tongue',(.135,s*.38,.232),(.14,.12,.025),'red','foot'+label,.012,rot=(0,-.3,0))
    for k in range(4):
        x=.095+k*.037; z=.246-k*.008
        for t in (-1,1): ell('laceEyelet',(x,s*.38+t*.066,z),(.012,.012,.008),'yellow','foot'+label,seg=10,rings=6)
        tube('crossLace',[(x,s*.38-.064,z+.005),(x+.03,s*.38+.064,z+.006)],.007,'white','foot'+label)
        tube('crossLace',[(x,s*.38+.064,z+.007),(x+.03,s*.38-.064,z+.008)],.007,'white','foot'+label)
    tube('laceBow',[(.095,s*.38,.255),(.058,s*.30,.27),(.04,s*.32,.263),(.095,s*.38,.255),(.057,s*.45,.26),(.04,s*.44,.26)],.007,'white','foot'+label)
    for k in range(5): box('soleTread',(.0+k*.075,s*.38,.014),(.038,.308,.025),'white','foot'+label,.005)
    for k in range(3): ell('shoeBlood',(.37,s*(.33+k*.03),.117),(.008,.015,.018),'blood','foot'+label,seg=10,rings=6)
# Sculpted angry face: skull, cheeks, ears, an open maw, separate gums and teeth.
loft('cranium',[(.18,0,1.69,.12,.125),(.21,0,1.74,.155,.175),(.19,0,1.89,.175,.205),(.13,0,2.04,.18,.215),(.07,0,2.12,.13,.165)],'skin','head',24,1)
ell('jaw',(.25,0,1.755),(.17,.17,.095),'skin','head')
ell('mawDark',(.379,0,1.805),(.05,.134,.119),'dark','head',seg=24,rings=16)
tube('upperLip',[(.373,-.134,1.83),(.42,-.09,1.9),(.435,0,1.885),(.42,.09,1.90),(.373,.134,1.83)],.020,'skin','head')
tube('lowerLip',[(.375,-.127,1.81),(.414,-.10,1.727),(.434,0,1.706),(.414,.10,1.727),(.375,.127,1.81)],.016,'skin','head')
ell('tongue',(.423,0,1.75),(.027,.07,.024),'red','head')
for k in range(7):
    yy=(k-3)*.031
    box('upperTooth',(.436-abs(yy)*.2,yy,1.866-abs(yy)*.02),(.022,.025,.037 if k%2 else .047),'white','head',.006,rot=(0,.12,(k-3)*.05))
    box('lowerTooth',(.433-abs(yy)*.17,yy,1.742),(.021,.024,.027),'white','head',.005)
for s in (-1,1):
    ell('cheekbone',(.325,s*.145,1.883),(.075,.063,.07),'skin','head',rot=(s*.1,-.35,0))
    ell('eyeSocket',(.325,s*.096,1.983),(.065,.08,.045),'blood','head',rot=(s*-.23,0,0))
    ell('redEye',(.383,s*.098,1.983),(.016,.040,.022),'eye','head',rot=(s*-.25,0,0),seg=20,rings=10)
    ell('eyeHotCore',(.398,s*.098,1.985),(.006,.013,.010),'eye','head',seg=12,rings=8)
    tube('heavyBrow',[(.328,s*.177,2.035),(.385,s*.111,2.025),(.379,s*.042,2.004)],.025,'skin','head')
    tube('browHair',[(.345,s*.169,2.05),(.392,s*.106,2.037),(.393,s*.046,2.02)],.017,'dark','head')
    ell('ear',(.08,s*.211,1.973),(.072,.052,.10),'skin','head')
    ell('earRecess',(.137,s*.234,1.979),(.012,.027,.058),'blood','head',seg=14,rings=8)
    tube('snarlFold',[(.384,s*.061,1.919),(.393,s*.098,1.902),(.381,s*.139,1.865)],.01,'dark','head')
    tube('cheekScar',[(.334,s*.18,1.952),(.356,s*.172,1.917),(.34,s*.193,1.88)],.008,'blood','head')
ell('noseBridge',(.349,0,1.964),(.058,.040,.076),'skin','head')
ell('brokenNose',(.410,0,1.934),(.045,.051,.030),'skin','head')
for s in (-1,1): ell('nostril',(.46,s*.033,1.917),(.014,.018,.011),'dark','head',seg=12,rings=8)
# Swept hair cap and chunky tapered locks with sculpted ridges.
ell('hairCap',(.025,0,2.089),(.17,.204,.095),'dark','head')
def lock(n,pts,radii):
    vs=[]; steps=8
    for j,(p,r) in enumerate(zip(pts,radii)):
        direction=Vector(pts[min(j+1,len(pts)-1)])-Vector(pts[max(j-1,0)])
        direction.normalize(); a=direction.cross(Vector((0,1,0))).normalized(); b=direction.cross(a).normalized()
        for k in range(steps): vs.append(Vector(p)+r*(a*math.cos(k*math.tau/steps)+b*math.sin(k*math.tau/steps)))
    fs=[tuple(range(steps-1,-1,-1))]
    for j in range(len(pts)-1):
        for k in range(steps): q=j*steps+k; u=j*steps+(k+1)%steps; fs.append((q,u,u+steps,q+steps))
    fs.append(tuple(range((len(pts)-1)*steps,len(vs))))
    me=bpy.data.meshes.new(n); me.from_pydata(vs,[],fs); me.update(); o=bpy.data.objects.new(n,me); COL.objects.link(o); finish(o,n,'dark','head',1)
for k in range(7):
    yy=-.165+k*.054
    dz=.026*math.sin(k*2.1)
    lock('sweptHair',[(.14,yy,2.10),(.10,yy-.012,2.18+dz),(-.035,yy-.025,2.205+dz),(-.16-k*.007,yy-.015,2.17+dz),(-.21-k*.012,yy+.012,2.16+dz)],[.043,.047,.038,.022,.001])
for s in (-1,1):
    lock('templeLock',[(.11,s*.17,2.08),(.15,s*.195,2.06),(.10,s*.195,2.0)],[.04,.033,.001])
    lock('foreheadTuft',[(.13,s*.04,2.15),(.24,s*.065,2.12),(.27,s*.09,2.069)],[.038,.027,.001])
# Purposeful little torn flaps, cloth wear, and stylized stains on chest and vest.
for s in (-1,1):
    for k in range(4):
        x=.27+(k%2)*.035; y=s*(.065+k*.032); z=1.49-k*.075
        patch('chestBlood',[(.326,y-.025,z+.025),(.329,y-.014,z+.044),(.332,y+.018,z+.018),(.33,y+.025,z-.012),(.327,y+.012,z-.039),(.325,y-.018,z-.015)],'blood','torso',.003)
    for k in range(3):
        yy=s*(.30+k*.033); z=1.22+k*.115
        ell('vestStain',(.369,yy,z),(.007,.017,.030),'blood','torso',seg=10,rings=6)
    patch('tornShirtFlap',[(.31,s*.13,1.50),(.325,s*.19,1.45),(.342,s*.16,1.37),(.33,s*.13,1.44)],'cloth','torso')
    patch('vestHemNotch',[(.327,s*.27,1.045),(.35,s*.33,1.045),(.344,s*.32,1.008)],'orange','torso')
for side,label in [(1,'L'),(-1,'R')]:
    for k in range(5):
        y=side*(.59+k*.04); z=1.35+(k%2)*.022
        patch('raggedSleeveTag',[(.16,y,z+.025),(.18,y+side*.026,z+.02),(.20,y+side*.013,z-.045)],'cloth','arm'+label,.018)
    for k in range(4):
        y=side*.33+(k-1.5)*.035
        patch('kneeTearFringe',[(.231,y,.57),(.235,y+.023,.568),(.253,y+.013,.545-(k%2)*.024)],'cloth','leg'+label,.01)
# Raised tailoring folds and torn cloth edges remain readable at isometric distance.
for side in (-1,1):
    for k in range(3):
        tube('shirtCompressionFold',[(.28,side*.045,1.10+k*.074),(.312,side*.12,1.117+k*.072),(.30,side*.19,1.101+k*.075)],.008,'cloth','torso')
    for k in range(3):
        patch('vestWear',[(.358,side*(.35+k*.014),1.38+k*.061),(.362,side*(.37+k*.013),1.39+k*.061),(.36,side*(.365+k*.012),1.365+k*.061)],'cloth','torso',.003)
    tube('vestBackFold',[(-.433,side*.29,1.30),(-.44,side*.33,1.40),(-.42,side*.35,1.52)],.01,'orange','torso')
    patch('tornThighCloth',[(.18,side*.39,.76),(.199,side*.42,.73),(.219,side*.41,.68),(.204,side*.39,.71)],'cloth','leg'+('L' if side==1 else 'R'),.012)
# Integrate the facial skin into one sculpt, avoiding separate cheek/ear bubbles.
skin=[o for o in pieces['head'] if o.data.materials[0]==M['skin']]
bpy.ops.object.select_all(action='DESELECT')
for o in skin: o.select_set(True)
bpy.context.view_layer.objects.active=skin[0]; bpy.ops.object.join(); face=bpy.context.object
pieces['head']=[o for o in pieces['head'] if o not in skin]+[face]
md=face.modifiers.new('Integrated face sculpt','REMESH'); md.mode='VOXEL'; md.voxel_size=.012; md.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=md.name)
md=face.modifiers.new('Sculpt polish','SMOOTH'); md.factor=.65; md.iterations=4; bpy.ops.object.modifier_apply(modifier=md.name)
# Lower the head toward the shoulders for the reference's menacing hunch.
G['head'].location.z-=.045; G['head'].location.x+=.025
# Consolidate all static details under each rigid joint into a single multimaterial mesh.
for parent,objs in pieces.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join(); o=bpy.context.object; o.name=parent+'_surface'
    w=o.matrix_world.copy(); o.parent=G[parent]; o.matrix_world=w
    # Break symmetric collapse-cost ties deterministically (10 micrometres).
    for v in o.data.vertices:
        i=v.index+1; v.co+=Vector((math.sin(i*1.71),math.sin(i*2.39),math.sin(i*3.17)))*.00001
    md=o.modifiers.new('Hero budget reduction','DECIMATE'); md.ratio=.57
    bpy.ops.object.modifier_apply(modifier=md.name)
# Stumps have joint-space origins, invisible rest scales, and explicit export metadata.
for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']:
    pos=G[n].matrix_world.translation.copy(); radius=.12 if n=='head' else (.15 if n.startswith('arm') else .13)
    o=ell('stump_'+n,pos,(radius,radius,.026),'blood',n,seg=20,rings=10)
    if n.startswith('arm') or n.startswith('fore'): o.rotation_euler.x=.25
    o['ss_hidden']=True; o['ss_visible_scale']=[1,1,1]; o['ss_stump_for']=n; o.scale=(0,0,0)
G['root']['asset_id']='inf.brute'; G['root']['forward']='+X'; G['root']['rig']='rigid'; G['root']['height_m']=2.22
bpy.context.view_layer.update()
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket']+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
tri=0
for o in COL.objects:
    if o.type=='MESH': o.data.calc_loop_triangles(); tri+=len(o.data.loop_triangles)
missing=[n for n in required if n not in bpy.data.objects]
report={'id':'inf.brute','triangles':tri,'meshes':sum(o.type=='MESH' for o in COL.objects),'nodes_ok':not missing,'missing_nodes':missing,'rounds':int(arg('--round',4)),'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2))
print('BUILD OK',json.dumps(report))
if arg('--glb'):
    bpy.ops.object.select_all(action='DESELECT')
    for o in COL.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_texcoords=False,export_cameras=False,export_lights=False)
    print('GLB OK')
if '--pose' in ARGS:
    G['armL'].rotation_euler.x=-.65; G['armL'].rotation_euler.y=-.28
    G['foreArmL'].rotation_euler.y=-.95; G['legR'].rotation_euler.y=.30
    bpy.data.objects['stump_armL'].scale=(1,1,1)
    # Hide detached upper-arm surface; elbow and hand remain posed to show hierarchy.
    bpy.data.objects['armL_surface'].hide_render=True
    G['root']['pose_test']='armL x=-.65 y=-.28; foreArmL y=-.95; legR y=.30; stump_armL visible'
if arg('--render'):
    def area(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA'); d.energy=power; d.color=color; d.shape='DISK'; d.size=size
        o=bpy.data.objects.new(n,d); SC.collection.objects.link(o); o.location=p; o.rotation_euler=(Vector((0,0,1.1))-o.location).to_track_quat('-Z','Y').to_euler()
    area('warm key',(4,-4,6),650,(1,.82,.66),4)
    area('cool fill',(1,4,3),350,(.58,.67,1),3)
    area('rim',(-3,-1,5),900,(1,.65,.35),3)
    SC.world=bpy.data.worlds.new('Studio'); SC.world.use_nodes=True; SC.world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.13,.18,1); SC.world.node_tree.nodes['Background'].inputs[1].default_value=.4
    bpy.ops.mesh.primitive_plane_add(size=200); floor=bpy.context.object; floor.name='Studio floor'
    fm=mat('studio','302d36'); floor.data.materials.append(fm)
    cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera')); SC.collection.objects.link(cam); SC.camera=cam; cam.data.type='ORTHO'; cam.data.ortho_scale=4.7
    view=arg('--view','ref'); views={'ref':(7,-5,3.5),'far':(7,5,3.5),'front':(8,0,1.75),'side':(0,-8,1.75),'back':(-8,0,1.75)}
    cam.location=views[view]; cam.rotation_euler=(Vector((0,0,1.08))-cam.location).to_track_quat('-Z','Y').to_euler()
    SC.render.engine='CYCLES'; pref=bpy.context.preferences.addons['cycles'].preferences
    pref.compute_device_type='METAL'; pref.get_devices()
    for d in pref.devices: d.use=True
    SC.cycles.device='GPU'; SC.cycles.samples=int(arg('--samples',24)); SC.cycles.use_denoising=True
    SC.view_settings.view_transform='AgX'; SC.view_settings.look='AgX - Medium High Contrast'
    SC.render.resolution_x=int(arg('--width',960)); SC.render.resolution_y=int(arg('--height',540)); SC.render.resolution_percentage=100
    SC.render.image_settings.file_format='PNG'; SC.render.filepath=str(Path(arg('--render')).resolve()); bpy.ops.render.render(write_still=True)
    print('RENDER OK')
