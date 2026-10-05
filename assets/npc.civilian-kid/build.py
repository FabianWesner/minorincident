"""Civilian kid: deterministic palette-only rigid hero, +X front, -Y right.
Applied subdivision, joint-local exports; run via experiment/tools/blender_run.py.
"""
import argparse, math, sys, json
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser()
for key in ['render','glb']: ap.add_argument('--'+key)
ap.add_argument('--view',default='hero');ap.add_argument('--samples',type=int,default=24)
ap.add_argument('--width',type=int,default=960);ap.add_argument('--height',type=int,default=540);ap.add_argument('--pose',action='store_true')
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene;parts={};objects=[]
COLORS={'picketWhite':'f2e6dc','uiDark':'25222c','survivorRed':'d9363e','schoolBusYellow':'f2b630','woodWarm':'b0703f','skinWarm':'f2ad86','skinBlush':'ec947e','hairChestnut':'492720','hairWarm':'67352a','hairHighlight':'80432e','eyeBrown':'623021','teeLavender':'e6dae8','teeSeam':'cdbecf','olive':'6d7050','oliveLight':'80815e','oliveSeam':'53563c','packBlue':'355e83','packEdge':'28465f','orange':'ed8b35','mouth':'883e3c'}
def mat(k,h):
    m=bpy.data.materials.new('pal_'+k);m.use_nodes=True
    c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=c;bs.inputs['Roughness'].default_value=.7
    if k in ['eyeBrown','uiDark']:bs.inputs['Roughness'].default_value=.3
    m.diffuse_color=c;return m
M={k:mat(k,h) for k,h in COLORS.items()}
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p;bpy.context.view_layer.update()
    if par:
        world=o.matrix_world.copy();o.parent=parts[par];o.matrix_world=world
    parts[n]=o;bpy.context.view_layer.update();return o
def finish(o,n,m,par,sub=0):
    o.name=n;o.data.materials.append(M[m]);bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if sub:
        mod=o.modifiers.new('Applied sculpt smoothing','SUBSURF');mod.levels=sub;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    bpy.context.view_layer.update();world=o.matrix_world.copy();o.parent=parts[par];o.matrix_world=world
    objects.append(o);return o
def ell(n,p,sz,m,par,rot=None,seg=16,rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p);o=bpy.context.object;o.scale=sz
    if rot:o.rotation_euler=rot
    return finish(o,n,m,par,1)
def box(n,p,sz,m,par,bevel=.012,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=sz
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot:o.rotation_euler=rot
    mod=o.modifiers.new('Soft tailoring','BEVEL');mod.width=bevel;mod.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,n,m,par)
def mesh(n,v,f,m,par,sub=1):
    me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);S.collection.objects.link(o)
    return finish(o,n,m,par,sub)
def tube(n,points,radii,m,par,N=10,sub=1):
    # Support the end caps so subdivision cannot shorten limbs at their joints.
    if sub:
        p=list(map(Vector,points));r=list(radii)
        def mix(x,y,t):
            if isinstance(x,(int,float)) and isinstance(y,(int,float)):return x*(1-t)+y*t
            x=(x,x) if isinstance(x,(int,float)) else x;y=(y,y) if isinstance(y,(int,float)) else y
            return tuple(a*(1-t)+b*t for a,b in zip(x,y))
        points=[p[0],p[0].lerp(p[1],.09)]+p[1:-1]+[p[-2].lerp(p[-1],.91),p[-1]]
        radii=[r[0],mix(r[0],r[1],.09)]+r[1:-1]+[mix(r[-2],r[-1],.91),r[-1]]
    v=[];f=[]
    for j,p in enumerate(points):
        t=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(j-1,0)]);t.normalize();u=t.cross(Vector((1,0,0)))
        if u.length<.1:u=t.cross(Vector((0,1,0)))
        u.normalize();w=t.cross(u);r=radii[j];rx,ry=(r,r) if isinstance(r,(int,float)) else r
        for i in range(N):v.append(Vector(p)+u*rx*math.cos(i*2*math.pi/N)+w*ry*math.sin(i*2*math.pi/N))
    for j in range(len(points)-1):
        for i in range(N):k=j*N+i;kk=j*N+(i+1)%N;f.append((k,kk,kk+N,k+N))
    f.extend([tuple(range(N-1,-1,-1)),tuple((len(points)-1)*N+i for i in range(N))])
    return mesh(n,v,f,m,par,sub)
