"""Patient Zero courier: deterministic shared rigid rig, --state healthy|sick|infected.
+X forward, +Z up, -Y right. All subdivision applied before export.
"""
import argparse, math, sys, json
from pathlib import Path
import bpy, bmesh
from mathutils import Vector, Matrix
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser()
ap.add_argument('--state',choices=['healthy','sick','infected'],default='healthy')
ap.add_argument('--render');ap.add_argument('--glb');ap.add_argument('--view',default='hero')
ap.add_argument('--samples',type=int,default=24);ap.add_argument('--width',type=int,default=960);ap.add_argument('--height',type=int,default=540)
ap.add_argument('--pose',action='store_true')
ap.add_argument('--lod',type=int,choices=[0,1,2],default=0)
ap.add_argument('--lod-chain',action='store_true')
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene;parts={};objects=[];infected=a.state=='infected';sick=a.state=='sick'
def mat(token,h,rough=.7,emit=0):
    m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token);m.use_nodes=True
    c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=c;b.inputs['Roughness'].default_value=rough
    if emit:b.inputs['Emission Color'].default_value=c;b.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=c;return m
M={k:mat(k,h) for k,h in [('uiDark','25222c'),('picketWhite','f2e6dc'),('blood','b3121f'),('sidewalk','b9a4a0'),('survivorRed','d9363e')]}
# Skin and amber details reuse the warm palette; hue variation is state-specific.
M['skin']=mat('infectedSkin','eeb18a' if not sick and not infected else ('e0baa1' if sick else 'c9a39a'))
M['blue']=mat('policeBlue','355aa7');M['orange']=mat('schoolBusYellow','ee9b31')
M['brown']=mat('asphalt','79604e');M['hair']=mat('woodWarm','493025')
M.update({'policeBlue':M['blue'],'schoolBusYellow':M['orange'],'woodWarm':M['hair'],'asphalt':M['brown'],'infectedSkin':M['skin']})
M['eye']=mat('infectedEye','ff3b2f',.25,3) if infected else M['hair']
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o
node('root',(0,0,0));parts['root']['state']=a.state
node('hip',(0,0,.61),'root');node('torso',(0,0,.73),'hip');node('head',(0,0,1.04),'torso')
node('backpackSocket',(-.17,0,.92),'torso')
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
    # Endpoint support loops prevent Catmull-Clark caps shortening joint segments.
    points=[Vector(p) for p in points]
    if sub:
        points=[points[0],points[0].lerp(points[1],.045)]+points[1:-1]+[points[-1].lerp(points[-2],.045),points[-1]]
        radii=[radii[0],radii[0]]+radii[1:-1]+[radii[-1],radii[-1]]
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
# Tailored shirt, hem, collar and functional uniform details.
ell('pelvis',(0,0,.62),(.13,.166,.105),'brown','hip')
ell('shirt',(.005,0,.835),(.145,.197,.217),'blue','torso',seg=16,rings=10)
box('shirt_hem',(.01,0,.664),(.26,.34,.035),'blue','torso',.018)
ell('neck',(0,0,1.045),(.057,.071,.071),'skin','head')
for s in [-1,1]:
    patch('collar'+str(s),[(.087,s*.024,1.056),(.112,s*.113,1.009),(.16,s*.078,.952),(.153,s*.03,.995)],'blue','torso',.015)
    box('chest_pocket'+str(s),(.144,s*.106,.858),(.031,.079,.102),'blue','torso',.014)
    box('orange_pocket_flap'+str(s),(.164,s*.106,.901),(.016,.086,.036),'orange','torso',.007)
    ell('pocket_snap'+str(s),(.175,s*.106,.897),(.006,.007,.007),'picketWhite','torso',seg=8,rings=6)
    tube('pocket_stitch'+str(s),[(.165,s*.074,.879),(.169,s*.074,.826),(.168,s*.135,.826),(.162,s*.137,.875)],[.0025]*4,'policeBlue','torso',N=6,sub=0)
    tube('shirt_side_fold'+str(s),[(.116,s*.119,.734),(.144,s*.143,.72),(.12,s*.167,.706)],[.003,.009,.002],'blue','torso',N=8)
