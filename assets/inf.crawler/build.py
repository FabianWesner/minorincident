"""Minor Incident legless infected crawler. +X forward, Z up; rigid joint tree.
Reproducible palette-only geometry. Subdivision and bevels applied before GLB.
Use only experiment/tools/blender_run.py to execute this script.
"""
import bpy, math, sys, json, random
from pathlib import Path
from mathutils import Vector
HERE = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(k,d=None): return ARGS[ARGS.index(k)+1] if k in ARGS else d
# Contact sheet assembly uses Blender image buffers; source renders stay untouched.
if arg('--view')=='sheet':
    from array import array
    w,h=960,540
    sheet=bpy.data.images.new('turnaround',width=w*2,height=h*2,alpha=True)
    buffer=array('f',[0])*(w*h*16)
    for name,col,row in [('front',0,1),('side',1,1),('back',0,0),('hero',1,0)]:
        im=bpy.data.images.load(str(HERE/'renders'/f'{name}.png'));im.scale(w,h)
        pixels=array('f',[0])*(w*h*4);im.pixels.foreach_get(pixels)
        for y in range(h):
            start=((row*h+y)*w*2+col*w)*4
            buffer[start:start+w*4]=pixels[y*w*4:(y+1)*w*4]
    sheet.pixels.foreach_set(buffer);sheet.filepath_raw=str(Path(arg('--render')).resolve());sheet.file_format='PNG';sheet.save()
    print('SHEET OK');sys.exit(0)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
parts={}
def rgb(h):
    v=[int(h[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in v)+(1,)
def mat(token,h,rough=.65,emission=0):
    m=bpy.data.materials.new(('emi_' if emission else 'pal_')+token); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=rgb(h); p.inputs['Roughness'].default_value=rough
    if emission: p.inputs['Emission Color'].default_value=rgb(h); p.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=rgb(h); return m
M={
 'skin':mat('infectedSkin','#c9a39a',.58),
 'shorts':mat('asphalt','#5b4f5c',.82), 'hair':mat('woodWarm','#68392b',.68),
 'cream':mat('picketWhite','#f2e6dc',.74), 'blood':mat('blood','#b3121f',.29),
 'dark':mat('uiDark','#25222c',.7),
 'eye':mat('infectedEye','#ff3b2f',.25,3.5)}
def parent_keep(o,p):
    bpy.context.view_layer.update(); mw=o.matrix_world.copy(); o.parent=parts[p] if isinstance(p,str) else p; o.matrix_world=mw

def node(n,loc,p=None):
    o=bpy.data.objects.new(n,None); scene.collection.objects.link(o); o.location=loc
    parts[n]=o
    if p: parent_keep(o,p)
    return o

def finish(o,n,m,p):
    o.name=n; o.data.materials.append(M[m])
    for f in o.data.polygons: f.use_smooth=True
    bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    if p: parent_keep(o,p)
    return o

def ell(n,c,s,m,p,detail=1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16 if detail else 10,ring_count=10 if detail else 6,location=c)
    o=bpy.context.object; o.scale=s
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,n,m,p)

def box(n,c,s,m,p,b=.015,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=c); o=bpy.context.object; o.scale=s
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('Soft tailored edges','BEVEL'); mod.width=min(b,min(s)*.4);mod.segments=3
    mod=o.modifiers.new('Corner normals','WEIGHTED_NORMAL')
    if rot: o.rotation_euler=rot
    return finish(o,n,m,p)

def sculpt(n,c,s,m,p):
    bpy.ops.mesh.primitive_cube_add(size=2,location=c); o=bpy.context.object
    mod=o.modifiers.new('Applied sculpt subdivision','SUBSURF');mod.levels=2
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    o.scale=s; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,n,m,p)

