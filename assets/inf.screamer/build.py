"""Deterministic rigid-part hero Screamer. +X forward, Z up, -Y character right.
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
def mat(token,hex,rough=.7,emit=0):
    m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token);m.use_nodes=True
    c=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=c;b.inputs['Roughness'].default_value=rough
    if emit:b.inputs['Emission Color'].default_value=c;b.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=c;return m
M={k:mat(k,v,r) for k,v,r in [('infectedSkin','c9a39a',.68),('picketWhite','f2e6dc',.85),('asphalt','5b4f5c',.8),('uiDark','25222c',.78),('blood','b3121f',.35),('survivorRed','d9363e',.73),('sidewalk','b9a4a0',.8),('woodWarm','b0703f',.72),('brick','a8483a',.72)]}
M['eye']=mat('infectedEye','ff3b2f',.24,2.5)
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o
node('root',(0,0,0));node('hip',(-.035,0,.70),'root');node('torso',(-.025,0,.79),'hip');node('head',(.025,0,1.16),'torso');node('backpackSocket',(-.20,0,1.03),'torso')
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
# Fitted coral top under an open, flared ivory hoodie.
ell('pelvis',(-.035,0,.71),(.15,.215,.135),'asphalt','hip')
ell('top',(.007,0,.914),(.151,.188,.203),'survivorRed','torso',seg=16,rings=10)
ell('neck',(.03,0,1.146),(.077,.089,.10),'infectedSkin','head')
# Low scooped neckline: a recessed patch of bare skin above the tank top.
ell('upper_chest',(.083,0,1.067),(.06,.115,.071),'infectedSkin','torso')
tube('tank_neckline',[(.128,-.113,1.1),(.163,-.059,1.053),(.169,0,1.039),(.163,.059,1.053),(.128,.113,1.1)],[.011]*5,'blood','torso',N=8)
v=[];f=[];N=24
for j,(z,rx,ry) in enumerate([(.681,.186,.268),(.711,.185,.255),(.80,.15,.209),(.98,.159,.221),(1.095,.143,.237),(1.125,.131,.201)]):
    for i in range(N):
        t=.69+(2*math.pi-1.38)*i/(N-1)
        v.append((rx*math.cos(t)-.025,ry*math.sin(t),z+(.016*math.cos(i*2.3) if j==0 else 0)))
for j in range(5):
    for i in range(N-1):f.append((j*N+i,j*N+i+1,(j+1)*N+i+1,(j+1)*N+i))
o=mesh('hoodie_shell',v,f,'picketWhite','torso',2)
mod=o.modifiers.new('cloth thickness','SOLIDIFY');mod.thickness=.013;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
# Folded hood reads clearly on the back without adding a backpack.
ell('folded_hood',(-.159,0,1.066),(.081,.161,.099),'picketWhite','torso',seg=16,rings=10)
tube('hood_rim',[(-.14,-.148,1.127),(-.208,-.102,1.079),(-.235,0,1.032),(-.208,.102,1.079),(-.14,.148,1.127)],[.017]*5,'sidewalk','torso',N=10)
for s in [-1,1]:
    patch('red_collar'+str(s),[(.093,s*.056,1.132),(.151,s*.116,1.087),(.174,s*.085,1.02),(.15,s*.056,1.064)],'survivorRed','torso',.018)
    tube('zipper_edge'+str(s),[(.116,s*.109,1.105),(.158,s*.123,1.007),(.149,s*.113,.859),(.162,s*.159,.75),(.115,s*.227,.692)],[.006]*5,'sidewalk','torso',N=6)
    tube('hood_drawstring'+str(s),[(.098,s*.1,1.126),(.158,s*.1,1.058),(.177,s*.093,.985)],[.004]*3,'picketWhite','torso',N=6)
    box('string_tip'+str(s),(.18,s*.093,.98),(.01,.01,.022),'woodWarm','torso',.003)
    for j in range(3):
        yy=s*(.138+j*.029)
        patch('jacket_rag'+str(s)+str(j),[(.15,yy,.742),(.143,yy+s*.034,.721),(.151,yy+s*.015,.651+j*.011)],'picketWhite','torso',.012)
    tube('pocket_welt'+str(s),[(.065,s*.193,.814),(.135,s*.151,.792)],[.01,.01],'sidewalk','torso',N=8)
    for j in range(3):
        z=.85+j*.049
        tube('cloth_crease'+str(s)+str(j),[(.115,s*.132,z+.011),(.097,s*.185,z),(.018,s*.214,z+.019)],[.005,.01,.002],'picketWhite','torso',N=8)
# Raised elbows, palms beside temples, chunky curled fingers with separate nails.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(-.02,s*.211,1.072);elbow=(.043,s*.403,1.009);wrist=(.092,s*.346,1.316)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    tube('upper_sleeve'+side,[shoulder,(.01,s*.272,1.074),(.035,s*.361,1.028),elbow],[.092,.111,.103,.088],'picketWhite','arm'+side,N=12)
    ell('elbow_fold'+side,elbow,(.09,.095,.085),'picketWhite','foreArm'+side)
    tube('rolled_sleeve'+side,[elbow,(.055,s*.399,1.088),(.064,s*.386,1.137)],[.09,.091,.081],'picketWhite','foreArm'+side,N=12)
    tube('cuff_edge'+side,[(.061,s*.389,1.125),(.064,s*.386,1.145)],[.082,.082],'sidewalk','foreArm'+side,N=12)
    tube('forearm'+side,[(.067,s*.385,1.139),(.085,s*.365,1.215),wrist],[.063,.063,.047],'infectedSkin','foreArm'+side,N=12)
    tube('wrist_band'+side,[(.088,s*.352,1.277),(.091,s*.349,1.299)],[.051,.052],'brick','foreArm'+side,N=10)
    ell('palm'+side,(.1,s*.349,1.359),(.049,.065,.084),'infectedSkin','hand'+side,seg=12,rings=8)
    for j in range(4):
        yy=s*(.285+j*.039);zz=1.396+(.023 if j in [1,2] else 0)
        points=[(.098,yy,zz),(.086,yy+s*(j-1.5)*.01,zz+.047),(.117,yy+s*(j-1.5)*.015,zz+.075),(.154,yy+s*(j-1.5)*.013,zz+.048)]
        tube('finger'+side+str(j),points,[.018,.02,.017,.011],'infectedSkin','hand'+side,N=8)
        ell('knuckle'+side+str(j),points[1],(.022,.022,.023),'infectedSkin','hand'+side,seg=8,rings=6)
        ell('nail'+side+str(j),points[-1],(.01,.012,.016),'sidewalk','hand'+side,seg=8,rings=6)
    tube('thumb'+side,[(.109,s*.298,1.354),(.149,s*.272,1.367),(.17,s*.261,1.401),(.166,s*.273,1.424)],[.026,.026,.019,.011],'infectedSkin','hand'+side,N=10)
    # Wide bent stance; bare legs below ragged shorts.
    hp=(-.035,s*.133,.703);knee=(.09,s*.255,.428);ankle=(-.014,s*.341,.149)
    node('leg'+side,hp,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('thigh'+side,[hp,(-.014,s*.175,.629),(.07,s*.235,.472),knee],[.113,.124,.104,.084],'infectedSkin','leg'+side,N=12)
    tube('shorts'+side,[hp,(-.026,s*.163,.675),(.011,s*.198,.569),(.026,s*.213,.537)],[.134,.14,.137,.133],'asphalt','leg'+side,N=12)
    for j in range(6):
        t=j*2*math.pi/6
        x=.026+.12*math.cos(t);y=s*.21+.126*math.sin(t)
        tube('shorts_torn_hem'+side+str(j),[(x,y,.558),(x+.011,y,.536),(x+.008,y,.507+(j%3)*.01)],[.032,.034,.005],'asphalt','leg'+side,N=6)
    ell('knee'+side,knee,(.099,.096,.092),'infectedSkin','shin'+side)
    tube('calf'+side,[knee,(.068,s*.28,.361),(.007,s*.327,.229),ankle],[.084,.092,.076,.052],'infectedSkin','shin'+side,N=12)
    tube('sock'+side,[(0,s*.332,.187),ankle],[.066,.068],'picketWhite','shin'+side,N=12)
    box('sole'+side,(.048,s*.345,.036),(.292,.19,.072),'picketWhite','foot'+side,.025)
    box('sole_stripe'+side,(.048,s*.345,.063),(.294,.192,.014),'brick','foot'+side,.006)
    ell('sneaker_upper'+side,(.048,s*.345,.114),(.146,.095,.082),'survivorRed','foot'+side,seg=16,rings=8)
    ell('sneaker_toe'+side,(.132,s*.345,.096),(.072,.091,.05),'picketWhite','foot'+side,seg=12,rings=8)
    ell('high_top'+side,(-.024,s*.341,.158),(.075,.08,.079),'survivorRed','foot'+side)
    ell('shoe_tongue'+side,(.018,s*.345,.194),(.055,.052,.022),'brick','foot'+side)
    for j in range(4):
        tube('shoe_lace'+side+str(j),[(.003+j*.023,s*.297,.188-j*.011),(.021+j*.023,s*.345,.199-j*.013),(.006+j*.023,s*.393,.187-j*.011)],[.004]*3,'picketWhite','foot'+side,N=6,sub=0)
    box('heel_tab'+side,(-.091,s*.345,.173),(.02,.046,.037),'picketWhite','foot'+side,.007)
    for j in range(6):box('sole_tread'+side+str(j),(-.067+j*.043,s*.345,.008),(.018,.172,.016),'sidewalk','foot'+side,.003)
    patch('short_pocket'+side,[(.131,s*.129,.69),(.145,s*.189,.662),(.141,s*.192,.599),(.124,s*.15,.611)],'uiDark','leg'+side,.008)
    box('hanging_belt_strap'+side,(.035,s*.271,.566),(.027,.052,.185),'woodWarm','hip',.009,rot=(s*.22,0,0))
    box('strap_buckle'+side,(.055,s*.269,.606),(.016,.061,.04),'sidewalk','hip',.005)
    tube('short_seam'+side,[(.144,s*.146,.68),(.146,s*.179,.611),(.131,s*.203,.561)],[.004]*3,'sidewalk','leg'+side,N=6,sub=0)
# Belt and fly sit above the short shells.
tube('belt',[(-.031+.149*math.cos(t*2*math.pi/24),.216*math.sin(t*2*math.pi/24),.727) for t in range(25)],[.019]*25,'woodWarm','hip',N=8)
box('belt_buckle',(.138,0,.728),(.024,.072,.044),'sidewalk','hip',.007)
box('buckle_inset',(.153,0,.728),(.006,.046,.024),'brick','hip',.004)
# Oversized sculpted head. Its face is intentionally broad enough to read in isometric play.
ell('cranium',(.019,0,1.382),(.182,.208,.235),'infectedSkin','head',seg=20,rings=14)
ell('jaw',(.068,0,1.236),(.135,.151,.105),'infectedSkin','head',seg=16,rings=10)
for s in [-1,1]:
    ell('ear'+str(s),(.015,s*.211,1.337),(.049,.033,.065),'infectedSkin','head')
    ell('ear_inner'+str(s),(.052,s*.214,1.337),(.013,.018,.04),'blood','head')
    ell('cheek'+str(s),(.138,s*.137,1.313),(.04,.06,.074),'infectedSkin','head')
    ell('orbital_wound'+str(s),(.172,s*.096,1.41),(.025,.064,.064),'blood','head')
    ell('socket'+str(s),(.19,s*.096,1.412),(.012,.052,.052),'uiDark','head')
    ell('red_eye'+str(s),(.203,s*.096,1.414),(.019,.045,.047),'eye','head',seg=16,rings=10)
    ell('eye_core'+str(s),(.221,s*.092,1.418),(.005,.017,.019),'picketWhite','head',seg=10,rings=8)
    tube('brow'+str(s),[(.179,s*.037,1.486),(.184,s*.09,1.481),(.147,s*.153,1.467)],[.016,.025,.014],'asphalt','head',N=8)
    tube('lower_eyelid'+str(s),[(.2,s*.05,1.379),(.193,s*.102,1.365),(.168,s*.145,1.385)],[.01,.013,.007],'infectedSkin','head',N=8)
# Genuine recessed mouth opening, rounded lips, teeth, gum ridges, tongue and throat.
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=(.202,0,1.266));cutter=bpy.context.object;cutter.scale=(.103,.092,.117);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for name in ['cranium','jaw']:
    obj=bpy.data.objects[name];mod=obj.modifiers.new('screaming mouth','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True)
ell('mouth_interior',(.146,0,1.266),(.039,.09,.116),'uiDark','head',seg=20,rings=12)
pts=[(.21,.096*math.cos(i*2*math.pi/32),1.266+.123*math.sin(i*2*math.pi/32)) for i in range(33)]
tube('lip_ring',pts,[.014 if i<17 else .019 for i in range(33)],'blood','head',N=8)
ell('upper_gum',(.202,0,1.361),(.019,.077,.016),'blood','head')
ell('lower_gum',(.207,0,1.163),(.023,.077,.014),'blood','head')
for row in [0,1]:
    for j in range(6):
        yy=(j-2.5)*.026;z=(1.35 if row==0 else 1.179)+(abs(j-2.5)*(-.006 if row==0 else .006))
        box('tooth'+str(row)+str(j),(.219,yy,z),(.031,.022,.028 if row==0 else .018),'picketWhite','head',.005)
ell('tongue',(.203,0,1.196),(.034,.051,.021),'survivorRed','head')
ell('nose_bridge',(.195,0,1.412),(.036,.031,.057),'infectedSkin','head')
ell('nose_tip',(.234,0,1.383),(.039,.044,.027),'infectedSkin','head')
for s in [-1,1]:ell('nostril'+str(s),(.261,s*.023,1.371),(.007,.011,.007),'uiDark','head',seg=8,rings=6)
# A layered mane: broad sculpted locks, not thin strands or spikes.
def lock(n,start,mid,end,width,material='woodWarm'):
    a0=Vector(start);b0=Vector(mid);c0=Vector(end)
    q0=tuple(a0*.8+b0*.2);q1=tuple(b0*.65+c0*.35)
    return tube(n,[start,q0,mid,q1,end],[width*.70,width,width*.78,width*.45,.004],material,'head',N=8)
ell('hair_cap',(-.046,0,1.508),(.187,.218,.165),'asphalt','head',seg=16,rings=10)
# Back layers stream behind and below the shoulders; varied tips give a wild silhouette.
for layer in range(3):
    for j in range(11):
        t=1.13+j*(4.02/10);z=1.48-layer*.095
        start=(-.035+.128*math.cos(t),.174*math.sin(t),z)
        mid=(-.092+.20*math.cos(t),.237*math.sin(t),z-.09)
        end=(-.173+.25*math.cos(t),.274*math.sin(t),z-.22-(j%3)*.022)
        lock('mane_'+str(layer)+'_'+str(j),start,mid,end,.06+(j%3)*.008,'woodWarm' if (j+layer)%3 else 'asphalt')
# Loose energetic crown, hooked tips and broad forward bangs.
for j in range(11):
    t=j*2*math.pi/11
    lock('crown_'+str(j),(-.028,.075*math.sin(t),1.573),(-.073+.1*math.cos(t),.153*math.sin(t),1.696+(j%3)*.015),(-.17+.19*math.cos(t),.235*math.sin(t),1.624+(j%2)*.035),.054,'woodWarm' if j%3 else 'brick')
for j in range(5):
    y=-.176+j*.083
    lock('fringe_'+str(j),(.02,y,1.62),(.154,y-.025,1.586),(.191,y-.047,1.46+(j%3)*.018),.062,'woodWarm' if j%2 else 'asphalt')
for s in [-1,1]:
    lock('temple_lock'+str(s),(.034,s*.171,1.582),(.136,s*.225,1.477),(.125,s*.247,1.298),.073)
    lock('side_curl'+str(s),(-.01,s*.205,1.432),(-.051,s*.269,1.356),(.057,s*.276,1.246),.061)
# Blood is actual separated geometry projected onto curved surfaces, >= 3 mm proud.
def splat(n,targets,center,ry,rz,back=False):
    x,y,z=center;pts=[Vector((x,y,z))]
    for i in range(11):
        t=i*2*math.pi/11;r=rng.uniform(.65,1.1);pts.append(Vector((x,y+ry*r*math.cos(t),z+rz*r*math.sin(t))))
    bpy.context.view_layer.update();direction=Vector((1,0,0) if back else (-1,0,0));startx=-1 if back else 1
    for p in pts:
        start=Vector((startx,p.y,p.z));hits=[]
        for name in targets:
            o=bpy.data.objects[name];inv=o.matrix_world.inverted();hit,loc,normal,index=o.ray_cast(inv@start,inv.to_3x3()@direction)
            if hit:
                world=o.matrix_world@loc;normal=(o.matrix_world.to_3x3()@normal).normalized();hits.append((world,normal))
        if hits:
            loc,normal=min(hits,key=lambda h:(h[0]-start).length);p[:]=loc+normal*.0045
    par=bpy.data.objects[targets[0]].parent.name
    o=mesh(n,pts,[(0,i+1,(i+1)%11+1) for i in range(11)],'blood',par,0)
    for f in o.data.polygons:f.use_smooth=False
for s,side in [(1,'L'),(-1,'R')]:
    for j,(y,z,ry,rz) in enumerate([(s*.156,.94,.033,.045),(s*.183,.826,.027,.035),(s*.192,.72,.043,.029)]):
        splat('jacket_blood'+side+str(j),['hoodie_shell'],(.3,y,z),ry,rz)
    for j,(y,z) in enumerate([(s*.28,1.074),(s*.35,1.027)]):
        splat('sleeve_blood'+side+str(j),['upper_sleeve'+side],(.2,y,z),.039,.033)
    splat('cuff_blood'+side,['rolled_sleeve'+side],(.2,s*.4,1.075),.033,.034)
    splat('arm_wound'+side,['forearm'+side],(.2,s*.366,1.226),.022,.046)
    splat('palm_blood'+side,['palm'+side],(.2,s*.349,1.36),.034,.034)
    splat('thigh_blood'+side,['thigh'+side],(.25,s*.231,.497),.048,.048)
    splat('knee_blood'+side,['knee'+side],(.25,s*.253,.433),.034,.03)
    splat('calf_blood'+side,['calf'+side],(.2,s*.316,.265),.026,.045)
    splat('shoe_blood'+side,['sneaker_toe'+side],(.3,s*.345,.097),.043,.023)
    splat('face_stream'+side,['cheek'+str(s)],(.3,s*.134,1.32),.015,.047)
    for j in range(4):
        splat('jacket_back_blood'+side+str(j),['hoodie_shell'],(-.3,s*(.055+j*.043),.775+j*.067),.025,.032,back=True)
for j in range(5):
    splat('top_blood'+str(j),['top'],(.3,(-.08+j*.042),.82+(j%3)*.075),.028,.038)
# Torn shell openings expose the red shirt; torn sleeve holes reveal skin.
def tear(name,center,size):
    obj=bpy.data.objects[name];bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=center);cut=bpy.context.object;cut.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=obj.modifiers.new('ragged opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
for s,side in [(1,'L'),(-1,'R')]:
    tear('upper_sleeve'+side,(.108,s*.295,1.069),(.046,.037,.034))
    ell('sleeve_skin_hole'+side,(.076,s*.295,1.067),(.025,.033,.031),'infectedSkin','arm'+side)
    for j in range(3):
        patch('torn_sleeve_edge'+side+str(j),[(.113,s*(.27+j*.02),1.092),(.112,s*(.29+j*.02),1.096),(.109,s*(.285+j*.02),1.05)],'picketWhite','arm'+side)
    tear('hoodie_shell',(.12,s*.19,.903),(.059,.031,.048))
# Seven hidden caps on proximal parts survive removal of the distal limb.
for key,parent,p,sz in [('head','torso',(.025,0,1.16),(.077,.085,.015)),('armL','torso',(-.02,.211,1.072),(.08,.018,.08)),('armR','torso',(-.02,-.211,1.072),(.08,.018,.08)),('foreArmL','armL',(.043,.403,1.009),(.074,.074,.018)),('foreArmR','armR',(.043,-.403,1.009),(.074,.074,.018)),('legL','hip',(-.035,.133,.703),(.105,.11,.015)),('legR','hip',(-.035,-.133,.703),(.105,.11,.015))]:
    o=ell('stump_'+key,p,sz,'blood',parent,seg=12,rings=6);o['stumpFor']=key;o['hidden']=True;o.scale=(0,0,0)
# Apply smooth forms, then reduce redundant geometry to a 36k game mesh.
raw=sum(len(f.vertices)-2 for o in objects for f in o.data.polygons)
ratio=min(1.0,35000/raw)
for o in objects:
    if sum(len(f.vertices)-2 for f in o.data.polygons)>80:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('game mesh reduction','DECIMATE');mod.ratio=ratio
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
if a.pose:
    parts['armL'].rotation_euler.x=.48
    parts['foreArmL'].rotation_euler.y=-.68
    parts['legR'].rotation_euler.y=-.38
    # Requested left cap visible; left limb ghosted away for a clear amputation test.
    for o in objects:
        parent=o.parent
        while parent:
            if parent==parts['armL']:o.hide_render=True;break
            parent=parent.parent
    cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
    # Detached left assembly also displayed offset, preserving the visibly rotated elbow.
    parts['armL'].location.y+=.34
    for o in objects:
        if o.hide_render:o.hide_render=False
if a.render and a.view=='turnaround':
    # Assemble already-rendered camera views in Blender, without another GPU render.
    import numpy as np
    paths=[P/'renders'/n for n in ['front.png','side.png','back.png','review-hero.png']]
    panels=[]
    for path in paths:
        im=bpy.data.images.load(str(path));w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-420)//2:(w+420)//2,:])
    data=np.concatenate(panels,axis=1);sheet=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
    sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=a.render;sheet.file_format='PNG';sheet.save()
    print('OK turnaround');sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),460,(1,.83,.69),3);light('cool fill',(1,4,3),260,(.63,.72,1),3);light('amber rim',(-3,1,3.5),600,(1,.46,.2),2)
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='studio_floor';ground.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,2.9),'front':(6,0,1.35),'side':(0,-6,1.35),'back':(-6,0,1.35)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((-.06,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.95*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='METAL';prefs.get_devices()
        for d in prefs.devices:d.use=True
        S.cycles.device='GPU'
    except Exception:pass
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG';S.render.filepath=a.render;bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(objects),'meshes')