box('button_placket',(.154,0,.839),(.018,.019,.257),'blue','torso',.005)
for j in range(6):ell('shirt_button'+str(j),(.168,0,.728+j*.043),(.006,.007,.007),'sidewalk','torso',seg=8,rings=6)
box('belt',(0,0,.637),(.262,.341,.043),'uiDark','hip',.016)
box('belt_buckle',(.148,0,.639),(.025,.071,.051),'sidewalk','hip',.006)
box('buckle_opening',(.164,0,.639),(.012,.049,.032),'uiDark','hip',.004)
for s in [-1,1]:
    box('belt_loop'+str(s),(.139,s*.116,.642),(.022,.021,.066),'brown','hip',.005)
# Parcel backpack: soft rigid shell, framed edges, lid, seam, buckles and envelope panel.
box('parcel_pack',(-.254,0,.885),(.23,.374,.43),'orange','torso',.035)
box('pack_rear_panel',(-.38,0,.884),(.025,.332,.347),'orange','torso',.02)
box('pack_lid',(-.259,0,1.105),(.25,.4,.06),'orange','torso',.022)
for s in [-1,1]:
    box('pack_vertical_frame'+str(s),(-.379,s*.179,.887),(.04,.045,.409),'blue','torso',.013)
    box('pack_side_panel'+str(s),(-.254,s*.197,.88),(.159,.017,.323),'orange','torso',.012)
    box('pack_side_reinforcement'+str(s),(-.17,s*.2,.881),(.035,.029,.406),'blue','torso',.009)
    box('pack_clasp'+str(s),(-.255,s*.211,1.031),(.052,.022,.075),'uiDark','torso',.007)
    box('pack_clasp_inset'+str(s),(-.255,s*.227,1.028),(.029,.01,.029),'sidewalk','torso',.004)
    tube('shoulder_strap'+str(s),[(-.22,s*.132,1.035),(-.075,s*.163,1.056),(.055,s*.16,1.015),(.148,s*.15,.92),(.141,s*.147,.814),(.102,s*.164,.735),(-.17,s*.17,.724)],[.024,.028,.028,.026,.026,.024,.023],'uiDark','torso',N=8)
    box('strap_buckle'+str(s),(.17,s*.15,.923),(.022,.059,.07),'sidewalk','torso',.009)
    box('strap_buckle_hole'+str(s),(.184,s*.15,.923),(.012,.039,.047),'uiDark','torso',.006)
    tube('strap_stitch'+str(s),[(.174,s*.169,.888),(.168,s*.168,.831),(.139,s*.179,.78)],[.0025]*3,'asphalt','torso',N=6,sub=0)
