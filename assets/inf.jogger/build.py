"""Minor Incident adult infected jogger. +X forward, Z up; rigid joint tree.
Reproducible palette-only geometry. Subdivision and bevels applied before GLB.
Use only experiment/tools/blender_run.py to execute this script.
"""
import bpy, math, sys, json, random
from pathlib import Path
from mathutils import Matrix, Vector
HERE = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(k,d=None): return ARGS[ARGS.index(k)+1] if k in ARGS else d
def turnaround_sheet():
    from array import array
    w,h=960,540
    sheet=bpy.data.images.new('turnaround',width=w*2,height=h*2,alpha=True)
    buffer=array('f',[0])*(w*h*16)
    for name,col,row in [('front',0,1),('side',1,1),('back',0,0),('three-quarter',1,0)]:
        im=bpy.data.images.load(str(HERE/'renders'/f'{name}.png'));im.scale(w,h)
        pixels=array('f',[0])*(w*h*4);im.pixels.foreach_get(pixels)
        for y in range(h):
            start=((row*h+y)*w*2+col*w)*4
            buffer[start:start+w*4]=pixels[y*w*4:(y+1)*w*4]
    sheet.pixels.foreach_set(buffer);sheet.filepath_raw=str(Path(HERE/'renders'/'turnaround.png').resolve());sheet.file_format='PNG';sheet.save()
    print('SHEET OK')
if arg('--view')=='sheet':
    turnaround_sheet();sys.exit(0)
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
 'skin':mat('infectedSkin','#c9a39a',.58), 'pink':mat('survivorRed','#ed4b96',.62),
 'shorts':mat('asphalt','#5b4f5c',.82), 'hair':mat('woodWarm','#4d281f',.68),
 'cream':mat('picketWhite','#f2e6dc',.74), 'blood':mat('blood','#b3121f',.29),
 'dark':mat('uiDark','#25222c',.7), 'gold':mat('schoolBusYellow','#f2b630',.4),
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
    # Catmull-Rom interpolation makes flowing volumetric hair locks.
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
    if m=='hair':
        md=o.modifiers.new('Applied hair sculpt subdivision','SUBSURF');md.levels=1
        md=o.modifiers.new('Hair tessellation budget','DECIMATE');md.ratio=.5
    return finish(o,n,m,p)

def line(n,pts,r,m,p): return tube(n,pts,[r]*len(pts),m,p)

def limb(n,a,b,r1,r2,m,p):
    a=Vector(a);b=Vector(b)
    half=(b-a).length/2+.023
    o=ell(n,(a+b)/2,(r1,r1*.92,half),m,p)
    for v in o.data.vertices:
        t=(v.co.z/half+1)/2
        factor=1-t*(1-r2/r1)
        v.co.x*=factor;v.co.y*=factor
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o

def mesh(n,vs,fs,m,p,sub=0):
    me=bpy.data.meshes.new(n);me.from_pydata(vs,[],fs);me.update()
    o=bpy.data.objects.new(n,me);scene.collection.objects.link(o)
    if sub:
        mod=o.modifiers.new('Applied organic subdivision','SUBSURF');mod.levels=sub
    return finish(o,n,m,p)

def shell(n,rings,m,p,ragged=False):
    vs=[];N=24
    for j,(x,y,z,rx,ry) in enumerate(rings):
        for i in range(N):
            a=i*math.tau/N
            vs.append((x+rx*math.cos(a),y+ry*math.sin(a),z+(.009*math.sin(i*2.3) if ragged and j==0 else 0)))
    fs=[(j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i) for j in range(len(rings)-1) for i in range(N)]
    # Clothing has actual shell thickness, applied before export.
    o=mesh(n,vs,fs,m,p,1)
    bpy.context.view_layer.objects.active=o
    md=o.modifiers.new('Fabric thickness','SOLIDIFY');md.thickness=.005
    bpy.ops.object.modifier_apply(modifier=md.name)
    return o