def patch(n,pts,m,par,depth=.006):
    N=len(pts);v=pts+[(x-depth,y,z) for x,y,z in pts]
    f=[tuple(range(N)),tuple(range(2*N-1,N-1,-1))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
    return mesh(n,v,f,m,par,0)
node('root',(0,0,0));node('hip',(0,0,.65),'root');node('torso',(0,0,.73),'hip');node('head',(0,0,1.035),'torso')
node('backpackSocket',(-.15,0,.89),'torso')
parts['root']['asset_id']='npc.civilian-kid';parts['root']['forward']='+X';parts['root']['animation']='rigid-part'
# Short, comfortably loose cotton tee: tailored ring silhouette with real hem.
rings=[(.65,.126,.158),(.666,.14,.168),(.69,.133,.163),(.80,.119,.157),(.94,.124,.177),(.99,.10,.139),(1.015,.068,.085)]
v=[];f=[];N=24
for z,rx,ry in rings:
    for i in range(N):t=i*2*math.pi/N;v.append((rx*math.cos(t),ry*math.sin(t),z))
for j in range(len(rings)-1):
    for i in range(N):f.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
f.extend([tuple(range(N-1,-1,-1)),tuple((len(rings)-1)*N+i for i in range(N))])
mesh('tee_shell',v,f,'teeLavender','torso',2)
ell('neck',(0,0,1.035),(.055,.065,.073),'skinWarm','head')
for z,r in [(1.012,.067),(.668,.138)]:
    pts=[(r*math.cos(i*2*math.pi/32),(.086 if z>1 else .17)*math.sin(i*2*math.pi/32),z) for i in range(33)]
    tube('collar' if z>1 else 'tee_hem',pts,[.007]*33,'teeSeam','torso',N=6)
ell('shorts_waist',(0,0,.635),(.125,.157,.069),'olive','hip')
box('waistband',(.003,0,.638),(.25,.31,.025),'oliveLight','hip',.01)
box('fly',(.133,0,.603),(.015,.028,.079),'oliveSeam','hip',.005)
# Relaxed limbs, multi-part sneakers, striped socks, cargo pockets.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(0,s*.167,.968);elbow=(.008,s*.233,.832);wrist=(.025,s*.278,.681)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    node('weaponSocket'+side,(.045,s*.287,.628),'hand'+side)
    tube('arm_skin'+side,[shoulder,(.003,s*.205,.897),elbow],[.064,.063,.051],'skinWarm','arm'+side)
    tube('tee_sleeve'+side,[shoulder,(-.002,s*.185,.955),(0,s*.227,.884),(.005,s*.232,.875)],[.077,.086,.079,.078],'teeLavender','arm'+side,N=12)
    tube('sleeve_stitch'+side,[(.005,s*.23,.887),(.005,s*.235,.876)],[.079,.08],'teeSeam','arm'+side,N=16)
    ell('elbow'+side,elbow,(.051,.05,.052),'skinWarm','foreArm'+side)
    tube('forearm'+side,[elbow,(.018,s*.255,.76),wrist],[.052,.05,.035],'skinWarm','foreArm'+side)
    ell('palm'+side,(.028,s*.285,.654),(.039,.048,.052),'skinWarm','hand'+side)
    for i in range(4):
        y=s*(.25+i*.022);z=.633+abs(i-1.5)*.006
        tube('finger'+side+str(i),[(.032,y,z),(.047,y,z-.029),(.062,y,z-.028)],[.012,.012,.009],'skinWarm','hand'+side,N=8)
    tube('thumb'+side,[(.05,s*.253,.67),(.071,s*.24,.646),(.073,s*.245,.634)],[.017,.015,.01],'skinWarm','hand'+side,N=8)
    hip=(0,s*.084,.625);knee=(.008,s*.105,.388);ankle=(0,s*.126,.125)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('shorts_leg'+side,[hip,(0,s*.09,.60),(0,s*.101,.494),(.004,s*.103,.46)],[.085,.094,.085,.084],'olive','leg'+side,N=12)
    tube('shorts_cuff'+side,[(.004,s*.103,.478),(.004,s*.105,.457)],[.087,.088],'oliveLight','leg'+side,N=12)
    tube('thigh'+side,[(0,s*.104,.484),knee],[.064,.054],'skinWarm','leg'+side)
    tube('calf'+side,[knee,(0,s*.115,.31),ankle],[.053,.055,.038],'skinWarm','shin'+side)
    ell('knee'+side,(.013,s*.105,.389),(.044,.049,.045),'skinWarm','shin'+side)
    tube('sock'+side,[(0,s*.118,.286),(0,s*.12,.273),ankle],[.057,.058,.045],'picketWhite','shin'+side,N=12)
    for j,(z,col) in enumerate([(.276,'packEdge'),(.263,'survivorRed'),(.249,'packEdge')]):
        tube('sock_stripe'+side+str(j),[(0,s*.119,z+.004),(0,s*.119,z-.004)],[.059,.059],col,'shin'+side,N=16)
    box('cargo_pocket'+side,(.013,s*.184,.54),(.126,.033,.106),'oliveLight','leg'+side,.014)
    box('cargo_flap'+side,(.015,s*.202,.584),(.133,.023,.029),'olive','leg'+side,.007)
    ell('pocket_button'+side,(.015,s*.216,.582),(.008,.004,.006),'oliveSeam','leg'+side,seg=8,rings=6)
    tube('shorts_seam'+side,[(.074,s*.157,.613),(.087,s*.167,.544),(.081,s*.174,.477)],[.003]*3,'oliveSeam','leg'+side,N=6,sub=0)
    for j in range(2):
        tube('cloth_crease'+side+str(j),[(.077,s*.056,.51+j*.069),(.093,s*.104,.506+j*.069),(.075,s*.137,.513+j*.069)],[.003,.006,.002],'oliveLight','leg'+side,N=6)
    box('rubber_outsole'+side,(.05,s*.13,.023),(.26,.158,.046),'picketWhite','foot'+side,.02)
    box('welt'+side,(.05,s*.13,.053),(.263,.16,.027),'picketWhite','foot'+side,.015)
    ell('sneaker_upper'+side,(.044,s*.13,.096),(.127,.077,.067),'survivorRed','foot'+side)
    ell('toe_cap'+side,(.135,s*.13,.073),(.069,.079,.044),'picketWhite','foot'+side)
    box('tongue'+side,(.033,s*.13,.176),(.075,.09,.027),'picketWhite','foot'+side,.012,rot=(0,.2,0))
    box('tongue_label'+side,(.025,s*.13,.194),(.032,.04,.012),'survivorRed','foot'+side,.005)
    ell('ankle_collar'+side,(-.038,s*.13,.13),(.048,.079,.035),'survivorRed','foot'+side)
    for j in range(4):
        x=.006+j*.024;z=.20-j*.009
        tube('lace'+side+str(j),[(x,s*.081,z-.015),(x+.007,s*.13,z),(x+.01,s*.179,z-.015)],[.004]*3,'picketWhite','foot'+side,N=6,sub=0)
        for ss in [-1,1]:ell('eyelet'+side+str(j)+str(ss),(x,s*.13+ss*.047,z-.012),(.006,.006,.004),'picketWhite','foot'+side,seg=8,rings=6)
    for j in range(5):box('sole_groove'+side+str(j),(-.046+j*.046,s*.205,.021),(.012,.004,.015),'teeSeam','foot'+side,.002)
    box('shoe_side_panel'+side,(.018,s*.204,.094),(.081,.007,.036),'packBlue','foot'+side,.012,rot=(0,.25,0))
    box('heel_tab'+side,(-.074,s*.13,.123),(.015,.06,.034),'packBlue','foot'+side,.006)
# Watch on anatomical left wrist.
box('watch_strap',(.022,.275,.704),(.075,.087,.025),'uiDark','foreArmL',.012)
box('watch_case',(.064,.277,.706),(.018,.046,.036),'schoolBusYellow','foreArmL',.006)
box('watch_face',(.075,.277,.706),(.006,.034,.024),'uiDark','foreArmL',.004)
# Friendly facial sculpture. Large curved eyes sit proud of the cranium.
ell('cranium',(.003,0,1.17),(.139,.153,.167),'skinWarm','head',seg=24,rings=16)
ell('jaw',(.044,0,1.088),(.10,.119,.065),'skinWarm','head',seg=20,rings=12)
for s in [-1,1]:
    ell('ear'+str(s),(-.006,s*.153,1.135),(.037,.031,.049),'skinWarm','head')
    ell('ear_fold'+str(s),(.024,s*.167,1.137),(.011,.013,.027),'skinBlush','head')
    # Blush follows the cheek surface without separate spherical cheek pads.
    ell('eye_rim'+str(s),(.111,s*.062,1.194),(.013,.046,.055),'skinBlush','head')
    ell('eye_white'+str(s),(.119,s*.062,1.196),(.014,.040,.049),'picketWhite','head')
    ell('iris'+str(s),(.133,s*.058,1.194),(.006,.024,.035),'eyeBrown','head')
    ell('pupil'+str(s),(.14,s*.058,1.195),(.004,.014,.025),'uiDark','head')
    ell('eye_glint'+str(s),(.145,s*.052,1.209),(.004,.007,.008),'picketWhite','head',seg=10,rings=6)
    ell('eye_glint_small'+str(s),(.145,s*.069,1.183),(.003,.003,.004),'picketWhite','head',seg=8,rings=6)
    tube('upper_lid'+str(s),[(.126,s*.025,1.222),(.124,s*.059,1.244),(.1,s*.097,1.227)],[.004,.006,.003],'hairChestnut','head',N=8)
    tube('brow'+str(s),[(.116,s*.022,1.267),(.13,s*.055,1.276),(.103,s*.092,1.265)],[.008,.012,.006],'hairChestnut','head',N=8)
ell('nose_bridge',(.136,0,1.17),(.024,.021,.036),'skinWarm','head')
ell('button_nose',(.161,0,1.149),(.023,.027,.017),'skinWarm','head')
# Smile is a shallow sculpted crescent: dark bed, ivory tooth strip, raised lower lip.
pts=[(.14,-.053,1.101),(.149,-.031,1.093),(.153,0,1.091),(.149,.031,1.093),(.14,.053,1.101),(.14,.036,1.077),(.146,0,1.07),(.14,-.036,1.077)]
patch('smile',pts,'mouth','head',.008)
patch('smile_teeth',[(.148,-.043,1.097),(.158,0,1.088),(.148,.043,1.097),(.15,.028,1.086),(.157,0,1.082),(.15,-.028,1.086)],'picketWhite','head',.006)
tube('lower_lip',[(.14,-.041,1.077),(.149,0,1.069),(.14,.041,1.077)],[.004,.006,.004],'skinBlush','head',N=8)
# Chestnut crown with sculpted swept, pointed locks.
ell('hair_cap',(-.033,0,1.269),(.144,.163,.132),'hairChestnut','head',seg=20,rings=12)
def lock(n,start,bend,tip,width,col='hairWarm'):
    p0,p1,p2=map(Vector,[start,bend,tip]);pts=[p0,p0.lerp(p1,.5),p1,p1.lerp(p2,.7),p2]
    tube(n,pts,[.008,(width*.8,width*.45),(width,width*.52),(width*.38,width*.24),.002],col,'head',N=8)
for layer in range(3):
    for j in range(10):
        t=2*math.pi*j/10+.25*(layer%2);z=1.17+layer*.061;x=-.033+.124*math.cos(t);y=.143*math.sin(t)
        lock('hair_layer'+str(layer)+'_'+str(j),(x*.55,y*.6,z+.068),(x-.017,y,z+.041),(x-.038+math.cos(t)*.036,y+math.sin(t)*.035,z-.04),.049+(j%3)*.005,'hairWarm' if j%3 else 'hairChestnut')
for j in range(5):
    y=-.105+j*.047
    lock('fringe'+str(j),(-.026,y+.064,1.37),(.072,y+.027,1.326),(.123,y-.036,1.239+j*.012),.049+(j%2)*.009)
for j in range(3):
    lock('crown_swoop'+str(j),(-.115,-.065+j*.065,1.319),(-.018,-.078+j*.066,1.404),(.136,-.115+j*.068,1.437-(j%2)*.024),.071,'hairWarm')
lock('side_quiff',(-.083,.103,1.312),(-.003,.143,1.363),(.065,.192,1.373),.05,'hairWarm')
# Raised rocket graphic (no coplanar paint), blue body and orange fins.
# The small chest emblem is sculpted onto a curving cloth surface.
def graphic(n,uv,col,offset=.008):
    pts=[]
    for y,z in uv:
        x=.127*math.sqrt(max(.1,1-(y/.17)**2))+offset
        pts.append((x,y,z))
    return patch(n,pts,col,'torso',.004)
graphic('rocket_outline',[(-.063,.79),(-.065,.838),(-.025,.875),(.032,.902),(.068,.906),(.063,.866),(.018,.816),(-.022,.796)],'schoolBusYellow')
graphic('rocket_body',[(-.052,.807),(-.05,.838),(-.018,.869),(.035,.893),(.055,.895),(.05,.87),(.014,.832),(-.02,.813)],'packBlue',.014)
graphic('rocket_fin',[(-.02,.826),(-.028,.795),(.008,.804),(.026,.83)],'orange',.020)
graphic('rocket_flame',[(-.045,.818),(-.078,.801),(-.067,.792),(-.095,.77),(-.059,.781),(-.054,.771),(-.035,.803)],'orange',.014)
graphic('flame_core',[(-.052,.805),(-.077,.783),(-.054,.791),(-.04,.811)],'schoolBusYellow',.020)
ell('rocket_window',(.148,.018,.859),(.008,.018,.02),'schoolBusYellow','torso',seg=12,rings=8)
ell('rocket_port',(.159,.018,.86),(.005,.011,.012),'packEdge','torso',seg=12,rings=8)
for j,(y,z) in enumerate([(-.072,.869),(.066,.801),(-.036,.886)]):
    graphic('tee_star'+str(j),[(y-.009,z),(y,z+.013),(y+.009,z),(y,z-.013)],'schoolBusYellow')
# Backpack: main cushion, framed inset, front pocket, bound edges, zip pulls.
box('backpack_body',(-.184,0,.864),(.166,.289,.318),'packBlue','torso',.044)
box('pack_front_inset',(-.279,0,.88),(.037,.24,.259),'packEdge','torso',.028)
box('pack_front_panel',(-.301,0,.886),(.024,.218,.229),'packBlue','torso',.024)
box('pack_lower_pocket',(-.319,0,.798),(.041,.21,.098),'packBlue','torso',.021)
box('pocket_zip',(-.343,0,.834),(.007,.188,.008),'packEdge','torso',.003)
for s in [-1,1]:
    box('side_pouch'+str(s),(-.19,s*.151,.796),(.115,.039,.11),'packEdge','torso',.015)
    tube('strap'+str(s),[(-.191,s*.114,1.009),(-.09,s*.132,1.035),(.033,s*.144,1.00),(.112,s*.123,.909),(.116,s*.119,.837),(-.135,s*.13,.719)],[(.017,.027)]*6,'packBlue','torso',N=8)
    box('strap_buckle'+str(s),(.12,s*.122,.891),(.021,.04,.036),'woodWarm','torso',.006)
    box('buckle_inset'+str(s),(.134,s*.122,.891),(.008,.025,.023),'packEdge','torso',.004)
    tube('zip_pull'+str(s),[(-.347,s*.088,.831),(-.352,s*.09,.806),(-.351,s*.091,.791)],[.003,.003,.005],'orange','torso',N=6)
    box('zip_toggle'+str(s),(-.352,s*.091,.787),(.008,.012,.022),'orange','torso',.004)
    tube('pack_piping'+str(s),[(-.319,s*.085,.993),(-.322,s*.108,.97),(-.325,s*.111,.889),(-.326,s*.11,.778),(-.317,s*.083,.756)],[.004]*5,'packEdge','torso',N=6)
tube('carry_handle',[(-.192,-.037,1.008),(-.203,-.035,1.059),(-.203,.035,1.059),(-.192,.037,1.008)],[.011]*4,'packEdge','torso',N=8)
def star(n,x,y,z,r,col):
    pts=[]
    for j in range(10):
        t=math.pi/2+j*math.pi/5;rr=r if j%2==0 else r*.44;pts.append((x,y+rr*math.cos(t),z+rr*math.sin(t)))
    # Backward surface thickness points outward toward -X.
    return patch(n,pts,col,'torso',-.008)
star('pack_star',-.32,0,.91,.058,'schoolBusYellow');star('star_center',-.331,0,.91,.023,'survivorRed')
# Slightly broaden the child's head, keeping the neck pivot unscaled.
bpy.context.view_layer.update()
for o in objects:
    if o.parent==parts['head'] and o.name!='neck':
        inv=o.matrix_world.inverted()
        for v in o.data.vertices:
            p=o.matrix_world@v.co;p.x*=1.08;p.y*=1.16
            if o.name.startswith(('hair','fringe','crown','side_quiff')):p.y*=1.1
            p.z=1.035+(p.z-1.035)*1.07;v.co=inv@p
# Reduce smoothly tessellated detail, triangulate, then join all static decoration per joint.
for o in objects:
    if len(o.data.polygons)>120:
        bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Game tessellation','DECIMATE');mod.ratio=.40;bpy.ops.object.modifier_apply(modifier=mod.name)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
for par in parts:
    group=[o for o in bpy.data.objects if o.type=='MESH' and o.parent==parts[par]]
    if not group:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0].name=par+'_surface'
