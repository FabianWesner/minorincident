"""Minor Incident adult suburban-mom Runner. +X forward, Z up; rigid joint tree.
Reproducible palette-only geometry. Subdivision and bevels applied before GLB.
Use only experiment/tools/blender_run.py to execute this script.
"""
import bpy, bmesh, math, sys, json, random
from pathlib import Path
from mathutils import Vector
HERE = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(k,d=None): return ARGS[ARGS.index(k)+1] if k in ARGS else d
def contact_sheet(output):
    # Assemble rendered pixels without modifying the reference images.
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
    sheet.pixels.foreach_set(buffer);sheet.filepath_raw=str(Path(output).resolve());sheet.file_format='PNG';sheet.save()
    print('SHEET OK')
if arg('--view')=='sheet':
    contact_sheet(arg('--render'));sys.exit(0)
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
 'skin':mat('infectedSkin','#c9a39a',.57), 'jacket':mat('cardiganRose','#dc809a'),
 'denim':mat('denim','#74819c'), 'hair':mat('hairAuburn','#743522'),
 'hairLight':mat('hairCopper','#984725'), 'hairDark':mat('hairShadow','#582c23'),
 'cream':mat('picketWhite','#f2e6dc'), 'red':mat('survivorRed','#d9363e',.48),
 'blood':mat('blood','#b3121f',.29), 'dark':mat('uiDark','#25222c'),
 'pack':mat('woodWarm','#b0703f'), 'leather':mat('leatherShadow','#77482e'),
 'gold':mat('schoolBusYellow','#f2b630',.4), 'stitch':mat('denimStitch','#a4a4b3'),
 'eye':mat('infectedEye','#ff3b2f',.25,4.5)}
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
    mod=o.modifiers.new('Soft tailored edges','BEVEL'); mod.width=min(b,min(s)*.4);mod.segments=1 if n=='soleGroove' else 3
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
    source=[Vector(q) for q in points]
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
    if n.startswith(('hair','bang','curl','claw','thumb','cardiganSleeve')):
        mod=o.modifiers.new('Applied swept sculpt','SUBSURF');mod.levels=1
    return finish(o,n,m,p)

def line(n,pts,r,m,p): return tube(n,pts,[r]*len(pts),m,p)

def limb(n,a,b,r1,r2,m,p):
    a=Vector(a); b=Vector(b)
    pts=[a.lerp(b,t) for t in (0,.08,.25,.55,.85,1)]
    return tube(n,pts,[r1,r1,r1*.98,(r1+r2)/2,r2,r2],m,p,12)

# Authored body; the R2 proportions and lunging rest pose are applied below.
node('root',(0,0,0));parts['root']['asset_id']='inf.suburban-mom';parts['root']['forward']='+X';parts['root']['animation']='rigid-part'
node('hip',(-.045,0,.70),'root');node('torso',(-.025,0,.78),'hip');node('head',(.055,0,1.10),'torso')
node('backpackSocket',(-.14,0,1.01),'torso')
for side,s in [('L',1),('R',-1)]:
    node('arm'+side,(.01,s*.195,1.045),'torso')
    node('foreArm'+side,(.10,s*.31,.88),'arm'+side)
    node('hand'+side,(.27,s*.365,.77),'foreArm'+side)
    node('leg'+side,(-.045,s*.103,.70),'hip')
    node('shin'+side,(.038,s*.17,.407),'leg'+side)
    node('foot'+side,(-.002,s*.215,.135),'shin'+side)
# Buttoned pink cardigan shell, white pointed collar, tailored back and hem.
sculpt('jeansSeat',(-.045,0,.683),(.143,.168,.102),'denim','hip')
# Fitted garment rings keep the hem joined to the shell, rather than
# tapering an ellipsoid to a point beneath the waist trim.
shirt_rings=[(-.025,.685,.153,.19),(-.025,.705,.153,.19),(-.022,.75,.15,.193),(-.015,.88,.148,.203),(-.008,1.01,.14,.202),(.005,1.066,.112,.165),(.025,1.10,.063,.083)]
verts=[(x+rx*math.cos(j*2*math.pi/20),ry*math.sin(j*2*math.pi/20),z) for x,z,rx,ry in shirt_rings for j in range(20)]
faces=[(k*20+j,k*20+(j+1)%20,(k+1)*20+(j+1)%20,(k+1)*20+j) for k in range(len(shirt_rings)-1) for j in range(20)]
faces.extend([tuple(range(19,-1,-1)),tuple((len(shirt_rings)-1)*20+j for j in range(20))])
me=bpy.data.meshes.new('Cardigan shell');me.from_pydata(verts,[],faces);me.update()
o=bpy.data.objects.new('Cardigan shell',me);scene.collection.objects.link(o)
mod=o.modifiers.new('Applied garment sculpt','SUBSURF');mod.levels=1
finish(o,'cardiganTorso','jacket','torso')
sculpt('cardiganBack',(-.10,0,.91),(.066,.186,.188),'jacket','torso')
line('ribHem',[(.084,-.155,.704),(.119,-.08,.691),(.126,0,.689),(.119,.08,.691),(.084,.155,.704)],.016,'jacket','torso')
for i in range(19):
    y=-.152+i*.017;x=.125-.04*(abs(y)/.155)**2
    line('hemKnitting',[(x+.006,y,.687),(x+.006,y,.711)],.002,'jacket','torso')