def sleeve(n,a,b,p):
    a=Vector(a);b=Vector(b);q=(b-a).to_track_quat('Z','Y')
    vs=[];N=16
    for t,r in [(0,.071),(.08,.085),(.86,.077),(1,.076)]:
        for i in range(N):
            angle=i*math.tau/N
            edge=t+(.035*math.sin(i*2.2) if t==1 else 0)
            vs.append(tuple(a.lerp(b,edge)+q@Vector((r*math.cos(angle),r*math.sin(angle),0))))
    fs=[(j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i) for j in range(3) for i in range(N)]
    fs.append(tuple(reversed(range(N))))
    o=mesh(n,vs,fs,'cream',p,1)
    bpy.context.view_layer.objects.active=o;md=o.modifiers.new('Sleeve shell thickness','SOLIDIFY');md.thickness=.006;bpy.ops.object.modifier_apply(modifier=md.name)
    return o

node('root',(0,0,0));node('hip',(-.045,0,.75),'root');node('torso',(-.025,0,.87),'hip')
node('head',(.12,0,1.13),'torso');node('backpackSocket',(-.19,0,1.02),'torso')
joints={
'L':{'shoulder':(.045,.206,1.10),'elbow':(.17,.30,.97),'wrist':(.38,.33,.83),'hip':(-.04,.115,.74),'knee':(.10,.18,.46),'ankle':(.045,.22,.15)},
'R':{'shoulder':(.045,-.206,1.10),'elbow':(.18,-.32,.97),'wrist':(.36,-.38,.78),'hip':(-.04,-.115,.74),'knee':(-.055,-.17,.43),'ankle':(-.13,-.215,.15)}}
for side,q in joints.items():
    for n,key,p in [('arm','shoulder','torso'),('foreArm','elbow','arm'+side),('hand','wrist','foreArm'+side),('leg','hip','hip'),('shin','knee','leg'+side),('foot','ankle','shin'+side)]:node(n+side,q[key],p)
# Leaning athletic torso and a separate undershirt / bound sports tank.
sculpt('shortsSeat',(-.04,0,.752),(.14,.177,.10),'shorts','hip')
tee=ell('undershirt',(.006,0,.983),(.105,.145,.185),'cream','torso')
tee.rotation_euler.y=.12
shell('sportsTank',[(-.036,0,.817,.127,.157),(-.032,0,.85,.132,.16),(.004,0,.96,.16,.188),(.034,0,1.062,.142,.177)],'pink','torso',True)
for sy in (-1,1):
    line('tankStrap',[(.114,sy*.13,1.053),(.085,sy*.137,1.133),(.004,sy*.137,1.14),(-.082,sy*.131,1.068)],.021,'pink','torso')
    line('armholeBinding',[(.096,sy*.158,1.108),(.113,sy*.181,1.049),(.03,sy*.196,1.015),(-.094,sy*.149,1.054)],.007,'cream','torso')
    for z in (.872,.924,.984):line('fabricFold',[(.126,sy*.065,z),(.136,sy*.104,z-.012),(.107,sy*.149,z-.016)],.005,'pink','torso')