objects=[o for o in bpy.data.objects if o.type=='MESH']
# Ground contact and joint pivots are measured in the actual exported rest state.
bpy.context.view_layer.update()
for side in ['L','R']:
    o=bpy.data.objects['foot'+side+'_surface'];floor=min((o.matrix_world@v.co).z for v in o.data.vertices);parts['foot'+side].location.z-=floor
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','weaponSocketR','weaponSocketL','backpackSocket']
triangles=sum(len(f.vertices)-2 for o in objects for f in o.data.polygons)
(P/'build-stats.json').write_text(json.dumps({'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in parts]},indent=2))
bpy.context.view_layer.update()
(P/'rig-rest.json').write_text(json.dumps({'pivots':{n:list(o.matrix_world.translation) for n,o in parts.items()},'feet_min_z':0},indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if a.pose:
    before={n:list(parts[n].matrix_world.translation) for n in ['handL','footR']}
    parts['armL'].rotation_euler.x=.65;parts['foreArmL'].rotation_euler.y=-.8;parts['legR'].rotation_euler.y=-.45
    bpy.context.view_layer.update()
    (P/'pose-proof.json').write_text(json.dumps({'rotations':{n:list(parts[n].rotation_euler) for n in ['armL','foreArmL','legR']},'before':before,'after':{n:list(parts[n].matrix_world.translation) for n in before}},indent=2))
if a.render and a.view=='turnaround':
    import numpy as np
    panels=[]
    for name in ['front','side','back','hero']:
        im=bpy.data.images.load(str(P/'renders'/f'{name}.png'))
        if tuple(im.size)!=(960,540):im.scale(960,540)
        w,h=im.size;px=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(px);panels.append(px.reshape(h,w,4)[:,(w-360)//2:(w+360)//2,:])
    data=np.concatenate(panels,axis=1);im=bpy.data.images.new('Turnaround',width=data.shape[1],height=data.shape[0],alpha=True);im.pixels.foreach_set(data.ravel());im.filepath_raw=a.render;im.file_format='PNG';im.save();print('OK turnaround');sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('Studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.065,.084,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,c,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=c;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
    light('Warm key',(3,-4,5),420,(1,.84,.72),3);light('Cool fill',(1,4,3),240,(.69,.76,1),3);light('Golden rim',(-3,1,3),500,(1,.50,.24),2)
    bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(mat('studio','35303b'))
    cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));S.collection.objects.link(cam);S.camera=cam
    cam.location={'hero':(6,-4,2.6),'front':(6,0,.9),'side':(0,-6,.9),'back':(-6,0,.9)}.get(a.view,(6,-4,2.6));cam.rotation_euler=(Vector((0,0,.72))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.7*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True;S.cycles.device='CPU'
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100;S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG';S.render.filepath=a.render;bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(objects),'meshes')
