"""Hero infected police shepherd. Deterministic, rigid joints, applied sculpt smoothing.
Blender +X forward, -Y right, feet Z=0. Run only through blender_run.py.
Humanoid infected joints map to the dog's front/rear legs; quadruped aliases coexist.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser()
for n in ['render','glb']: ap.add_argument('--'+n)
ap.add_argument('--view',default='hero');ap.add_argument('--pose',action='store_true');ap.add_argument('--lod',type=int,choices=[0,1,2],default=0)
ap.add_argument('--samples',type=int,default=24);ap.add_argument('--width',type=int,default=960);ap.add_argument('--height',type=int,default=540)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene;parts={};objects=[];tuft_counter=0
palette=json.loads((P.parents[1]/'src/assets/palette.json').read_text())
def material(token,rough=.65,metal=0,emit=0):
    m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token);m.use_nodes=True
    rgb=[int(palette[token][i:i+2],16)/255 for i in (1,3,5)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]+[1]
    bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=c;bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    if emit:bs.inputs['Emission Color'].default_value=c;bs.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=c;return m
M={n:material(n) for n in ['shoeTan','khakiLight','woodWarm','leather','uiDark','navy','navySeam','blueTrim','blood','redDark','mouth','corgiPink','corgiTongue','picketWhite']}
M['eye']=material('infectedEye',.23,emit=4);M['silver']=material('silver',.35,.65);M['brass']=material('brass',.4,.6)
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o
node('root',(0,0,0));node('hip',(-.46,0,.65),'root');node('torso',(.13,0,.68),'hip');node('body',(0,0,.7),'torso');node('neck',(.39,0,.82),'torso');node('head',(.45,0,.92),'neck');node('jaw',(.58,0,.83),'head');node('tail',(-.73,0,.73),'hip');node('backpackSocket',(-.15,0,1),'torso');node('front',(.99,0,.94),'head')
def finish(o,n,m,par,sub=0):
    o.name=n;o.data.materials.append(M[m]);bpy.context.view_layer.objects.active=o
    if sub and a.lod==0:
        mod=o.modifiers.new('applied sculpt surface','SUBSURF');mod.levels=sub;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    objects.append(o);return o
def ell(n,p,sz,m,par,rot=None,seg=12,rings=8):
    if a.lod:seg,rings=([8,6] if a.lod==1 else [6,4])
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p);o=bpy.context.object;o.scale=sz
    if rot:o.rotation_euler=rot
    return finish(o,n,m,par,1)
def mesh(n,v,f,m,par,sub=1):
    me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);S.collection.objects.link(o);return finish(o,n,m,par,sub)
def tube(n,pts,radii,m,par,N=8,sub=1):
    if a.lod:N=6 if a.lod==1 else 4
    v=[];f=[]
    for j,p in enumerate(pts):
        tangent=(Vector(pts[min(j+1,len(pts)-1)])-Vector(pts[max(0,j-1)])).normalized();u=tangent.cross(Vector((1,0,0)))
        if u.length<.1:u=tangent.cross(Vector((0,1,0)))
        u.normalize();w=tangent.cross(u);r=radii[j];rx,ry=(r,r) if isinstance(r,(float,int)) else r
        for i in range(N):v.append(Vector(p)+u*rx*math.cos(i*2*math.pi/N)+w*ry*math.sin(i*2*math.pi/N))
    for j in range(len(pts)-1):
        for i in range(N):k=j*N+i;kk=j*N+(i+1)%N;f.append((k,kk,kk+N,k+N))
    f.extend([tuple(range(N-1,-1,-1)),tuple((len(pts)-1)*N+i for i in range(N))]);return mesh(n,v,f,m,par,sub)
def box(n,p,size,m,par,b=.015,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot:o.rotation_euler=rot
    mod=o.modifiers.new('soft bevel','BEVEL');mod.width=b;mod.segments=3 if a.lod==0 else 1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,n,m,par)
def tuft(n,start,bend,tip,width,m,par):
    global tuft_counter
    tuft_counter+=1
    if a.lod and tuft_counter%(3 if a.lod==1 else 5):return None
    p,q,t=map(Vector,[start,bend,tip]);return tube(n,[p,p.lerp(q,.6),q,q.lerp(t,.65),t],[.012,(width*.68,width*.48),(width,width*.5),(width*.44,width*.28),.0015],m,par)
def text(n,word,p,size,par,orientation):
    if a.lod==2:return None
    d=bpy.data.curves.new(n,'FONT');d.body=word;d.align_x='CENTER';d.align_y='CENTER';d.size=size;d.extrude=.0015;d.bevel_depth=.0006;d.bevel_resolution=1
    o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;o.rotation_euler=orientation;bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return finish(o,n,'picketWhite',par)
# Strong barrel chest and tapered rear, with large separate shoulder and thigh volumes.
ell('ribcage',(-.05,0,.71),(.64,.255,.3),'shoeTan','body',seg=20,rings=12)
ell('rump',(-.5,0,.66),(.3,.25,.25),'woodWarm','hip')
ell('chest',(.33,0,.64),(.25,.285,.3),'shoeTan','torso')
ell('neck_ruff',(.38,0,.86),(.29,.26,.28),'woodWarm','neck')
ell('dark_saddle',(-.2,0,.89),(.54,.258,.155),'leather','body')
# Front and digitigrade back legs, each pivot centered inside the sculpted joint.
for side,s in [('L',1),('R',-1)]:
    shoulder=(.3,s*.25,.72);elbow=(.36,s*.345,.4);wrist=(.48,s*.435,.14)
    node('arm'+side,shoulder,'torso');node('legF'+side,shoulder,'arm'+side)
    node('foreArm'+side,elbow,'legF'+side);node('hand'+side,wrist,'foreArm'+side);node('pawF'+side,wrist,'hand'+side)
    tube('front_upper'+side,[shoulder,(.32,s*.292,.63),elbow],[.125,.135,.09],'shoeTan','legF'+side,N=12)
    tube('front_lower'+side,[elbow,(.4,s*.39,.28),wrist],[.092,.075,.067],'khakiLight','foreArm'+side,N=12)
    ell('front_shoulder'+side,(.27,s*.28,.65),(.15,.13,.21),'woodWarm','arm'+side)
    hip=(-.46,s*.185,.65);knee=(-.31,s*.245,.38);hock=(-.61,s*.26,.19);ankle=(-.54,s*.285,.115)
    node('leg'+side,hip,'hip');node('legB'+side,hip,'leg'+side);node('shin'+side,knee,'legB'+side);node('foot'+side,ankle,'shin'+side);node('pawB'+side,ankle,'foot'+side)
    tube('rear_thigh'+side,[hip,(-.43,s*.235,.57),knee],[.15,.16,.1],'shoeTan','legB'+side,N=12)
    tube('rear_shin'+side,[knee,(-.43,s*.26,.29),hock,ankle],[.091,.077,.06,.055],'khakiLight','shin'+side,N=12)
    for front,x,y,par in [(True,.52,s*.435,'pawF'+side),(False,-.5,s*.285,'pawB'+side)]:
        ell('paw'+par,(x,y,.084),(.157 if front else .12,.125 if front else .105,.085),'shoeTan',par)
        ell('paw_pad'+par,(x+.02,y,.027),(.128 if front else .115,.109 if front else .093,.026),'leather',par)
        for j in range(4):
            yy=y+(j-1.5)*(.052 if front else .045);xx=x+.075+( .015 if j in [1,2] else 0)
            ell('toe'+par+str(j),(xx,yy,.065),(.063,.031,.052),'khakiLight',par,seg=10,rings=6)
            tube('claw'+par+str(j),[(xx+.03,yy,.062),(xx+.067,yy,.045),(xx+.077,yy,.026)],[.017,.015,.002],'uiDark',par)
    for j in range(5):
        z=.64-j*.075;x=.31+j*.022;y=s*(.338+j*.015+.015*(j%2))
        tuft('front_fur'+side+str(j),(x-.045,y*.93,z+.04),(x,y,z),(x-.055,y+s*.035,z-.07),.06,'shoeTan' if j%2 else 'khakiLight','arm'+side if j<3 else 'foreArm'+side)
    for j in range(7):
        x=-.52+(j%3)*.075;z=.62-(j//3)*.12;y=s*(.28+.01*(j%2))
        tuft('haunch_fur'+side+str(j),(x+.04,y*.8,z+.05),(x,y,z),(x-.1,y+s*.03,z-.05),.069,'woodWarm' if j%3==0 else 'shoeTan','leg'+side)
# Head: broad skull, distinct shepherd stop, dimensional muzzle and an open jaw.
ell('skull',(.51,0,1.005),(.265,.22,.245),'shoeTan','head',seg=20,rings=12)
ell('forehead_mask',(.64,0,1.115),(.154,.174,.15),'woodWarm','head')
ell('muzzle_bridge',(.74,0,.994),(.195,.117,.087),'woodWarm','head')
ell('mouth_interior',(.686,0,.825),(.105,.098,.105),'uiDark','head')
ell('lower_jaw',(.756,0,.793),(.18,.118,.049),'woodWarm','jaw')
ell('lower_gum',(.782,0,.823),(.142,.099,.016),'mouth','jaw')
ell('tongue',(.818,0,.835),(.086,.046,.017),'corgiTongue','jaw')
tube('tongue_groove',[(.86,0,.85),(.825,0,.853),(.785,0,.85)],[.002]*3,'redDark','jaw',N=6,sub=0)
for s in [-1,1]:
    ell('upper_muzzle'+str(s),(.828,s*.062,.955),(.108,.071,.065),'khakiLight','head')
    tube('snarl_lip'+str(s),[(.893,s*.075,.93),(.81,s*.121,.917),(.69,s*.126,.899)],[.012,.016,.008],'redDark','head')
    ell('eye_socket'+str(s),(.698,s*.14,1.075),(.031,.061,.06),'leather','head',rot=(0,0,s*.35))
    ell('red_eye_rim'+str(s),(.716,s*.151,1.077),(.022,.045,.046),'redDark','head')
    ell('eye_glow'+str(s),(.734,s*.151,1.081),(.022,.031,.034),'eye','head')
    ell('eye_hot_core'+str(s),(.752,s*.15,1.086),(.006,.012,.019),'picketWhite','head',seg=10,rings=6)
    tube('angry_brow'+str(s),[(.736,s*.095,1.11),(.724,s*.15,1.149),(.66,s*.2,1.144)],[.023,.033,.015],'leather','head')
    ell('cheek'+str(s),(.621,s*.19,.979),(.08,.06,.077),'khakiLight','head')
    # Pointed volumetric ear with a recessed pink insert, oriented towards +X.
    y=s*.155
    tube('ear_outer'+str(s),[(.47,y,1.12),(.452,y+s*.025,1.21),(.43,y+s*.045,1.35),(.455,y+s*.06,1.46)],[.078,(.07,.091),(.045,.055),.002],'leather','head',N=8)
    tube('ear_tan_edge'+str(s),[(.483,y-s*.059,1.155),(.478,y-s*.037,1.28),(.462,y+s*.06,1.457)],[.016,.022,.002],'woodWarm','head')
    tube('ear_inner'+str(s),[(.509,y,1.18),(.496,y+s*.02,1.24),(.474,y+s*.047,1.36),(.464,y+s*.053,1.406)],[(.018,.04),(.022,.058),(.012,.029),.002],'mouth','head',N=8)
    for j in range(4):
        z=1.055-j*.063
        tuft('cheek_ruff'+str(s)+str(j),(.61,s*.16,z+.04),(.6-j*.018,s*.252,z),(.45-j*.015,s*(.31-j*.007),z-.067),.074,'khakiLight' if j%2 else 'shoeTan','head')
    for j in range(4):
        x=.36-j*.052;z=.93-j*.042
        tuft('mane'+str(s)+str(j),(x+.03,s*.18,z+.075),(x,s*.27,z),(x-.095,s*.31,z-.105),.086,'leather' if j%2 else 'woodWarm','neck')
    for j in range(4):
        ell('whisker_dot'+str(s)+str(j),(.88-j*.033,s*(.102+.005*(j%2)),.961+.012*(j%2)),(.006,.004,.006),'leather','head',seg=8,rings=6)
    # Teeth curve along the exposed lateral mouth, with oversized canine fangs.
    for j in range(6):
        x=.887-j*.034;y=s*(.055+.047*math.sin(j*math.pi/7));z=.901-.011*(j/5)
        length=.09 if j==1 else .047
        tube('upper_tooth'+str(s)+str(j),[(x,y,z),(x+.001,y,z-.012),(x-.009,y,z-length)],[.015,.014,.0015],'picketWhite','head')
        z=.833+.006*(j/5);length=.068 if j==2 else .037
        tube('lower_tooth'+str(s)+str(j),[(x-.018,y*.91,z),(x-.018,y*.91,z+.009),(x-.012,y*.9,z+length)],[.012,.011,.0015],'picketWhite','jaw')
ell('nose',(.937,0,.987),(.057,.071,.035),'uiDark','head',seg=16,rings=10)
for s in [-1,1]:ell('nostril'+str(s),(.976,s*.036,.984),(.008,.017,.01),'leather','head')
tube('nose_septum',[(.983,0,.983),(.963,0,.963),(.933,0,.947)],[.006,.008,.004],'uiDark','head')
# The front incisor rows frame an actual open gap rather than a dark surface over teeth.
for j in range(4):
    y=(j-1.5)*.028
    tube('front_upper_incisor'+str(j),[(.911,y,.91),(.916,y,.891),(.909,y,.868)],[.012,.013,.003],'picketWhite','head')
    tube('front_lower_incisor'+str(j),[(.901,y,.833),(.908,y,.851),(.908,y,.869)],[.012,.011,.003],'picketWhite','jaw')
# Outer shoulder tufts break up the large smooth upper leg volumes.
for side,sign in [('L',1),('R',-1)]:
    for j in range(7):
        z=.69-j*.036;y=sign*(.4-(j//3)*.017)
        tuft('outer_leg_coat'+side+str(j),(.27,y*.88,z+.044),(.31,y,z),(.32-j*.004,y+sign*.032,z-.062),.052,'shoeTan' if j%2 else 'khakiLight','arm'+side)
# Sculpted dark shepherd mask and layered neck mane.
for sign in [-1,1]:
    ell('temple_mask'+str(sign),(.542,sign*.172,1.095),(.14,.061,.129),'leather','head',rot=(0,.2,0))
    for j in range(5):
        z=1.105-j*.059
        tuft('dark_mane'+str(sign)+str(j),(.395,sign*.14,z+.043),(.35,sign*.243,z),(.225,sign*.302,z-.062),.079,'leather' if j<3 else 'woodWarm','neck')
    for j in range(3):
        x=.22-j*.061;z=1.06+(.017 if j%2 else 0)
        tuft('shoulder_fur'+str(sign)+str(j),(x+.02,sign*.205,z-.08),(x,sign*.27,z),(x-.08,sign*.305,z+.043),.052,'leather' if j%2 else 'woodWarm','neck' if j<3 else 'body')
    for j in range(3):
        tuft('paw_ruff'+str(sign)+str(j),(.4,sign*(.382+j*.027),.19),(.46,sign*(.39+j*.03),.174),(.52,sign*(.405+j*.03),.143),.036,'shoeTan','hand'+('L' if sign==1 else 'R'))
for j in range(3):
    tuft('forehead_stripe'+str(j),(.59,(j-1)*.058,1.255),(.703,(j-1)*.047,1.246),(.788,(j-1)*.028,1.143),.025,'leather','head')
# Coarse thick fur leaves follow the silhouette, never thin hair cards.
for j in range(7):
    y=(j-3)*.043
    tuft('crown'+str(j),(.49,y,1.17),(.46,y,1.238+(j%2)*.02),(.385,y+.014,1.279+(j%3)*.018),.041,'woodWarm' if j%3 else 'shoeTan','head')
for s in [-1,1]:
    for j in range(8):
        x=-.72+j*.075;z=.7+(j%3)*.05
        tuft('rear_coat'+str(s)+str(j),(x+.06,s*.175,z+.04),(x,s*.265,z),(x-.09,s*.29,z-.065),.065,'leather' if j in [2,5] else 'woodWarm' if j%2 else 'shoeTan','hip')
    for j in range(6):
        x=.34-j*.05;z=.58-(j%2)*.035
        tuft('chest_ruff'+str(s)+str(j),(x,s*.14,z+.06),(x+.025,s*.25,z),(x-.025,s*.28,z-.1),.07,'khakiLight' if j%2 else 'shoeTan','torso')
# Raised bushy tail, dark back and golden undersides.
tailpts=[(-.7,0,.73),(-.89,0,.74),(-1.08,0,.83),(-1.24,0,.99),(-1.34,0,1.13)]
tube('tail_core',tailpts,[.10,.14,.125,.09,.002],'leather','tail',N=12)
for s in [-1,1]:
    for j in range(7):
        x=-.83-j*.065;z=.75+j*.042
        tuft('tail_plume'+str(s)+str(j),(x+.06,s*.025,z),(x,s*.08,z+.014),(x-.16,s*.11,z+.083),.105,'shoeTan' if j%2 else 'woodWarm','tail')
for j in range(4):
    x=-.97-j*.085;z=.87+j*.075
    tuft('tail_top'+str(j),(x+.07,0,z-.07),(x,0,z),(x-.09,0,z+.095),.061,'leather','tail')
# Thick contoured navy vest shell, open below the belly with rolled bound edges.
def vest_shell():
    N=[17,9,7][a.lod];v=[];f=[]
    for x,ry,rz in [(-.55,.29,.3),(-.52,.315,.33),(-.1,.323,.35),(.21,.329,.35),(.27,.32,.33)]:
        for i in range(N):
            t=-.25+(math.pi+.5)*i/(N-1);v.append((x,ry*math.cos(t),.745+rz*math.sin(t)))
    for j in range(4):
        for i in range(N-1):f.append((j*N+i,j*N+i+1,(j+1)*N+i+1,(j+1)*N+i))
    o=mesh('vest_shell',v,f,'navy','body',1);mod=o.modifiers.new('padded shell thickness','SOLIDIFY');mod.thickness=.026;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
vest_shell()
for x in [-.51,.24]:
    pts=[(x,.324*math.cos(t),.745+.344*math.sin(t)) for t in [-.24+i*(math.pi+.48)/24 for i in range(25)]]
    tube('bound_vest_edge'+str(x),pts,[.016]*25,'blueTrim','body',N=6,sub=0)
for s in [-1,1]:
    box('side_patch_frame'+str(s),(-.09,s*.329,.815),(.385,.026,.15),'navySeam','body',.017)
    box('side_patch'+str(s),(-.09,s*.348,.815),(.355,.016,.121),'uiDark','body',.009)
    # Local X follows the side, text outward normal +/-Y, local Y = world Z.
    text('POLICE_side'+str(s),'POLICE',(-.09,s*.361,.815),.081,'body',(math.pi/2,0,0 if s==-1 else math.pi))
    for x in [-.42,.16]:
        tube('girth_strap'+str(s)+str(x),[(x,s*.24,.971),(x,s*.336,.88),(x,s*.33,.68),(x,s*.21,.5)],[.027,.03,.03,.024],'blueTrim','body',N=8)
        box('strap_buckle'+str(s)+str(x),(x,s*.345,.713),(.078,.034,.07),'silver','body',.012)
        box('buckle_inner'+str(s)+str(x),(x,s*.367,.713),(.045,.013,.039),'uiDark','body',.006)
        for z in [.78,.81,.91]:box('webbing_stitch'+str(s)+str(x)+str(z),(x,s*.338,z),(.027,.006,.005),'navySeam','body',.002)
    tube('shoulder_strap'+str(s),[(.06,s*.19,1.014),(.3,s*.25,1.02),(.59,s*.22,.798),(.585,s*.11,.577)],[.035]*4,'blueTrim','torso',N=8)
    box('shoulder_buckle'+str(s),(.276,s*.203,1.008),(.094,.07,.033),'silver','torso',.01,rot=(0,.23,0))
    box('shoulder_buckle_inset'+str(s),(.28,s*.203,1.03),(.05,.038,.016),'uiDark','torso',.004,rot=(0,.23,0))
# Front bib, bound panel, identity patch, ring and collar tag.
box('chest_bib',(.592,0,.601),(.058,.35,.174),'navy','torso',.045,rot=(0,-.12,0))
box('chest_patch_frame',(.629,0,.622),(.024,.286,.116),'navySeam','torso',.012)
box('chest_patch',(.645,0,.624),(.015,.266,.096),'uiDark','torso',.01)
text('POLICE_chest','POLICE',(.659,0,.624),.066,'torso',(math.pi/2,0,math.pi/2))
box('carry_handle_base',(-.1,0,1.105),(.25,.10,.024),'blueTrim','body',.01)
tube('carry_handle',[(-.22,0,1.122),(-.2,0,1.174),(-.01,0,1.174),(.015,0,1.122)],[.02]*4,'uiDark','body',N=8)
for x in [-.38,.07]:
    box('top_webbing'+str(x),(x,0,1.1),(.048,.4,.026),'blueTrim','body',.01)
    for s in [-1,1]:box('top_loop'+str(x)+str(s),(x,s*.1,1.125),(.07,.09,.029),'navySeam','body',.007)
tube('collar',[(.46,.18,.88),(.53,.1,.735),(.54,0,.704),(.53,-.1,.735),(.46,-.18,.88)],[.024]*5,'uiDark','neck',N=10)
ell('dog_tag',(.558,-.043,.694),(.012,.034,.04),'brass','neck')
# Ragged infected wound islands, inset-colored beds with raised torn fur margins.
for s in [-1,1]:
    for k,(x,y,z,par) in enumerate([(.368,s*.421,.405,'foreArm'+('L' if s==1 else 'R')),(-.59,s*.272,.641,'leg'+('L' if s==1 else 'R'))]):
        ell('wound_dark'+str(s)+str(k),(x,y,z),(.07,.018,.077),'redDark',par)
        ell('wound_blood'+str(s)+str(k),(x+.01,y+s*.011,z),(.046,.012,.052),'blood',par)
        for j in range(5):
            t=j*2*math.pi/5;xx=x+.057*math.cos(t);zz=z+.068*math.sin(t)
            tuft('wound_rag'+str(s)+str(k)+str(j),(xx+.01,y,zz+.02),(xx,y+s*.019,zz),(xx-.025,y+s*.027,zz-.025),.022,'woodWarm',par)
    tube('chin_blood'+str(s),[(.857,s*.09,.792),(.84,s*.1,.755),(.82,s*.09,.718)],[.009,.008,.002],'blood','jaw')
# Stump caps live on the proximal joint and export hidden via zero scale + extras.
caps=[]
for key,par,p,sz in [('head','neck',(.654,0,.984),(.014,.14,.135)),('armL','torso',(.3,.289,.72),(.088,.018,.088)),('armR','torso',(.3,-.289,.72),(.088,.018,.088)),('foreArmL','armL',(.36,.345,.4),(.07,.07,.014)),('foreArmR','armR',(.36,-.345,.4),(.07,.07,.014)),('legL','hip',(-.46,.27,.65),(.1,.018,.1)),('legR','hip',(-.46,-.27,.65),(.1,.018,.1))]:
    o=ell('stump_'+key,p,sz,'blood',par);o['stumpFor']=key;o['hidden']=True;caps.append(o)
# Equivalent quadruped stump names share the same cut surfaces.
for quad,human in [('legFL','armL'),('legFR','armR'),('legBL','legL'),('legBR','legR')]:
    original=bpy.data.objects['stump_'+human];o=original.copy();o.data=original.data.copy();S.collection.objects.link(o);o.name='stump_'+quad;o['stumpFor']=quad;caps.append(o);objects.append(o)
# Open the hinged lower jaw to match the reference's wide snarl.
parts['jaw'].location.z-=.075
# Reduce oversampling while retaining applied subdivision and smooth sculpted silhouettes.
for o in objects:
    if len(o.data.polygons)>100:
        bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('game density','DECIMATE');mod.ratio=.19;bpy.ops.object.modifier_apply(modifier=mod.name)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));tiny=[f for f in bm.faces if f.calc_area()<1e-10]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
    bm.to_mesh(o.data);bm.free()
# Merge decorative meshes by rigid parent, retaining palette slots; joints/caps stay named.
buckets={}
for o in objects:
    if o not in caps:buckets.setdefault((o.parent.name,o.data.materials[0].name.startswith('emi_')),[]).append(o)
joined=[]
for (par,emissive),group in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]
    if len(group)>1:bpy.ops.object.join()
    group[0].name=par+('__eyes' if emissive else '__surface');joined.append(group[0])
objects=joined+caps
# Animal crowd budgets: reduce the applied sculpt by rigid surface, preserving nodes.
# LOD0 retains chunky volumetric fur and the face; LOD1/2 progressively collapse detail.
for o in objects:
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('animal LOD budget','DECIMATE');mod.ratio=([.55,.8,.6] if o.name.endswith('__eyes') else [.285,.22,.35])[a.lod]
    bpy.ops.object.modifier_apply(modifier=mod.name)
# Ground every paw exactly while preserving ankle pivots and the leg hierarchy.
bpy.context.view_layer.update()
for paw in ['pawFL','pawFR','pawBL','pawBR']:
    surfaces=[o for o in joined if o.parent==parts[paw]]
    floor=min((o.matrix_world@v.co).z for o in surfaces for v in o.data.vertices)
    parts[paw].location.z-=floor
bpy.context.view_layer.update()
for o in caps:o.scale=(0,0,0)
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket']+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]+['body','neck','jaw','tail','legFL','legFR','legBL','legBR','pawFL','pawFR','pawBL','pawBR','stump_legFL','stump_legFR','stump_legBL','stump_legBR']
triangles=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
stats={'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in bpy.data.objects]}
(P/('build-stats.json' if a.lod==0 else f'lod{a.lod}-stats.json')).write_text(json.dumps(stats,indent=2))
bpy.context.view_layer.update()
(P/('rig-rest.json' if a.lod==0 else f'lod{a.lod}-rig.json')).write_text(json.dumps({'pivots':{n:list(o.matrix_world.translation) for n,o in parts.items()},'required':required},indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
def pose():
    parts['armL'].rotation_euler.x=-.45;parts['foreArmL'].rotation_euler.y=-.65;parts['legR'].rotation_euler.y=.4;parts['jaw'].rotation_euler.y=.16
    # A removed right front leg exposes its stationary proximal cap.
    for o in objects:
        p=o.parent
        while p:
            if p==parts['armR']:o.hide_render=True;break
            p=p.parent
    for n in ['stump_armL','stump_armR']:bpy.data.objects[n].scale=(1,1,1);bpy.data.objects[n]['hidden']=False
if a.pose:pose()
def turnaround(out):
    import numpy as np
    panels=[]
    for name in ['front','side','back','review-hero']:
        im=bpy.data.images.load(str(P/'renders'/f'{name}.png'));w,h=im.size;p=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(p);panels.append(p.reshape(h,w,4))
    data=np.concatenate(panels,axis=1);im=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0]);im.pixels.foreach_set(data.ravel());im.filepath_raw=str(out);im.file_format='PNG';im.save()
if a.render and a.view=='turnaround':turnaround(a.render);print('OK turnaround');sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.07,.065,.09,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
    light('key',(3,-4,5),500,(1,.82,.65),3);light('fill',(0,4,3),300,(.62,.72,1),3);light('rim',(-3,1,3),650,(1,.45,.19),2)
    bpy.ops.mesh.primitive_plane_add(size=200);o=bpy.context.object;o.data.materials.append(M['uiDark'])
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(5,-7,3.4),'front':(6,0,1.8),'side':(0,-6,1.7),'back':(-6,0,1.8)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((-.15,0,.72))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.1*a.width/a.height
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True;S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100;S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG';S.render.filepath=a.render
    if a.view in ['review-all','final-all']:
        for view in ['front','side','back','hero']:
            cam.location=views[view];cam.rotation_euler=(Vector((-.15,0,.72))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.render.filepath=str(P/'renders'/('review-hero.png' if view=='hero' else view+'.png'));bpy.ops.render.render(write_still=True)
        bpy.data.images['Render Result'].save_render(a.render,scene=S)
        if a.view=='final-all':
            turnaround(P/'renders/turnaround.png')
            S.cycles.samples=96;S.render.resolution_x=1600;S.render.resolution_y=900;S.render.filepath=str(P/'renders/hero.png');bpy.ops.render.render(write_still=True)
            pose();S.cycles.samples=24;S.render.resolution_x=960;S.render.resolution_y=540;S.render.filepath=str(P/'renders/pose-test.png');bpy.ops.render.render(write_still=True)
    else:bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(objects),'meshes')