def tube(n,points,radii,m,p,segments=8):
    # Catmull-Rom interpolation turns hair control points into soft swept volumes.
    source=[Vector(q) for q in points]
    if m=='hair':
        sampled=[]; radii_new=[]
        for i in range(len(source)-1):
            a=source[max(0,i-1)];b=source[i];c=source[i+1];d=source[min(len(source)-1,i+2)]
            for t in (0,.5):
                sampled.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
                radii_new.append(radii[i]*(1-t)+radii[i+1]*t)
        sampled.append(source[-1]);radii_new.append(radii[-1]);source=sampled;radii=radii_new
    pts=source; vs=[]; fs=[]
    for i,q in enumerate(pts):
        tangent=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        u=tangent.cross(Vector((1,0,0)))
        if u.length<.01: u=tangent.cross(Vector((0,1,0)))
        u.normalize(); v=tangent.cross(u).normalized()
        for k in range(segments):
            a=2*math.pi*k/segments;vs.append(q+radii[i]*(math.cos(a)*u+math.sin(a)*v))
    for i in range(len(pts)-1):
        for k in range(segments): a=i*segments+k;b=i*segments+(k+1)%segments;fs.append((a,b,b+segments,a+segments))
    fs.extend([tuple(range(segments-1,-1,-1)),tuple((len(pts)-1)*segments+k for k in range(segments))])
    me=bpy.data.meshes.new(n);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(n,me);scene.collection.objects.link(o)
    return finish(o,n,m,p)

def line(n,pts,r,m,p): return tube(n,pts,[r]*len(pts),m,p)

def limb(n,a,b,r1,r2,m,p):
    a=Vector(a); b=Vector(b)
    pts=[a.lerp(b,t) for t in (0,.08,.25,.55,.85,1)]
    return tube(n,pts,[r1,r1,r1*.98,(r1+r2)/2,r2,r2],m,p,12)

def mesh(n,vs,fs,m,p,sub=0):
    me=bpy.data.meshes.new(n);me.from_pydata(vs,[],fs);me.update()
    o=bpy.data.objects.new(n,me);scene.collection.objects.link(o)
    if sub:
        mod=o.modifiers.new('Applied organic subdivision','SUBSURF');mod.levels=sub
    return finish(o,n,m,p)

node('root',(0,0,0));node('hip',(-.40,0,.26),'root');node('torso',(-.30,0,.38),'hip')
node('head',(.19,0,.57),'torso');node('backpackSocket',(-.29,0,.64),'torso')
joints={}
for side,sy in [('L',1),('R',-1)]:
    q={'shoulder':(.02,sy*.23,.57),'elbow':(.22,sy*.35,.31),'wrist':(.48,sy*.39,.12),'hip':(-.43,sy*.12,.25),'knee':(-.65,sy*.14,.075),'ankle':(-.65,sy*.14,.04)}
    joints[side]=q
    for n,key,p in [('arm','shoulder','torso'),('foreArm','elbow','arm'+side),('hand','wrist','foreArm'+side),('leg','hip','hip'),('shin','knee','leg'+side),('foot','ankle','shin'+side)]:node(n+side,q[key],p)
# Separate tailored shirt shell over the hunched ribcage.
shirt=ell('shirtBody',(-.17,0,.46),(.35,.245,.185),'cream','torso');shirt.rotation_euler.y=-.31
ell('neck',(.16,0,.58),(.10,.093,.11),'skin','head')
sculpt('trouserSeat',(-.45,0,.245),(.23,.22,.16),'shorts','hip')
line('waistband',[(-.36,-.22,.355),(-.43,-.19,.39),(-.50,0,.403),(-.43,.19,.39),(-.36,.22,.355)],.023,'dark','hip')
for sy in (-1,1):
    box('beltLoop',(-.48,sy*.15,.389),(.035,.023,.055),'shorts','hip',.006,rot=(0,-.25,0))
    box('rearPocket',(-.632,sy*.115,.266),(.012,.105,.093),'shorts','hip',.013)
    line('pocketStitch',[(-.641,sy*.066,.302),(-.645,sy*.162,.294),(-.648,sy*.154,.231),(-.647,sy*.11,.218),(-.645,sy*.068,.234)],.0025,'dark','hip')
    # Collar points, placket, buttons, hanging tie and shirt tails.
    o=mesh('collarPoint',[(.145,sy*.03,.652),(.09,sy*.14,.63),(.205,sy*.126,.514),(.208,sy*.05,.58)],[(0,1,2,3)],'cream','torso',1)
    bpy.context.view_layer.objects.active=o;md=o.modifiers.new('Thick collar','SOLIDIFY');md.thickness=.018;bpy.ops.object.modifier_apply(modifier=md.name)
    line('collarSeam',[(.15,sy*.035,.65),(.094,sy*.136,.628),(.204,sy*.126,.52)],.004,'cream','torso')
    for j in range(6):
        xx=-.39+j*.105; yy=sy*(.11+(.045 if j%2 else 0));zz=.32+.08*(xx+.4)
        mesh('tornShirtTail',[(xx-.035,yy,.36),(xx+.041,yy,.36),(xx+.024,yy+sy*.027,zz-.045)],[(0,1,2)],'cream','torso',1)
    for j in range(3):
        line('shirtCrease',[(-.35+j*.12,sy*.219,.46+j*.03),(-.30+j*.12,sy*.248,.44+j*.03),(-.23+j*.12,sy*.224,.45+j*.03)],.007,'cream','torso')