line('buttonPlacket',[(.08,0,1.092),(.138,0,1.01),(.141,0,.89),(.135,0,.77),(.126,0,.702)],.011,'jacket','torso')
for z,x in [(1.009,.15),(.942,.157),(.874,.159),(.806,.15)]:
    ell('button',(x,0,z),(.005,.009,.009),'leather','torso',0)
# Open collar uses soft triangular cotton lapels.
def patch(n,verts,m,p,thick=.005):
    me=bpy.data.meshes.new(n);me.from_pydata(verts,[],[tuple(range(len(verts)))]);me.update()
    o=bpy.data.objects.new(n,me);scene.collection.objects.link(o)
    mo=o.modifiers.new('Cloth thickness','SOLIDIFY');mo.thickness=thick
    mo=o.modifiers.new('Soft trim','BEVEL');mo.width=.003;mo.segments=2
    return finish(o,n,m,p)
for s in [-1,1]:
    patch('whiteCollar',[(.063,s*.052,1.11),(.105,s*.105,1.076),(.154,s*.059,1.003),(.135,s*.014,1.05)],'cream','torso')
    for z in [.76,.85,.96]:
        line('cardiganFold',[(.105,s*.139,z+.022),(.133,s*.106,z),(.128,s*.079,z-.012)],.005,'jacket','torso')