line('tankNeckline',[(.12,-.112,1.1),(.167,-.065,1.063),(.172,0,1.051),(.167,.065,1.063),(.12,.112,1.1)],.009,'pink','torso')
line('undershirtNeckline',[(.126,-.09,1.11),(.16,-.053,1.081),(.167,0,1.073),(.16,.053,1.081),(.126,.09,1.11)],.005,'cream','torso')
ell('neck',(.102,0,1.13),(.069,.068,.105),'skin','head')
# Belt, fly, tailored shorts with visible cuff and pocket outlines.
shell('belt',[(-.04,0,.779,.142,.181),(-.04,0,.81,.144,.183)],'dark','hip')
box('beltBuckle',(.108,0,.795),(.018,.041,.034),'gold','hip',.005)
box('buckleInset',(.12,0,.795),(.005,.024,.02),'blood','hip',.002)
line('fly',[(.099,.012,.774),(.109,.012,.714),(.11,.006,.68)],.0025,'dark','hip')
for side,q in joints.items():
    sy=1 if side=='L' else -1;hy=q['hip'][1]
    limb('bareThigh',q['hip'],q['knee'],.083,.070,'skin','leg'+side)
    end=Vector(q['hip']).lerp(Vector(q['knee']),.46)
    shell('shortLeg',[(end.x,end.y,end.z,.091,.105),(-.04,hy,.735,.101,.115),(-.04,hy,.778,.091,.10)],'shorts','leg'+side)
    shell('rolledShortCuff',[(end.x,end.y,end.z-.008,.095,.109),(end.x,end.y,end.z+.024,.099,.112)],'shorts','leg'+side,True)
    for y in (.07,.15):box('beltLoop',(.093,sy*y,.79),(.018,.015,.047),'shorts','hip',.004)
    line('frontPocket',[(.101,sy*.07,.774),(.109,sy*.128,.742),(.04,sy*.207,.713)],.003,'dark','hip')
    box('rearPocket',(-.174,sy*.103,.71),(.015,.087,.085),'shorts','hip',.011)
    line('pocketStitch',[(-.185,sy*.061,.747),(-.188,sy*.143,.747),(-.188,sy*.143,.687),(-.186,sy*.103,.676),(-.184,sy*.061,.686)],.002,'dark','hip')
    for j in range(3):
        y=sy*(.087+j*.04);line('shortFold',[(.099,y,.688),(.109,y+.012,.67),(.082,y+.024,.648)],.004,'shorts','leg'+side)
    # Leg volumes remain independently attached at hips and knees.
    a=Vector(q['knee']);b=Vector(q['ankle'])
    ell('kneecap',(a.x+.044,a.y,a.z),(.037,.055,.045),'skin','shin'+side)
    limb('calf',a,b,.073,.050,'skin','shin'+side)
    ax,yy,az=q['ankle']
    ell('sock',(ax,yy,.177),(.059,.063,.076),'cream','foot'+side)
    shell('sockRib',[(ax,yy,.218,.063,.066),(ax,yy,.238,.065,.068)],'cream','foot'+side)
    for k in range(9):
        t=math.tau*k/9;line('sockKnit',[(ax+.064*math.cos(t),yy+.067*math.sin(t),.218),(ax+.065*math.cos(t),yy+.068*math.sin(t),.238)],.0018,'shorts','foot'+side)
    box('outsole',(ax+.05,yy,.019),(.283,.17,.038),'dark','foot'+side,.016)
    box('midsole',(ax+.05,yy,.047),(.289,.176,.046),'cream','foot'+side,.018)
    sculpt('sneakerUpper',(ax+.045,yy,.102),(.144,.084,.067),'pink','foot'+side)
    ell('paddedHeel',(ax-.03,yy,.144),(.077,.073,.074),'pink','foot'+side)
    box('rubberToeCap',(ax+.15,yy,.092),(.09,.169,.061),'cream','foot'+side,.022)
    sculpt('tongue',(ax+.029,yy,.156),(.05,.056,.049),'pink','foot'+side)
    box('tongueLabel',(ax+.053,yy,.192),(.03,.046,.008),'cream','foot'+side,.003)
    for j in range(4):
        xx=ax+.041+j*.024;zz=.174-j*.013
        line('shoelace',[(xx-.004,yy-.051,zz),(xx+.005,yy,zz+.009),(xx-.004,yy+.051,zz)],.0035,'cream','foot'+side)
        for sy2 in (-1,1):ell('eyelet',(xx,yy+sy2*.055,zz),(.006,.005,.005),'gold','foot'+side,0)
    for sy2 in (-1,1):
        for j in range(2):line('sportStripe',[(ax-.015+j*.024,yy+sy2*.079,.13),(ax+.018+j*.024,yy+sy2*.085,.084)],.007,'cream','foot'+side)
        line('soleSeam',[(ax-.07,yy+sy2*.087,.048),(ax+.09,yy+sy2*.089,.049),(ax+.175,yy+sy2*.068,.046)],.002,'shorts','foot'+side)
    box('heelTab',(ax-.095,yy,.149),(.014,.045,.055),'cream','foot'+side,.006)