line('buttonPlacket',[(.163,0,.576),(.173,0,.48),(.095,0,.365)],.018,'cream','torso')
for z,x in [(.53,.191),(.46,.184),(.39,.125)]:ell('shirtButton',(x,0,z),(.007,.011,.011),'shorts','torso',0)
sculpt('tieKnot',(.199,0,.545),(.026,.032,.035),'blood','torso')
o=mesh('looseTie',[(.205,-.021,.52),(.212,.02,.52),(.267,.025,.30),(.26,-.015,.25),(.218,-.037,.295)],[(0,1,2,3,4)],'blood','torso',1)
bpy.context.view_layer.objects.active=o;md=o.modifiers.new('Tie fabric','SOLIDIFY');md.thickness=.012;bpy.ops.object.modifier_apply(modifier=md.name)
for side,q in joints.items():
    sy=1 if side=='L' else -1;a=Vector(q['shoulder']);b=Vector(q['elbow']);w=Vector(q['wrist'])
    limb('upperArm',a,b,.093,.072,'skin','arm'+side)
    ell('shoulderCap',a,(.116,.115,.115),'cream','arm'+side)
    limb('shirtSleeve',a,b,.113,.091,'cream','arm'+side)
    limb('forearm',b,w,.072,.052,'skin','foreArm'+side)
    limb('rolledSleeve',b,b.lerp(w,.63),.097,.078,'cream','foreArm'+side)
    rim=b.lerp(w,.62);axis=(w-b).normalized()
    u=axis.cross(Vector((0,1,0))).normalized();v=axis.cross(u)
    line('rolledCuff',[rim+.081*(math.cos(t)*u+math.sin(t)*v) for t in [i*math.tau/24 for i in range(25)]],.014,'cream','foreArm'+side)
    for j in range(3):
        c=a.lerp(b,.3+j*.23)
        line('sleeveFold',[c+Vector((.08,-.06,0)),c+Vector((.11,0,.015)),c+Vector((.076,.067,0))],.008,'cream','arm'+side)
    palm=w+Vector((.076,sy*.012,-.047))
    limb('wristBridge',w,palm,.054,.071,'skin','hand'+side)
    sculpt('broadPalm',palm,(.114,.094,.054),'skin','hand'+side)
    for j in range(4):
        yy=palm.y+(j-1.5)*.043;ln=.16-abs(j-1.5)*.026;spread=(j-1.5)*.016
        pts=[(palm.x+.053,yy,.079),(palm.x+.11,yy+spread,.073),(palm.x+.053+ln,yy+spread*1.6,.045),(palm.x+.059+ln,yy+spread*1.7,.022)]
        tube('splayedFinger',pts,[.023,.025,.021,.013],'skin','hand'+side,12)
        ell('knuckle',(palm.x+.11,yy+spread,.078),(.027,.025,.025),'skin','hand'+side)
        box('brokenNail',(pts[-1][0]+.002,pts[-1][1],.038),(.027,.022,.008),'cream','hand'+side,.004)
        line('fingerCrease',[(pts[2][0]-.012,pts[2][1]-.015,.066),(pts[2][0],pts[2][1],.069),(pts[2][0]+.003,pts[2][1]+.015,.062)],.0025,'blood','hand'+side)
    tube('thumb',[(palm.x+.015,palm.y-sy*.057,.07),(palm.x+.066,palm.y-sy*.13,.046),(palm.x+.11,palm.y-sy*.15,.025)],[.032,.026,.016],'skin','hand'+side,12)
    ell('thumbNail',(palm.x+.108,palm.y-sy*.15,.041),(.021,.018,.006),'cream','hand'+side,0)
    # Short torn trouser ends and the visible comic stump faces.
    start=Vector(q['hip']);end=Vector(q['knee'])
    limb('trouserStump',start,end,.125,.102,'shorts','leg'+side)
    ell('openStump',end+Vector((-.03,0,.012)),(.022,.092,.074),'blood','leg'+side)
    ell('stumpInset',end+Vector((-.048,0,.014)),(.01,.052,.043),'dark','leg'+side)
    ell('stumpBone',end+Vector((-.06,.014,.02)),(.014,.018,.023),'cream','leg'+side,0)
    for j in range(9):
        t=j*math.tau/9;rr=.092
        c=end+Vector((-.02,math.sin(t)*rr,math.cos(t)*rr*.78))
        tube('raggedTrouserEdge',[c+Vector((.045,0,0)),c,c+Vector((-.025,math.sin(t)*.012,math.cos(t)*.012))],[.023,.02,.001],'shorts','leg'+side)
    line('trouserSideSeam',[(-.41,sy*.226,.29),(-.52,sy*.246,.20),(-.64,sy*.217,.135)],.003,'dark','leg'+side)