line('backYoke',[(-.159,-.13,1.002),(-.17,0,.986),(-.159,.13,1.002)],.003,'jacket','torso')
# Jeans and anatomically placed knee openings. Smooth shells have actual removed faces.
def cut_ellipsoid(o,c,r):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=c)
    tool=bpy.context.object;tool.scale=r;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('Actual torn opening','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=tool
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(tool,do_unlink=True)
for side,s in [('L',1),('R',-1)]:
    p='leg'+side;sh='shin'+side;f='foot'+side
    thigh=limb('denimThigh',(-.045,s*.105,.69),(.038,s*.17,.415),.102,.078,'denim',p)
    cut_ellipsoid(thigh,(.114,s*.17,.453),(.075,.066,.045))
    ell('exposedKnee',(.060,s*.17,.451),(.062,.059,.039),'skin',p)
    for j in range(7):
        yy=s*.17+(j-3)*.014
        patch('tornDenimTab',[(.108,yy-.008,.477),(.133,yy,.459+(j%2)*.008),(.112,yy+.008,.478)],'denim',p)
    for j in range(3):
        line('frayedThread',[(.12,s*.17-.047+j*.021,.44),(.126,s*.17-.036+j*.021,.426),(.12,s*.17-.027+j*.021,.44)],.0015,'stitch',p)
    limb('jeansCalf',(.035,s*.174,.404),(-.002,s*.213,.174),.078,.064,'denim',sh)
    for z,yy,xx,pa in [(.565,.14,.106,p),(.34,.189,.103,sh),(.255,.20,.082,sh)]:
        line('denimCrease',[(xx-.014,s*(yy-.05),z+.012),(xx,s*yy,z),(xx-.012,s*(yy+.05),z-.007)],.006,'denim',pa)
    box('rolledCuff',(-.002,s*.213,.182),(.15,.155,.044),'stitch',sh,.015)
    line('rolledCuffEdge',[(.075,s*.158,.204),(.08,s*.212,.207),(.072,s*.271,.2)],.005,'denim',sh)
    line('outerSeam',[(.02,s*.248,.4),(.012,s*.275,.3),(.001,s*.284,.211)],.002,'stitch',sh)
    line('frontPocket',[(.081,s*.065,.723),(.094,s*.116,.681),(.062,s*.17,.674)],.0025,'stitch','hip')
    box('rearJeanPocket',(-.137,s*.108,.658),(.014,.084,.071),'denim',p,.009)
    line('backPocketStitch',[(-.147,s*.071,.685),(-.15,s*.148,.685),(-.15,s*.143,.636),(-.15,s*.104,.628),(-.147,s*.071,.645)],.002,'stitch',p)
    box('beltLoop',(.066,s*.12,.713),(.022,.014,.044),'denim','hip',.004)
    # Pink-coral sneakers, cream bumper, stitching, laces and sole tread.
    ell('ankle',(-.001,s*.214,.137),(.047,.049,.041),'skin',f)
    box('outsole',(.05,s*.218,.024),(.275,.165,.048),'cream',f,.015)
    box('midsole',(.05,s*.218,.055),(.269,.161,.036),'cream',f,.012)
    sculpt('coralSneaker',(.026,s*.218,.105),(.139,.083,.07),'red',f)
    box('toeCap',(.154,s*.218,.094),(.084,.156,.059),'cream',f,.022)
    sculpt('shoeTongue',(.016,s*.218,.152),(.055,.051,.035),'jacket',f)
    for j in range(4):
        xx=.01+j*.024;zz=.177-j*.010
        line('lace',[(xx-.012,s*.218-.048,zz),(xx+.012,s*.218+.046,zz-.003)],.004,'cream',f)
        for yy in [-.047,.047]:ell('eyelet',(xx,s*.218+yy,zz-.006),(.007,.006,.004),'cream',f,0)
    for yy in [-.081,.081]:
        box('shoeSideStripe',(.034,s*.218+yy,.102),(.085,.008,.026),'cream',f,.003,rot=(0,-.3,0))
        line('soleStitch',[(-.071,s*.218+yy,.054),(.14,s*.218+yy,.054)],.0018,'leather',f)
    for j in range(7):box('soleGroove',(-.066+j*.033,s*.218,.016),(.008,.173,.017),'leather',f,.002)
line('fly',[ (.082,0,.722),(.096,0,.68),(.086,0,.639)],.0025,'stitch','hip')
# Reaching sleeves, rolled cuffs and broad hands with individually curled fingers.
for side,s in [('L',1),('R',-1)]:
    a='arm'+side;fore='foreArm'+side;h='hand'+side
    limb('cardiganSleeve',(.006,s*.191,1.038),(.103,s*.31,.883),.097,.071,'jacket',a)
    for t in [.43,.63,.82]:
        x=.006+.097*t;y=s*(.191+.119*t);z=1.038-.155*t
        ell('sleeveFold',(x,y,z),(.08,.074,.027),'jacket',a)
    limb('turnedCuff',(.095,s*.301,.904),(.12,s*.322,.863),.079,.079,'jacket',a)
    line('cuffBinding',[(.18,s*.285,.894),(.192,s*.313,.88),(.17,s*.35,.861)],.005,'cream',a)
    limb('forearm',(.113,s*.319,.876),(.27,s*.365,.77),.049,.035,'skin',fore)
    sculpt('palm',(.301,s*.366,.745),(.057,.064,.046),'skin',h)
    for j in range(4):
        yy=s*.366+(j-1.5)*.036;zz=.736+abs(j-1.5)*.009
        tip_y=yy+(j-1.5)*.009;short=.008*abs(j-1.5)
        tube('clawFinger',[(.32,yy,zz),(.358,yy,.712+short),(.382,tip_y,.681+short),(.378,tip_y,.655+short),(.359,tip_y,.654+short)],[.016,.016,.013,.010,.006],'skin',h)
        ell('bloodyNail',(.368,tip_y,.653+short),(.011,.011,.012),'blood',h,0)
        ell('knuckle',(.341,yy,.731),(.017,.017,.016),'skin',h,0)
    tube('thumb',[(.296,s*(.366-.046),.75),(.34,s*.285,.735),(.37,s*.28,.706),(.355,s*.301,.694)],[.022,.019,.015,.009],'skin',h)
    if side=='R':
        limb('watchBand',(.231,s*.354,.798),(.254,s*.36,.782),.042,.042,'leather',fore)
        box('watch',(.252,s*.385,.803),(.035,.022,.03),'gold',fore,.005)
        box('watchDial',(.253,s*.399,.805),(.025,.006,.022),'dark',fore,.004)
# Large head with a continuous fused face and a truly inset snarling mouth.
ell('neck',(.04,0,1.125),(.066,.067,.085),'skin','head')
ell('cranium',(.046,0,1.316),(.170,.193,.210),'skin','head')
sculpt('jaw',(.114,0,1.196),(.125,.137,.114),'skin','head')
for s in [-1,1]:
    ell('cheek',(.165,s*.103,1.252),(.048,.071,.074),'skin','head')
    ell('ear',(.038,s*.193,1.287),(.046,.026,.063),'skin','head')
ell('noseBridge',(.209,0,1.276),(.028,.027,.056),'skin','head')
ell('noseTip',(.241,0,1.25),(.036,.037,.027),'skin','head')
# Voxel fuse only skin of face, retaining feature shells and joint separation.
skin=[o for o in scene.objects if o.type=='MESH' and o.parent==parts['head'] and o.data.materials[0]==M['skin']]
bpy.ops.object.select_all(action='DESELECT')
for o in skin:o.select_set(True)
bpy.context.view_layer.objects.active=skin[0];bpy.ops.object.join();face=skin[0];face.name='continuousFace'
mod=face.modifiers.new('Unified face sculpt','REMESH');mod.mode='VOXEL';mod.voxel_size=.014;bpy.ops.object.modifier_apply(modifier=mod.name)
mod=face.modifiers.new('Sculpt relaxation','SMOOTH');mod.factor=.5;mod.iterations=3;bpy.ops.object.modifier_apply(modifier=mod.name)
for poly in face.data.polygons:poly.use_smooth=True
cut_ellipsoid(face,(.226,0,1.177),(.094,.074,.077))
ell('mouthInterior',(.162,0,1.177),(.044,.068,.073),'dark','head')
pts=[(.218,.073*math.sin(t),1.177+.073*math.cos(t)) for t in [2*math.pi*i/28 for i in range(29)]]
line('bloodyLip',pts,.007,'blood','head')
ell('tongue',(.206,0,1.129),(.02,.043,.019),'red','head')
for i in range(7):
    y=(i-3)*.019
    box('upperTooth',(.225,y,1.220+abs(i-3)*.001),(.02,.015,.022 if i in (1,5) else .017),'cream','head',.004)
for i in range(5):box('lowerTooth',(.224,(i-2)*.022,1.122),(.019,.016,.016),'cream','head',.003)
for s in [-1,1]:
    ell('earBowl',(.061,s*.211,1.289),(.027,.009,.037),'red','head')
    line('earRim',[(.071,s*.21,1.324),(.087,s*.22,1.29),(.059,s*.216,1.253)],.006,'skin','head')
    ell('eyeSocket',(.191,s*.082,1.321),(.024,.057,.055),'blood','head')
    ell('eyeWhite',(.211,s*.083,1.326),(.015,.045,.042),'cream','head')
    ell('infectedIris',(.227,s*.08,1.328),(.009,.035,.036),'eye','head')
    ell('pupil',(.236,s*.077,1.328),(.003,.010,.019),'dark','head',0)
    ell('eyeHighlight',(.240,s*.07,1.344),(.003,.006,.007),'cream','head',0)
    line('upperLid',[(.211,s*.129,1.346),(.232,s*.087,1.365),(.224,s*.041,1.353)],.006,'hairDark','head')
    line('lowerLid',[(.216,s*.129,1.308),(.234,s*.082,1.286),(.224,s*.041,1.30)],.004,'skin','head')
    line('angryBrow',[(.192,s*.134,1.396),(.219,s*.089,1.391),(.213,s*.037,1.370)],.013,'hairDark','head')
    ell('nostril',(.264,s*.018,1.238),(.006,.009,.006),'dark','head',0)
# Thick auburn shoulder-length waves. Seeded asymmetry, a left-parted fringe and back tie.
# Continuous scalp shell follows the cranium 7 mm above the skin. Its
# sloping hairline keeps the forehead open while filling gaps between locks.
cap=ell('hairMass',(.046,0,1.316),(.177,.201,.217),'hair','head')
bm=bmesh.new();bm.from_mesh(cap.data)
remove=[v for v in bm.verts if v.co.z+1.316 < 1.33+.082*max(-1,min(1,v.co.x/.17))]
bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(cap.data);bm.free()

for s in [-1,1]:
    for j in range(4):
        yy=s*(.035+j*.046)
        tube('bangWave',[(-.026,.052,1.543),(.069,yy*.48,1.55+(j%2)*.008),(.158,yy,1.49),(.181,s*(.09+j*.038),1.424+j*.014),(.148,s*(.168+j*.032),1.37+j*.013),(.14,s*(.19+j*.032),1.395+j*.014)],[.033,.047,.046,.035,.018,.001],'hairLight' if j%3==0 else 'hair','head',10)
    for j in range(7):
        x=-.102+j*.033;yy=s*(.174+(j%3)*.02);z=1.453+(j%2)*.029
        tube('hairSideWave',[(x,yy*.79,z),(x+.023,yy,1.377),(x-.014,yy+.075*s,1.30),(x+.034,yy+.105*s,1.239),(x+.063,yy+.082*s,1.16+(j%3)*.025),(x+.1,yy+.09*s,1.207+(j%3)*.025)],[.035,.049,.043,.034,.020,.001],'hairLight' if j%3==1 else 'hair','head',10)
    for j in range(3):
        tube('curlFlyaway',[(.005,s*.202,1.42),(.06,s*(.25+j*.02),1.38),(.12,s*(.27+j*.025),1.37),(.14,s*(.28+j*.02),1.39)],[.004,.006,.004,.001],'hairLight','head')
    for j in range(3):
        xx=-.10+j*.065
        tube('hairShoulderCurl',[(xx,s*.19,1.37),(xx-.01,s*.285,1.31),(xx+.04,s*.34,1.25),(xx+.095,s*.335,1.19),(xx+.13,s*.28,1.17),(xx+.09,s*.25,1.21),(xx+.065,s*.29,1.235)],[.041,.053,.051,.046,.035,.022,.002],'hairLight' if j==1 else 'hair','head',10)
        tube('curlWildWisp',[(xx,s*.26,1.27),(xx+.02,s*.35,1.245),(xx+.09,s*.37,1.267),(xx+.105,s*.34,1.30)],[.006,.008,.005,.001],'hairLight','head')
for j in range(9):
    yy=(j-4)*.040
    tube('hairBackWave',[(-.052,yy*.7,1.543),(-.16,yy,1.47),(-.20,yy+.022*math.sin(j),1.36),(-.16,yy*1.1-.025*math.cos(j),1.27),(-.19,yy*1.14+.015*math.sin(j),1.193),(-.11,yy*1.2+.032*math.cos(j),1.18+(j%3)*.025)],[.028,.041,.044,.04,.025,.001],'hairLight' if j%3==1 else 'hair','head',10)
for j in range(5):
    yy=(j-2)*.035
    tube('hairCrownWave',[(-.09,yy,1.535),(-.03,yy,1.555),(.04,yy+.03,1.552),(.10,yy+.03,1.51)],[.027,.029,.026,.009],'hair','head',10)
for j in range(4):
    tube('curlCrown',[(.005,.025,1.51),(-.034,.03+j*.026,1.565),(.009,.073+j*.027,1.58),(.049,.095+j*.029,1.552)],[.006,.009,.006,.001],'hairLight','head')
ell('ponyTie',(-.17,.085,1.435),(.025,.065,.043),'red','head')
for j in range(5):
    tube('hairPony',[(-.17,.07,1.435),(-.23,.09+(j-2)*.02,1.40),(-.25,.08+(j-2)*.024,1.31),(-.21,.10+(j-2)*.026,1.26),(-.23,.15+(j-2)*.025,1.28)],[.021,.027,.025,.017,.001],'hair','head',10)
for j in range(3):
    ell('scrunchieFold',(-.173,.038+j*.027,1.443),(.03,.021,.03),'red','head',0)
# Brown crossbody handbag sits on the character's left hip, readable in front-right view.
sculpt('bagBody',(-.025,.293,.653),(.088,.119,.151),'pack','hip')
box('bagFlap',(.065,.293,.722),(.027,.227,.122),'pack','hip',.024)
box('bagPocket',(.074,.294,.601),(.032,.157,.068),'pack','hip',.017)
line('bagPiping',[(.071,.19,.77),(.075,.182,.60),(.075,.214,.523),(.075,.36,.523),(.075,.408,.59),(.071,.397,.77)],.0035,'leather','hip')
line('flapPiping',[(.085,.191,.735),(.086,.20,.671),(.089,.3,.65),(.086,.395,.673),(.085,.394,.735)],.003,'leather','hip')
box('bagClasp',(.095,.30,.672),(.013,.026,.03),'gold','hip',.005)
line('bagHandle',[(-.025,.24,.797),(-.029,.25,.829),(-.029,.335,.829),(-.025,.35,.797)],.01,'leather','hip')
# Flat ribbon strap lies 5mm clear of garment instead of a round rope.
strap=[(.033,-.168,1.075),(.127,-.119,1.036),(.159,-.045,.969),(.156,.031,.896),(.133,.115,.82),(.096,.207,.757),(.032,.285,.793)]
for a,b in zip(strap,strap[1:]):
    patch('frontCrossbodyStrap',[(a[0],a[1]-.018,a[2]),(a[0],a[1]+.018,a[2]),(b[0],b[1]+.018,b[2]),(b[0],b[1]-.018,b[2])],'leather','torso',.009)
backstrap=[(.033,-.168,1.075),(-.115,-.18,1.036),(-.172,-.119,.973),(-.183,-.03,.897),(-.163,.08,.82),(-.102,.21,.756),(-.025,.29,.792)]
for a,b in zip(backstrap,backstrap[1:]):
    patch('backCrossbodyStrap',[(a[0],a[1]-.018,a[2]),(a[0],a[1]+.018,a[2]),(b[0],b[1]+.018,b[2]),(b[0],b[1]-.018,b[2])],'leather','torso',.009)
box('strapBuckle',(.164,.085,.852),(.016,.046,.035),'gold','torso',.005)
for z,y,x in [(.97,-.045,.171),(.82,.132,.139),(.739,.27,.093)]:ell('strapRivet',(x,y,z),(.004,.006,.006),'gold','torso',0)
# Heavy stylized blood and jagged garment tears; every patch has >=3mm separation.
rng=random.Random(123)
def splat(n,c,ry,rz,p,surface=None):
    x,y,z=c;verts=[c]
    for k in range(12):
        a=k*2*math.pi/12;r=rng.uniform(.5,1)
        yy=y+math.cos(a)*ry*r;zz=z+math.sin(a)*rz*r
        xx=surface(yy,zz) if surface else x
        verts.append((xx,yy,zz))
    if surface:verts[0]=(surface(y,z),y,z)
    fs=[(0,i+1,(i+1)%12+1) for i in range(12)]
    me=bpy.data.meshes.new(n);me.from_pydata(verts,[],fs);me.update();o=bpy.data.objects.new(n,me);scene.collection.objects.link(o);return finish(o,n,'blood',p)
def shirt_surface(y,z):
    for a,b in zip(shirt_rings,shirt_rings[1:]):
        if a[1]<=z<=b[1]:
            t=(z-a[1])/(b[1]-a[1]);x=a[0]*(1-t)+b[0]*t;rx=a[2]*(1-t)+b[2]*t;ry=a[3]*(1-t)+b[3]*t
            return x+rx*math.sqrt(max(.02,1-(y/ry)**2))+.006
    return .15
for c,ry,rz in [((.15,-.05,1.018),.04,.06),((.15,.02,.949),.035,.051),((.15,-.025,.886),.023,.044),((.15,.07,.801),.024,.021)]:splat('cardiganBlood',c,ry,rz,'torso',shirt_surface)
for i in range(30):
    y=rng.uniform(-.12,.12);z=rng.uniform(.74,1.068)
    splat('bloodSpray',(.15,y,z),rng.uniform(.002,.008),rng.uniform(.003,.01),'torso',shirt_surface)
for s in [-1,1]:
    splat('faceBlood',(.224,s*.129,1.265),.018,.039,'head')
    line('cheekBloodDrip',[(.225,s*.13,1.278),(.225,s*.132,1.234),(.214,s*.118,1.209)],.004,'blood','head')
    line('chinDrip',[(.226,s*.036,1.111),(.199,s*.032,1.087),(.159,s*.033,1.058)],.005,'blood','head')
    splat('bloodyPalm',(.355,s*.366,.75),.049,.023,'hand'+('L' if s>0 else 'R'))
    for j in range(5):
        z=.92+j*.022;t=(1.038-z)/.155;xx=.006+.097*t;yy=s*(.191+.119*t)
        splat('sleeveBlood',(xx+.08,yy,z),.015,.013,'arm'+('L' if s>0 else 'R'))
# Forehead abrasion follows the forehead surface.
splat('foreheadBlood',(.20,.008,1.424),.014,.02,'head')
for side,s in [('L',1),('R',-1)]:
    for j in range(8):
        z=rng.uniform(.49,.65);t=(.69-z)/.275;yy=s*(.105+.065*t)+rng.uniform(-.022,.022);xx=-.045+.083*t+.1*(1-t)+.078*t+.007
        splat('jeansBlood',(xx,yy,z),rng.uniform(.004,.012),rng.uniform(.005,.016),'leg'+side)
    for j in range(5):splat('shoeBlood',(.199,s*.218+rng.uniform(-.05,.05),.093),.013,.016,'foot'+side)
# Connect rigid knee seams beneath the torn shells.
for side,s in [('L',1),('R',-1)]:
    ell('kneeJoint',(.035,s*.172,.407),(.061,.068,.055),'denim','shin'+side)
# R2: reshape the authored rigid surfaces, then place each joint at its new
# anatomical rest location. Details and blood move with their shell surfaces.
def meshes_of(part):
    return [o for o in scene.objects if o.type=='MESH' and o.parent==parts[part]]

def warp_meshes(part, transform):
    for o in meshes_of(part):
        world=o.matrix_world.copy();inverse=world.inverted()
        for v in o.data.vertices:v.co=inverse @ transform(world @ v.co)
        o.data.update()
        if o.data.has_custom_normals:o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))