# Waist pouch, curved zipper and belt attachment; matches side-view silhouette.
sculpt('waistPouch',(-.125,.217,.772),(.098,.073,.113),'shorts','hip')
line('pouchZip',[(-.19,.247,.831),(-.14,.291,.857),(-.065,.263,.843)],.0035,'dark','hip')
box('zipPull',(-.088,.282,.842),(.013,.009,.032),'gold','hip',.003)
# Bare arms and torn white short sleeves; hands reach forward with thick curled claws.
for side,q in joints.items():
    sy=1 if side=='L' else -1;a=Vector(q['shoulder']);b=Vector(q['elbow']);w=Vector(q['wrist'])
    limb('upperArm',a,b,.065,.053,'skin','arm'+side)
    sleeve('shirtSleeve',a,a.lerp(b,.56),'arm'+side)
    rim=a.lerp(b,.49)
    line('sleeveCuff',[(rim.x+.062,rim.y-sy*.048,rim.z+.017),(rim.x+.076,rim.y,rim.z),(rim.x+.053,rim.y+sy*.06,rim.z-.02)],.007,'cream','arm'+side)
    limb('forearm',b,w,.054,.036,'skin','foreArm'+side)
    palm=w+Vector((.016,sy*.006,-.047))
    sculpt('clawPalm',palm,(.056,.063,.061),'skin','hand'+side)
    for j in range(4):
        yy=palm.y+(j-1.5)*.031;length=.071-(abs(j-1.5)*.011)
        pts=[(palm.x+.025,yy,palm.z-.017),(palm.x+.055,yy,palm.z-.047),(palm.x+.057,yy,palm.z-.047-length*.63),(palm.x+.029,yy,palm.z-.055-length*.62)]
        tube('clawFinger',pts,[.015,.014,.012,.008],'skin','hand'+side,10)
        ell('bloodyNail',pts[-1],(.009,.011,.010),'blood','hand'+side,0)
    tube('thumb',[(palm.x-.003,palm.y-sy*.047,palm.z+.016),(palm.x+.063,palm.y-sy*.078,palm.z-.003),(palm.x+.087,palm.y-sy*.066,palm.z-.031)],[.023,.020,.012],'skin','hand'+side)
    if side=='R':
        ell('watchBand',w+Vector((-.018,0,.015)),(.053,.048,.022),'pink','foreArm'+side)
        box('watchCase',w+Vector((.018,-.037,.033)),(.044,.026,.021),'gold','foreArm'+side,.006)
        box('watchScreen',w+Vector((.018,-.044,.043)),(.030,.021,.007),'dark','foreArm'+side,.003)
# Sculpted face: cheek/jaw silhouette, furious eyes, nose, open snarl and thick ears.
ell('cranium',(.13,0,1.365),(.18,.207,.216),'skin','head')
sculpt('jaw',(.20,0,1.239),(.12,.143,.116),'skin','head')
for sy in (-1,1):
    ell('cheek',(.25,sy*.112,1.291),(.042,.052,.055),'skin','head')
    ell('ear',(.095,sy*.202,1.336),(.05,.035,.062),'skin','head')
    ell('earConcha',(.129,sy*.219,1.34),(.016,.013,.037),'blood','head')
    ell('earTragus',(.142,sy*.221,1.337),(.013,.009,.023),'skin','head')
    ell('eyeSocket',(.279,sy*.088,1.396),(.024,.06,.058),'blood','head')
    ell('eyeWhite',(.291,sy*.088,1.398),(.028,.049,.046),'cream','head')
    ell('redIris',(.317,sy*.087,1.398),(.008,.036,.038),'eye','head')
    ell('pupil',(.325,sy*.084,1.4),(.003,.011,.016),'dark','head',0)
    ell('eyeGlint',(.328,sy*.077,1.415),(.004,.006,.007),'cream','head',0)
    line('angryBrow',[(.282,sy*.145,1.465),(.31,sy*.101,1.466),(.308,sy*.045,1.443)],.013,'hair','head')
    line('lowerLid',[(.295,sy*.133,1.38),(.318,sy*.087,1.353),(.303,sy*.045,1.365)],.004,'skin','head')
