"""Mrs. Alvarez hero asset. Deterministic rigid joints; +X forward, Z up.
All sculpt subdivision and bevels are applied; palette-only, texture-free GLB.
Run exclusively through experiment/tools/blender_run.py.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector, Matrix
P = Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
for flag in ['render', 'glb']: ap.add_argument('--'+flag)
ap.add_argument('--view', default='hero')
ap.add_argument('--samples', type=int, default=24)
ap.add_argument('--width', type=int, default=960)
ap.add_argument('--height', type=int, default=540)
ap.add_argument('--pose', action='store_true')
a = ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene
parts, objects = {}, []
def material(token, color, rough=.72):
    m = bpy.data.materials.new('pal_'+token); m.use_nodes=True
    c = [int(color[i:i+2],16)/255 for i in (0,2,4)]
    c = [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
    b=m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value=c
    b.inputs['Roughness'].default_value=rough; m.diffuse_color=c
    return m
# Global tokens plus reference-specific wardrobe/skin extensions, declared in materials.json.
colors={'shoeTan':'cf9b62','skinWarm':'e9a77f','skinBlush':'d88773','cardiganLavender':'a374be',
        'cardiganTrim':'bc91cf','trouserViolet':'625874','hairSilver':'9b939f',
        'hairHighlight':'c0b3c2','hairShadow':'79747f','apronSage':'7b8960',
        'apronOlive':'657448','gloveKhaki':'97906a','pocketRose':'dbb3ad',
        'woodWarm':'b0703f','picketWhite':'f2e6dc','schoolBusYellow':'f2b630',
        'uiDark':'25222c','asphalt':'5b4f5c','grass':'6f8f3a','survivorRed':'d9363e'}
M={k:material(k,v,.35 if k=='uiDark' else .73) for k,v in colors.items()}
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None); S.collection.objects.link(o);o.location=p
    bpy.context.view_layer.update()
    if par: o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o; return o

def finish(o,n,m,par,sub=0):
    o.name=n;o.data.materials.append(M[m]);bpy.context.view_layer.objects.active=o
    if sub:
        mod=o.modifiers.new('applied sculpt smoothing','SUBSURF');mod.levels=sub
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    objects.append(o);return o

def ell(n,p,sz,m,par,rot=None,seg=12,rings=8,sub=1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p)
    o=bpy.context.object;o.scale=sz
    if rot:o.rotation_euler=rot
    return finish(o,n,m,par,sub)

def box(n,p,sz,m,par,bevel=.012,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=sz
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot:o.rotation_euler=rot
    mod=o.modifiers.new('soft cloth edge','BEVEL');mod.width=bevel;mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,n,m,par)

def mesh(n,v,f,m,par,sub=1):
    me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update()
    o=bpy.data.objects.new(n,me);S.collection.objects.link(o)
    return finish(o,n,m,par,sub)

def tube(n,points,radii,m,par,N=8,sub=1):
    v=[];f=[]
    for j,p in enumerate(points):
        t=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(j-1,0)]);t.normalize()
        u=t.cross(Vector((1,0,0)))
        if u.length<.1:u=t.cross(Vector((0,1,0)))
        u.normalize();w=t.cross(u);r=radii[j];rx,ry=(r,r) if isinstance(r,(float,int)) else r
        for i in range(N):v.append(Vector(p)+u*rx*math.cos(i*2*math.pi/N)+w*ry*math.sin(i*2*math.pi/N))
    for j in range(len(points)-1):
        for i in range(N):k=j*N+i;kk=j*N+(i+1)%N;f.append((k,kk,kk+N,k+N))
    f += [tuple(range(N-1,-1,-1)),tuple((len(points)-1)*N+i for i in range(N))]
    return mesh(n,v,f,m,par,sub)

def patch(n,pts,m,par,thick=.009):
    N=len(pts);v=pts+[(p[0]-thick,p[1],p[2]) for p in pts]
    f=[tuple(range(N)),tuple(range(2*N-1,N-1,-1))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
    o=mesh(n,v,f,m,par,0);mod=o.modifiers.new('rounded applique','BEVEL');mod.width=.004;mod.segments=3
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name);return o

node('root',(0,0,0));node('hip',(0,0,.57),'root');node('torso',(0,0,.68),'hip')
node('head',(0,0,1.045),'torso');node('backpackSocket',(-.17,0,.93),'torso')
parts['root']['assetId']='npc.mrs-alvarez';parts['root']['forward']='+X'
ell('pelvis',(0,0,.577),(.143,.187,.1),'trouserViolet','hip')
ell('cardigan_body',(-.007,0,.824),(.167,.2,.228),'cardiganLavender','torso',seg=18,rings=12)
ell('neck',(0,0,1.037),(.062,.068,.079),'skinWarm','head')
# Separate collar leaves, raised placket, seams, and cardigan hem.
for s in [-1,1]:
    patch('collar'+str(s),[(.10,s*.025,1.055),(.10,s*.094,1.071),(.14,s*.158,1.007),(.174,s*.074,.986)],'cardiganTrim','torso',.018)
    tube('collar_edge'+str(s),[(.118,s*.03,1.047),(.125,s*.096,1.064),(.15,s*.15,1.015)],[.005]*3,'cardiganLavender','torso')
    tube('cardigan_side_seam'+str(s),[(-.06,s*.193,.64),(-.043,s*.206,.8),(-.046,s*.186,.98)],[.003]*3,'cardiganTrim','torso',sub=0)
box('placket',(.16,0,.913),(.025,.032,.15),'cardiganTrim','torso',.007)
for i in range(3):ell('cardigan_button'+str(i),(.182,0,.884+i*.042),(.006,.009,.009),'picketWhite','torso',seg=8,rings=6)
# Chunky relaxed sleeves, rolled cuffs, gloved palms and articulated finger volumes.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(0,s*.193,.965); elbow=(.015,s*.282,.803); wrist=(.026,s*.32,.659)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    tube('cardigan_upper'+side,[shoulder,(0,s*.237,.929),elbow],[.083,.089,.071],'cardiganLavender','arm'+side,N=12)
    tube('cardigan_lower'+side,[elbow,(.014,s*.302,.745),(.02,s*.312,.706)],[.076,.081,.071],'cardiganLavender','foreArm'+side,N=12)
    tube('rolled_sleeve'+side,[(.013,s*.299,.754),(.018,s*.313,.715),(.02,s*.318,.702)],[.081,.083,.072],'cardiganTrim','foreArm'+side,N=12)
    tube('exposed_wrist'+side,[(.02,s*.314,.709),(.023,s*.317,.681),wrist],[.05,.048,.047],'skinWarm','foreArm'+side,N=10)
    for j in range(2):
        tube('sleeve_fold'+side+str(j),[(.071,s*.255,.87-j*.059),(.088,s*.274,.855-j*.06),(.059,s*.287,.84-j*.059)],[.006,.012,.004],'cardiganTrim','arm'+side if j==0 else 'foreArm'+side)
    tube('glove_cuff'+side,[(.025,s*.321,.675),(.027,s*.327,.651)],[.062,.061],'gloveKhaki','hand'+side,N=12)
    ell('glove_palm'+side,(.027,s*.334,.608),(.055,.058,.069),'gloveKhaki','hand'+side)
    for j in range(4):
        y=s*(.298+j*.023);length=[.048,.063,.059,.045][j]
        tube('glove_finger'+side+str(j),[(.037,y,.598),(.047,y,.575),(.056,y,.598-length),(.073,y,.596-length)],[.017,.018,.016,.011],'gloveKhaki','hand'+side)
    tube('glove_thumb'+side,[(.033,s*.288,.633),(.073,s*.279,.611),(.08,s*.29,.581)],[.027,.022,.015],'gloveKhaki','hand'+side)
    tube('glove_cuff_trim'+side,[(.081,s*.287,.667),(.088,s*.325,.671),(.081,s*.365,.663)],[.003]*3,'apronOlive','hand'+side,sub=0)
    ell('elbow_joint'+side,elbow,(.068,.068,.07),'cardiganLavender','foreArm'+side)
    ell('shoulder_joint'+side,shoulder,(.078,.083,.083),'cardiganLavender','arm'+side)
    node('weaponSocket'+side,(.072,s*.328,.6),'hand'+side)
    hip=(0,s*.102,.572);knee=(.005,s*.126,.359);ankle=(0,s*.136,.141)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('trouser_thigh'+side,[hip,(0,s*.11,.51),knee],[.093,.098,.084],'trouserViolet','leg'+side,N=12)
    ell('knee_joint'+side,knee,(.079,.08,.086),'trouserViolet','shin'+side)
    tube('trouser_calf'+side,[knee,(0,s*.137,.264),(.005,s*.136,.182)],[.087,.087,.077],'trouserViolet','shin'+side,N=12)
    tube('rolled_trouser'+side,[(.005,s*.136,.209),(.005,s*.136,.174)],[.087,.086],'cardiganTrim','shin'+side,N=12)
    tube('ankle_skin'+side,[(0,s*.136,.167),(0,s*.136,.126)],[.053,.049],'skinWarm','foot'+side,N=10)
    box('shoe_sole'+side,(.037,s*.139,.028),(.26,.173,.056),'woodWarm','foot'+side,.017)
    box('shoe_welt'+side,(.037,s*.139,.057),(.256,.173,.027),'shoeTan','foot'+side,.012)
    ell('garden_shoe'+side,(.032,s*.139,.102),(.127,.085,.075),'woodWarm','foot'+side)
    ell('shoe_toecap'+side,(.111,s*.139,.089),(.063,.084,.043),'woodWarm','foot'+side)
    ell('shoe_tongue'+side,(-.003,s*.139,.154),(.058,.05,.022),'shoeTan','foot'+side)
    for j in range(3):
        tube('shoe_lace'+side+str(j),[(.075+j*.02,s*.103,.175-j*.006),(.08+j*.02,s*.14,.183-j*.007),(.082+j*.02,s*.176,.175-j*.006)],[.004]*3,'picketWhite','foot'+side,sub=0)
    # Raised stitching and quarter panels give the gardening shoes a finished silhouette.
    tube('shoe_quarter_seam'+side,[(-.062,s*.194,.086),(-.051,s*.201,.123),(-.011,s*.206,.147),(.034,s*.202,.132)],[.003]*4,'shoeTan','foot'+side,N=6,sub=0)
    tube('shoe_toe_seam'+side,[(.095,s*.068,.084),(.095,s*.092,.139),(.095,s*.139,.16),(.095,s*.185,.139),(.095,s*.21,.084)],[.003]*5,'shoeTan','foot'+side,N=6,sub=0)
    for j in range(3):
        for sign in [-1,1]:
            ell('shoe_eyelet'+side+str(j)+str(sign),(.078+j*.02,s*.139+sign*.04,.173-j*.006),(.006,.005,.004),'shoeTan','foot'+side,seg=8,rings=6,sub=0)
    for j in range(6):box('sole_tread'+side+str(j),(-.067+j*.038,s*.139,.009),(.018,.153,.016),'asphalt','foot'+side,.003)
    tube('trouser_fold'+side,[(.07,s*.08,.295),(.09,s*.133,.284),(.05,s*.19,.276)],[.005,.011,.003],'trouserViolet','shin'+side)
# Sculpted face: broad cheeks, inset warm eyes, round spectacles, lifted brows and smile.
ell('head_sculpt',(.008,0,1.206),(.167,.179,.182),'skinWarm','head',seg=24,rings=16)
ell('chin',(.077,0,1.093),(.099,.105,.061),'skinWarm','head',seg=16,rings=10)
for s in [-1,1]:
    ell('ear'+str(s),(-.006,s*.175,1.18),(.047,.03,.063),'skinWarm','head')
    ell('ear_inner'+str(s),(.025,s*.19,1.182),(.01,.014,.037),'skinBlush','head')
    ell('cheek'+str(s),(.123,s*.10,1.142),(.03,.048,.042),'skinWarm','head')
    ell('cheek_blush'+str(s),(.155,s*.114,1.151),(.0025,.022,.014),'skinBlush','head')
    ell('eye_white'+str(s),(.153,s*.071,1.239),(.031,.049,.051),'picketWhite','head',seg=16,rings=10)
    ell('iris'+str(s),(.184,s*.068,1.24),(.009,.026,.034),'woodWarm','head')
    ell('pupil'+str(s),(.194,s*.067,1.241),(.008,.017,.026),'uiDark','head')
    ell('eye_catchlight'+str(s),(.203,s*.06,1.256),(.004,.007,.009),'picketWhite','head',seg=8,rings=6)
    tube('brow'+str(s),[(.143,s*.03,1.305),(.151,s*.073,1.315),(.124,s*.12,1.302)],[.009,.012,.007],'hairShadow','head')
    pts=[(.202,s*.076+.063*math.cos(t),1.236+.058*math.sin(t)) for t in [i*2*math.pi/40 for i in range(41)]]
    tube('spectacle_rim'+str(s),pts,[.006]*41,'uiDark','head',N=8,sub=0)
    tube('spectacle_arm'+str(s),[(.2,s*.138,1.242),(.123,s*.166,1.241),(-.006,s*.184,1.223),(-.029,s*.187,1.202)],[.005]*4,'uiDark','head')
    ell('spectacle_hinge'+str(s),(.198,s*.14,1.243),(.009,.007,.008),'schoolBusYellow','head',seg=8,rings=6)
    tube('smile_crease'+str(s),[(.149,s*.07,1.129),(.16,s*.075,1.143),(.145,s*.077,1.153)],[.002,.004,.002],'skinBlush','head')
tube('spectacle_bridge',[(.204,-.016,1.241),(.214,0,1.251),(.204,.016,1.241)],[.005]*3,'uiDark','head')
ell('nose_bridge',(.166,0,1.206),(.025,.027,.048),'skinWarm','head')
ell('nose_tip',(.194,0,1.185),(.031,.035,.023),'skinWarm','head')
# Smile cavity is carved through the lower face, with a visible crescent of teeth.
bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=(.169,0,1.132))
cutter=bpy.context.object;cutter.scale=(.047,.069,.023);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for name in ['head_sculpt','chin']:
    o=bpy.data.objects[name];mod=o.modifiers.new('smile opening','BOOLEAN');mod.object=cutter;mod.operation='DIFFERENCE'
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True)
ell('smile_dark',(.146,0,1.135),(.028,.061,.02),'uiDark','head')
tube('lower_lip',[(.16,-.067,1.137),(.176,-.035,1.12),(.181,0,1.118),(.176,.035,1.12),(.16,.067,1.137)],[.004,.006,.007,.006,.004],'skinBlush','head')
for j in range(7):
    y=(j-3)*.016
    box('smile_tooth'+str(j),(.172-abs(y)*.15,y,1.14+abs(y)*.09),(.014,.014,.011),'picketWhite','head',.003)
# Blend cheeks, chin and cranium into one continuous sculpted skin surface.
face=[bpy.data.objects[n] for n in ['head_sculpt','chin','cheek-1','cheek1']]
bpy.ops.object.select_all(action='DESELECT')
for o in face:o.select_set(True)
for o in face[1:]:objects.remove(o)
bpy.context.view_layer.objects.active=face[0];bpy.ops.object.join()
face=face[0];bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
face.data.remesh_voxel_size=.0045;bpy.ops.object.voxel_remesh()
mod=face.modifiers.new('blended face sculpt','SMOOTH');mod.factor=.6;mod.iterations=4
bpy.ops.object.modifier_apply(modifier=mod.name)
for f in face.data.polygons:f.use_smooth=True
# Hair cap stays behind the forehead. Broad S-curved locks create a swept silver coiffure.
ell('hair_cap',(-.049,0,1.27),(.15,.186,.143),'hairShadow','head',seg=20,rings=14)
def lock(n,pts,width,m='hairSilver'):
    tube(n,pts,[.012,(width*.7,width*.45),(width,width*.5),(width*.7,width*.42),.003],m,'head',N=10)
for s in [-1,1]:
    for j in range(3):
        z=1.2+j*.057
        lock('side_wave'+str(s)+str(j),[(-.094,s*.13,z+.064),(-.011,s*.177,z+.052),(.066,s*.18,z+.025),(.115,s*.18,z-.003),(.135,s*.158,z+.013)],.052,'hairHighlight' if j==2 else 'hairSilver')
    lock('parted_fringe'+str(s),[(.015,s*.005,1.394),(.083,s*.04,1.398),(.137,s*.09,1.355),(.142,s*.145,1.309),(.09,s*.174,1.337)],.067,'hairHighlight')
    for j in range(3):
        lock('crown_sweep'+str(s)+str(j),[(-.107,s*.025,1.365-j*.022),(-.074,s*.085,1.393-j*.022),(-.045,s*.136,1.379-j*.03),(-.06,s*.178,1.312-j*.028),(-.119,s*.149,1.276-j*.036)],.045)
    tube('temple_wisp'+str(s),[(.065,s*.17,1.215),(.019,s*.198,1.2),(.027,s*.199,1.158)],[.012,.011,.003],'hairHighlight','head')
for j in range(3):
    y=(j-1)*.035
    lock('crown_wave'+str(j),[(-.134,y,1.396),(-.1,y+.013,1.426),(-.047,y+.016,1.428),(.009,y+.015,1.407),(.046,y+.013,1.391)],.037,'hairSilver' if j==1 else 'hairHighlight')
# Rear swept volumes and curled nape silhouette prevent the cap reading as a helmet.
for s in [-1,1]:
    for j in range(3):
        lock('rear_sweep'+str(s)+str(j),[(-.139,s*.017,1.369-j*.037),(-.203,s*.067,1.372-j*.04),(-.226,s*.111,1.317-j*.042),(-.183,s*.163,1.261-j*.036),(-.111,s*.171,1.248-j*.037)],.044,'hairHighlight' if j==0 else 'hairSilver')
for j in range(6):
    y=-.124+j*.05
    lock('nape_curl'+str(j),[(-.126,y,1.268),(-.19,y,1.235),(-.204,y,1.176),(-.175,y,1.134),(-.139,y,1.161)],.033,'hairSilver')
ell('hair_bun',(-.142,.035,1.364),(.105,.102,.086),'hairSilver','head',seg=16,rings=10)
for j in range(7):
    t=j*2*math.pi/7
    lock('bun_swirl'+str(j),[(-.155,.032,1.412),(-.18,.032+.054*math.cos(t),1.398+.028*math.sin(t)),(-.215,.032+.081*math.cos(t),1.36+.058*math.sin(t)),(-.18,.032+.04*math.cos(t+.8),1.338+.02*math.sin(t+.8)),(-.165,.035,1.346)],.034,'hairHighlight' if j%3==0 else 'hairSilver')
for j in range(8):
    t=j*math.pi/4
    tube('bun_ridge'+str(j),[(-.231,.035+.014*math.cos(t),1.375+.014*math.sin(t)),(-.259,.035+.048*math.cos(t+.18),1.365+.039*math.sin(t+.18)),(-.238,.035+.071*math.cos(t+.42),1.36+.058*math.sin(t+.42))],[.002,.005,.002],'hairHighlight','head',N=6)
for j in range(6):
    t=j*math.pi/3;ell('bun_flower'+str(j),(-.24,.035+.017*math.cos(t),1.365+.017*math.sin(t)),(.007,.009,.009),'pocketRose','head',seg=8,rings=6)
ell('bun_flower_center',(-.248,.035,1.365),(.006,.009,.009),'schoolBusYellow','head',seg=8,rings=6)
# Tailored apron panels: gently curved surface, real cloth thickness, raised bound edges.
def apron_x(y,z):return .185-.27*y*y+.018*math.sin((z-.38)*5)
def apron_panel(n,rows,m,par):
    v=[];f=[];N=12
    for z,width in rows:
        for i in range(N):
            y=width*(2*i/(N-1)-1);v.append((apron_x(y,z),y,z))
    for j in range(len(rows)-1):
        for i in range(N-1):k=j*N+i;f.append((k,k+1,k+1+N,k+N))
    o=mesh(n,v,f,m,par,2);mod=o.modifiers.new('cloth thickness','SOLIDIFY');mod.thickness=.012
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
apron_panel('apron_skirt',[(.386,.214),(.397,.218),(.48,.206),(.58,.193),(.67,.18),(.688,.178)],'apronSage','hip')
apron_panel('apron_bib',[(.684,.173),(.7,.175),(.83,.139),(.936,.117),(.95,.116)],'apronSage','torso')
for s in [-1,1]:
    pts=[(apron_x(s*y,z)+.01,s*y,z) for y,z in [(.208,.403),(.205,.48),(.192,.58),(.178,.679),(.148,.8),(.12,.941)]]
    # Split piping at waist so the hip and torso can move independently.
    tube('skirt_binding'+str(s),pts[:4],[.006]*4,'picketWhite','hip')
    tube('bib_binding'+str(s),pts[3:],[.006]*3,'picketWhite','torso')
    tube('apron_shoulder_strap'+str(s),[(.196,s*.113,.95),(.145,s*.115,1.024),(.02,s*.115,1.039),(-.114,s*.115,1.007)],[.014,.019,.018,.015],'apronOlive','torso')
    ell('apron_brass_fastener'+str(s),(.21,s*.109,.941),(.011,.017,.017),'schoolBusYellow','torso')
    ell('fastener_inset'+str(s),(.222,s*.109,.941),(.004,.009,.009),'woodWarm','torso',seg=8,rings=6)
    # Soft, different-color patch pockets with lips and welt seams.
    y=s*.116;m='apronSage' if s==1 else 'pocketRose'
    patch('apron_pocket'+str(s),[(.215,y-.048,.621),(.215,y+.048,.621),(.219,y+.046,.529),(.221,y+.026,.509),(.221,y-.025,.509),(.219,y-.046,.53)],m,'hip',.018)
    tube('pocket_lip'+str(s),[(.228,y-.047,.619),(.231,y,.615),(.228,y+.047,.619)],[.005]*3,'picketWhite' if s==-1 else 'apronOlive','hip')
    tube('pocket_stitch'+str(s),[(.229,y-.039,.609),(.233,y-.037,.54),(.235,y-.02,.523),(.235,y+.02,.523),(.233,y+.039,.54),(.229,y+.039,.607)],[.002]*6,'picketWhite','hip',N=6,sub=0)
tube('apron_bottom_binding',[(apron_x(y,.403)+.01,y,.403) for y in [-.207,-.16,-.08,0,.08,.16,.207]],[.006]*7,'picketWhite','hip')
tube('apron_top_binding',[(.206,-.112,.944),(.209,0,.94),(.206,.112,.944)],[.005]*3,'picketWhite','torso')
# Back wrap panels, belt and tied bow, all readable in the turnaround.
for s in [-1,1]:
    patch('back_apron_wrap'+str(s),[(-.15,s*.011,.675),(-.16,s*.171,.674),(-.172,s*.22,.399),(-.166,s*.025,.401)],'apronSage','hip',-.012)
    tube('back_apron_hem'+str(s),[(-.178,s*.024,.403),(-.182,s*.12,.401),(-.18,s*.213,.405)],[.005]*3,'picketWhite','hip')
    tube('bow_loop'+str(s),[(-.194,0,.692),(-.223,s*.05,.723),(-.224,s*.103,.739),(-.221,s*.12,.683),(-.211,s*.078,.659),(-.198,0,.692)],[.01,(.018,.031),(.022,.032),(.023,.033),(.018,.026),.008],'apronOlive','hip')
    tube('bow_tail'+str(s),[(-.206,s*.014,.689),(-.214,s*.047,.613),(-.208,s*.052,.548)],[.017,(.023,.012),(.021,.01)],'apronOlive','hip')
# Waist band encircles body, with a small front seam and back knot.
v=[];f=[];N=48
for z in [.666,.67,.694,.698]:
    for i in range(N):
        t=i*2*math.pi/N;v.append((.219*math.cos(t),.198*math.sin(t),z))
for row in range(3):
    for i in range(N):
        k=row*N+i;kk=row*N+(i+1)%N;f.append((k,kk,kk+N,k+N))
o=mesh('apron_waistband',v,f,'apronOlive','hip',1)
mod=o.modifiers.new('belt thickness','SOLIDIFY');mod.thickness=.008
bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
box('bow_knot',(-.217,0,.693),(.035,.034,.036),'apronOlive','hip',.009)
# Embroidered daisies are sculpted petals, not textures or coplanar stickers.
def flower(n,y,z,r,par,petal='picketWhite'):
    x=apron_x(y,z)+.018
    for j in range(7):
        t=j*2*math.pi/7;dy=math.cos(t)*r*.57;dz=math.sin(t)*r*.57
        ell(n+'_petal'+str(j),(x,y+dy,z+dz),(.004,r*.19,r*.42),petal,par,rot=(t-math.pi/2,0,0),seg=8,rings=6,sub=0)
    ell(n+'_center',(x+.007,y,z),(.006,r*.25,r*.25),'schoolBusYellow',par,seg=8,rings=6,sub=0)
    ell(n+'_seed',(x+.013,y,z),(.003,r*.07,r*.07),'woodWarm',par,seg=8,rings=6,sub=0)
for j,(y,z,r,par) in enumerate([(-.063,.855,.046,'torso'),(.084,.905,.028,'torso'),(.014,.536,.042,'hip'),(-.149,.437,.035,'hip'),(.131,.435,.041,'hip'),(.14,.66,.024,'hip')]):flower('daisy'+str(j),y,z,r,par)
for j,(y,z,par) in enumerate([(.074,.773,'torso'),(-.118,.648,'hip'),(.117,.683,'hip')]):
    for k in range(5):
        yy=y+(k%3-1)*.014;zz=z+(k//3)*.015
        flower('red_cluster'+str(j)+str(k),yy,zz,.01,par,'survivorRed')
    tube('embroidered_stem'+str(j),[(apron_x(y,z)+.012,y,z-.024),(apron_x(y,z)+.012,y-.008,z+.022)],[.002]*2,'apronOlive',par,N=6,sub=0)
    for s in [-1,1]:ell('leaf'+str(j)+str(s),(apron_x(y,z)+.014,y+s*.014,z-.014),(.004,.012,.006),'grass',par,rot=(s*.5,0,0),seg=8,rings=6)
tube('cardigan_back_yoke',[(-.135,-.132,.968),(-.16,0,.982),(-.135,.132,.968)],[.003]*3,'cardiganTrim','torso',N=6,sub=0)
tube('cardigan_back_center',[(-.173,0,.94),(-.178,0,.83),(-.161,0,.722)],[.002]*3,'cardiganTrim','torso',N=6,sub=0)
def reduce_mesh(o,ratio):
    # Break equal-cost collapses on symmetric edges with deterministic 0.01 mm offsets.
    for v in o.data.vertices:
        key=(round(v.co.x*1e6)*73856093)^(round(v.co.y*1e6)*19349663)^(round(v.co.z*1e6)*83492791)
        for axis in range(3):v.co[axis]+=(((key>>(axis*7))&127)-63)*1e-7
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('applied game reduction','DECIMATE');mod.ratio=ratio;mod.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
# Reduce applied subdivision where the small screen silhouette cannot use extra facets.
for o in objects:
    if len(o.data.polygons)>160:
        reduce_mesh(o,.5)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
    tiny=[f for f in bm.faces if f.calc_area()<1e-10]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
    bm.to_mesh(o.data);bm.free()
# Join only within rigid parents. Material slots remain palette identities.
buckets={}
for o in objects:buckets.setdefault(o.parent.name,[]).append(o)
objects=[]
for parent,group in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]
    if len(group)>1:bpy.ops.object.join()
    o=group[0];o.name=parent+'_mesh';objects.append(o)
count=sum(len(f.vertices)-2 for o in objects for f in o.data.polygons)
if count>57000:
    ratio=57000/count
    for o in objects:
        reduce_mesh(o,ratio)
# Fix triangle topology and remove unused UVs before export; there are no textures.
for o in objects:
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bm.to_mesh(o.data);bm.free()
    for uv in list(o.data.uv_layers):o.data.uv_layers.remove(uv)
# Broader chibi head with its correct neck pivot; bake scale, including sockets.
parts['head'].scale=(1.07,1.13,1.0)
# Bake mesh transforms into local joint coordinates: exact pivots, unit scale, no inverse bind ambiguity.
bpy.context.view_layer.update()
positions={n:o.matrix_world.translation.copy() for n,o in parts.items()}
for o in objects:
    world=o.matrix_world.copy();parent=o.parent
    o.data.transform(Matrix.Translation(-positions[parent.name])@world)
    o.matrix_parent_inverse.identity();o.location=(0,0,0);o.rotation_euler=(0,0,0);o.scale=(1,1,1)
for n,o in parts.items():
    o.scale=(1,1,1)
    if o.parent:o.location=positions[n]-positions[o.parent.name]
    o.matrix_parent_inverse.identity()
bpy.context.view_layer.update()
required='root hip torso head armL armR foreArmL foreArmR handL handR legL legR shinL shinR footL footR weaponSocketR weaponSocketL backpackSocket'.split()
triangles=sum(len(f.vertices)-2 for o in objects for f in o.data.polygons)
bounds=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
stats={'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in parts],
       'height':max(v.z for v in bounds),'min_z':min(v.z for v in bounds),
       'pivots':{n:list(o.matrix_world.translation) for n,o in parts.items()}}
(P/'build-stats.json').write_text(json.dumps(stats,indent=2))
(P/'materials.json').write_text(json.dumps({'palette':{'pal_'+k:'#'+v for k,v in colors.items()},'textures':False},indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_texcoords=False)
if a.pose:
    parts['armL'].rotation_euler.x=.65;parts['foreArmL'].rotation_euler.y=-1.0
    parts['legR'].rotation_euler.y=-.38;parts['shinR'].rotation_euler.y=.38
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world
    world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o)
        o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size
        o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),430,(1,.83,.72),3)
    light('cool fill',(1,4,3),250,(.72,.78,1),3)
    light('golden rim',(-3,1,3.5),500,(1,.60,.33),2)
    bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='studio_floor'
    floor.data.materials.append(material('studio','35303b',.86));floor.location.z=-.001
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,2.6),'front':(6,0,.94),'side':(0,-6,.94),'back':(-6,0,.94)}
    cam.location=views.get(a.view,views['hero'])
    cam.rotation_euler=(Vector((0,0,.74))-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO';cam.data.ortho_scale=1.64*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='METAL';prefs.get_devices()
        for d in prefs.devices:d.use=True
        S.cycles.device='GPU'
    except Exception:pass
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG';S.render.filepath=a.render
    if a.view in ['review','final']:
        if a.view=='final':
            S.cycles.samples=24;S.render.resolution_x=960;S.render.resolution_y=540
        def view_path(name):
            if a.view=='final':return Path(a.render).with_name('review-hero.png' if name=='hero' else name+'.png')
            return Path(a.render).with_name(Path(a.render).stem+'-'+name+'.png')
        for name in ['front','side','back','hero']:
            cam.location=views[name]
            cam.rotation_euler=(Vector((0,0,.74))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.render.filepath=str(view_path(name))
            bpy.ops.render.render(write_still=True)
        # Assemble the four rendered views at full resolution without another render.
        import numpy as np
        panels=[]
        for name in ['front','side','back','hero']:
            path=view_path(name)
            im=bpy.data.images.load(str(path));w,h=im.size
            pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
            crop=int(h*.85);panels.append(pixels.reshape(h,w,4)[:,(w-crop)//2:(w+crop)//2,:])
        data=np.concatenate(panels,axis=1)
        sheet=bpy.data.images.new('turnaround_sheet',width=data.shape[1],height=data.shape[0],alpha=True)
        sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=str(Path(a.render).with_name('turnaround.png' if a.view=='final' else Path(a.render).stem+'-turnaround.png'))
        sheet.file_format='PNG';sheet.save()
        if a.view=='final':
            cam.location=views['hero'];cam.rotation_euler=(Vector((0,0,.74))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.cycles.samples=a.samples;S.render.resolution_x=a.width;S.render.resolution_y=a.height
            S.render.filepath=a.render;bpy.ops.render.render(write_still=True)
            parts['armL'].rotation_euler.x=.65;parts['foreArmL'].rotation_euler.y=-1.0
            parts['legR'].rotation_euler.y=-.38;parts['shinR'].rotation_euler.y=.38
            S.cycles.samples=24;S.render.resolution_x=960;S.render.resolution_y=540
            S.render.filepath=str(Path(a.render).with_name('pose-test.png'));bpy.ops.render.render(write_still=True)
    else:bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(objects),'meshes')