for z in [.69,1.099]:box('pack_horizontal_frame'+str(z),(-.378,0,z),(.047,.4,.041),'blue','torso',.011)
box('pack_handle',(-.262,0,1.155),(.095,.128,.021),'uiDark','torso',.009)
box('rear_envelope_badge',(-.401,0,.921),(.012,.155,.099),'picketWhite','torso',.007)
# Rear icon extruded >3mm; simple geometric envelope seam.
for s in [-1,1]:tube('rear_envelope_fold'+str(s),[(-.411,s*.067,.956),(-.411,0,.913),(-.411,s*.064,.884)],[.003]*3,'orange','torso',N=6,sub=0)
# Same joint topology in all states, big hands and layered sneakers.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(0,s*.185,.982);elbow=(.013,s*.263,.825);wrist=(.04,s*.296,.709)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    tube('short_sleeve'+side,[shoulder,(0,s*.213,.968),(.004,s*.243,.897),(.008,s*.258,.869)],[.085,.091,.088,.084],'blue','arm'+side,N=12)
    tube('sleeve_cuff'+side,[(.008,s*.253,.882),(.01,s*.262,.861)],[.087,.087],'blue','arm'+side,N=12)
    tube('upper_skin'+side,[(.009,s*.256,.862),elbow],[.07,.063],'skin','arm'+side,N=12)
    tube('forearm'+side,[elbow,(.027,s*.284,.767),wrist],[.065,.066,.047],'skin','foreArm'+side,N=12)
    ell('palm'+side,(.05,s*.299,.68),(.055,.055,.065),'skin','hand'+side)
    for j in range(4):
        y=s*(.258+j*.026);z=.656+(abs(j-1.5)*.009)
        pts=[(.064,y,z),(.071,y,z-.039),(.10,y,z-.044),(.114,y,z-.021)] if not infected else [(.064,y,z),(.09,y,z-.052),(.125,y,z-.108),(.151,y,z-.083)]
        tube('finger'+side+str(j),pts,[.014,.016,.014,.01],'skin','hand'+side,N=8)
    tube('thumb'+side,[(.08,s*.25,.699),(.115,s*.247,.674),(.116,s*.26,.654)],[.023,.021,.012],'skin','hand'+side,N=8)
    node('weaponSocket'+side,(.104,s*.294,.661),'hand'+side)
    # Sleeve patch: oval ivory plate with orange envelope raised on outward side.
    ell('sleeve_badge'+side,(.025,s*.292,.94),(.041,.009,.032),'picketWhite','arm'+side)
    box('sleeve_envelope'+side,(.033,s*.304,.943),(.041,.012,.025),'orange','arm'+side,.004)
    tube('sleeve_envelope_fold'+side,[(.015,s*.313,.953),(.033,s*.313,.94),(.05,s*.313,.952)],[.0018]*3,'blue','arm'+side,N=6,sub=0)
    hip=(0,s*.099,.61);knee=(.014,s*.132,.365);ankle=(0,s*.148,.127)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('cargo_thigh'+side,[hip,(0,s*.109,.549),(.01,s*.127,.43),knee],[.099,.107,.094,.087],'brown','leg'+side,N=12)
    tube('cargo_calf'+side,[knee,(.005,s*.138,.294),(0,s*.147,.185),ankle],[.087,.094,.089,.073],'brown','shin'+side,N=12)
    for z in [.397,.27,.157]:ell('trouser_fold'+side+str(z),(.008,s*.139,z),(.087,.092,.025),'brown','shin'+side,seg=12,rings=6)
    box('cargo_pocket'+side,(0,s*.213,.477),(.12,.032,.125),'brown','leg'+side,.014)
    box('cargo_pocket_flap'+side,(.002,s*.235,.534),(.132,.02,.037),'brown','leg'+side,.006)
    ell('cargo_snap'+side,(.004,s*.25,.533),(.007,.004,.007),'orange','leg'+side,seg=8,rings=6)
    tube('cargo_stitch'+side,[(.055,s*.233,.513),(.055,s*.234,.429),(-.05,s*.232,.429)],[.0025]*3,'woodWarm','leg'+side,N=6,sub=0)
    for j,z in enumerate([.56,.405,.266]):tube('trouser_crease'+side+str(j),[(.073,s*.087,z+.012),(.101,s*.136,z),(.071,s*.177,z-.009)],[.003,.009,.002],'brown','leg'+side,N=8)
    box('shoe_sole'+side,(.044,s*.148,.032),(.251,.173,.064),'picketWhite','foot'+side,.023)
    box('shoe_welt'+side,(.044,s*.148,.065),(.249,.17,.025),'picketWhite','foot'+side,.012)
    ell('sneaker'+side,(.04,s*.148,.103),(.124,.081,.062),'blue','foot'+side,seg=16,rings=10)
    ell('toe_cap'+side,(.125,s*.148,.086),(.045,.081,.033),'picketWhite','foot'+side)
    box('tongue'+side,(.04,s*.148,.15),(.072,.064,.063),'blue','foot'+side,.013)
    box('tongue_patch'+side,(.051,s*.148,.185),(.038,.041,.009),'picketWhite','foot'+side,.004)
    for j in range(4):
        x=.083+j*.019;z=.17-j*.006
        tube('lace'+side+str(j),[(x,s*.112,z-.006),(x+.008,s*.148,z+.007),(x,s*.184,z-.006)],[.0035]*3,'picketWhite','foot'+side,N=6,sub=0)
    for j in range(5):box('sole_groove'+side+str(j),(-.032+j*.037,s*.235,.03),(.009,.004,.018),'sidewalk','foot'+side,.002)
    tube('sneaker_side_mark'+side,[(.084,s*.219,.10),(.043,s*.234,.087),(.008,s*.229,.125)],[.009,.01,.008],'picketWhite','foot'+side,N=8)
