"""Deterministic rigid-part hero Infected Sprinter. +X forward, Z up, -Y character right.
Run through experiment/tools/blender_run.py. All subdivision is applied before GLB.
"""
import argparse, math, sys, json, random
from pathlib import Path
import bpy, bmesh
from mathutils import Vector, Matrix
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser()
ap.add_argument('--render'); ap.add_argument('--glb'); ap.add_argument('--view',default='hero')
ap.add_argument('--samples',type=int,default=24); ap.add_argument('--width',type=int,default=960); ap.add_argument('--height',type=int,default=540)
ap.add_argument('--pose',action='store_true')
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene; rng=random.Random(71); parts={}; objects=[]
def mat(token,color_hex,rough=.7,emit=0):
    m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token);m.use_nodes=True
    c=[int(color_hex[i:i+2],16)/255 for i in (0,2,4)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=c;b.inputs['Roughness'].default_value=rough
    if emit:b.inputs['Emission Color'].default_value=c;b.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=c;return m
M={k:mat(k,v,r) for k,v,r in [('infectedSkin','c9a39a',.68),('picketWhite','f2e6dc',.85),('asphalt','916687',.8),('woodWarm','49352f',.8),('backpackTeal','2f6e6a',.8),('uiDark','25222c',.78),('blood','b3121f',.35),('survivorRed','d9363e',.73),('sidewalk','b9a4a0',.8),('schoolBusYellow','f2b630',.7)]}
M['eye']=mat('infectedEye','ff3b2f',.24,4)
M['eyeCore']=mat('windowGlow','ffc773',.24,5)
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o
node('root',(0,0,0));node('hip',(0,0,.68),'root');node('torso',(0,0,.83),'hip');node('head',(.015,0,1.19),'torso');node('backpackSocket',(-.18,0,1.02),'torso')
def finish(o,n,m,par,sub=0):
    o.name=n;o.data.materials.append(M[m]);bpy.context.view_layer.objects.active=o
    if sub:
        mod=o.modifiers.new('sculpt smoothing','SUBSURF');mod.levels=sub;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    objects.append(o);return o

def ell(n,p,sz,m,par,rot=None,seg=10,rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p);o=bpy.context.object;o.scale=sz
    if rot:o.rotation_euler=rot
    return finish(o,n,m,par,1)
def box(n,p,sz,m,par,bevel=.015,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=sz;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot:o.rotation_euler=rot
    mod=o.modifiers.new('soft edges','BEVEL');mod.width=bevel;mod.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,n,m,par)
def mesh(n,v,f,m,par,sub=1):
    me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);S.collection.objects.link(o)
    return finish(o,n,m,par,sub)
def tube(n,points,radii,m,par,N=10,sub=1):
    v=[];f=[]
    for j,p in enumerate(points):
        tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(j-1,0)])
        tangent.normalize();u=tangent.cross(Vector((1,0,0)))
        if u.length<.1:u=tangent.cross(Vector((0,1,0)))
        u.normalize();w=tangent.cross(u);r=radii[j];rx,ry=(r,r) if isinstance(r,(int,float)) else r
        for i in range(N):v.append(Vector(p)+u*rx*math.cos(i*2*math.pi/N)+w*ry*math.sin(i*2*math.pi/N))
    for j in range(len(points)-1):
        for i in range(N):k=j*N+i;kk=j*N+(i+1)%N;f.append((k,kk,kk+N,k+N))
    f.extend([tuple(range(N-1,-1,-1)),tuple((len(points)-1)*N+i for i in range(N))])
    return mesh(n,v,f,m,par,sub)
