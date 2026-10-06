"""Hero Butcher: deterministic palette-only rigid parts, +X forward / Z up.
Subdivision and bevels are applied; only joint/socket empties and game meshes export.
Build and render exclusively through experiment/tools/blender_run.py.
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
S=bpy.context.scene; rng=random.Random(2207); parts={}; objects=[]
sys.path.insert(0,str(P.parents[1]/'tools'/'blender'))
from sslib import palette
M={k:palette.mat(k) for k in ['infectedSkin','picketWhite','asphalt','uiDark','blood','survivorRed','sidewalk','argyleGrey','olive','oliveLight','oliveSeam','silver','leather','leatherEdge','bone','redDark']}
M['eye']=palette.mat('infectedEye',emissive=True)
for k,m in M.items():
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Roughness'].default_value=.8 if k in ['picketWhite','argyleGrey','olive'] else .55
    if k=='blood':bs.inputs['Roughness'].default_value=.32
    if k=='silver':bs.inputs['Metallic'].default_value=.72;bs.inputs['Roughness'].default_value=.3
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o

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
# A thick, forward-set neck joins the exaggerated adult head to a humped chest.
node('root',(0,0,0));node('hip',(-.035,0,.77),'root')
node('torso',(-.04,0,.88),'hip');node('head',(.09,0,1.40),'torso')
node('backpackSocket',(-.29,0,1.24),'torso')
ell('pelvis',(-.035,0,.79),(.245,.32,.16),'olive','hip',seg=16,rings=10)
ell('shirt_mass',(-.03,0,1.12),(.27,.385,.32),'argyleGrey','torso',seg=20,rings=12)
ell('hunched_back',(-.13,0,1.28),(.245,.35,.18),'argyleGrey','torso',seg=16,rings=10)
ell('neck',(.065,0,1.416),(.14,.145,.14),'infectedSkin','head')
# Sculpted draped apron surface: a single connected bib/skirt with a zigzag hem.
# Ring rows stay close enough to form a continuous garment, but far enough from shirt.
def apron_x(y,z):
    width=.31 if z>1 else .37
    return (.285 if z>.93 else .277)-.125*(y/width)**2+.016*math.cos(y*39)*(1 if z<1 else .4)
rows=[(.605,.38),(.68,.372),(.81,.35),(.90,.335),(1.0,.284),(1.16,.242),(1.31,.212)]
v=[];f=[];N=25
for j,(z,w) in enumerate(rows):
    for i in range(N):
        y=w*(2*i/(N-1)-1)
        zz=z+((.026 if i%2 else -.025) if j==0 else 0)
        v.append((apron_x(y,zz),y,zz))
for j in range(len(rows)-1):
    for i in range(N-1):f.append((j*N+i,j*N+i+1,(j+1)*N+i+1,(j+1)*N+i))
apron=mesh('apron_front',v,f,'picketWhite','torso',1)
mod=apron.modifiers.new('cloth thickness','SOLIDIFY');mod.thickness=.012;bpy.context.view_layer.objects.active=apron;bpy.ops.object.modifier_apply(modifier=mod.name)
# Back apron upper panel: straps continue over both shoulders.
bv=[];bf=[];BN=17
bpy.context.view_layer.update()
for row in range(9):
    z=.984+row*.054;w=.24-.035*row/8
    for i in range(BN):
        y=w*(2*i/(BN-1)-1);hits=[]
        for target in ['shirt_mass','hunched_back']:
            obj=bpy.data.objects[target];inv=obj.matrix_world.inverted()
            hit,loc,normal,index=obj.ray_cast(inv@Vector((-.8,y,z)),inv.to_3x3()@Vector((1,0,0)))
            if hit:hits.append((obj.matrix_world@loc).x)
        x=min(hits)-.013 if hits else -.27
        bv.append((x,y,z))
for row in range(8):
    for i in range(BN-1):bf.append((row*BN+i,row*BN+i+1,(row+1)*BN+i+1,(row+1)*BN+i))
back=mesh('apron_back_bib',bv,bf,'picketWhite','torso',1)
mod=back.modifiers.new('back cloth thickness','SOLIDIFY');mod.thickness=.012;bpy.context.view_layer.objects.active=back;bpy.ops.object.modifier_apply(modifier=mod.name)
for s in [-1,1]:
    tube('apron_shoulder_strap'+str(s),[(.24,s*.207,1.24),(.18,s*.22,1.4),(-.035,s*.235,1.448),(-.295,s*.219,1.407),(-.365,s*.182,1.26)],[(.018,.039)]*5,'picketWhite','torso',N=8)
    patch('shirt_collar'+str(s),[(.135,s*.07,1.442),(.21,s*.178,1.385),(.246,s*.134,1.27),(.233,s*.067,1.336)],'argyleGrey','torso',.022)
    ell('apron_eyelet'+str(s),(.264,s*.193,1.267),(.009,.023,.026),'silver','torso',seg=12,rings=8)
    ell('apron_eyelet_hole'+str(s),(.274,s*.193,1.267),(.005,.009,.012),'uiDark','torso',seg=10,rings=6)
    tube('apron_waist_tie'+str(s),[(.299,s*.04,.94),(.235,s*.271,.94),(-.04,s*.354,.94),(-.28,s*.27,.945),(-.323,s*.03,.95)],[(.012,.024)]*5,'picketWhite','torso',N=8)
    # Visible sewn edges and shallow fabric creases.
    tube('apron_bib_seam'+str(s),[(apron_x(s*.197,1.29)+.009,s*.197,1.29),(apron_x(s*.237,1.15)+.009,s*.237,1.15),(apron_x(s*.28,1)+.009,s*.28,1)], [.0035]*3,'sidewalk','torso',N=6,sub=0)
    tube('apron_fold'+str(s),[(.274,s*.20,.94),(.291,s*.16,.83),(.289,s*.19,.70)],[.006,.012,.003],'picketWhite','torso',N=8)
    tube('bow_loop'+str(s),[(-.337,0,.944),(-.363,s*.108,.992),(-.38,s*.169,.964),(-.371,s*.106,.925),(-.337,0,.944)],[(.014,.025)]*5,'picketWhite','torso',N=8)
    tube('bow_tail'+str(s),[(-.348,s*.025,.94),(-.36,s*.041,.839),(-.365,s*.053,.728)],[ (.018,.024),(.012,.029),(.01,.028)],'picketWhite','torso',N=8)
ell('bow_knot',(-.363,0,.946),(.03,.038,.033),'picketWhite','torso')
# Relaxed hulking arms, oversized biceps and vein shapes; hands stay clear of apron.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(-.02,s*.364,1.292); elbow=(.075,s*.493,1.08);wrist=(.16,s*.555,.882)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    ell('deltoid'+side,(-.005,s*.38,1.27),(.205,.20,.19),'infectedSkin','arm'+side,seg=14,rings=10)
    tube('torn_sleeve'+side,[(-.055,s*.34,1.344),(-.021,s*.396,1.315),(.02,s*.431,1.255)],[.195,.217,.189],'argyleGrey','arm'+side,N=14)
    bpy.context.view_layer.update()
    for j in range(4):
        y=s*(.315+j*.048)
        pts=[(.20,y,1.404-j*.007),(.20,y+s*.06,1.373-j*.008),(.20,y+s*.037,1.276-(j%2)*.026)]
        projected=[]
        for x,yy,z in pts:
            hits=[]
            for target in ['torn_sleeve'+side,'deltoid'+side]:
                obj=bpy.data.objects[target];inv=obj.matrix_world.inverted()
                hit,loc,normal,index=obj.ray_cast(inv@Vector((.8,yy,z)),inv.to_3x3()@Vector((-1,0,0)))
                if hit:hits.append((obj.matrix_world@loc).x)
            projected.append((max(hits)+.004 if hits else x,yy,z))
        patch('sleeve_rag'+side+str(j),projected,'argyleGrey','arm'+side,.010)
    ell('bicep'+side,(.07,s*.457,1.168),(.169,.164,.166),'infectedSkin','arm'+side,rot=(s*.2,.23,0),seg=16,rings=10)
    ell('tricep'+side,(-.067,s*.465,1.148),(.092,.116,.16),'infectedSkin','arm'+side)
    tube('forearm_mass'+side,[elbow,(.113,s*.52,1.021),(.146,s*.55,.95),wrist],[.109,.142,.12,.086],'infectedSkin','foreArm'+side,N=14)
    ell('elbow'+side,(.026,s*.49,1.079),(.109,.122,.089),'infectedSkin','foreArm'+side)
    tube('wrist_band'+side,[(.145,s*.548,.94),(.158,s*.556,.892)],[.115,.109],'leather','foreArm'+side,N=14,sub=0)
    for j in range(2):ell('cuff_rivet'+side+str(j),(.264,s*(.53+j*.04),.915),(.009,.012,.012),'silver','foreArm'+side,seg=8,rings=6)
    tube('arm_vein'+side,[(.219,s*.46,1.18),(.215,s*.482,1.117),(.22,s*.52,1.024),(.233,s*.55,.984)],[.006,.01,.008,.003],'sidewalk','foreArm'+side,N=6)
    ell('hand_palm'+side,(.177,s*.564,.827),(.088,.10,.108),'infectedSkin','hand'+side,seg=14,rings=8)
    # Four distinct hooked digits. Right fingers curl around the cleaver grip.
    for j in range(4):
        y=s*(.48+j*.048);z=.794+(abs(j-1.5)*.01)
        endx=.28 if side=='L' else .246
        tube('finger'+side+str(j),[(.195,y,z),(.24,y,z-.047),(.272,y,z-.085),(endx,y,z-.047)], [.029,.029,.024,.017],'infectedSkin','hand'+side,N=8)
        ell('knuckle'+side+str(j),(.219,y,z),(.033,.03,.03),'infectedSkin','hand'+side,seg=8,rings=6)
        ell('nail'+side+str(j),(endx+.007,y,z-.049),(.006,.015,.018),'sidewalk','hand'+side,seg=8,rings=6)
    tube('thumb'+side,[(.212,s*.488,.851),(.29,s*.473,.815),(.305,s*.502,.783)],[.039,.035,.022],'infectedSkin','hand'+side,N=8)
    node('weaponSocket'+side,(.245,s*.568,.79),'hand'+side)
    hp=(-.042,s*.194,.78);kp=(.02,s*.263,.48);ank=(-.024,s*.276,.20)
    node('leg'+side,hp,'hip');node('shin'+side,kp,'leg'+side);node('foot'+side,ank,'shin'+side)
    tube('trouser_thigh'+side,[hp,(-.01,s*.227,.712),(.025,s*.264,.573),kp],[.173,.189,.174,.139],'olive','leg'+side,N=14)
    tube('trouser_calf'+side,[kp,(.002,s*.278,.4),(-.026,s*.277,.31)],[.145,.143,.11],'olive','shin'+side,N=12)
    for j,z in enumerate([.65,.55,.46]):
        tube('trouser_fold'+side+str(j),[(.137,s*.16,z+.02),(.195,s*.249,z),(.138,s*.351,z-.016)],[.009,.023,.006],'oliveLight','leg'+side,N=8)
    ell('torn_knee'+side,(.164,s*.267,.497),(.024,.083,.063),'uiDark','leg'+side)
    ell('knee_skin'+side,(.179,s*.267,.501),(.019,.058,.04),'infectedSkin','leg'+side)
    for j in range(3):patch('knee_rag'+side+str(j),[(.2,s*(.20+j*.042),.549),(.205,s*(.23+j*.042),.535),(.202,s*(.214+j*.042),.495)],'olive','leg'+side)
    # Separate thick rubber shafts, welt, toe guards, sole, tread and pull tabs.
    box('boot_sole'+side,(.063,s*.283,.046),(.39,.261,.092),'uiDark','foot'+side,.028)
    box('boot_welt'+side,(.064,s*.283,.094),(.395,.26,.034),'leatherEdge','foot'+side,.014)
    ell('boot_foot'+side,(.063,s*.283,.16),(.197,.128,.106),'asphalt','foot'+side,seg=16,rings=10)
    tube('rubber_shaft'+side,[(-.026,s*.278,.144),(-.03,s*.279,.245),(-.026,s*.278,.365)],[.114,.12,.138],'asphalt','foot'+side,N=14)
    tube('boot_top_rim'+side,[(-.026,s*.278,.347),(-.026,s*.278,.375)],[.146,.147],'leatherEdge','foot'+side,N=14,sub=0)
    ell('boot_toe_guard'+side,(.166,s*.283,.141),(.104,.129,.073),'leatherEdge','foot'+side,seg=14,rings=8)
    box('boot_pull_tab'+side,(-.148,s*.283,.356),(.039,.06,.098),'leather','foot'+side,.008)
    for j in range(6):
        box('sole_tread'+side+str(j),(-.088+j*.06,s*.283,.012),(.026,.257,.022),'uiDark','foot'+side,.005)
    for j in range(3):
        tube('boot_rib'+side+str(j),[(.074,s*.193,.206+j*.045),(.11,s*.28,.217+j*.045),(.076,s*.373,.207+j*.045)],[.006,.008,.006],'leatherEdge','foot'+side,N=6)
    patch('cargo_pocket'+side,[(-.10,s*.4,.745),(.062,s*.414,.715),(.066,s*.407,.595),(-.091,s*.39,.598)],'oliveLight','leg'+side,.014)
    tube('trouser_outer_seam'+side,[(-.055,s*.412,.72),(-.05,s*.414,.599),(-.03,s*.381,.471)],[.004]*3,'oliveSeam','leg'+side,N=6,sub=0)
# Hero head: almost one third of height, with adult brow/jaw and short tousled hair.
ell('cranium',(.106,0,1.664),(.24,.259,.284),'infectedSkin','head',seg=24,rings=16)
ell('jaw',(.179,0,1.473),(.175,.196,.139),'infectedSkin','head',seg=16,rings=10)
for s in [-1,1]:
    ell('ear'+str(s),(.083,s*.255,1.625),(.063,.05,.086),'infectedSkin','head')
    ell('ear_inner'+str(s),(.13,s*.269,1.625),(.019,.023,.049),'redDark','head')
    ell('cheekbone'+str(s),(.288,s*.153,1.586),(.06,.073,.076),'infectedSkin','head')
    ell('eye_bruise'+str(s),(.317,s*.12,1.718),(.031,.085,.078),'redDark','head')
    ell('eye_socket'+str(s),(.337,s*.12,1.716),(.022,.067,.056),'uiDark','head')
    ell('red_eye'+str(s),(.352,s*.119,1.718),(.025,.043,.036),'eye','head',seg=16,rings=10)
    ell('eye_hot_core'+str(s),(.373,s*.118,1.721),(.006,.011,.014),'bone','head',seg=10,rings=6)
    tube('angry_brow'+str(s),[(.359,s*.032,1.745),(.352,s*.107,1.795),(.303,s*.19,1.795)],[.023,.035,.022],'uiDark','head',N=10)
    tube('orbital_ridge'+str(s),[(.344,s*.022,1.774),(.323,s*.108,1.825),(.28,s*.192,1.814)],[.021,.033,.014],'infectedSkin','head',N=10)
ell('nose_bridge',(.355,0,1.674),(.048,.043,.088),'infectedSkin','head')
ell('nose_tip',(.408,0,1.625),(.055,.055,.036),'infectedSkin','head')
for s in [-1,1]:ell('nostril'+str(s),(.439,s*.032,1.606),(.009,.014,.01),'uiDark','head',seg=8,rings=6)
# Real carved mouth cavity, rather than a graphic glued onto the face.
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=(.363,0,1.501))
cutter=bpy.context.object;cutter.scale=(.112,.119,.114);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for name in ['cranium','jaw']:
    obj=bpy.data.objects[name];mod=obj.modifiers.new('mouth opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True)
ell('mouth_cavity',(.287,0,1.499),(.042,.116,.11),'uiDark','head',seg=20,rings=12)
pts=[(.353,.12*math.cos(i*2*math.pi/32),1.5+.117*math.sin(i*2*math.pi/32)) for i in range(33)]
tube('torn_lips',pts,[.016]*33,'blood','head',N=8)
for row in [0,1]:
    for j in range(7):
        y=(j-3)*.03;z=(1.586 if row==0 else 1.413)+(abs(j-3)*(-.004 if row==0 else .004))
        box('tooth'+str(row)+str(j),(.366,y,z),(.034,.024,.035 if row==0 else .021),'bone','head',.006,rot=(.08*(j-3),0,0))
ell('tongue',(.348,0,1.429),(.038,.065,.019),'survivorRed','head')
for s in [-1,1]:
    tube('nasolabial_fold'+str(s),[(.397,s*.056,1.605),(.369,s*.105,1.564),(.343,s*.14,1.504)],[.009,.011,.006],'sidewalk','head',N=8)
    tube('cheek_wound'+str(s),[(.341,s*.171,1.654),(.341,s*.175,1.604),(.327,s*.16,1.566)],[.008,.015,.006],'blood','head',N=6)
# A solid cap supports thick, short overlapping locks; no skinny hair wires.
ell('hair_cap',(.064,0,1.854),(.259,.276,.167),'uiDark','head',seg=20,rings=12)
def lock(n,p0,p1,p2,w):
    a,b,c=map(Vector,[p0,p1,p2]);tube(n,[a,a.lerp(b,.5),b,b.lerp(c,.72),c],[.008,(w*.82,w*.6),(w,w*.63),(w*.43,w*.3),.003],'uiDark','head',N=8)
for layer in range(2):
    for j in range(13):
        t=j*2*math.pi/13+layer*.18
        lock('hair_lock'+str(layer)+'_'+str(j),(.07+.13*math.cos(t),.14*math.sin(t),1.935-layer*.073),
             (.07+.236*math.cos(t),.254*math.sin(t),1.925-layer*.063),
             (.06+.282*math.cos(t),.292*math.sin(t),1.832-layer*.071),.07)
for j in range(7):
    y=-.207+j*.069
    lock('fringe'+str(j),(.10,y*.86,1.986),(.25,y,1.932),(.306,y-.025,1.797+(j%3)*.024),.065)
for j in range(7):
    t=j*2*math.pi/7
    lock('crown'+str(j),(.075,0,1.928),(.05+.10*math.cos(t),.12*math.sin(t),2.025+(j%2)*.02),
         (.035+.19*math.cos(t),.20*math.sin(t),1.984),.074)
for side,s in [('L',1),('R',-1)]:
    lock('sideburn'+side,(.075,s*.237,1.82),(.064,s*.267,1.756),(.049,s*.259,1.69),.046)
    for j in range(3):
        tube('shirt_sleeve_crease'+side+str(j),[(.079,s*.358,1.44-j*.033),(.158,s*.404,1.401-j*.031),(.176,s*.443,1.345-j*.027)],[.005,.014,.003],'argyleGrey','arm'+side,N=8)
for j in range(8):
    t=1.9+j*.33
    lock('nape'+str(j),(.05+.16*math.cos(t),.19*math.sin(t),1.84),(-.03+.19*math.cos(t),.25*math.sin(t),1.773),(-.02+.21*math.cos(t),.25*math.sin(t),1.703),.055)
# Cleaver mounted at weaponSocketR. Broad steel face, sharpened bevel, punched hole.
# The hanging blade lies in X/Z, leaving its front face legible in the hero view.
tube('cleaver_grip',[(.247,-.568,.83),(.273,-.571,.72),(.3,-.577,.627)],[.027,.027,.027],'leather','weaponSocketR',N=10,sub=0)
for z in [.746,.791]:ell('handle_pin'+str(z),(.284,-.599,z),(.009,.006,.009),'silver','weaponSocketR',seg=8,rings=6)
blade=box('cleaver_blade',(.334,-.582,.495),(.345,.03,.295),'silver','weaponSocketR',.016,rot=(0,-.23,0))
# Hole through the broad blade, aligned along Y.
bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=.018,depth=.10,location=(.238,-.582,.571),rotation=(math.pi/2,0,0))
cutter=bpy.context.object;mod=blade.modifiers.new('hanging hole','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
bpy.context.view_layer.objects.active=blade;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
box('cleaver_sharpened_edge',(.362,-.6,.377),(.328,.008,.032),'picketWhite','weaponSocketR',.006,rot=(0,-.23,0))
# Deterministic stains projected onto the intended surface, at least 3 mm proud.
def stain(n,y,z,ry,rz,target,par,front=True):
    obj=bpy.data.objects[target];bpy.context.view_layer.update();inv=obj.matrix_world.inverted()
    verts=[]
    for i in range(13):
        t=i*2*math.pi/12;r=1 if i==0 else rng.uniform(.65,1.12)
        yy=y if i==0 else y+math.cos(t)*ry*r;zz=z if i==0 else z+math.sin(t)*rz*r
        start=Vector((.8 if front else -.8,yy,zz));direction=Vector((-1 if front else 1,0,0))
        hit,loc,normal,index=obj.ray_cast(inv@start,inv.to_3x3()@direction)
        if not hit:return
        verts.append(obj.matrix_world@loc+direction*(-.004))
    # Center plus twelve boundary points.
    me=mesh(n,verts,[(0,i+1,(i+1)%12+1) for i in range(12)],'blood',par,0)
    for face in me.data.polygons:face.use_smooth=False
for j in range(45):
    y=rng.uniform(-.29,.29);z=rng.uniform(.66,1.29)
    stain('apron_splatter'+str(j),y,z,rng.uniform(.008,.04),rng.uniform(.009,.055),'apron_front','torso')
for j in range(30):
    stain('back_splatter'+str(j),rng.uniform(-.16,.16),rng.uniform(1.015,1.395),rng.uniform(.009,.036),rng.uniform(.01,.034),'apron_back_bib','torso',False)
for s,side in [(1,'L'),(-1,'R')]:
    for j in range(5):
        stain('arm_blood'+side+str(j),s*(.46+j*.017),1.19-j*.064,.028,.034,'bicep'+side if j<2 else 'forearm_mass'+side,'arm'+side if j<2 else 'foreArm'+side)
    stain('hand_smear'+side,s*.56,.835,.058,.066,'hand_palm'+side,'hand'+side)
    stain('knee_blood'+side,s*.266,.505,.043,.022,'knee_skin'+side,'leg'+side)
for j in range(7):
    stain('face_blood'+str(j),rng.uniform(-.15,.15),rng.uniform(1.79,1.89),.014,.029,'cranium','head')
# Larger apron smears communicate heavy wear rather than even polka dots.
for j,(y,z,ry,rz) in enumerate([(-.07,.99,.08,.073),(.13,.80,.065,.083),(-.19,.73,.07,.074),(.04,1.2,.045,.073),(-.08,.865,.056,.09),(.02,.697,.052,.06)]):
    stain('apron_heavy_smear'+str(j),y,z,ry,rz,'apron_front','torso')
for j,y in enumerate([-.15,.08,.21]):
    tube('apron_drip'+str(j),[(apron_x(y,.67)+.008,y,.67),(apron_x(y,.61)+.009,y,.61),(.25,y,.567-j*.009)],[.009,.009,.003],'blood','torso',N=6)
tube('chin_drip',[(.28,-.04,1.404),(.266,-.04,1.365),(.256,-.043,1.329)],[.017,.012,.003],'blood','head',N=8)
# Blade blood is geometry on both steel faces, oriented to the blade's plane.
for j in range(20):
    x=rng.uniform(.22,.48);z=rng.uniform(.385,.505)
    pts=[]
    for i in range(9):
        t=i*2*math.pi/9;r=rng.uniform(.65,1.15)
        pts.append((x+math.cos(t)*(.009+(j%4)*.004)*r,-.602,z+math.sin(t)*(.012+(j%3)*.006)*r))
    mesh('blade_splatter'+str(j),pts,[tuple(range(9))],'blood','weaponSocketR',0)
tube('blade_drip',[(.427,-.604,.383),(.423,-.604,.327)],[.007,.002],'blood','weaponSocketR',N=6)
# Caps belong to proximal joints and export hidden via scale, with runtime extras.
for key,par,p,sz in [('head','torso',(.09,0,1.40),(.14,.14,.015)),('armL','torso',(-.02,.364,1.292),(.13,.018,.13)),('armR','torso',(-.02,-.364,1.292),(.13,.018,.13)),('foreArmL','armL',(.075,.493,1.08),(.095,.018,.09)),('foreArmR','armR',(.075,-.493,1.08),(.095,.018,.09)),('legL','hip',(-.042,.194,.78),(.13,.13,.018)),('legR','hip',(-.042,-.194,.78),(.13,.13,.018))]:
    o=ell('stump_'+key,p,sz,'blood',par,seg=12,rings=6);o['stumpFor']=key;o['hidden']=True
# Triangulate before export; reduction keeps fine curves but meets the 40k crowd limit.
for o in objects:
    if len(o.data.polygons)>90:
        bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('game reduction','DECIMATE');mod.ratio=.34;bpy.ops.object.modifier_apply(modifier=mod.name)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
    tiny=[f for f in bm.faces if f.calc_area()<1e-9]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
    bm.to_mesh(o.data);bm.free();o.data.update()
# Join details within each rigid parent, retaining cap and joint names.
caps=[o for o in objects if o.name.startswith('stump_')];buckets={}
for o in objects:
    if o in caps:continue
    # Boolean operations can leave empty slots; normalize to palette materials.
    fallback=next(m for m in o.data.materials if m)
    for i,m in enumerate(o.data.materials):
        if m is None:o.data.materials[i]=fallback
    buckets.setdefault(o.parent.name,[]).append(o)
joined=[]
for parent,group in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0].name=parent+'__mesh';joined.append(group[0])
objects=joined+caps
# Rest-pose bend is baked into geometry and joint positions, so runtime rotations start at zero.
parts['torso'].rotation_euler.y=.15
parts['head'].rotation_euler.y=-.08
parts['weaponSocketR'].rotation_euler.z=math.radians(55)
for side in ['L','R']:
    parts['arm'+side].rotation_euler.y=-.16
    parts['foreArm'+side].rotation_euler.y=-.18
    parts['leg'+side].rotation_euler.y=-.16
    parts['shin'+side].rotation_euler.y=.33
    parts['foot'+side].rotation_euler.y=-.17
bpy.context.view_layer.update()
positions={n:o.matrix_world.translation.copy() for n,o in parts.items()}
parents={n:o.parent.name if o.parent else None for n,o in parts.items()}
meshparents={o.name:o.parent.name for o in objects}
for o in objects:
    o.data.transform(o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
for n,o in parts.items():o.parent=None;o.matrix_world=Matrix.Translation(positions[n])
for n,o in parts.items():
    if parents[n]:
        o.parent=parts[parents[n]];o.matrix_parent_inverse=Matrix.Identity(4);o.location=positions[n]-positions[parents[n]]
bpy.context.view_layer.update()
for o in objects:
    o.parent=parts[meshparents[o.name]];o.matrix_parent_inverse=o.parent.matrix_world.inverted();o.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
for side in ['L','R']:
    sole=[o for o in objects if o.parent==parts['foot'+side]]
    floor=min((o.matrix_world@v.co).z for o in sole for v in o.data.vertices)
    parts['foot'+side].location.z-=floor
for cap in caps:cap.scale=(0,0,0)
bpy.context.view_layer.update()
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','weaponSocketR','weaponSocketL','backpackSocket']+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
triangles=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
stats={'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in bpy.data.objects]}
(P/'build-stats.json').write_text(json.dumps(stats,indent=2))
bounds=[o.matrix_world@v.co for o in joined for v in o.data.vertices]
(P/'rig-rest.json').write_text(json.dumps({'height':max(v.z for v in bounds)-min(v.z for v in bounds),'feet_min_z':min(v.z for v in bounds),'rest_rotations_zero':all(sum(abs(v) for v in o.rotation_euler)<1e-6 for o in parts.values()),'rest_scales_one':all((o.scale-Vector((1,1,1))).length<1e-6 for o in parts.values()),'pivots':{n:list(o.matrix_world.translation) for n,o in parts.items()},'parents':{n:o.parent.name if o.parent else None for n,o in parts.items()}},indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if a.pose:
    parts['armL'].rotation_euler.x=.55
    parts['foreArmL'].rotation_euler.y=-.6
    parts['legR'].rotation_euler.y=-.3
    # Place the animated detached arm beside its exposed proximal shoulder cap.
    parts['armL'].location.y+=.5
    cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
if a.render and a.view=='turnaround':
    import numpy as np
    panels=[]
    for n in ['front','side','back','review-hero']:
        im=bpy.data.images.load(str(P/'renders'/f'{n}.png'));w,h=im.size
        data=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(data)
        panels.append(data.reshape(h,w,4)[:,(w-440)//2:(w+440)//2,:])
    data=np.concatenate(panels,axis=1);im=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
    im.pixels.foreach_set(data.ravel());im.filepath_raw=a.render;im.file_format='PNG';im.save();print('OK turnaround');sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world
    world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size
        o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),520,(1,.83,.69),3);light('cool fill',(1,4,3),300,(.63,.72,1),3);light('amber rim',(-3,1,3.5),650,(1,.46,.2),2)
    bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object
    m=bpy.data.materials.new('studio floor');m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.045,.036,.05,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85;floor.data.materials.append(m)
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,3.25),'front':(6,0,1.5),'side':(0,-6,1.5),'back':(-6,0,1.5),'pose':(6,4,3.25)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((.06,0,1.02))-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO';cam.data.ortho_scale=(2.55 if a.pose else 2.35)*a.width/a.height
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True;S.cycles.device='CPU'
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG'
    if a.view=='review-set':
        for view in ['front','side','back','hero']:
            cam.location=views[view];cam.rotation_euler=(Vector((.06,0,1.02))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.render.filepath=str(Path(a.render).with_name(Path(a.render).stem+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
    else:
        S.render.filepath=a.render;bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(objects),'meshes')