def move_joint(part, location):
    o=parts[part]
    children=[(c,c.matrix_world.copy()) for c in o.children]
    o.matrix_world.translation=Vector(location)
    bpy.context.view_layer.update()
    for c,world in children:c.matrix_world=world
    bpy.context.view_layer.update()

# Lower the pelvis before fitting the bent legs; upper-body descendants follow.
parts['hip'].location+=Vector((-.055,0,-.06))
bpy.context.view_layer.update()
head_origin=parts['head'].matrix_world.translation.copy()
warp_meshes('head',lambda v: head_origin+Vector(((v.x-head_origin.x)*1.10,(v.y-head_origin.y)*1.24,(v.z-head_origin.z)*1.18)))
# The head is broad, with a large face rather than a long narrow silhouette.
for side in ['L','R']:
    origin=parts['hand'+side].matrix_world.translation.copy()
    warp_meshes('hand'+side,lambda v,o=origin:o+(v-o)*1.48)
    # Upper arm and forearm thickness, with axial length unchanged.
    for part,child,bulk in [('arm','foreArm',1.16),('foreArm','hand',1.24)]:
        origin=parts[part+side].matrix_world.translation.copy()
        axis=(parts[child+side].matrix_world.translation-origin).normalized()
        def radial(v,o=origin,a=axis,k=bulk):
            d=v-o;along=a*d.dot(a)
            return o+along+(d-along)*k
        warp_meshes(part+side,radial)

