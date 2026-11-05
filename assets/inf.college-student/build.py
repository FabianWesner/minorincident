"""Minor Incident adult college Runner. +X forward, Z up; rigid joint tree.
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
 'skin':mat('infectedSkin','#c9a39a',.57), 'jacket':mat('asphalt','#5b4f78'),
 'denim':mat('sidewalk','#727b90'), 'hair':mat('woodWarm','#553127'),
 'cream':mat('picketWhite','#f2e6dc'), 'red':mat('survivorRed','#d9363e',.48),
 'blood':mat('blood','#b3121f',.29), 'dark':mat('uiDark','#25222c'),
 'pack':mat('backpackTeal','#514438'), 'gold':mat('schoolBusYellow','#d79848',.4),
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
    if n in ('sweptBang','pigtailLock','backHairLock','faceTendril'):
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

node('root',(0,0,0));node('hip',(0,0,.76),'root');node('torso',(0,0,.87),'hip');node('head',(0,0,1.18),'torso')
node('backpackSocket',(-.17,0,1.06),'torso')
# Relaxed wide stance and joint pivots, left is +Y.
for side,sy in [('L',1),('R',-1)]:
    node('arm'+side,(0,sy*.205,1.12),'torso');node('foreArm'+side,(.018,sy*.29,.93),'arm'+side)
    node('hand'+side,(.035,sy*.355,.745),'foreArm'+side)
    node('leg'+side,(0,sy*.103,.76),'hip');node('shin'+side,(.015,sy*.145,.435),'leg'+side)
    node('foot'+side,(.017,sy*.165,.115),'shin'+side)
# Torso separate shell cardigan, ivory tee and ribbed hems.
sculpt('waistDenim',(0,0,.754),(.145,.178,.10),'denim','hip')
ell('tee',( .015,0,1.004),(.123,.176,.211),'cream','torso')
ell('neck',(0,0,1.192),(.063,.062,.105),'skin','head')
# neckline circular open rim projected on front
line('teeNeckBinding',[(.098,-.095,1.15),(.126,-.055,1.116),(.136,0,1.108),(.126,.055,1.116),(.098,.095,1.15)],.008,'cream','torso')
sculpt('cardiganBack',(-.085,0,.993),(.07,.205,.24),'jacket','torso')
for sy in (-1,1):
    sculpt('cardiganPanel',(.013,sy*.157,.99),(.102,.082,.24),'jacket','torso')
    line('placket',[(.095,sy*.107,1.18),(.123,sy*.127,1.08),(.105,sy*.117,.95),(.112,sy*.106,.81)],.015,'jacket','torso')
    box('ribHem',(.005,sy*.155,.795),(.15,.13,.036),'jacket','torso',.012)
    for k in range(7): line('hemRib',[(.086,sy*(.108+k*.014),.781),(.089,sy*(.108+k*.014),.809)],.002,'jacket','torso')
    for z in (.83,.90,.972,1.045): ell('cardiganButton',(.127,sy*.115,z),(.004,.009,.009),'gold','torso',0)
    line('pocketWelt',[(.111,sy*.143,.872),(.105,sy*.20,.868)],.006,'jacket','torso')
# Belt, belt loops, fly and curved jean pockets
box('belt',(.077,0,.79),(.065,.277,.033),'pack','hip')
box('beltBuckle',(.119,0,.79),(.012,.035,.030),'gold','hip',.006)
line('flySeam',[(.119,.014,.773),(.13,.014,.726),(.125,.008,.68)],.0025,'gold','hip')
for sy in (-1,1):
    for y in (.056,.118):box('beltLoop',(.11,sy*y,.793),(.015,.014,.044),'denim','hip',.004)
    line('jeansPocket',[(.119,sy*.077,.773),(.119,sy*.117,.737),(.092,sy*.158,.728)],.003,'pack','hip')
    line('backPocket',[(-.124,sy*.04,.751),(-.137,sy*.12,.75),(-.12,sy*.133,.694),(-.129,sy*.071,.681),(-.124,sy*.04,.751)],.003,'pack','hip')
# Legs, cuff rolls, articulated shoes, chunky tongue, toe cap and laces.
for side,sy in [('L',1),('R',-1)]:
    y=sy*.145
    limb('denimThigh',(0,sy*.102,.746),(.015,y,.437),.095,.075,'denim','leg'+side)
    limb('denimCalf',(.015,y,.444),(.013,sy*.168,.165),.077,.065,'denim','shin'+side)
    for z in (.49,.55,.35,.26):
        line('denimCrease',[(.075,sy*.11,z+.01),(.088,sy*.145,z),(.074,sy*.195,z-.009)],.006,'denim','leg'+side if z>.435 else 'shin'+side)
    line('outerSeam',[(.008,sy*.226,.412),(.015,sy*.237,.286),(.013,sy*.23,.184)],.0025,'pack','shin'+side)
    box('rolledJeanCuff',(.013,sy*.169,.178),(.148,.151,.043),'denim','shin'+side,.015)
    line('cuffTop',[(.083,sy*.107,.196),(.091,sy*.17,.196),(.08,sy*.237,.196)],.006,'cream','shin'+side)
    ell('ankle',(.013,sy*.167,.129),(.047,.049,.047),'skin','foot'+side)
    box('outsole',(.057,sy*.167,.022),(.254,.152,.044),'dark','foot'+side,.018)
    box('midsole',(.057,sy*.167,.052),(.252,.152,.049),'cream','foot'+side,.022)
    sculpt('sneakerUpper',(.029,sy*.167,.101),(.127,.080,.062),'red','foot'+side)
    box('whiteToeCap',(.149,sy*.167,.086),(.085,.15,.053),'cream','foot'+side,.024)
    sculpt('shoeTongue',(.012,sy*.167,.132),(.052,.055,.041),'cream','foot'+side)
    box('tongueLabel',(.045,sy*.167,.16),(.035,.047,.012),'red','foot'+side,.005)
    for j in range(4):
        x=.024+j*.024; z=.156-j*.009
        line('crossLace',[(x-.008,sy*.123,z),(x+.009,sy*.206,z-.002)],.004,'cream','foot'+side)
        for yy in (.119,.214):ell('laceEyelet',(x,sy*yy,z-.005),(.006,.005,.004),'gold','foot'+side,0)
    for yy in (.092,.242):
        box('sideShoePanel',(.027,sy*yy,.103),(.090,.008,.032),'cream','foot'+side,.004,rot=(0,-.2,0))
    box('heelPatch',(-.056,sy*.167,.098),(.008,.069,.03),'cream','foot'+side,.005)
# Sleeves rolled above the elbow, exposed forearms, watch, clenched claw fingers.
for side,sy in [('L',1),('R',-1)]:
    limb('cardiganSleeve',(0,sy*.2,1.11),(.018,sy*.287,.932),.092,.071,'jacket','arm'+side)
    ell('sleeveFold',(.01,sy*.271,.973),(.078,.080,.035),'jacket','arm'+side)
    limb('rolledSleeve',(.018,sy*.279,.95),(.022,sy*.30,.914),.081,.081,'jacket','arm'+side)
    for k in range(9):
        a=2*math.pi*k/9;line('cuffRib',[(.018+.078*math.cos(a),sy*.29+.061*math.sin(a),.945),(.022+.078*math.cos(a),sy*.306+.061*math.sin(a),.916)],.0025,'jacket','arm'+side)
    limb('bareForearm',(.018,sy*.296,.922),(.035,sy*.353,.747),.049,.031,'skin','foreArm'+side)
    ell('wristBand',(.035,sy*.348,.768),(.039,.04,.02),'red','foreArm'+side)
    box('watchFace',(.072,sy*.348,.771),(.014,.036,.026),'gold' if sy<0 else 'cream','foreArm'+side,.005)
    sculpt('palm',(.04,sy*.36,.707),(.043,.045,.063),'skin','hand'+side)
    for j in range(4):
        yy=sy*(.326+j*.023); zz=.672+(abs(j-1.5)*.009)
        tube('curledFinger',[(.045,yy,.703),(.061,yy,zz),(.089,yy,zz-.019),(.103,yy,zz-.005)],[.011,.012,.010,.007],'skin','hand'+side)
        ell('bloodyFingertip',(.102,yy,zz-.005),(.008,.008,.010),'blood','hand'+side,0)
    tube('thumb',[(.055,sy*.322,.729),(.093,sy*.3,.696),(.108,sy*.315,.681)],[.018,.015,.010],'skin','hand'+side)
# Head pear form, cheek volumes, ears, explicit brows/nose/open snarling mouth.
ell('cranium',(-.012,0,1.376),(.143,.167,.192),'skin','head')
sculpt('jaw',(.045,0,1.279),(.103,.119,.094),'skin','head')
for sy in (-1,1):
    ell('cheek',(.107,sy*.091,1.323),(.027,.047,.044),'skin','head')
    ell('ear',(-.012,sy*.167,1.356),(.037,.029,.047),'skin','head')
    ell('earInset',(.008,sy*.183,1.36),(.013,.008,.026),'blood','head',0)
    ell('eyeSocket',(.117,sy*.07,1.405),(.023,.053,.049),'blood','head')
    ell('eyeWhite',(.128,sy*.073,1.408),(.026,.042,.037),'cream','head')
    ell('redIris',(.152,sy*.07,1.41),(.008,.022,.026),'eye','head')
    ell('pupil',(.160,sy*.067,1.411),(.003,.008,.017),'dark','head',0)
    ell('eyeGlint',(.161,sy*.062,1.423),(.003,.005,.006),'cream','head',0)
    line('upperLid',[(.134,sy*.112,1.426),(.151,sy*.086,1.443),(.144,sy*.044,1.433)],.005,'hair','head')
    line('angryBrow',[(.123,sy*.123,1.471),(.143,sy*.083,1.463),(.14,sy*.038,1.449)],.010,'hair','head')
    line('lowerLid',[(.14,sy*.113,1.386),(.158,sy*.075,1.371),(.145,sy*.04,1.388)],.003,'skin','head')
ell('noseBridge',(.145,0,1.364),(.026,.02,.041),'skin','head')
ell('noseTip',(.17,0,1.348),(.031,.03,.019),'skin','head')
for sy in (-1,1):ell('nostril',(.19,sy*.016,1.338),(.006,.007,.004),'dark','head',0)
ell('mouthCavity',(.146,0,1.28),(.026,.066,.053),'dark','head')
# rim sits ahead of face, giving a deep dark opening rather than painted mouth.
pts=[(.169,.067*math.sin(t),1.28+.053*math.cos(t)) for t in [2*math.pi*i/24 for i in range(25)]]
line('snarlLip',pts,.0045,'blood','head')
ell('tongue',(.173,0,1.248),(.009,.039,.014),'red','head')
for i in range(7):
    yy=(i-3)*.016
    box('upperTooth',(.174,yy,1.307+(.005 if abs(i-3)>1 else 0)),(.015,.012,.019 if i in (1,5) else .013),'cream','head',.003)
for i in range(5):box('lowerTooth',(.174,(i-2)*.018,1.25),(.012,.012,.011),'cream','head',.003)
# Volumetric swept locks. Hair cap hugs the skull, bangs sweep around brows.
ell('hairCap',(-.065,0,1.439),(.135,.164,.177),'hair','head')
for sy in (-1,1):
    for j in range(4):
        # Asymmetric diagonal fringe, with a visible off-centre part.
        y=sy*(.018+j*.032)
        tip=1.455+(j*.012 if sy>0 else (3-j)*.012)
        pts=[(-.055,.035,1.605),(.006,y*.45,1.591),(.077,y,1.554),(.12,sy*(.024+j*.035),1.514),(.118,sy*(.046+j*.032),tip)]
        tube('sweptBang',pts,[.027,.041,.036,.025,.002],'hair','head',10)
    # tied ponytail bases and cascading chunky tapered clumps
    ell('ponyRoot',(-.073,sy*.164,1.504),(.067,.069,.079),'hair','head')
    ell('redHairTie',(-.05,sy*.181,1.505),(.043,.026,.048),'red','head')
    for j in range(5):
        offset=(j-2)*.022
        spread=.205+j*.022
        bottom=1.258+(j%3)*.025
        pts=[(-.085+offset,sy*.181,1.51),(-.125+offset,sy*(spread-.014),1.461),(-.13+offset,sy*spread,1.38),(-.114+offset,sy*(spread+.018),1.31),(-.075+offset,sy*(spread+.038),bottom),(-.045+offset,sy*(spread+.06),bottom+.027)]
        tube('pigtailLock',pts,[.027,.036,.032,.025,.014,.001],'hair','head',10)
    for j in range(3):
        spread=.232+j*.032
        tube('faceTendril',[(-.09,sy*.18,1.51),(-.065,sy*spread,1.48),(-.071,sy*(spread+.045),1.412),(-.018,sy*(spread+.05),1.374)],[.005,.007,.005,.0006],'hair','head')
    tube('faceTendril',[(.048,sy*.151,1.502),(.09,sy*.172,1.437),(.048,sy*.184,1.357),(.08,sy*.173,1.299),(.113,sy*.175,1.315)],[.014,.016,.014,.009,.001],'hair','head')
for j in range(6):
    y=(j-2.5)*.041
    tube('backHairLock',[(-.09,y,1.602),(-.16,y,1.548),(-.181,y*.9,1.459),(-.156,y*.8,1.369),(-.13,y*.7,1.292+(j%2)*.025)],[.026,.035,.03,.019,.002],'hair','head',10)
for j in range(4):
    tube('faceTendril',[(-.065,.016+j*.02,1.573),(-.063,.045+j*.024,1.631),(-.026,.075+j*.025,1.639),(.004,.091+j*.026,1.615)],[.006,.008,.005,.001],'hair','head')
# Backpack on socket, independent shell pockets, piping, cat patch and brass buckles.
sculpt('backpack',(-.191,0,1.016),(.078,.139,.172),'pack','backpackSocket')
box('packFlap',(-.272,0,1.095),(.026,.263,.121),'pack','backpackSocket',.02)
box('frontPackPocket',(-.268,0,.94),(.054,.203,.11),'pack','backpackSocket',.022)
for sy in (-1,1):
    box('packSidePocket',(-.193,sy*.144,.986),(.092,.038,.107),'pack','backpackSocket',.015)
    line('shoulderStrap',[(-.154,sy*.113,1.133),(-.075,sy*.165,1.198),(.021,sy*.167,1.181),(.11,sy*.148,1.09),(.117,sy*.164,.98),(-.105,sy*.173,.882)],.017,'pack','torso')
    box('strapBuckle',(.124,sy*.156,1.077),(.013,.03,.033),'gold','torso',.005)
    box('packCompressionStrap',(-.292,sy*.074,1.009),(.008,.018,.25),'gold','backpackSocket',.003)
    box('packClasp',(-.30,sy*.074,.959),(.013,.035,.034),'gold','backpackSocket',.005)
line('packHandle',[(-.196,-.034,1.181),(-.195,-.031,1.208),(-.195,.031,1.208),(-.196,.034,1.181)],.010,'pack','backpackSocket')
ell('catPatch',(-.292,0,1.093),(.006,.028,.023),'gold','backpackSocket',0)
for sy in (-1,1):
    tube('catEar',[(-.293,sy*.018,1.104),(-.293,sy*.023,1.125),(-.293,sy*.005,1.11)],[.009,.001,.009],'gold','backpackSocket')
    ell('catEye',(-.299,sy*.009,1.095),(.002,.003,.003),'dark','backpackSocket',0)
# Organic raised blood marks, deterministic surface splats and tear slits.
rng=random.Random(19)
def splat(n,x,y,z,ry,rz,p):
    # Thin jagged closed patch on +X facing surface; shallow depth avoids z-fighting.
    points=[]
    for k in range(11):
        a=k*2*math.pi/11;rr=rng.uniform(.56,1)
        points.append((x,y+math.cos(a)*ry*rr,z+math.sin(a)*rz*rr))
    def surface(yy,zz):
        if n=='bloodTee':
            return .015+.123*math.sqrt(max(.01,1-(yy/.176)**2-((zz-1.004)/.211)**2))+.0015
        if n=='bloodSleeve':
            sy=1 if yy>0 else -1;t=max(0,min(1,(1.11-zz)/.178));cy=sy*(.2+.087*t);r=.092*(1-t)+.071*t
            return .018*t+math.sqrt(max(.00004,r*r-((yy-cy)*.898)**2))+.0006
        if n=='bloodJeans':
            sy=1 if yy>0 else -1
            if zz>.435:
                t=(.746-zz)/(.746-.437);cy=sy*(.102+.043*t);r=.095*(1-t)+.075*t;cx=.015*t
            else:
                t=(.444-zz)/(.444-.165);cy=sy*(.145+.023*t);r=.077*(1-t)+.065*t;cx=.015-.002*t
            return cx+math.sqrt(max(.00004,r*r-(yy-cy)**2))+.001
        return x
    points=[(surface(yy,zz),yy,zz) for _,yy,zz in points]
    vs=[(surface(y,z),y,z)]+points;faces=[(0,i+1,(i+1)%11+1) for i in range(11)]
    me=bpy.data.meshes.new(n);me.from_pydata(vs,[],faces);me.update();o=bpy.data.objects.new(n,me);scene.collection.objects.link(o);finish(o,n,'blood',p)
for y,z,ry,rz in [(-.025,1.07,.04,.056),(.035,1.023,.021,.028),(-.012,.912,.04,.031),(.069,.97,.016,.023),(-.064,1.102,.016,.02),(.064,.86,.022,.025)]:
    splat('bloodTee',.135,y,z,ry,rz,'torso')
for side,sy in [('L',1),('R',-1)]:
    for i in range(13):
        z=rng.uniform(.23,.70);y=sy*(.143+rng.uniform(-.045,.035));x=.091 if z>.435 else .087
        splat('bloodJeans',x,y,z,rng.uniform(.004,.022),rng.uniform(.004,.028),'leg'+side if z>.435 else 'shin'+side)
    for i in range(9):
        z=rng.uniform(.966,1.088);cy=.2+.087*(1.11-z)/.178
        splat('bloodSleeve',.089,sy*(cy+rng.uniform(-.027,.027)),z,rng.uniform(.004,.016),rng.uniform(.006,.02),'arm'+side)
    for i in range(5):splat('bloodHand',.079,sy*rng.uniform(.33,.39),rng.uniform(.695,.738),.009,.012,'hand'+side)
    for i in range(5):splat('bloodShoe',.193,sy*(.167+rng.uniform(-.059,.059)),rng.uniform(.048,.10),.012,.01,'foot'+side)
    line('tornKnee',[(.09,sy*.115,.454),(.096,sy*.15,.46),(.085,sy*.181,.45)],.004,'dark','leg'+side)
for sy in (-1,1):
    for z in (.861,.935,1.025):
        line('cardiganFold',[(.072,sy*.197,z+.009),(.089,sy*.172,z),(.084,sy*.146,z-.019)],.006,'jacket','torso')
for i in range(17):
    y=rng.uniform(-.07,.07);z=rng.uniform(.87,1.13)
    splat('bloodTee',.13,y,z,rng.uniform(.002,.008),rng.uniform(.002,.01),'torso')
# Face smear and several blood drips down cheek/chin.
for sy in (-1,1):
    splat('cheekBlood',.155,sy*.099,1.35,.019,.023,'head')
    line('cheekDrip',[(.151,sy*.098,1.35),(.147,sy*.104,1.323),(.136,sy*.096,1.298)],.0035,'blood','head')
line('chinDrip',[(.15,-.026,1.238),(.122,-.027,1.213),(.105,-.028,1.177)],.004,'blood','head')
# Fuse facial skin volumes into one continuous sculpt; features stay separate.
face_skin=[o for o in scene.objects if o.type=='MESH' and o.parent==parts['head'] and o.data.materials[0]==M['skin']]
bpy.ops.object.select_all(action='DESELECT')
for o in face_skin:o.select_set(True)
bpy.context.view_layer.objects.active=face_skin[0];bpy.ops.object.join()
face=face_skin[0];face.name='continuousFaceSculpt'
remesh=face.modifiers.new('Fuse facial volumes','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.011
bpy.ops.object.modifier_apply(modifier=remesh.name)
soften=face.modifiers.new('Relax sculpt','SMOOTH');soften.factor=.6;soften.iterations=3
bpy.ops.object.modifier_apply(modifier=soften.name)
reduce=face.modifiers.new('Sculpt topology budget','DECIMATE');reduce.ratio=.48
bpy.ops.object.modifier_apply(modifier=reduce.name)
for poly in face.data.polygons:poly.use_smooth=True
# Seven caps export at zero scale, with full-scale geometry and visibility extras.
for part in ['head','armL','armR','foreArmL','foreArmR','legL','legR']:
    loc=parts[part].matrix_world.translation.copy()
    cap=ell('stump_'+part,loc,(.066,.064,.014) if part.startswith('arm') else (.042,.049,.009),'blood',parts[part].parent,0)
    if part.startswith(('arm','fore')):cap.rotation_euler.x=math.radians(75)
    cap['hidden']=True;cap['stumpFor']=part;cap['showScale']=[1,1,1];cap.scale=(0,0,0);parts['stump_'+part]=cap
# Merge by material within each rigid part, preserving all joint origins and caps.
for p in list(parts.values()):
    children=[o for o in list(scene.objects) if o.type=='MESH' and o.parent==p and not o.name.startswith('stump_')]
    materials=set(o.data.materials[0] for o in children)
    for m in sorted(materials,key=lambda m:m.name):
        group=[o for o in list(scene.objects) if o.type=='MESH' and o.parent==p and not o.name.startswith('stump_') and o.data.materials[0]==m]
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        if group:
            bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0].name=p.name+'__'+m.name
# Count applied evaluated triangles and export precisely the asset tree.
meshes=[o for o in scene.objects if o.type=='MESH']
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket']+['stump_'+p for p in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
missing=[n for n in required if n not in bpy.data.objects]
(HERE/'build-stats.json').write_text(json.dumps({'triangles':triangles,'meshes':len(meshes),'nodes_ok':not missing,'missing_nodes':missing},indent=2))
if arg('--glb'):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    print('EXPORT OK',triangles,'triangles',len(meshes),'meshes')
# Optional pose occurs after rest-pose export.
if arg('--view')=='pose':
    parts['armL'].rotation_euler.x=-.8;parts['foreArmL'].rotation_euler.y=-.9;parts['legR'].rotation_euler.y=-.45
    parts['stump_armL'].scale=(1,1,1)
    # detach raised arm from shoulder slightly to expose the demonstrated cap
    parts['armL'].location.y+=.13
if arg('--render'):
    world=bpy.data.worlds.new('Purple studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.10,.17,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5;scene.world=world
    # Studio ground excluded from export.
    bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='studioFloor';floor.data.materials.append(mat('studio','#36333e',.85))
    def area(n,loc,power,color,size):
        o=bpy.data.objects.new(n,bpy.data.lights.new(n,'AREA'));scene.collection.objects.link(o);o.location=loc;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.85))-o.location).to_track_quat('-Z','Y').to_euler()
    area('warmKey',(3,-4,5),450,(1,.78,.62),4)
    area('coolFill',(1,3,3),260,(.64,.70,1),3)
    area('hairRim',(-2,1,3.2),500,(1,.40,.15),2)
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));scene.collection.objects.link(cam);scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=3.45
    view=arg('--view','hero');positions={'hero':(5,-3,2.65),'front':(5,0,1.7),'side':(0,-5,1.7),'back':(-5,0,1.7),'pose':(5,3,2.65)}
    cam.location=positions.get(view,positions['hero']);cam.rotation_euler=(Vector((0,0,.81))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES';scene.cycles.samples=int(arg('--samples','24'));scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='METAL';prefs.get_devices()
        for d in prefs.devices:d.use=d.type=='METAL'
        scene.cycles.device='GPU'
    except Exception: pass
    scene.render.resolution_x=int(arg('--width','960'));scene.render.resolution_y=int(arg('--height','540'));scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(Path(arg('--render')).resolve());Path(scene.render.filepath).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True);print('RENDER OK',view)