ell('noseBridge',(.296,0,1.347),(.027,.023,.052),'skin','head')
ell('noseTip',(.33,0,1.328),(.035,.037,.024),'skin','head')
for sy in (-1,1):ell('nostril',(.352,sy*.022,1.316),(.007,.008,.005),'dark','head',0)
ell('mouthCavity',(.301,0,1.241),(.031,.079,.069),'dark','head')
line('snarlLip',[(.325,.08*math.sin(t),1.241+.069*math.cos(t)) for t in [i*math.tau/28 for i in range(29)]],.006,'blood','head')
ell('tongue',(.329,.005,1.208),(.009,.042,.017),'blood','head')
for i in range(7):box('upperTooth',(.334,(i-3)*.021,1.28+(.005 if abs(i-3)>1 else 0)),(.018,.016,.02 if i!=1 else .012),'cream','head',.004)
for i in range(5):box('lowerTooth',(.335,(i-2)*.024,1.197),(.016,.018,.014),'cream','head',.003)
# Swept hair cap and bangs, single big high ponytail with many curved tapered locks.
ell('hairCap',(.064,0,1.455),(.183,.204,.185),'hair','head')
for j in range(9):
    y=(j-4)*.039;endz=1.459+.022*abs(j-4)
    tube('sweptBang',[(.04,.035,1.62),(.12,y*.5,1.589),(.20,y,1.539),(.28-.10*abs(y)/.16,y+.021,1.492),(.27-.13*abs(y)/.16,y+.03,endz)],[.034,.043,.039,.027,.002],'hair','head',12)
for sy in (-1,1):
    tube('faceTendril',[(.19,sy*.178,1.515),(.217,sy*.209,1.421),(.178,sy*.216,1.31),(.206,sy*.205,1.218)],[.022,.026,.019,.002],'hair','head',12)
    for j in range(4):
        tube('backHairLock',[(.039-j*.027,sy*.11,1.593),(-.054-j*.018,sy*.161,1.517),(-.072-j*.015,sy*.17,1.386),(-.048-j*.019,sy*.139,1.327)],[.028,.035,.027,.002],'hair','head',10)
ell('ponyRoot',(-.05,.038,1.572),(.095,.087,.087),'hair','head')
ell('ponyTie',(-.094,.038,1.581),(.028,.083,.081),'pink','head')
for j in range(13):
    y=(j-6)*.021;z=1.30+(j%4)*.024
    tube('pigtailLock',[(-.102,.04,1.59),(-.21-.025*math.sin(j),.11+y*.6,1.67+.033*math.sin(j*1.3)),(-.35-.035*math.cos(j),.17+y,1.60+.025*math.sin(j)),(-.395+.028*math.sin(j*1.2),.16+y*1.25,1.461+.03*math.cos(j)),(-.32+j*.004,.13+y*1.35,z-.025*math.sin(j)),(-.25+j*.005,.1+y*1.42,z+.04)],[.028,.051,.056,.049,.025,.0015],'hair','head',12)
for j in range(4):tube('faceTendril',[(-.04,.017+j*.025,1.6),(-.107,.02+j*.023,1.713),(-.222,.021+j*.027,1.736),(-.29,.035+j*.031,1.675)],[.009,.010,.007,.001],'hair','head',8)
# Visor is an open band with a true thick curved bill, never a cap crown.
shell('visorBand',[(.094,0,1.526,.216,.221),(.094,0,1.586,.214,.22)],'pink','head')
N=33;vs=[]
for k in range(5):
    u=k/4
    for i in range(N):
        a=-1.13+2.26*i/(N-1)
        vs.append((.094+(.19+.126*u)*math.cos(a),(.208+.011*u)*math.sin(a),1.533-.035*u-.024*(math.sin(a)**2)))