# Bent knees and a staggered planted stance, forward is +X.
targets={
    'legL':(-.10,.12,.64),'shinL':(.115,.23,.37),'footL':(-.08,.30,.1458),
    'legR':(-.10,-.12,.64),'shinR':(.22,-.23,.385),'footR':(.135,-.30,.1458)}
for side in ['L','R']:
    for part,child,bulk in [('leg','shin',1.20),('shin','foot',1.24)]:
        name=part+side;end=child+side
        old_a=parts[name].matrix_world.translation.copy();old_b=parts[end].matrix_world.translation.copy()
        new_a=Vector(targets[name]);new_b=Vector(targets[end])
        old_axis=(old_b-old_a).normalized();new_axis=(new_b-new_a).normalized()
        turn=old_axis.rotation_difference(new_axis);length=(new_b-new_a).length/(old_b-old_a).length
        def bent(v,a=old_a,b=new_a,axis=old_axis,q=turn,k=length,r=bulk):
            d=v-a;axial=axis*d.dot(axis)
            return b+q @ (axial*k+(d-axial)*r)
        warp_meshes(name,bent)
    old=parts['foot'+side].matrix_world.translation.copy();new=Vector(targets['foot'+side])
    warp_meshes('foot'+side,lambda v,a=old,b=new:b+Vector(((v.x-a.x)*1.20,(v.y-a.y)*1.24,(v.z-a.z)*1.08)))
    for name in ['leg'+side,'shin'+side,'foot'+side]:move_joint(name,targets[name])