# Expressive face with thick sculpted hair under a fitted delivery cap.
ell('skull',(0,0,1.196),(.133,.143,.165),'skin','head',seg=20,rings=14)
ell('jaw',(.028,0,1.112),(.088,.108,.052),'skin','head',seg=16,rings=10)
for s in [-1,1]:
    ell('ear'+str(s),(0,s*.145,1.176),(.039,.03,.05),'skin','head')
    ell('ear_inner'+str(s),(.024,s*.158,1.177),(.012,.009,.027),'skin','head')
    ell('eye_rim'+str(s),(.105,s*.063,1.222),(.016,.046,.05),'hair','head')
    ell('eye_white'+str(s),(.119,s*.063,1.222),(.012,.037,.041),'eye' if infected else 'picketWhite','head')
    if not infected:
        ell('iris'+str(s),(.13,s*.059,1.22),(.006,.021,.03),'eye','head')
        ell('pupil'+str(s),(.136,s*.058,1.22),(.004,.011,.022),'uiDark','head')
    ell('eye_spark'+str(s),(.141,s*.052,1.234),(.004,.007,.01),'picketWhite','head',seg=8,rings=6)
    z=1.282 if sick else 1.275
    tube('brow'+str(s),[(.126,s*.021,z+(.012 if sick else -.006)),(.134,s*.061,z+.011),(.10,s*.106,z-.008)],[.009,.013,.006],'hair','head',N=8)