def patch(n,pts,m,par,depth=.006):
    # Soft extruded silhouette in the front-facing Y/Z plane, with explicit thickness.
    v=[tuple(p) for p in pts]+[(p[0]-depth,p[1],p[2]) for p in pts];N=len(pts)
    f=[tuple(range(N)),tuple(range(2*N-1,N-1,-1))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
    o=mesh(n,v,f,m,par,0);mod=o.modifiers.new('edge rounding','BEVEL');mod.width=.004;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=False
    return o

# The hoodie, undershirt and shorts are individual shells, not colour regions on skin.
ell('pelvis',(0,0,.695),(.133,.188,.109),'uiDark','hip')
ell('red_undershirt',(.017,0,.955),(.145,.187,.205),'survivorRed','torso')
ell('neck',(.013,0,1.184),(.076,.088,.089),'infectedSkin','head')
v=[];f=[];N=24
for j,(z,rx,ry) in enumerate([(.726,.15,.194),(.748,.159,.201),(.88,.151,.197),(1.065,.159,.23),(1.125,.13,.197),(1.14,.127,.19)]):
    for i in range(N):
        t=.38+(2*math.pi-.76)*i/(N-1)
        v.append((rx*math.cos(t)-.016,ry*math.sin(t),z+(.012*math.sin(i*2.7) if j==0 else 0)))
for j in range(5):
    for i in range(N-1):f.append((j*N+i,j*N+i+1,(j+1)*N+i+1,(j+1)*N+i))
o=mesh('hoodie_shell',v,f,'picketWhite','torso',2)
mod=o.modifiers.new('cloth thickness','SOLIDIFY');mod.thickness=.015;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
ell('hood_fold',(-.112,0,1.117),(.135,.185,.091),'picketWhite','torso')
tube('hood_edge',[(-.055,-.17,1.15),(-.17,-.13,1.186),(-.226,0,1.177),(-.17,.13,1.186),(-.055,.17,1.15)],[.026,.037,.038,.037,.026],'sidewalk','torso',N=10)
tube('hood_inner_edge',[(-.029,-.134,1.161),(-.092,-.1,1.196),(-.148,0,1.192),(-.092,.1,1.196),(-.029,.134,1.161)],[.018]*5,'picketWhite','torso',N=10)
for s in [-1,1]:
    tube('hoodie_front_binding'+str(s),[(.104,s*.073,1.135),(.154,s*.074,1.04),(.155,s*.056,.894),(.15,s*.06,.75)],[.018,.02,.013,.02],'sidewalk','torso',N=8)
    tube('drawstring'+str(s),[(.132,s*.096,1.114),(.186,s*.088,1.062),(.195,s*.083,1.001)],[.006]*3,'picketWhite','torso',N=8)
    box('drawstring_aglet'+str(s),(.195,s*.083,.995),(.014,.014,.027),'sidewalk','torso',.004)
    tube('hem_binding'+str(s),[(-.158,s*.06,.75),(-.115,s*.17,.735),(.025,s*.198,.738),(.135,s*.12,.75)],[.017]*4,'sidewalk','torso',N=10)
    for j in range(3):
        patch('torn_hoodie_hem'+str(s)+str(j),[(.133,s*(.072+j*.032),.797),(.142,s*(.102+j*.032),.785),(.14,s*(.089+j*.032),.713-j*.013)],'picketWhite','torso')
    box('hoodie_pocket_rim'+str(s),(.13,s*.12,.819),(.021,.073,.018),'sidewalk','torso',.005,rot=(s*.2,.1,0))
    for j in range(3):
        tube('hoodie_crease'+str(s)+str(j),[(.143,s*.076,.854+j*.042),(.156,s*.116,.87+j*.042),(.119,s*.162,.866+j*.042)],[.004,.01,.002],'picketWhite','torso',N=8)
# The hanging hood has a pointed back fold with a rounded stitched border.
patch('hood_back_fold',[(-.251,-.12,1.147),(-.251,.12,1.147),(-.25,.071,1.075),(-.23,0,1.04),(-.25,-.071,1.075)],'picketWhite','torso',.018)
tube('hood_fold_border',[(-.26,-.116,1.145),(-.26,-.07,1.077),(-.242,0,1.046),(-.26,.07,1.077),(-.26,.116,1.145)],[.012]*5,'sidewalk','torso',N=8)
# Athletic bare legs, torn shorts, rolled sleeves, expressive enlarged claw hands.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(-.008,s*.218,1.076);elbow=(.021,s*.316,.906);wrist=(.086,s*.391,.751)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    tube('upper_sleeve'+side,[shoulder,(-.005,s*.259,1.054),(.006,s*.289,.958),elbow],[.092,.099,.086,.08],'picketWhite','arm'+side,N=12)
    tube('rolled_sleeve'+side,[(.027,s*.319,.922),(.037,s*.337,.885),(.042,s*.343,.872)],[.088,.093,.081],'sidewalk','foreArm'+side,N=12)
    tube('cuff_edge'+side,[(.029,s*.32,.928),(.033,s*.325,.91),(.036,s*.33,.899)],[.09,.096,.092],'picketWhite','foreArm'+side,N=12)
    tube('forearm_skin'+side,[(.041,s*.338,.865),(.064,s*.37,.804),wrist],[.063,.068,.045],'infectedSkin','foreArm'+side,N=12)
    ell('palm'+side,(.087,s*.397,.727),(.058,.066,.075),'infectedSkin','hand'+side)
    for i in range(4):
        y=s*(.338+i*.039);z=.703-(.006 if i in [0,3] else .018)
        pts=[(.105,y,z),(.127,y+s*(i-1.5)*.006,z-.044),(.175,y+s*(i-1.5)*.01,z-.085),(.204,y+s*(i-1.5)*.012,z-.048)]
        tube('finger'+side+str(i),pts,[.019,.02,.017,.011],'infectedSkin','hand'+side,N=8)
        ell('knuckle'+side+str(i),(.115,y,z),(.023,.02,.023),'infectedSkin','hand'+side,seg=8,rings=6)
        ell('nail'+side+str(i),(.206,y+s*(i-1.5)*.012,z-.045),(.006,.011,.014),'sidewalk','hand'+side,seg=8,rings=6)
    tube('thumb'+side,[(.105,s*.343,.752),(.15,s*.326,.72),(.178,s*.339,.698)],[.028,.026,.015],'infectedSkin','hand'+side,N=10)
    h=(.04 if side=='L' else -.02,s*.107,.694);k=(.024,s*.15,.417);ank=(-.019,s*.174,.165)
    node('leg'+side,h,'hip');node('shin'+side,k,'leg'+side);node('foot'+side,ank,'shin'+side)
    tube('athletic_thigh'+side,[h,(.002,s*.125,.586),(.019,s*.145,.483),k],[.096,.103,.084,.074],'infectedSkin','leg'+side,N=12)
    tube('shorts'+side,[h,(-.009,s*.112,.65),(.009,s*.133,.558),(.011,s*.137,.528)],[.108,.114,.117,.115],'uiDark','leg'+side,N=12)
    # Jagged hem points and cut-away tear rims make the fabric visibly damaged.
    for j in range(6):
        t=2*math.pi*j/6;x=.01+.111*math.cos(t);y=s*.137+.11*math.sin(t)
        tube('shorts_rag'+side+str(j),[(x*.9,y,.559),(x,y,.53),(x+.008,y,.495-(j%3)*.014)],[.019,.021,.0015],'uiDark','leg'+side,N=8)
    tube('calf'+side,[k,(.014,s*.162,.362),(-.008,s*.171,.265),ank],[.073,.089,.066,.045],'infectedSkin','shin'+side,N=12)
    ell('kneecap'+side,(.077,s*.153,.421),(.036,.06,.054),'infectedSkin','shin'+side)
    tube('sock'+side,[(-.018,s*.174,.171),(-.017,s*.175,.22),(-.016,s*.175,.246)],[.052,.055,.057],'picketWhite','shin'+side,N=12)
    for j in range(3):
        tube('sock_rib'+side+str(j),[(-.015,s*.176,.218+j*.009),(-.015,s*.176,.224+j*.009)],[.058,.058],'sidewalk','shin'+side,N=12,sub=0)
    box('sneaker_sole'+side,(.048,s*.18,.036),(.289,.181,.072),'sidewalk','foot'+side,.023)
    box('sneaker_welt'+side,(.049,s*.18,.074),(.289,.182,.034),'picketWhite','foot'+side,.013)
    ell('red_sneaker'+side,(.048,s*.18,.116),(.144,.086,.075),'survivorRed','foot'+side)
    tube('hightop'+side,[(-.036,s*.18,.112),(-.052,s*.18,.159),(-.045,s*.18,.203)],[.068,.074,.067],'survivorRed','foot'+side,N=12)
    ell('rubber_toecap'+side,(.142,s*.18,.104),(.061,.085,.045),'picketWhite','foot'+side)
    tube('shoe_tongue'+side,[(.0,s*.18,.218),(.022,s*.18,.219),(.075,s*.18,.191),(.118,s*.18,.175)],[.018,(.05,.018),(.045,.017),.014],'blood','foot'+side,N=10)
    tube('shoe_collar'+side,[(-.044,s*.18,.19),(-.044,s*.18,.21)],[.072,.069],'blood','foot'+side,N=12)
    for j in range(5):
        x=.018+j*.023;z=.231-j*.012
        tube('lace'+side+str(j),[(x,s*.138,z-.01),(x+.005,s*.18,z+.003),(x+.01,s*.222,z-.01)],[.0045]*3,'picketWhite','foot'+side,N=6,sub=0)
        for ss in [-1,1]:ell('eyelet'+side+str(j)+str(ss),(x,s*.18+ss*.042,z-.015),(.008,.006,.009),'sidewalk','foot'+side,seg=8,rings=6)
    for j in range(7):box('sole_tread'+side+str(j),(-.073+j*.039,s*.18,.01),(.02,.16,.016),'uiDark','foot'+side,.004)
    for j in range(3):
        tube('shorts_crease'+side+str(j),[(.084,s*.06,.642-j*.03),(.12,s*.115,.63-j*.03),(.097,s*.195,.627-j*.03)],[.003,.009,.002],'asphalt','leg'+side,N=8)
    tube('shorts_side_seam'+side,[(-.034,s*.217,.663),(-.03,s*.239,.58),(-.032,s*.24,.532)],[.004]*3,'asphalt','leg'+side,N=6)
    for ss in [-1,1]:
        tube('sneaker_side_trim'+side+str(ss),[(-.075,s*.18+ss*.072,.131),(-.021,s*.18+ss*.084,.145),(.05,s*.18+ss*.082,.115),(.113,s*.18+ss*.075,.105)],[.005]*4,'sidewalk','foot'+side,N=6)
    for j in range(3):
        tube('sleeve_wrinkle'+side+str(j),[(.062,s*.264,1.028-j*.032),(.088,s*.285,1.008-j*.031),(.051,s*.302,.99-j*.031)],[.006,.013,.003],'picketWhite','arm'+side,N=8)
# Cloth tears, with inset red undershirt and skin.
def tear(name,center,size):
    target=bpy.data.objects[name];bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=center)
    cutter=bpy.context.object;cutter.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=target.modifiers.new('torn opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=target;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
for side,s in [('L',1),('R',-1)]:
    tear('upper_sleeve'+side,(.093,s*.284,.995),(.041,.037,.044))
    ell('sleeve_exposed_skin'+side,(.054,s*.284,.995),(.025,.036,.039),'infectedSkin','arm'+side)
    for j in range(3):
        patch('sleeve_tear_flap'+side+str(j),[(.099,s*(.25+j*.023),1.022),(.107,s*(.276+j*.023),1.01),(.095,s*(.26+j*.023),.977-j*.008)],'picketWhite','arm'+side)
# Back hood seam and front diagonal ripped fabric.
tube('hood_center_seam',[(-.245,0,1.16),(-.24,0,1.111),(-.20,0,1.084)],[.004]*3,'sidewalk','torso',N=6)
patch('diagonal_hoodie_flap',[(.164,-.152,.945),(.173,.051,.927),(.177,.108,.865),(.179,-.095,.914)],'picketWhite','torso',.016)
box('shorts_waistband',(.005,0,.698),(.233,.345,.038),'asphalt','hip',.016)

# Head, strong orbital shapes and screaming mouth; face planes project forward.
ell('cranium',(.009,0,1.349),(.164,.17,.214),'infectedSkin','head',seg=20,rings=14)
ell('jaw',(.07,0,1.235),(.113,.128,.09),'infectedSkin','head')
for s in [-1,1]:
    ell('ear'+str(s),(.012,s*.169,1.321),(.047,.035,.062),'infectedSkin','head')
    ell('ear_inner'+str(s),(.046,s*.18,1.322),(.01,.015,.023),'blood','head')
    ell('cheek'+str(s),(.113,s*.112,1.291),(.038,.048,.054),'infectedSkin','head')
    ell('eye_socket'+str(s),(.141,s*.082,1.37),(.023,.059,.052),'blood','head')
    ell('eye_dark_rim'+str(s),(.157,s*.082,1.37),(.012,.046,.044),'uiDark','head')
    ell('eye_glow'+str(s),(.166,s*.082,1.371),(.016,.041,.039),'eye','head')
    ell('eye_core'+str(s),(.178,s*.079,1.376),(.005,.023,.025),'eyeCore','head',seg=12,rings=8)
    tube('angry_brow'+str(s),[(.159,s*.028,1.399),(.167,s*.072,1.431),(.13,s*.13,1.433)],[.02,.025,.015],'woodWarm','head',N=10)
    tube('brow_ridge'+str(s),[(.151,s*.028,1.411),(.16,s*.075,1.444),(.121,s*.136,1.44)],[.017,.02,.01],'infectedSkin','head',N=10)
# Carve a genuine opening through jaw and face before inserting the mouth lining.
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=(.20,0,1.254))
cutter=bpy.context.object;cutter.scale=(.088,.070,.076);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for name in ['cranium','jaw']:
    obj=bpy.data.objects[name];mod=obj.modifiers.new('open mouth','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True)
# Mouth dark cavity and raised irregular lip ring, not a painted line.
ell('mouth_cavity',(.156,0,1.254),(.031,.069,.077),'uiDark','head',seg=20,rings=12)
pts=[]
for i in range(25):
    t=i*2*math.pi/24;pts.append((.196,.072*math.cos(t),1.257+.082*math.sin(t)))
tube('torn_bloody_lips',pts,[.010 if i<13 else .017 for i in range(len(pts))],'blood','head',N=8)
ell('nose_bridge',(.167,0,1.351),(.035,.028,.058),'infectedSkin','head')
ell('nose_tip',(.203,0,1.327),(.035,.037,.022),'infectedSkin','head')
for s in [-1,1]:ell('nostril'+str(s),(.22,s*.021,1.316),(.008,.01,.006),'uiDark','head',seg=8,rings=6)
for row in [0,1]:
    for j in range(5):
        y=(j-2)*.023;z=(1.309 if row==0 else 1.205)+(abs(j-2)*(-.004 if row==0 else .004))
        box('tooth'+str(row)+str(j),(.205,y,z),(.025,.018,([.031,.023,.017,.024,.03] if row==0 else [.012,.019,.017,.011,.018])[j]),'picketWhite','head',.006,rot=(.1*(j-2),0,0))
ell('tongue',(.21,0,1.213),(.012,.031,.014),'survivorRed','head')

# Volumetric swept brown hair under a six-panel purple baseball cap.
def lock(n,start,bend,tip,width):
    p0,p1,p2=map(Vector,[start,bend,tip]);pts=[p0,p0.lerp(p1,.55),p1,p1.lerp(p2,.74),p2]
    return tube(n,pts,[.012,(width*.85,width*.5),(width,width*.55),(width*.4,width*.25),.0015],'woodWarm','head',N=8)
ell('hair_base',(-.04,0,1.437),(.17,.173,.133),'woodWarm','head',seg=18,rings=12)
for layer in range(2):
    for j in range(12):
        t=.65+j*(2*math.pi-1.3)/11;z=1.34+layer*.07;x=-.035+.147*math.cos(t);y=.157*math.sin(t)
        lock('side_swept_lock'+str(layer)+'_'+str(j),(x*.6,y*.68,z+.11),(x-.014,y,z+.055),(x-.064,y+.03*math.sin(t),z-.065),.054+(j%3)*.006)
for j in range(7):
    y=-.139+j*.045
    lock('heavy_fringe'+str(j),(-.02,y+.043,1.509),(.11,y-.018,1.463),(.146,y-.055,1.4+(j%3)*.012),.048+(j%2)*.009)
# Dome made of rounded panel strips, ending at a thick rim. No hidden full sphere under the hat.
N=36;v=[];f=[]
for z,r in [(1.467,1),(1.476,1.005),(1.54,.95),(1.6,.74),(1.64,.4),(1.655,.035)]:
    for i in range(N):
        t=i*2*math.pi/N;v.append((-.034+.187*r*math.cos(t),.187*r*math.sin(t),z))
for j in range(5):
    for i in range(N):f.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
f.append(tuple(5*N+i for i in range(N)))
cap=mesh('cap_crown',v,f,'asphalt','head',1)
mod=cap.modifiers.new('hat fabric thickness','SOLIDIFY');mod.thickness=.009;bpy.context.view_layer.objects.active=cap;bpy.ops.object.modifier_apply(modifier=mod.name)
pts=[(-.034+.188*math.cos(i*2*math.pi/36),.189*math.sin(i*2*math.pi/36),1.473) for i in range(37)]
tube('cap_rim',pts,[.011]*len(pts),'asphalt','head',N=6)
for j in range(6):
    t=j*2*math.pi/6
    pts=[(-.034+.189*r*math.cos(t),.189*r*math.sin(t),z) for z,r in [(1.48,1),(1.545,.95),(1.61,.72),(1.647,.37),(1.66,.025)]]
    tube('cap_panel_seam'+str(j),pts,[.002]*5,'asphalt','head',N=6,sub=0)
    ell('cap_airhole'+str(j),(-.034+.162*math.cos(t+.25),.162*math.sin(t+.25),1.573),(.007,.007,.007),'uiDark','head',seg=8,rings=6)
ell('cap_button',(-.034,0,1.665),(.018,.018,.01),'asphalt','head',seg=10,rings=6)
# Curved peaked visor, dark underside and thick fabric edge.
rows=[(1.0,.137),(1.12,.156),(1.64,.179),(1.78,.154)]
v=[];f=[];K=15
for r,w in rows:
    for j in range(K):
        y=-w+2*w*j/(K-1);x=.04+.155*r-.065*(y/w)**2;z=1.507-.028*(y/w)**2+.013*(r-1)
        v.append((x,y,z))
for j in range(3):
    for i in range(K-1):f.append((j*K+i,j*K+i+1,(j+1)*K+i+1,(j+1)*K+i))
o=mesh('curved_cap_visor',v,f,'asphalt','head',2);mod=o.modifiers.new('visor thickness','SOLIDIFY');mod.thickness=.014;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
# Front patch with a fictional runner star, no lettering or trademark.
box('cap_front_patch',(.15,0,1.559),(.017,.079,.064),'uiDark','head',.009,rot=(0,-.16,0))
pts=[]
for j in range(10):
    t=math.pi/2+j*math.pi/5;r=.022 if j%2==0 else .009
    pts.append((.166,.002+r*math.cos(t),1.56+r*math.sin(t)))
patch('cap_runner_star',pts,'schoolBusYellow','head',.006)
box('rear_cap_strap',(-.22,0,1.479),(.016,.082,.021),'uiDark','head',.005)
for j in range(4):ell('strap_adjuster'+str(j),(-.231,-.027+j*.018,1.482),(.004,.004,.004),'sidewalk','head',seg=8,rings=6)
# Blood shapes project onto intended curved surfaces and stand 4 mm proud.
def splat(n,x,y,z,ry,rz,par,targets):
    pts=[]
    for i in range(10):
        t=i*2*math.pi/10;r=rng.uniform(.6,1.12);pts.append((x,y+math.cos(t)*ry*r,z+math.sin(t)*rz*r))
    o=mesh(n,[(x,y,z)]+pts,[(0,i+1,(i+1)%len(pts)+1) for i in range(len(pts))],'blood',par,0)
    bpy.context.view_layer.update();direction=Vector((-1,0,0) if x>=0 else (1,0,0));startx=.6 if x>=0 else -.6
    for vert in o.data.vertices:
        start=Vector((startx,vert.co.y,vert.co.z));hits=[]
        for name in targets:
            target=bpy.data.objects[name];inv=target.matrix_world.inverted();hit,loc,normal,index=target.ray_cast(inv@start,inv.to_3x3()@direction)
            if hit:hits.append(target.matrix_world@loc)
        if hits:vert.co.x=min(hits,key=lambda p:(p-start).length).x+(.004 if x>=0 else -.004)
    for face in o.data.polygons:face.use_smooth=False
for j,(y,z,ry,rz) in enumerate([(-.117,1.056,.032,.049),(.128,.989,.034,.023),(-.099,.839,.033,.029),(.132,.781,.019,.035),(-.075,.96,.025,.014)]):
    splat('hoodie_front_blood'+str(j),.18,y,z,ry,rz,'torso',['hoodie_shell','diagonal_hoodie_flap'])
for j in range(12):
    y=-.125+(j%4)*.081;z=.79+(j//4)*.116
    splat('hoodie_blood_fleck'+str(j),.19,y,z,.006,.009,'torso',['hoodie_shell'])
for j,(y,z,ry,rz) in enumerate([(-.06,.969,.065,.055),(.063,.906,.046,.08),(-.027,.816,.053,.038),(.08,1.043,.031,.038)]):
    splat('hoodie_back_blood'+str(j),-.2,y,z,ry,rz,'torso',['hoodie_shell'])
for side,s in [('L',1),('R',-1)]:
    for j in range(3):
        splat('sleeve_blood'+side+str(j),.13,s*(.266+j*.025),1.029-j*.04,.022,.028,'arm'+side,['upper_sleeve'+side])
    splat('forearm_blood'+side,.15,s*.365,.819,.031,.029,'foreArm'+side,['forearm_skin'+side])
    splat('palm_blood'+side,.16,s*.397,.742,.039,.027,'hand'+side,['palm'+side])
    splat('thigh_blood'+side,.13,s*.143,.489,.03,.032,'leg'+side,['athletic_thigh'+side])
    splat('calf_blood'+side,.14,s*.164,.332,.025,.041,'shin'+side,['calf'+side])
    splat('shorts_blood'+side,.15,s*.13,.593,.028,.025,'leg'+side,['shorts'+side])
for j,(y,z,ry,rz) in enumerate([(-.116,1.302,.018,.033),(.113,1.303,.013,.026),(-.044,1.202,.035,.034)]):
    splat('face_blood'+str(j),.2,y,z,ry,rz,'head',['cranium','jaw','cheek-1','cheek1'])
tube('cheek_blood_drip',[(.169,-.119,1.366),(.173,-.116,1.316),(.177,-.084,1.267)],[.006,.012,.004],'blood','head',N=8)
for j,(x,y,z,ry,rz) in enumerate([(.19,-.11,1.537,.016,.026),(-.23,.045,1.529,.025,.018),(-.22,-.085,1.55,.017,.024)]):
    splat('cap_blood'+str(j),x,y,z,ry,rz,'head',['cap_crown'])
# A larger smear on the right cuff ties the torn hoodie into the infected silhouette.
splat('cuff_blood_R',.13,-.332,.899,.033,.031,'foreArmR',['rolled_sleeveR','cuff_edgeR'])
# Proximal stump caps remain with the torso/upper limbs after detachment.
for key,parent,p,sz in [('head','torso',(.014,0,1.19),(.075,.084,.012)),('armL','torso',(-.008,.218,1.076),(.077,.016,.077)),('armR','torso',(-.008,-.218,1.076),(.077,.016,.077)),('foreArmL','armL',(.021,.316,.906),(.065,.014,.06)),('foreArmR','armR',(.021,-.316,.906),(.065,.014,.06)),('legL','hip',(0,.107,.694),(.09,.095,.012)),('legR','hip',(0,-.107,.694),(.09,.095,.012))]:
    o=ell('stump_'+key,p,sz,'blood',parent,seg=12,rings=6);o['stumpFor']=key;o['hidden']=True;o.scale=(0,0,0)

# Enforce the infected hero budget while retaining the most geometry in sculpted volumes.
raw_triangles=sum(len(f.vertices)-2 for o in objects for f in o.data.polygons)
if raw_triangles>39500:
    reducible=sum(len(f.vertices)-2 for o in objects if len(o.data.polygons)>80 for f in o.data.polygons)
    ratio=(38500-(raw_triangles-reducible))/reducible
    for o in objects:
        if len(o.data.polygons)>80:
            bpy.context.view_layer.objects.active=o
            mod=o.modifiers.new('hero budget','DECIMATE');mod.ratio=ratio
            bpy.ops.object.modifier_apply(modifier=mod.name)
# Triangulate explicitly and discard zero-area remnants from bevels/boolean cuts.
for o in objects:
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    tiny=[f for f in bm.faces if f.calc_area()<1e-8]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
    bm.to_mesh(o.data);bm.free();o.data.update()
# Merge static decorations by material within each rigid parent; keep all cap names separate.
# Boolean openings may add an unused cutter-material slot; keep every slot palette-backed.
for o in objects:
    fallback=next(m for m in o.data.materials if m)
    materials=[m or fallback for m in o.data.materials]
    unique=list(dict.fromkeys(materials))
    indices=[unique.index(materials[f.material_index]) for f in o.data.polygons]
    o.data.materials.clear()
    for m in unique:o.data.materials.append(m)
    for f,index in zip(o.data.polygons,indices):f.material_index=index
caps=[o for o in objects if o.name.startswith('stump_')]
buckets={}
for o in objects:
    if not o.name.startswith('stump_'):
        buckets.setdefault((o.parent.name,tuple(m.name for m in o.data.materials)),[]).append(o)
joined=[]
for (parent,material),group in buckets.items():
    if len(group)>1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join()
    o=group[0];o.name=parent+'__'+material[0]+('_regions' if len(material)>1 else '');joined.append(o)
objects=joined+caps
# Establish the lurching rest pose, then bake it into geometry and joint positions.
# Rest nodes export at unit scale/zero rotation: procedural animation adds motion to this pose.
parts['head'].scale=(1.48,1.55,1.15)
parts['hip'].location.z-=.09
parts['torso'].rotation_euler.y=.29
parts['head'].rotation_euler.y=-.24
for side,sign in [('L',1),('R',-1)]:
    parts['arm'+side].rotation_euler=(sign*.14,-.85 if side=='L' else -.60,0)
    parts['foreArm'+side].rotation_euler.y=-.58 if side=='L' else -.65
    parts['hand'+side].scale=(1.38,1.45,1.40)
    parts['hand'+side].rotation_euler.z=math.pi
    parts['leg'+side].rotation_euler.y=-.73 if side=='L' else .30
    parts['shin'+side].rotation_euler.y=1.03 if side=='L' else .36
    parts['foot'+side].rotation_euler.y=-.30 if side=='L' else -.66
    parts['foot'+side].scale=(1.15,1.20,1.12)
# Caps have an export-hidden zero scale; restore temporarily to bake their actual surfaces.
for cap in caps:cap.scale=(1,1,1)
bpy.context.view_layer.update()
node_positions={n:o.matrix_world.translation.copy() for n,o in parts.items()}
parents={n:o.parent.name if o.parent else None for n,o in parts.items()}
mesh_parents={o.name:o.parent.name for o in objects}
for o in objects:
    o.data.transform(o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
for n,o in parts.items():
    o.parent=None;o.matrix_world=Matrix.Translation(node_positions[n])
for n,o in parts.items():
    if parents[n]:
        o.parent=parts[parents[n]];o.matrix_parent_inverse=Matrix.Identity(4)
        o.location=node_positions[n]-node_positions[parents[n]]
bpy.context.view_layer.update()
for o in objects:
    o.parent=parts[mesh_parents[o.name]];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    o.matrix_basis=Matrix.Identity(4)
# Ground both planted shoes after the knee bend. A tiny per-shoe shift avoids any floating sole.
bpy.context.view_layer.update()
for side in ['L','R']:
    shoe_objects=[o for o in objects if o.parent==parts['foot'+side]]
    floor=min((o.matrix_world@v.co).z for o in shoe_objects for v in o.data.vertices)
    parts['foot'+side].location.z-=floor
for cap in caps:cap.scale=(0,0,0)
bpy.context.view_layer.update()
# Measure the visible skull/hair separately from the neck and drips.
bpy.context.view_layer.update()
bounds=[o.matrix_world@v.co for o in objects if not o.name.startswith('stump_') for v in o.data.vertices]
(P/'rig-rest.json').write_text(json.dumps({
    'height':max(v.z for v in bounds)-min(v.z for v in bounds),
    'feet_min_z':min(v.z for v in bounds),
    'pivots':{n:list(o.matrix_world.translation) for n,o in parts.items()},
    'rest_rotations_zero':all(sum(v*v for v in o.rotation_euler)<1e-12 for o in parts.values()),
    'rest_scales_one':all((o.scale-Vector((1,1,1))).length<1e-6 for o in parts.values())
},indent=2))
# Record before stage objects. Export includes hidden caps as zero scale nodes.
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket']+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
triangles=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
(P/'build-stats.json').write_text(json.dumps({'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in bpy.data.objects]},indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
def pose_test():
    parts['armL'].rotation_euler.x=.45;parts['foreArmL'].rotation_euler.y=-.55;parts['legR'].rotation_euler.y=-.35
    # Separate the articulated left arm to expose the proximal shoulder cap.
    parts['armL'].location+=Vector((.17,.25,.075))
    cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
    (P/'pose-check.json').write_text(json.dumps({'rotated':['armL','foreArmL','legR'],'shown_cap':'stump_armL','arm_separation':[.17,.25,.075]},indent=2))
def turnaround(output):
    # Assemble the four views without another GPU render.
    import numpy as np
    panels=[]
    for name in ['front.png','side.png','back.png','review-hero.png']:
        im=bpy.data.images.load(str(P/'renders'/name));w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-420)//2:(w+420)//2,:])
    data=np.concatenate(panels,axis=1)
    sheet=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
    sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=str(output);sheet.file_format='PNG';sheet.save()
if a.pose:pose_test()
if a.render and a.view=='turnaround':
    turnaround(a.render);print('OK turnaround');sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),460,(1,.83,.69),3);light('cool fill',(1,4,3),260,(.63,.72,1),3);light('amber rim',(-3,1,3.5),500,(1,.65,.42),2)
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='studio_floor';ground.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,2.9),'pose':(6,4,2.9),'front':(6,0,1.35),'side':(0,-6,1.35),'back':(-6,0,1.35)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.10*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='METAL';prefs.get_devices()
        for d in prefs.devices:d.use=True
        S.cycles.device='GPU'
    except Exception:pass
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG'
    def render_view(view,path,width,height,samples):
        cam.location=views.get(view,views['hero']);cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.ortho_scale=2.1*max(width/height,1)
        S.render.resolution_x=width;S.render.resolution_y=height;S.cycles.samples=samples;S.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
    if a.view=='final-set':
        for view in ['front','side','back','hero']:
            path=P/'renders'/('review-hero.png' if view=='hero' else view+'.png')
            render_view(view,path,960,540,24)
        turnaround(P/'renders'/'turnaround.png')
        render_view('hero',a.render,1600,900,96)
        pose_test();render_view('pose',P/'renders'/'pose-test.png',960,540,24)
    else:
        review_set=(a.width==960 and a.view=='hero' and not a.pose)
        for view in (['front','side','back','hero'] if review_set else [a.view]):
            path=Path(a.render).with_name(view+'.png') if review_set and view!='hero' else a.render
            render_view(view,path,a.width,a.height,a.samples)
print('OK',triangles,'triangles',len(objects),'meshes')