# A wider denim seat overlaps the new hip origins naturally.
hip_origin=parts['hip'].matrix_world.translation.copy()
for obj in meshes_of('hip'):
    if obj.name.startswith(('jeansSeat','frontPocket','beltLoop','fly')):
        world=obj.matrix_world.copy();inv=world.inverted()
        for v in obj.data.vertices:
            q=world@v.co;d=q-hip_origin
            v.co=inv@(hip_origin+Vector((d.x*1.12,d.y*1.17,d.z)))
        obj.data.update()
# A strong forward lean with the head counter-tilted to keep the snarl visible.
parts['torso'].rotation_euler.y=.48
parts['head'].rotation_euler.y=-.20
parts['armL'].rotation_euler=(.13,-1.12,-.04)
parts['armR'].rotation_euler=(-.08,-1.20,.05)
parts['foreArmL'].rotation_euler.y=.12
parts['foreArmR'].rotation_euler.y=.23
bpy.context.view_layer.update()

# Record joint placement and posed silhouette dimensions for review.
points=[o.matrix_world @ v.co for o in scene.objects if o.type=='MESH' for v in o.data.vertices]
height=max(v.z for v in points)-min(v.z for v in points)
metrics={'height':round(height,4),'min_z':round(min(v.z for v in points),6),'head_above_neck_ratio':round((max((o.matrix_world @ v.co).z for o in meshes_of('head') for v in o.data.vertices)-parts['head'].matrix_world.translation.z)/height,4),'torso_lean_degrees':round(math.degrees(.48),2),'joint_positions':{n:[round(v,4) for v in o.matrix_world.translation] for n,o in parts.items()},'knee_flexion_degrees':{}}
for side in ['L','R']:
    hip=parts['leg'+side].matrix_world.translation;knee=parts['shin'+side].matrix_world.translation;ankle=parts['foot'+side].matrix_world.translation
    metrics['knee_flexion_degrees'][side]=round(180-math.degrees((hip-knee).angle(ankle-knee)),2)