ell('nose_bridge',(.125,0,1.194),(.015,.018,.029),'skin','head')
ell('nose_tip',(.142,0,1.176),(.017,.021,.013),'skin','head')
for s in [-1,1]:ell('nostril'+str(s),(.154,s*.011,1.168),(.003,.004,.0025),'woodWarm','head',seg=8,rings=6)
if infected:
    # Cut a genuine cavity through both face volumes before adding lining and teeth.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=(.19,0,1.102))
    cutter=bpy.context.object;cutter.scale=(.085,.059,.06)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for name in ['skull','jaw']:
        obj=bpy.data.objects[name];mod=obj.modifiers.new('snarl cavity','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
    ell('mouth_dark',(.125,0,1.102),(.032,.062,.064),'uiDark','head',seg=16,rings=10)
    pts=[(.169,.065*math.cos(i*2*math.pi/24),1.102+.066*math.sin(i*2*math.pi/24)) for i in range(25)]
    tube('snarl_lip',pts,[.01]*25,'blood','head',N=8)
    for row in [0,1]:
        for j in range(5):box('tooth'+str(row)+str(j),(.177,(j-2)*.022,1.146 if not row else 1.055),(.016,.017,.018 if row else .024),'picketWhite','head',.004)
    ell('tongue',(.178,0,1.065),(.011,.03,.013),'survivorRed','head')
    tube('chin_blood',[(.173,-.027,1.053),(.142,-.031,1.021),(.117,-.039,.979)],[.009,.012,.002],'blood','head',N=8)
else:
    pts=[(.105,-.076,1.132),(.123,-.042,1.114),(.132,0,1.11),(.123,.042,1.114),(.105,.076,1.132)]
    if sick:pts=[(.114,-.066,1.114),(.127,-.034,1.123),(.133,0,1.126),(.127,.034,1.123),(.114,.066,1.11)]
    tube('mouth',pts,[.005 if not sick else .007]*5,'hair','head',N=8)
    tube('smile_teeth',[(p[0]+.003,p[1],p[2]+.003) for p in pts],[.0035 if not sick else .003]*5,'picketWhite','head',N=6)
    if not sick:
        tube('lower_smile_lip',[(p[0]-.003,p[1],p[2]-.009) for p in pts[1:4]],[.004,.005,.004],'skin','head',N=8)
# Brown locks shaped as tapered volumes instead of flat spikes.
ell('hair_base',(-.035,0,1.307),(.129,.14,.069),'hair','head',seg=16,rings=10)
for j in range(9):
    y=-.135+j*.033
    tube('fringe'+str(j),[(-.015,y+.016,1.335),(.077,y,1.313),(.12,y-.021,1.276),(.111,y-.03,1.231+(j%3)*.017)],[.016,(.031,.022),(.024,.014),.002],'hair','head',N=8)
# Keep side locks tucked between cap and ear tops; no cheek-level sideburns or nape curtain.
for s in [-1,1]:
    for j in range(3):
        tube('side_lock'+str(s)+str(j),[(-.038-j*.025,s*.117,1.302),(-.065-j*.025,s*.151,1.289),(-.09-j*.025,s*.164,1.267)],[.015,.021,.002],'hair','head',N=8)
# Cap hemispherical cloth crown with panel seams; brim forms a swept padded crescent.
ell('cap_crown',(-.031,0,1.331),(.148,.157,.101),'blue','head',seg=20,rings=12)
box('cap_band',(-.023,0,1.296),(.276,.295,.026),'blue','head',.016)
ell('cap_bill',(.132,0,1.315),(.143,.182,.017),'blue','head',rot=(0,.08,0),seg=20,rings=10)
tube('bill_piping',[(.132+.136*math.cos(t),.175*math.sin(t),1.313-.009*math.cos(t)) for t in [(-math.pi/2+i*math.pi/20) for i in range(21)]],[.0035]*21,'orange','head',N=6,sub=0)
for yy in [-.093,.093]:tube('cap_panel_seam'+str(yy),[(.10,yy*.78,1.319),(.081,yy,1.371),(.02,yy*.9,1.418),(-.071,yy*.6,1.419),(-.165,yy*.4,1.342)],[.0025]*5,'policeBlue','head',N=6,sub=0)
ell('cap_button',(-.043,0,1.43),(.011,.012,.007),'orange','head')
box('cap_envelope',(.112,0,1.357),(.018,.085,.057),'orange','head',.005,rot=(0,-.2,0))
for s in [-1,1]:tube('cap_envelope_fold'+str(s),[(.127,s*.036,1.378),(.132,0,1.35),(.125,s*.034,1.332)],[.0025]*3,'blue','head',N=6,sub=0)
if sick:
    for j,(y,z) in enumerate([(-.108,1.193),(.106,1.179),(-.147,1.243)]):
        ell('sweat'+str(j),(.126,y,z),(.007,.009,.015),'picketWhite','head')
        tube('sweat_tip'+str(j),[(.125,y,z+.012),(.126,y,z+.022)],[.007,.001],'picketWhite','head',N=6)
if infected:
    def stain(name,spots):
        obj=bpy.data.objects[name];obj.data.materials.append(M['blood'])
        bpy.context.view_layer.update()
        for face in obj.data.polygons:
            c=obj.matrix_world@face.center
            if c.x>.045 and any(((c.y-y)/ry)**2+((c.z-z)/rz)**2<1 for y,z,ry,rz in spots):
                face.material_index=len(obj.data.materials)-1
    stain('shirt',[(-.072,.91,.042,.063),(.096,.777,.038,.042),(-.048,.719,.048,.026),(.022,.846,.032,.044)])
    for s,side in [(1,'L'),(-1,'R')]:
        ell('knee_rip'+side,(.097,s*.13,.361),(.012,.06,.045),'uiDark','shin'+side)
        ell('knee_skin'+side,(.101,s*.13,.362),(.011,.048,.035),'skin','shin'+side)
        ell('knee_wound'+side,(.115,s*.131,.358),(.003,.023,.025),'blood','shin'+side)
        for j in range(3):patch('ragged_knee'+side+str(j),[(.119,s*(.085+j*.025),.401),(.12,s*(.11+j*.025),.398),(.121,s*(.098+j*.025),.363-j*.007)],'brown','shin'+side)
        stain('forearm'+side,[(s*.275,.798,.032,.026),(s*.295,.735,.026,.019)])
        stain('short_sleeve'+side,[(s*.235,.93,.023,.018)])
        for j in range(3):patch('sleeve_rag'+side+str(j),[(.05,s*(.226+j*.025),.886),(.05,s*(.251+j*.025),.875),(.051,s*(.24+j*.025),.837-j*.004)],'blue','arm'+side)
    tube('face_blood',[(.15,-.106,1.213),(.15,-.102,1.168),(.15,-.068,1.12)],[.007,.01,.003],'blood','head',N=8)
    for j in range(6):ell('cap_blood'+str(j),(.103,-.072+j*.018,1.366+(j%2)*.022),(.008,.009,.007),'blood','head',seg=8,rings=6)

# Shared dismemberment caps remain on the proximal joint when a limb is removed.
caps=[]
if infected:
    for key,par,sz in [('head','torso',(.059,.063,.012)),('armL','torso',(.066,.014,.065)),('armR','torso',(.066,.014,.065)),('foreArmL','armL',(.05,.012,.053)),('foreArmR','armR',(.05,.012,.053)),('legL','hip',(.074,.074,.014)),('legR','hip',(.074,.074,.014))]:
        o=ell('stump_'+key,parts[key].matrix_world.translation,sz,'blood',par);o['stumpFor']=key;o['hidden']=True;caps.append(o)
# Leaner young-adult body: redistribute 7.5cm from waist-to-neck to the legs.
# Deform garment vertices and their joint locations together, retaining exact pivots.
def body_z(z):
    if z<=.15 or z>=1.04:return z
    if z<=.61:return z+.075*(z-.15)/.46
    return z+.075*(1.04-z)/.43
bpy.context.view_layer.update()
for o in objects:
    if o.parent==parts['head']:continue
    pack=o.name.startswith(('pack_','parcel_','rear_envelope'))
    inv=o.matrix_world.inverted()
    for v in o.data.vertices:
        q=o.matrix_world@v.co
        if pack:q.z+=.025
        else:
            if o.parent.name.startswith('foot'):q.y-=o.parent.matrix_world.translation.y*.14
            else:q.x*=.9;q.y*=.86;q.z=body_z(q.z)
        v.co=inv@q
# Set all world joint positions together before restoring their existing hierarchy.
mesh_world={o.name:o.matrix_world.copy() for o in objects}
joint_positions={n:o.matrix_world.translation.copy() for n,o in parts.items()}
for n,q in joint_positions.items():
    if n=='head':continue
    q.x*=.9;q.y*=.86;q.z=body_z(q.z)
for n,o in parts.items():
    o.location=joint_positions[n];o.matrix_parent_inverse=Matrix.Identity(4)
    if o.parent:o.location-=joint_positions[o.parent.name]
bpy.context.view_layer.update()
for o in objects:o.matrix_world=mesh_world[o.name]
bpy.context.view_layer.update()
# Keep the enlarged infected geometry under its 40k crowd-source budget.
for o in objects:
    if len(o.data.polygons)>100:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('triangle budget','DECIMATE');mod.ratio=.32 if infected else .78;bpy.ops.object.modifier_apply(modifier=mod.name)
# Merge ornament geometry by material and rigid parent; sockets and caps are preserved.
for o in objects:
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
    tiny=[f for f in bm.faces if f.calc_area()<1e-9]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
    bm.to_mesh(o.data);bm.free()
for o in objects:
    for i,m in enumerate(o.data.materials):
        if m is None:o.data.materials[i]=M['skin']
buckets={}
for o in objects:
    if o not in caps:buckets.setdefault((o.parent.name,tuple(m.name for m in o.data.materials)),[]).append(o)
joined=[]
for (parent,material),group in buckets.items():
    if len(group)>1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join()
    o=group[0];o.name=parent+'__'+material[0]+('_regions' if len(material)>1 else '');joined.append(o)
objects=joined+caps
# Final state pose; same rig and pivot contract, different body language.
if not infected:
    parts['head'].scale=(1.15,1.22,.98);parts['root'].scale=(.99,.99,.99)
if sick:
    parts['torso'].rotation_euler.y=.08;parts['head'].rotation_euler.y=.1
if infected:
    parts['head'].scale=(1.48,1.5,1.34)
    parts['hip'].location.z-=.065;parts['torso'].rotation_euler.y=.2
    parts['head'].rotation_euler.y=-.12
    for side,sign in [('L',1),('R',-1)]:
        parts['arm'+side].rotation_euler=(sign*.12,-.82,0)
        parts['foreArm'+side].rotation_euler.y=-.53
        parts['hand'+side].scale=(1.3,1.4,1.3)
        parts['hand'+side].rotation_euler.z=math.pi
        parts['leg'+side].rotation_euler.y=-.28
        parts['shin'+side].rotation_euler.y=.58
        parts['foot'+side].rotation_euler.y=-.3
# Bake rest pose to identity rotations/scales, preserving world joint positions.
bpy.context.view_layer.update()
positions={n:o.matrix_world.translation.copy() for n,o in parts.items()}
parents={n:o.parent.name if o.parent else None for n,o in parts.items()}
meshparents={o.name:o.parent.name for o in objects}
for o in objects:o.data.transform(o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
for n,o in parts.items():o.parent=None;o.matrix_world=Matrix.Translation(positions[n])
for n,o in parts.items():
    if parents[n]:o.parent=parts[parents[n]];o.matrix_parent_inverse=Matrix.Identity(4);o.location=positions[n]-positions[parents[n]]
bpy.context.view_layer.update()
for o in objects:
    o.parent=parts[meshparents[o.name]];o.matrix_parent_inverse=o.parent.matrix_world.inverted();o.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
for side in ['L','R']:
    shoes=[o for o in objects if o.parent==parts['foot'+side]]
    floor=min((o.matrix_world@v.co).z for o in shoes for v in o.data.vertices)
    parts['foot'+side].location.z-=floor
for cap in caps:cap.scale=(0,0,0)
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','weaponSocketR','weaponSocketL','backpackSocket']
if infected:required+=['stump_'+key for key in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
if a.lod:
    for o in objects:
        if len(o.data.polygons)>24:
            bpy.context.view_layer.objects.active=o
            mod=o.modifiers.new('rigid LOD reduction','DECIMATE');mod.ratio=.16 if a.lod==1 else .055
            bpy.ops.object.modifier_apply(modifier=mod.name)
triangles=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in objects)
(P/('stats-'+a.state+(f'-lod{a.lod}' if a.lod else '')+'.json')).write_text(json.dumps({'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in bpy.data.objects]},indent=2))
def export_model(path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if a.glb:
    export_model(a.glb)
    if a.lod_chain:
        high_data={o:o.data for o in objects}
        for level,ratio in [(1,.16),(2,.055)]:
            for o in objects:
                o.data=high_data[o].copy()
                if len(o.data.polygons)>24:
                    bpy.context.view_layer.objects.active=o
                    mod=o.modifiers.new('rigid LOD reduction','DECIMATE');mod.ratio=ratio
                    bpy.ops.object.modifier_apply(modifier=mod.name)
            path=Path(a.glb);export_model(path.with_name(path.stem+f'.lod{level}.glb'))
            count=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in objects)
            (P/f'stats-{a.state}-lod{level}.json').write_text(json.dumps({'triangles':count,'meshes':len(objects),'missing_nodes':[]},indent=2))
            for o in objects:
                low=o.data;o.data=high_data[o];bpy.data.meshes.remove(low)
if a.pose:
    parts['armL'].rotation_euler.x=.6;parts['foreArmL'].rotation_euler.y=-.75;parts['legR'].rotation_euler.y=-.4
    if infected:
        for o in objects:
            par=o.parent
            while par:
                if par==parts['armL']:o.hide_render=True;break
                par=par.parent
        bpy.data.objects['stump_armL'].scale=(1,1,1)
def turnaround_sheet(path):
    """Compose the four checked camera renders without a second GPU pass."""
    import numpy as np
    panels=[]
    for name in ['front.png','side.png','back.png','review-hero.png']:
        im=bpy.data.images.load(str(P/'renders'/name));w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-420)//2:(w+420)//2,:])
    data=np.concatenate(panels,axis=1)
    sheet=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
    sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=str(path);sheet.file_format='PNG';sheet.save()
if a.render and a.view=='turnaround':
    turnaround_sheet(a.render);print('OK turnaround');sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),460,(1,.83,.69),3);light('cool fill',(1,4,3),260,(.63,.72,1),3);light('amber rim',(-3,1,3.5),600,(1,.46,.2),2)
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='studio_floor';ground.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,2.9),'front':(6,0,1.35),'side':(0,-6,1.35),'back':(-6,0,1.35),'opposite':(6,4,2.9)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((0,0,.74))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.77*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='METAL';prefs.get_devices()
        for d in prefs.devices:d.use=True
        S.cycles.device='GPU'
    except Exception:pass
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG';S.render.filepath=a.render
    if a.view in ['review-set','final-set']:
        if a.view=='final-set':
            S.cycles.samples=96;S.render.resolution_x=1600;S.render.resolution_y=900
            S.render.filepath=str(P/'renders'/'hero.png');bpy.ops.render.render(write_still=True)
        S.cycles.samples=24;S.render.resolution_x=960;S.render.resolution_y=540
        for view in ['front','side','back','hero']:
            cam.location=views[view];cam.rotation_euler=(Vector((0,0,.74))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.render.filepath=str(P/'renders'/('review-hero.png' if view=='hero' else view+'.png'));bpy.ops.render.render(write_still=True)
        turnaround_sheet(P/'renders'/'turnaround.png')
        if a.view=='final-set':
            parts['armL'].rotation_euler.x=.6;parts['foreArmL'].rotation_euler.y=-.75;parts['legR'].rotation_euler.y=-.4
            S.render.filepath=str(P/'renders'/'pose-test.png');bpy.ops.render.render(write_still=True)
    else:
        bpy.ops.render.render(write_still=True)
        if a.view=='infected-set':
            parts['armL'].rotation_euler.x=.6;parts['foreArmL'].rotation_euler.y=-.75;parts['legR'].rotation_euler.y=-.4
            for o in objects:
                par=o.parent
                while par:
                    if par==parts['armL']:o.hide_render=True;break
                    par=par.parent
            bpy.data.objects['stump_armL'].scale=(1,1,1)
            cam.location=views['opposite'];cam.rotation_euler=(Vector((0,0,.74))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.render.filepath=str(P/'renders'/'infected-pose-test.png');bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(objects),'meshes')