# Face design translated from the shared infected facial proportions.
face_before=set(scene.objects)
# Sculpted face: cheek/jaw silhouette, furious eyes, nose, open snarl and thick ears.
ell('cranium',(.13,0,1.365),(.18,.207,.216),'skin','head')
sculpt('jaw',(.20,0,1.239),(.12,.143,.116),'skin','head')
for sy in (-1,1):
    ell('cheek',(.25,sy*.112,1.291),(.042,.052,.055),'skin','head')
    ell('ear',(.095,sy*.202,1.336),(.05,.035,.062),'skin','head')
    ell('earConcha',(.129,sy*.219,1.34),(.016,.013,.037),'blood','head')
    ell('earTragus',(.142,sy*.221,1.337),(.013,.009,.023),'skin','head')
    ell('eyeSocket',(.279,sy*.088,1.396),(.024,.06,.058),'blood','head')
    ell('eyeWhite',(.291,sy*.088,1.398),(.019,.046,.038),'cream','head')
    ell('redIris',(.309,sy*.087,1.398),(.008,.027,.030),'eye','head')
    ell('pupil',(.317,sy*.084,1.4),(.003,.011,.016),'dark','head',0)
    ell('eyeGlint',(.320,sy*.077,1.415),(.004,.006,.007),'cream','head',0)
    line('angryBrow',[(.308,sy*.145,1.452),(.322,sy*.101,1.439),(.329,sy*.045,1.409)],.019,'hair','head')
    line('lowerLid',[(.295,sy*.133,1.38),(.318,sy*.087,1.353),(.303,sy*.045,1.365)],.004,'skin','head')
ell('noseBridge',(.296,0,1.347),(.027,.023,.052),'skin','head')
ell('noseTip',(.33,0,1.328),(.035,.037,.024),'skin','head')
for sy in (-1,1):ell('nostril',(.352,sy*.022,1.316),(.007,.008,.005),'dark','head',0)
ell('mouthCavity',(.301,0,1.241),(.031,.079,.069),'dark','head')
line('snarlLip',[(.325,.08*math.sin(t),1.241+.069*math.cos(t)) for t in [i*math.tau/28 for i in range(29)]],.006,'blood','head')
ell('tongue',(.329,.005,1.208),(.009,.042,.017),'blood','head')
for i in range(7):box('upperTooth',(.334,(i-3)*.021,1.28+(.005 if abs(i-3)>1 else 0)),(.018,.016,.02 if i!=1 else .012),'cream','head',.004)
for i in range(5):box('lowerTooth',(.335,(i-2)*.024,1.197),(.016,.018,.014),'cream','head',.003)

for facial_part in set(scene.objects)-face_before:
    transform=facial_part.matrix_world.copy()
    transform.translation+=Vector((.19,0,-.66))
    facial_part.matrix_world=transform
# Thick tousled locks, with sculpted tapered tufts rather than a faceted helmet.
ell('hairMass',(.256,0,.822),(.197,.204,.173),'hair','head')
rng=random.Random(187)
for j in range(52):
    t=j*2.39996;z=-.40+1.38*(j+.5)/52;r=math.sqrt(1-z*z)
    d=Vector((math.cos(t)*r,math.sin(t)*r,z));base=Vector((.255,0,.816))+Vector((d.x*.15,d.y*.169,d.z*.115))
    tip=base+d*rng.uniform(.075,.13)+Vector((-.045,0,-.015))
    tube('tousledHair',[base,base+d*.038,base.lerp(tip,.65)+Vector((-.015,.012,.015)),tip],[.044,.055,.031,.0015],'hair','head',8)