(HERE/'rig-metrics.json').write_text(json.dumps(metrics,indent=2))

# Parent-side stump caps remain behind when the named limb subtree is detached.
for part in ['head','armL','armR','foreArmL','foreArmR','legL','legR']:
    loc=parts[part].matrix_world.translation.copy()
    dims=(.066,.066,.014) if part=='head' else ((.118,.11,.018) if part.startswith('leg') else ((.060,.055,.012) if part.startswith('fore') else (.100,.098,.018)))
    cap=ell('stump_'+part,loc,dims,'blood',parts[part].parent,0)
    next_joint=('foreArm'+part[-1] if part.startswith('arm') else ('hand'+part[-1] if part.startswith('fore') else ('shin'+part[-1] if part.startswith('leg') else None)))
    direction=parts[next_joint].matrix_world.translation-loc if next_joint else Vector((.17,0,1))
    cap.rotation_mode='QUATERNION'
    cap.rotation_quaternion=cap.parent.matrix_world.to_quaternion().inverted() @ direction.to_track_quat('Z','Y')
    cap['hidden']=True;cap['stumpFor']=part;cap['showScale']=[1,1,1];cap.scale=(0,0,0);parts['stump_'+part]=cap

# Collapse redundant smooth-surface triangles before joint/material batching.
for obj in list(scene.objects):
    if obj.type=='MESH' and len(obj.data.polygons)>130 and not obj.name.startswith('stump_'):
        bpy.context.view_layer.objects.active=obj
        mod=obj.modifiers.new('Applied silhouette reduction','DECIMATE');mod.ratio=.31
        bpy.ops.object.modifier_apply(modifier=mod.name)

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
# Pose changes happen only after the rest-pose GLB export.
def pose_test():
    parts['armL'].rotation_euler.x=-.8
    parts['foreArmL'].rotation_euler.y=-.9
    parts['legR'].rotation_euler.y=-.45
    parts['stump_armL'].scale=(1,1,1)
    # Small shoulder separation exposes the retained cap for review.
    parts['armL'].location.y+=.24