fs=[(k*N+i,k*N+i+1,(k+1)*N+i+1,(k+1)*N+i) for k in range(4) for i in range(N-1)]
o=mesh('visorBrim',vs,fs,'pink','head',1)
bpy.context.view_layer.objects.active=o;md=o.modifiers.new('Bill thickness','SOLIDIFY');md.thickness=.014;bpy.ops.object.modifier_apply(modifier=md.name)
line('visorPiping',[(.094+.317*math.cos(a),.221*math.sin(a),1.498-.024*math.sin(a)**2) for a in [-1.12+i*2.24/24 for i in range(25)]],.0035,'cream','head')
ell('visorBadge',(.311,0,1.564),(.005,.012,.012),'cream','head',0)
box('visorRearClasp',(-.128,0,1.553),(.012,.063,.025),'pink','head',.005)
# Jagged raised stains ray-fit to their underlying surfaces (3.5 mm clearance).
rng=random.Random(71)
def splat(n,y,z,ry,rz,targets,p,side=1):
    points=[(y,z)]
    for k in range(15):
        t=k*math.tau/15;r=rng.uniform(.50,1.12)
        points.append((y+ry*math.cos(t)*r,z+rz*math.sin(t)*r))
    vs=[]
    bpy.context.view_layer.update()
    for yy,zz in points:
        origin=Vector((side*.9,yy,zz));direction=Vector((-side,0,0));hits=[]
        for target in targets:
            inv=target.matrix_world.inverted();hit,loc,normal,_=target.ray_cast(inv@origin,inv.to_3x3()@direction)
            if hit:hits.append((target.matrix_world@loc,target.matrix_world.to_3x3()@normal))
        if not hits:return
        hit,normal=min(hits,key=lambda h:(h[0]-origin).length)
        vs.append(tuple(hit+normal.normalized()*.0035))
    return mesh(n,vs,[(0,i+1,(i+1)%15+1) for i in range(15)],'blood',p)
# Reference has large chin drips plus scattered athletic wear blood, no image decals.
for sy in (-1,1):
    splat('cheekBlood',sy*.126,1.294,.023,.047,[bpy.data.objects['cheek'],bpy.data.objects['cranium'],bpy.data.objects['jaw']],'head')
    line('cheekDrip',[(.291,sy*.137,1.323),(.293,sy*.145,1.274),(.281,sy*.128,1.247)],.005,'blood','head')
for y,low in [(-.039,1.12),(.006,1.091),(.039,1.15)]:
    tube('chinBlood',[(.322,y,1.196),(.304,y,1.163),(.291,y,low)],[.008,.006,.003],'blood','head')
    ell('bloodDrop',(.291,y,low),(.006,.005,.01),'blood','head',0)
for side in (1,-1):
    for i in range(22):
        y=rng.uniform(-.13,.13);z=rng.uniform(.837,1.043)
        splat('tankBlood',y,z,rng.uniform(.005,.029),rng.uniform(.006,.04),[bpy.data.objects['sportsTank']],'torso',side)
for side,q in joints.items():
    sy=1 if side=='L' else -1
    arm_targets=[o for o in scene.objects if o.type=='MESH' and o.parent==parts['arm'+side] and o.data.materials[0]==M['cream']]
    for i in range(9):splat('sleeveBlood',sy*(.20+rng.uniform(-.04,.055)),rng.uniform(1.02,1.13),.011,.013,arm_targets,'arm'+side)
    leg_targets=[o for o in scene.objects if o.type=='MESH' and o.parent in [parts['leg'+side],parts['shin'+side]] and o.data.materials[0]==M['skin']]
    for i in range(9):
        z=rng.uniform(.27,.61);y=sy*rng.uniform(.145,.19)
        splat('legBlood',y,z,.013,.022,leg_targets,'leg'+side if z>.46 else 'shin'+side)
    skin=[o for o in scene.objects if o.type=='MESH' and o.parent==parts['hand'+side] and o.data.materials[0]==M['skin']]
    for i in range(5):splat('handBlood',q['wrist'][1]+rng.uniform(-.045,.045),q['wrist'][2]-.038,.013,.025,skin,'hand'+side)