for j in range(9):
    y=(j-4)*.041
    tube('foreheadBang',[(.29,y*.72,.936),(.38,y,.884),(.439,y+.014,.830),(.442,y+.018,.779+abs(j-4)*.012)],[.036,.046,.033,.0015],'hair','head',12)
for sy in (-1,1):
    for j in range(4):
        tube('templeLock',[(.28-j*.034,sy*.16,.9),(.31-j*.035,sy*.214,.8),(.27-j*.042,sy*.211,.696)],[.034,.038,.002],'hair','head',10)
# Surface-conforming raised blood marks, no coplanar decals.
def stain(target, center, direction, radius, parent):
    d=Vector(direction).normalized();center=Vector(center);u=d.cross(Vector((0,0,1)))
    if u.length<.01:u=d.cross(Vector((0,1,0)))
    u.normalize();v=d.cross(u).normalized();vs=[];N=9
    for i in range(N+1):
        r=0 if i==0 else radius*rng.uniform(.48,1.15);t=(i-1)*math.tau/N
        origin=center+u*math.cos(t)*r+v*math.sin(t)*r+d*2
        inv=target.matrix_world.inverted();hit,loc,n,_=target.ray_cast(inv@origin,inv.to_3x3()@(-d))
        if not hit:return
        vs.append(tuple(target.matrix_world@loc+(target.matrix_world.to_3x3()@n).normalized()*.004))
    mesh('bloodSpatter',vs,[(0,i+1,(i+1)%N+1) for i in range(N)],'blood',parent)
bpy.context.view_layer.update()
for parent in ['torso','armL','armR','foreArmL','foreArmR','handL','handR','head']:
    targets=[o for o in list(scene.objects) if o.type=='MESH' and o.parent==parts[parent] and o.data.materials[0] in [M['cream'],M['skin']] and len(o.data.polygons)>60]
    for target in targets:
        if 'head'==parent and target.name not in ['cranium','cheek','cheek.001','jaw']:continue
        center=target.matrix_world@(sum((Vector(c) for c in target.bound_box),Vector())/8)
        count=30 if target==shirt else 7 if parent.startswith('hand') else 6
        for j in range(count):
            d=Vector((rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(.2,1)))
            if parent=='head':d=Vector((1,rng.uniform(-.7,.7),rng.uniform(-.5,.1)))
            stain(target,center+Vector((rng.uniform(-.15,.15) if target==shirt else rng.uniform(-.055,.055),rng.uniform(-.13,.13) if target==shirt else rng.uniform(-.06,.06),rng.uniform(-.07,.07))),d,rng.uniform(.012,.059),parent)
for sy in (-1,1):
    line('cheekBloodDrip',[(.487,sy*.134,.644),(.488,sy*.143,.614),(.476,sy*.124,.586)],.006,'blood','head')
    line('mouthBlood',[(.508,sy*.032,.544),(.495,sy*.035,.497),(.471,sy*.034,.453)],.008,'blood','head')
    ell('hangingBloodDrop',(.471,sy*.034,.453),(.009,.007,.014),'blood','head',0)
    # Small gaping tears and loose fraying at shoulders.
    line('sleeveTear',[(.09,sy*.255,.598),(.133,sy*.289,.555),(.117,sy*.311,.531)],.008,'blood','arm'+('L' if sy==1 else 'R'))

# Smooth-fuse the actual skin face into a sculpt, with applied topology reduction.
face_skin=[o for o in scene.objects if o.type=='MESH' and o.parent==parts['head'] and o.data.materials[0]==M['skin']]
bpy.ops.object.select_all(action='DESELECT')
for o in face_skin:o.select_set(True)
bpy.context.view_layer.objects.active=face_skin[0];bpy.ops.object.join();face=face_skin[0];face.name='faceSculpt'
for typ,name in [('REMESH','Continuous skin'),('SMOOTH','Sculpt relaxation'),('DECIMATE','Budget')]:
    md=face.modifiers.new(name,typ)
    if typ=='REMESH':md.mode='VOXEL';md.voxel_size=.012
    elif typ=='SMOOTH':md.factor=.55;md.iterations=3
    else:md.ratio=.55
    bpy.ops.object.modifier_apply(modifier=md.name)