if arg('--view')=='pose':pose_test()
if arg('--render'):
    world=bpy.data.worlds.new('Purple studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.10,.17,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5;scene.world=world
    # Studio ground excluded from export.
    bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='studioFloor';floor.data.materials.append(mat('studio','#36333e',.85))
    def area(n,loc,power,color,size):
        o=bpy.data.objects.new(n,bpy.data.lights.new(n,'AREA'));scene.collection.objects.link(o);o.location=loc;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.85))-o.location).to_track_quat('-Z','Y').to_euler()
    area('warmKey',(3,-4,5),450,(1,.78,.62),4)
    area('coolFill',(1,3,3),260,(.64,.70,1),3)
    area('hairRim',(-2,1,3.2),500,(1,.40,.15),2)
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));scene.collection.objects.link(cam);scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=3.35
    view=arg('--view','hero');positions={'hero':(5,-3,2.55),'front':(5,0,1.7),'side':(0,-5,1.7),'back':(-5,0,1.7),'pose':(4,5,2.2)}
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
    if view in ('reviewAll','final'):
        scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
        for study in ['front','side','back']:
            cam.location=positions[study];cam.rotation_euler=(Vector((0,0,.81))-cam.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(HERE/'renders'/f'{study}.png')
            bpy.ops.render.render(write_still=True);print('RENDER OK',study)

    if view=='final':
        pose_test()
        cam.location=positions['pose'];cam.rotation_euler=(Vector((0,0,.81))-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(HERE/'renders'/'pose-test.png')
        bpy.ops.render.render(write_still=True);print('RENDER OK pose')
        contact_sheet(HERE/'renders'/'turnaround.png')