# Purposeful ripped slits and frayed pink hem tabs.
for sy in (-1,1):
    line('clothTear',[(.125,sy*.08,.879),(.141,sy*.069,.903),(.141,sy*.092,.925)],.004,'dark','torso')
    for j in range(3):
        y=sy*(.068+j*.021)
        mesh('frayedHem',[(.096,y-.008,.82),(.118,y+.008,.82),(.103,y+.009,.797-j*.006)],[(0,1,2)],'pink','torso')
# Chunky hand silhouette, scaled in world space around the wrist pivot.
for side in 'LR':
    pivot=Vector(joints[side]['wrist'])
    for o in scene.objects:
        if o.type=='MESH' and o.parent==parts['hand'+side]:
            inv=o.matrix_world.inverted()
            for v in o.data.vertices:
                world=o.matrix_world@v.co
                v.co=inv@(pivot+(world-pivot)*1.28)
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
# Hero proportions: broaden the face and athletic limbs around their joint axes.
# Radial limb growth preserves segment lengths, clothing fit and raised blood clearance.
for side in 'LR':
    for prefix,child in [('arm','foreArm'),('foreArm','hand'),('leg','shin'),('shin','foot')]:
        joint=parts[prefix+side];pivot=joint.matrix_world.translation.copy()
        axis=(parts[child+side].matrix_world.translation-pivot).normalized()
        width=1.24 if prefix in ('leg','shin') else 1.20
        for o in scene.objects:
            if o.type=='MESH' and o.parent==joint:
                inv=o.matrix_world.inverted()
                for v in o.data.vertices:
                    delta=o.matrix_world@v.co-pivot
                    axial=axis*delta.dot(axis)
                    v.co=inv@(pivot+axial+(delta-axial)*width)
# Pose once, then bake it into geometry and joint positions for procedural clips.
parts['head'].scale=(1.25,1.28,1.13)
parts['hip'].location.z-=.12
parts['torso'].rotation_euler.y=.38
parts['head'].rotation_euler.y=-.24
for side in 'LR':
    parts['arm'+side].rotation_euler.y=-.65 if side=='L' else -.72
    parts['foreArm'+side].rotation_euler.y=-.28 if side=='L' else -.33
    parts['hand'+side].scale=(1.25,1.28,1.20)
    parts['hand'+side].rotation_euler.y=.50
    parts['leg'+side].rotation_euler.y=-.35 if side=='L' else -.50
    parts['shin'+side].rotation_euler.y=.72 if side=='L' else .86
    parts['foot'+side].rotation_euler.y=-.37 if side=='L' else -.36
    parts['foot'+side].scale=(1.25,1.30,1.15)
bpy.context.view_layer.update()
# Place both soles exactly at ground contact while preserving ankle origins.
for side in 'LR':
    foot=parts['foot'+side]
    children=[o for o in scene.objects if o.type=='MESH' and o.parent==foot]
    bottom=min((o.matrix_world@v.co).z for o in children for v in o.data.vertices)
    world=foot.matrix_world.copy();world.translation.z-=bottom;foot.matrix_world=world
bpy.context.view_layer.update()
posed_meshes={o.name:(o.matrix_world.copy(),o.parent) for o in scene.objects if o.type=='MESH'}
posed_joints={n:o.matrix_world.translation.copy() for n,o in parts.items()}
for n,o in parts.items():
    o.matrix_world=Matrix.Translation(posed_joints[n]);bpy.context.view_layer.update()