for poly in face.data.polygons:poly.use_smooth=True
# Caps stay on the surviving side of the joint. Zero-scale is portable GLB hiding.
for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']:
    pivot=parts[n].matrix_world.translation.copy()
    cap=ell('stump_'+n,pivot,(.06,.062,.014) if n.startswith('arm') else (.048,.049,.012),'blood',parts[n].parent,0)
    if n!='head':
        child=('foreArm' if n.startswith('arm') else 'hand' if n.startswith('foreArm') else 'shin')+n[-1]
        cap.rotation_euler=(parts[child].matrix_world.translation-pivot).to_track_quat('Z','Y').to_euler()
    cap['hidden']=True;cap['ss_hidden']=True;cap['stumpFor']=n;cap['showScale']=[1,1,1];cap.scale=(0,0,0);parts['stump_'+n]=cap
# Merge decoration by material within each rigid part; joint empties retain exact names.
for p in list(parts.values()):
    for m in M.values():
        batch=[o for o in list(scene.objects) if o.type=='MESH' and o.parent==p and not o.name.startswith('stump_') and o.data.materials[0]==m]
        if not batch:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in batch:o.select_set(True)
        bpy.context.view_layer.objects.active=batch[0];bpy.ops.object.join();batch[0].name=p.name+'__'+m.name
# A slight downward snarl reinforces the low crawling rest pose.
parts['head'].rotation_euler.y=.14
meshes=[o for o in scene.objects if o.type=='MESH']
triangles=0
for o in meshes:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket']+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
missing=[n for n in required if n not in bpy.data.objects]
assert not missing,missing
assert triangles<=40000,triangles
metrics={'id':'inf.crawler','triangles':triangles,'meshes':len(meshes),'nodes_ok':not missing,'missing_nodes':missing}
(HERE/'build-stats.json').write_text(json.dumps(metrics,indent=2)+'\n');print('BUILD OK',json.dumps(metrics))
if arg('--glb'):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    print('EXPORT OK',triangles)
if arg('--view')=='pose':
    parts['armL'].rotation_euler.x=-.45;parts['foreArmL'].rotation_euler.y=-.65;parts['legR'].rotation_euler.y=-.45
    parts['armL'].location.y+=.18;parts['stump_armL'].scale=(1,1,1)
if arg('--render'):
    world=bpy.data.worlds.new('Purple studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.10,.17,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5;scene.world=world
    bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='studioFloor';floor.data.materials.append(mat('studio','#36333e',.85))
    def area(n,loc,power,color,size):
        o=bpy.data.objects.new(n,bpy.data.lights.new(n,'AREA'));scene.collection.objects.link(o);o.location=loc;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.4))-o.location).to_track_quat('-Z','Y').to_euler()
    area('warmKey',(3,-4,5),450,(1,.88,.76),4);area('coolFill',(1,3,3),260,(.64,.70,1),3);area('hairRim',(-2,1,3.2),500,(1,.40,.15),2)
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));scene.collection.objects.link(cam);scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=2.65
    view=arg('--view','hero');positions={'hero':(5,-3,2.8),'front':(5,0,.75),'side':(0,-5,.75),'back':(-5,0,.75),'pose':(5,3,2.8)}
    cam.location=positions.get(view,positions['hero']);cam.rotation_euler=(Vector((0,0,.40))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES';scene.cycles.samples=int(arg('--samples','24'));scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='METAL';prefs.get_devices()
        for d in prefs.devices:d.use=d.type=='METAL'
        scene.cycles.device='GPU'
    except Exception:pass
    scene.render.resolution_x=int(arg('--width','960'));scene.render.resolution_y=int(arg('--height','540'));scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(Path(arg('--render')).resolve());Path(scene.render.filepath).parent.mkdir(parents=True,exist_ok=True)
    if view=='review':
        # Four views share one build and one allocated render slot.
        output=Path(arg('--render')).resolve()
        for v in ('front','side','back','hero'):
            cam.location=positions[v]
            cam.rotation_euler=(Vector((0,0,.40))-cam.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(output.parent/(output.stem+'-'+v+'.png'))
            bpy.ops.render.render(write_still=True);print('RENDER OK',v)
    else:
        bpy.ops.render.render(write_still=True);print('RENDER OK',view)