for n,(world,parent) in posed_meshes.items():
    o=bpy.data.objects[n];o.data.transform(parent.matrix_world.inverted()@world)
    o.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
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
meshes=[o for o in scene.objects if o.type=='MESH']
# Applied sculpt/shell tessellation is reduced before shipping; preserve tiny details.
for o in meshes:
    o.data.calc_loop_triangles()
    if len(o.data.loop_triangles)>500:
        bpy.context.view_layer.objects.active=o
        md=o.modifiers.new('Hero topology reduction','DECIMATE');md.ratio=.64
        bpy.ops.object.modifier_apply(modifier=md.name)
triangles=0
for o in meshes:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket']+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
missing=[n for n in required if n not in bpy.data.objects]
assert not missing,missing
assert triangles<=40000,triangles
metrics={'id':'inf.jogger','triangles':triangles,'meshes':len(meshes),'nodes_ok':not missing,'missing_nodes':missing}
(HERE/'build-stats.json').write_text(json.dumps(metrics,indent=2)+'\n');print('BUILD OK',json.dumps(metrics))
if arg('--glb'):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    print('EXPORT OK',triangles)
def pose_test():
    parts['armL'].rotation_euler.x=-.8;parts['foreArmL'].rotation_euler.y=-.9;parts['legR'].rotation_euler.y=-.45
    parts['armL'].location.y+=.18;parts['stump_armL'].scale=(1,1,1)
if arg('--view')=='pose':pose_test()
if arg('--render'):
    world=bpy.data.worlds.new('Purple studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.10,.17,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5;scene.world=world
    bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='studioFloor';floor.data.materials.append(mat('studio','#36333e',.85))
    def area(n,loc,power,color,size):
        o=bpy.data.objects.new(n,bpy.data.lights.new(n,'AREA'));scene.collection.objects.link(o);o.location=loc;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.85))-o.location).to_track_quat('-Z','Y').to_euler()
    area('warmKey',(3,-4,5),450,(1,.78,.62),4);area('coolFill',(1,3,3),260,(.64,.70,1),3);area('hairRim',(-2,1,3.2),500,(1,.40,.15),2)
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));scene.collection.objects.link(cam);scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=3.45
    view=arg('--view','hero');positions={'hero':(5,-3,2.55),'front':(5,0,1.5),'side':(0,-5,1.5),'back':(-5,0,1.5),'pose':(5,3,2.55)}
    cam.location=positions.get(view,positions['hero']);cam.rotation_euler=(Vector((.04,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES';scene.cycles.samples=int(arg('--samples','24'));scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='METAL';prefs.get_devices()
        for d in prefs.devices:d.use=d.type=='METAL'
        scene.cycles.device='GPU'
    except Exception:pass
    scene.render.resolution_x=int(arg('--width','960'));scene.render.resolution_y=int(arg('--height','540'));scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(Path(arg('--render')).resolve());Path(scene.render.filepath).parent.mkdir(parents=True,exist_ok=True)
    if view=='deliver':
        import shutil
        # One allocated slot produces all final artifacts from the same rest model.
        for v in ('front','side','back','hero','pose'):
            if v=='pose':pose_test()
            cam.location=positions[v]
            cam.rotation_euler=(Vector((.15,0,.8))-cam.location).to_track_quat('-Z','Y').to_euler()
            scene.render.resolution_x=1600 if v=='hero' else 960
            scene.render.resolution_y=900 if v=='hero' else 540
            scene.cycles.samples=96 if v=='hero' else 24
            scene.render.filepath=str(HERE/'renders'/('pose-test.png' if v=='pose' else v+'.png'))
            bpy.ops.render.render(write_still=True);print('RENDER OK',v)
        shutil.copyfile(HERE/'renders'/'hero.png',HERE/'renders'/'three-quarter.png')
        turnaround_sheet()
    elif view=='review':
        # Four views share one build and one allocated render slot.
        output=Path(arg('--render')).resolve()
        for v in ('front','side','back','hero'):
            cam.location=positions[v]
            cam.rotation_euler=(Vector((.04,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(output.parent/(output.stem+'-'+v+'.png'))
            bpy.ops.render.render(write_still=True);print('RENDER OK',v)
    else:
        bpy.ops.render.render(write_still=True);print('RENDER OK',view)
