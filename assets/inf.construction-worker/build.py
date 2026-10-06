"""Deterministic rigid-part hero infected construction worker. +X forward, Z up, -Y character right.
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
ap.add_argument('--pose',action='store_true');ap.add_argument('--stump',action='store_true')
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
palette=json.loads((P.parents[1]/'src/assets/palette.json').read_text())
used_tokens=['infectedSkin','picketWhite','asphalt','uiDark','blood','survivorRed','sidewalk','silver','denim','denimLight','denimStitch','leather','leatherShadow','shoeTan','woodWarm','schoolBusYellow','hoodieShade','orange','hairBrown','hairLight','brass','bandage']
M={k:mat(k,palette[k].lstrip('#')) for k in used_tokens}
M['silver'].node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.45
# Orange safety fabric uses a saturated hero swatch of the existing orange token.
M['orange'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.89,.18,.018,1)
M['orange'].diffuse_color=(.89,.18,.018,1)
M['eye']=mat('infectedEye','ff3b2f',.24,2.5)
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
# Charcoal work shirt under a thick separate open hi-vis vest shell.
ell('pelvis',(0,0,.695),(.153,.225,.125),'denim','hip')
ell('shirt_body',(.017,0,.944),(.174,.224,.257),'asphalt','torso')
ell('neck',(.013,0,1.184),(.076,.088,.089),'infectedSkin','head')
v=[];f=[];N=24
vest_rings=[(.727,.18,.237),(.745,.194,.249),(.84,.183,.25),(1.045,.178,.258),(1.123,.15,.22),(1.139,.142,.215)]
for j,(z,rx,ry) in enumerate(vest_rings):
    for i in range(N):
        t=.51+(2*math.pi-1.02)*i/(N-1)
        v.append((rx*math.cos(t)-.012,ry*math.sin(t),z+(.011*math.sin(i*2.1) if j==0 else 0)))
for j in range(len(vest_rings)-1):
    for i in range(N-1):f.append((j*N+i,j*N+i+1,(j+1)*N+i+1,(j+1)*N+i))
o=mesh('vest_shell',v,f,'orange','torso',2)
mod=o.modifiers.new('cloth shell','SOLIDIFY');mod.thickness=.013;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
def back_strip(name,y,width,material,offset):
    v=[]
    rows=[(1.118,.151,.222),(1.10,.16,.231),(1.045,.178,.258),(.96,.181,.253),(.875,.183,.25),(.855,.183,.25)]
    for z,rx,ry in rows:
        for yy in [y-width/2,y+width/2]:
            x=-.012-rx*math.sqrt(max(.01,1-(yy/ry)**2))-offset
            v.append((x,yy,z))
    f=[(2*j,2*j+1,2*j+3,2*j+2) for j in range(len(rows)-1)]
    o=mesh(name,v,f,material,'torso',0)
    mod=o.modifiers.new('reflective fabric thickness','SOLIDIFY');mod.thickness=.003
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
# Front panels, reflective yellow edging, inset silver strips, rounded patch pockets.
for s in [-1,1]:
    patch('vest_front'+str(s),[(.128,s*.106,1.128),(.132,s*.174,1.113),(.174,s*.213,1.037),(.191,s*.201,.83),(.178,s*.196,.744),(.188,s*.086,.738),(.20,s*.071,.886),(.158,s*.082,1.082)],'orange','torso',.018)
    tube('vest_edge'+str(s),[(.131,s*.09,1.124),(.17,s*.076,1.04),(.202,s*.071,.892),(.193,s*.084,.754)],[.008]*4,'hoodieShade','torso',N=8)
    # Straps follow the actual front surface, with a 4 mm raised metallic inlay.
    patch('hi_vis_border'+str(s),[(.168,s*.139,1.126),(.166,s*.18,1.109),(.205,s*.17,.813),(.21,s*.125,.809)],'schoolBusYellow','torso',.007)
    patch('reflect_front'+str(s),[(.179,s*.151,1.114),(.179,s*.167,1.105),(.214,s*.156,.825),(.215,s*.137,.824)],'silver','torso',.006)
    patch('hi_vis_waist'+str(s),[(.218,s*.081,.82),(.213,s*.196,.819),(.208,s*.2,.776),(.215,s*.081,.774)],'schoolBusYellow','torso',.007)
    patch('reflect_waist'+str(s),[(.223,s*.084,.807),(.218,s*.196,.806),(.215,s*.199,.79),(.221,s*.084,.787)],'silver','torso',.004)
    box('vest_pocket'+str(s),(.19,s*.134,.898),(.029,.085,.089),'hoodieShade','torso',.013,rot=(s*.07,0,0))
    box('pocket_flap'+str(s),(.21,s*.134,.924),(.018,.088,.032),'orange','torso',.007)
    ell('pocket_snap'+str(s),(.224,s*.134,.924),(.005,.007,.007),'brass','torso',seg=8,rings=6)
    patch('shirt_collar'+str(s),[(.109,s*.05,1.183),(.153,s*.124,1.106),(.204,s*.107,1.047),(.198,s*.035,1.083)],'asphalt','torso',.019)
    # Back reflective strips and shoulder turn-over straps.
    back_strip('back_reflector_border'+str(s),s*.143,.052,'schoolBusYellow',.007)
    back_strip('back_reflector'+str(s),s*.143,.034,'silver',.011)
    tube('shoulder_tape'+str(s),[(.14,s*.157,1.117),(.015,s*.187,1.15),(-.143,s*.139,1.122)],[.02,.022,.019],'schoolBusYellow','torso',N=8)
    tube('shoulder_silver'+str(s),[(.141,s*.157,1.13),(.015,s*.187,1.163),(-.151,s*.139,1.13)],[.01]*3,'silver','torso',N=8)
for j in range(4):
    ell('shirt_button'+str(j),(.191,.005,.845+j*.052),(.007,.008,.008),'woodWarm','torso',seg=8,rings=6)
# Back horizontal reflective band follows the rounded vest rather than floating.
pts=[(-.207*math.cos(t),.253*math.sin(t),.806) for t in [-1.22,-.9,-.6,-.3,0,.3,.6,.9,1.22]]
tube('back_band_border',pts,[(.025,.008)]*len(pts),'schoolBusYellow','torso',N=8)
pts=[(x-.012,y,z) for x,y,z in pts]
tube('back_band_silver',pts,[(.012,.006)]*len(pts),'silver','torso',N=8)
# Relaxed asymmetric limbs, sleeves with rolled ivory cuffs, individual curled fingers.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(-.008,s*.237,1.076);elbow=(.021,s*.343,.899);wrist=(.086,s*.418,.744)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    tube('upper_sleeve'+side,[shoulder,(-.005,s*.28,1.054),(.006,s*.313,.958),elbow],[.099,.112,.094,.091],'asphalt','arm'+side,N=12,sub=1)
    tube('sleeve_fold'+side,[(.022,s*.313,.948),(.034,s*.34,.916),(.037,s*.365,.874)],[.098,.098,.073],'asphalt','foreArm'+side,N=12)
    tube('rolled_cuff'+side,[(.031,s*.345,.902),(.039,s*.361,.865),(.042,s*.368,.852)],[.097,.098,.088],'asphalt','foreArm'+side,N=12)
    tube('forearm_skin'+side,[(.041,s*.364,.855),(.064,s*.396,.797),wrist],[.068,.068,.047],'infectedSkin','foreArm'+side,N=12,sub=1)
    ell('palm'+side,(.087,s*.424,.72),(.058,.066,.075),'infectedSkin','hand'+side)
    for i in range(4):
        y=s*(.365+i*.039);z=.696-(.006 if i in [0,3] else .018)
        points=[(.105,y,z),(.127,y+s*(i-1.5)*.006,z-.044),(.175,y+s*(i-1.5)*.010,z-.085),(.204,y+s*(i-1.5)*.012,z-.048)]
        tube('finger'+side+str(i),points,[.019,.02,.017,.011],'infectedSkin','hand'+side,N=8)
        ell('knuckle'+side+str(i),(.115,y,z),(.023,.02,.023),'infectedSkin','hand'+side,seg=8,rings=6)
        ell('nail'+side+str(i),(.206,y+s*(i-1.5)*.012,z-.045),(.006,.011,.014),'sidewalk','hand'+side,seg=8,rings=6)
    tube('thumb'+side,[(.105,s*.37,.745),(.15,s*.353,.713),(.178,s*.366,.691)],[.028,.026,.015],'infectedSkin','hand'+side,N=10)
    hip=(0,s*.124,.694);knee=(.024,s*.176,.415);ankle=(-.019,s*.198,.155)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('trouser_thigh'+side,[hip,(-.005,s*.137,.629),(.013,s*.168,.493),knee],[.122,.133,.117,.102],'denim','leg'+side,N=12,sub=1)
    tube('trouser_calf'+side,[knee,(.016,s*.186,.362),(-.008,s*.195,.264),ankle],[.105,.109,.101,.089],'denim','shin'+side,N=12,sub=1)
    for k,z in enumerate([.433,.36,.232,.17]):
        ell('cloth_fold'+side+str(k),(.016 if k<2 else -.013,s*.184,z),(.103,.106,.038),'denim','shin'+side,rot=(s*.12,-.18,0),seg=12,rings=6)
    ell('knee_tear'+side,(.11,s*.171,.457),(.018,.061,.041),'uiDark','leg'+side)
    ell('knee_wound'+side,(.125,s*.171,.46),(.028,.054,.044),'infectedSkin','leg'+side)
    for j in range(3):
        patch('knee_rag'+side+str(j),[(.138,s*(.122+j*.029),.482),(.14,s*(.145+j*.029),.473),(.135,s*(.13+j*.029),.452)],'denim','leg'+side)
    box('shoe_sole'+side,(.048,s*.204,.034),(.288,.184,.068),'leatherShadow','foot'+side,.026)
    box('shoe_welt'+side,(.049,s*.204,.067),(.285,.181,.033),'shoeTan','foot'+side,.018)
    ell('work_shoe'+side,(.049,s*.204,.111),(.143,.087,.081),'leatherShadow','foot'+side)
    ell('shoe_toecap'+side,(.128,s*.204,.095),(.069,.087,.052),'woodWarm','foot'+side)
    ell('shoe_tongue'+side,(-.002,s*.204,.173),(.064,.057,.025),'woodWarm','foot'+side)
    for j in range(4):
        tube('lace'+side+str(j),[(-.03+j*.023,s*.166,.167),(-.026+j*.023,s*.203,.188-j*.006),(-.018+j*.023,s*.243,.161)],[.004]*3,'shoeTan','foot'+side,N=6,sub=0)
    for j in range(7):
        box('sole_tread'+side+str(j),(-.073+j*.039,s*.204,.009),(.016,.164,.015),'leatherShadow','foot'+side,.004)
# Head, strong orbital shapes and screaming mouth; face planes project forward.
ell('cranium',(.009,0,1.349),(.164,.17,.214),'infectedSkin','head',seg=20,rings=14)
ell('jaw',(.07,0,1.235),(.113,.128,.09),'infectedSkin','head')
for s in [-1,1]:
    ell('ear'+str(s),(.012,s*.169,1.321),(.047,.035,.062),'infectedSkin','head')
    ell('ear_inner'+str(s),(.046,s*.18,1.322),(.016,.018,.036),'blood','head')
    ell('cheek'+str(s),(.113,s*.112,1.291),(.038,.048,.054),'infectedSkin','head')
    ell('eye_socket'+str(s),(.141,s*.082,1.37),(.023,.059,.052),'blood','head')
    ell('eye_dark_rim'+str(s),(.157,s*.082,1.37),(.012,.046,.044),'uiDark','head')
    ell('eye_glow'+str(s),(.166,s*.082,1.371),(.016,.041,.039),'eye','head')
    ell('eye_core'+str(s),(.178,s*.079,1.376),(.004,.012,.014),'picketWhite','head',seg=12,rings=8)
    tube('angry_brow'+str(s),[(.159,s*.028,1.399),(.167,s*.072,1.431),(.13,s*.13,1.433)],[.02,.025,.015],'uiDark','head',N=10)
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
def lock(name,start,bend,tip,width,material='hairBrown'):
    p0,p1,p2=map(Vector,[start,bend,tip])
    points=[p0,p0.lerp(p1,.55),p1,p1.lerp(p2,.74),p2]
    tube(name,points,[.014,(width*.85,width*.52),(width,width*.56),(width*.40,width*.29),.002],material,'head',N=8,sub=1)
# Short thick chestnut locks peeking from beneath the hard hat, including nape.
ell('hair_base',(-.035,0,1.451),(.17,.179,.116),'hairBrown','head',seg=16,rings=10)
for j in range(15):
    t=.64+j*(2*math.pi-1.28)/14;x=-.025+.15*math.cos(t);y=.16*math.sin(t)
    lock('hat_nape_lock'+str(j),(x*.77,y*.8,1.453),(x-.026,y*1.04,1.378),(x-.034,y*.96,1.286+(j%3)*.018),.045,'hairBrown' if j%3 else 'hairLight')
for s in [-1,1]:
    lock('sideburn'+str(s),(.03,s*.164,1.455),(.057,s*.171,1.371),(.069,s*.16,1.306),.036)
for j in range(4):
    y=-.104+j*.063
    lock('fringe'+str(j),(.095,y,1.487),(.14,y-.02,1.454),(.152,y-.033,1.412),.035)
# Hardhat: sculpted dome, broad brim, raised crown rib and molded side stiffeners.
v=[];f=[];N=24
for j in range(9):
    t=j*math.pi/16;r=max(.005,math.cos(t))
    for i in range(N):
        angle=i*2*math.pi/N
        v.append((-.019+.193*r*math.cos(angle),.199*r*math.sin(angle),1.484+.184*math.sin(t)))
for j in range(8):
    for i in range(N):f.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
f.extend([tuple(range(N-1,-1,-1)),tuple(8*N+i for i in range(N))])
mesh('hardhat_dome',v,f,'schoolBusYellow','head',1)
ell('hardhat_brim',(.024,0,1.477),(.25,.231,.023),'schoolBusYellow','head',seg=24,rings=8)
tube('helmet_rim',[(-.014+.196*math.cos(i*2*math.pi/32),.205*math.sin(i*2*math.pi/32),1.484) for i in range(33)],[.009]*33,'hoodieShade','head',N=8)
pts=[(-.018+.194*math.cos(t),0,1.495+.183*math.sin(t)) for t in [0,.22,.45,.7,.95,1.2,1.45,1.7,1.95,2.2,2.45,2.7,2.95,math.pi]]
tube('crown_ridge',pts,[(.015,.012)]*len(pts),'schoolBusYellow','head',N=8)
for s in [-1,1]:
    for j in range(3):
        x=-.102+j*.09;y=s*(.171+(.018 if j==1 else 0))
        box('hat_rib'+str(s)+str(j),(x,y,1.511),(.033,.025,.052),'schoolBusYellow','head',.009,rot=(s*-.17,0,0))
    box('helmet_clip'+str(s),(-.13,s*.147,1.487),(.046,.025,.026),'hoodieShade','head',.006)
# Chunky leather tool belt with individual pouches, flaps, seams and rivets.
ell('belt',(0,0,.724),(.171,.234,.042),'leather','hip',seg=20,rings=8)
box('buckle',(.175,0,.725),(.025,.071,.047),'brass','hip',.007)
box('buckle_inner',(.19,0,.725),(.011,.046,.025),'leather','hip',.003)
box('buckle_pin',(.197,0,.725),(.011,.049,.006),'silver','hip',.002)
for s in [-1,1]:
    for j in range(3):
        y=s*(.09+j*.056);x=.177-(j*.033);z=.664-(j%2)*.018
        box('tool_pouch'+str(s)+str(j),(x,y,z),(.06,.072,.103),'woodWarm','hip',.014,rot=(s*.08,-.1,0))
        box('pouch_flap'+str(s)+str(j),(x+.015,y,z+.033),(.053,.078,.036),'leatherShadow','hip',.008)
        ell('pouch_rivet'+str(s)+str(j),(x+.046,y,z+.034),(.005,.007,.007),'brass','hip',seg=8,rings=6)
        tube('pouch_seam'+str(s)+str(j),[(x+.031,y-.025,z+.007),(x+.033,y-.025,z-.033),(x+.034,y+.025,z-.033),(x+.032,y+.025,z+.007)],[.003]*4,'shoeTan','hip',N=6,sub=0)
    box('side_tool_holster'+str(s),(-.048,s*.244,.641),(.081,.067,.153),'woodWarm','hip',.014,rot=(s*.12,0,0))
    box('holster_flap'+str(s),(-.04,s*.284,.689),(.088,.018,.049),'leatherShadow','hip',.009)
    ell('holster_rivet'+str(s),(-.04,s*.297,.682),(.009,.005,.009),'brass','hip',seg=8,rings=6)
    for j in range(3):
        box('rear_pouch'+str(s)+str(j),(-.145,s*(.058+j*.065),.654),(.065,.059,.107),'woodWarm','hip',.01)
        box('rear_pouch_flap'+str(s)+str(j),(-.184,s*(.058+j*.065),.687),(.018,.067,.035),'leatherShadow','hip',.007)
        ell('rear_snap'+str(s)+str(j),(-.197,s*(.058+j*.065),.681),(.005,.006,.006),'brass','hip',seg=8,rings=6)
    # belt loops and jean pocket edging
    for j in range(3):
        y=s*(.081+j*.054)
        box('belt_loop'+str(s)+str(j),(.168-j*.025,y,.742),(.017,.018,.054),'shoeTan','hip',.005)
    tube('jeans_pocket'+str(s),[(.126,s*.115,.691),(.13,s*.19,.646),(.091,s*.234,.633)],[.0035]*3,'denimStitch','hip',N=6,sub=0)
    # Boot collar and tongue belong to feet; leather straps and metal eyelets.
    ell('boot_ankle'+str(s),(-.015,s*.204,.167),(.09,.093,.078),'woodWarm','foot'+('L' if s==1 else 'R'))
    box('padded_boot_collar'+str(s),(-.014,s*.204,.217),(.166,.189,.065),'shoeTan','foot'+('L' if s==1 else 'R'),.023)
    for j in range(4):
        for q in [-1,1]:ell('lace_eyelet'+str(s)+str(j)+str(q),(-.015+j*.024,s*.204+q*.052,.173-j*.007),(.006,.007,.005),'brass','foot'+('L' if s==1 else 'R'),seg=8,rings=6)
# Hammer, screwdriver, tape measure and a box of nails, all seated in belt holders.
tube('hammer_handle',[(-.064,-.274,.538),(-.061,-.269,.633),(-.06,-.263,.751)],[.015,.015,.017],'woodWarm','hip',N=10)
box('hammer_head',(-.06,-.263,.762),(.092,.034,.03),'silver','hip',.008)
box('hammer_claw',(-.106,-.263,.75),(.029,.038,.047),'silver','hip',.006,rot=(0,-.4,0))
tube('screwdriver_shaft',[(.062,.24,.676),(.062,.24,.799)],[.006,.006],'silver','hip',N=8,sub=0)
ell('screwdriver_grip',(.062,.24,.797),(.018,.018,.041),'survivorRed','hip')
box('tape_measure',(.187,-.14,.668),(.041,.047,.044),'schoolBusYellow','hip',.01)
box('tape_clip',(.214,-.14,.668),(.01,.026,.027),'silver','hip',.003)
# True openings at knees and sleeve, with separate torn cloth tongues.
def tear(name,center,size):
    target=bpy.data.objects[name]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=center)
    cutter=bpy.context.object;cutter.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=target.modifiers.new('torn opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=target;bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
for s,side in [(1,'L'),(-1,'R')]:
    tear('trouser_thigh'+side,(.129,s*.171,.457),(.052,.057,.051))
    tear('upper_sleeve'+side,(.087,s*.302,.99),(.047,.042,.045))
    ell('sleeve_skin'+side,(.056,s*.302,.99),(.038,.04,.045),'infectedSkin','arm'+side)
    for j in range(4):
        yy=s*(.263+j*.025)
        patch('sleeve_rag'+side+str(j),[(.096,yy,1.012),(.102,yy+s*.023,1.015),(.104,yy+s*.012,.961-(j%2)*.017)],'asphalt','arm'+side)
    for j in range(3):
        z=.61-j*.059
        tube('denim_fold'+side+str(j),[(.091,s*.101,z+.014),(.125,s*.159,z),(.094,s*.232,z-.014)],[.006,.014,.003],'denimLight','leg'+side,N=8)
    for j in range(2):
        tube('calf_fold'+side+str(j),[(.074,s*.129,.3-j*.058),(.097,s*.19,.318-j*.058),(.067,s*.249,.289-j*.058)],[.004,.011,.002],'denimLight','shin'+side,N=8)
    tube('denim_side_seam'+side,[(-.035,s*.253,.61),(-.034,s*.274,.49),(-.05,s*.27,.28)],[.003]*3,'denimStitch','leg'+side,N=6,sub=0)
# Project thick stylized stains onto nearest surfaces to avoid floating/coplanar decals.
def stain(name,target_names,y,z,ry,rz,par,back=False,material='blood'):
    pts=[(0,y,z)]
    for i in range(9):
        t=2*math.pi*i/9;r=rng.uniform(.65,1.15);pts.append((0,y+math.cos(t)*ry*r,z+math.sin(t)*rz*r))
    o=mesh(name,pts,[(0,i+1,(i+1)%9+1) for i in range(9)],material,par,0)
    bpy.context.view_layer.update();direction=Vector((1,0,0) if back else (-1,0,0));startx=-.6 if back else .6
    for vertex in o.data.vertices:
        start=Vector((startx,vertex.co.y,vertex.co.z));hits=[]
        for n in target_names:
            target=bpy.data.objects[n];inv=target.matrix_world.inverted()
            hit,loc,normal,index=target.ray_cast(inv@start,inv.to_3x3()@direction)
            if hit:hits.append(target.matrix_world@loc)
        if hits:
            hit=min(hits,key=lambda p:(p-start).length);vertex.co.x=hit.x+(-.004 if back else .004)
    for face in o.data.polygons:face.use_smooth=False
for j,(y,z,ry,rz) in enumerate([(-.108,1.29,.024,.042),(.124,1.31,.018,.025),(-.063,1.207,.036,.033),(.04,1.199,.026,.028)]):
    stain('face_blood'+str(j),['cranium','jaw','cheek-1','cheek1'],y,z,ry,rz,'head')
tube('face_blood_stream',[(.163,-.119,1.363),(.162,-.112,1.31),(.174,-.082,1.258)],[.009,.013,.004],'blood','head',N=8)
for j in range(13):
    y=(-1 if j%2 else 1)*(.093+(j%3)*.031);z=.782+(j%5)*.061
    stain('vest_grime'+str(j),['vest_shell','vest_front-1','vest_front1'],y,z,.018+(j%2)*.01,.013+(j%3)*.009,'torso',material='leatherShadow' if j%3 else 'blood')
for j in range(8):
    y=-.13+j*.037;z=.85+(j%3)*.074
    stain('back_grime'+str(j),['vest_shell'],y,z,.024,.023,'torso',back=True,material='leatherShadow' if j%2 else 'blood')
for s,side in [(1,'L'),(-1,'R')]:
    for j in range(3):
        stain('forearm_blood'+side+str(j),['forearm_skin'+side],s*(.382+j*.011),.828-j*.023,.021,.025,'foreArm'+side)
    stain('claw_blood'+side,['palm'+side],s*.421,.726,.04,.037,'hand'+side)
    stain('knee_blood'+side,['knee_wound'+side],s*.18,.453,.026,.014,'leg'+side)
    stain('jeans_dust'+side,['trouser_thigh'+side],s*.17,.553,.046,.021,'leg'+side,material='denimLight')
    stain('calf_dust'+side,['trouser_calf'+side],s*.19,.283,.042,.018,'shin'+side,material='denimLight')
for j in range(9):
    y=-.145+j*.038;z=1.512+(j%3)*.037
    stain('helmet_scuff'+str(j),['hardhat_dome','hardhat_brim'],y,z,.013+(j%2)*.008,.011+(j%3)*.005,'head',material='blood' if j%3==0 else 'hoodieShade')
# Radio clipped to vest: grille bars and amber button.
box('radio',(.228,-.172,.995),(.035,.039,.071),'uiDark','torso',.008)
for j in range(4):box('radio_grille'+str(j),(.249,-.172,.979+j*.01),(.005,.026,.003),'silver','torso',.001)
tube('radio_antenna',[(.226,-.179,1.027),(.219,-.181,1.082)],[.003,.002],'uiDark','torso',N=6,sub=0)
ell('radio_button',(.252,-.17,1.019),(.004,.006,.005),'schoolBusYellow','torso',seg=8,rings=6)
# Asymmetric gloves and wrist wrap match the reference's battered work gear.
for o in objects:
    if o.name=='palmL' or o.name.startswith(('fingerL','knuckleL','thumbL')):
        o.data.materials.clear();o.data.materials.append(M['leatherShadow'])
tube('glove_cuffL',[(.075,.405,.784),(.08,.416,.76),(.084,.42,.748)],[.055,.059,.059],'leather','handL',N=12)
box('glove_strapL',(.139,.416,.766),(.018,.075,.02),'woodWarm','handL',.006)
ell('glove_snapL',(.154,.416,.766),(.005,.009,.007),'brass','handL',seg=8,rings=6)
tube('wrist_bandageR',[(.072,-.407,.771),(.079,-.416,.754),(.084,-.42,.744)],[.052,.053,.051],'bandage','foreArmR',N=12)
for j in range(3):
    tube('bandage_overlapR'+str(j),[(.125,-.388,.768-j*.007),(.139,-.416,.773-j*.007),(.122,-.444,.762-j*.007)],[.0025]*3,'picketWhite','foreArmR',N=6,sub=0)
# Jagged rims around the exposed knees, with cloth fragments of varied lengths.
for s,side in [(1,'L'),(-1,'R')]:
    for j in range(6):
        t=j*2*math.pi/6;y=s*.171+.054*math.cos(t);z=.457+.043*math.sin(t)
        patch('knee_fray'+side+str(j),[(.148,y-.012,z+.011),(.149,y+.014,z+.008),(.154,y+.006,z-.013-(j%2)*.011)],'denim','leg'+side)
    for j in range(3):
        y=s*(.17+j*.02);z=.509+j*.025
        stain('denim_scuff'+side+str(j),['trouser_thigh'+side],y,z,.016,.005,'leg'+side,material='denimLight')
    # Dust and scrapes on the boots follow the leather toe and collar surfaces.
    stain('boot_dust'+side,['shoe_toecap'+side,'work_shoe'+side],s*.202,.113,.05,.012,'foot'+side,material='shoeTan')
for s in [-1,1]:
    for j in range(2):
        box('helmet_side_vent'+str(s)+str(j),(-.094+j*.063,s*.193,1.514),(.038,.011,.013),'hoodieShade','head',.004)
# Blood beneath collar, on the chest and hardhat brim, irregular raised stains.
for j in range(3):
    stain('shirt_blood'+str(j),['shirt_body'],(-.031+j*.028),1.027-j*.026,.012,.021,'torso')
    stain('helmet_brim_blood'+str(j),['hardhat_brim'],-.109+j*.089,1.48,.015,.009,'head')

# Caps stay on proximal parts so they remain when distal nodes are detached.
for key,parent,p,sz in [('head','torso',(.014,0,1.19),(.075,.084,.012)),('armL','torso',(-.008,.237,1.076),(.077,.016,.077)),('armR','torso',(-.008,-.237,1.076),(.077,.016,.077)),('foreArmL','armL',(.021,.343,.899),(.065,.014,.06)),('foreArmR','armR',(.021,-.343,.899),(.065,.014,.06)),('legL','hip',(0,.124,.694),(.09,.095,.012)),('legR','hip',(0,-.124,.694),(.09,.095,.012))]:
    o=ell('stump_'+key,p,sz,'blood',parent,seg=12,rings=6);o['stumpFor']=key;o['hidden']=True;o.scale=(0,0,0)
# Applied subdivision defines the sculpted forms; reduce redundant triangles for the crowd budget.
for o in objects:
    if sum(len(f.vertices)-2 for f in o.data.polygons)>80:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('game mesh reduction','DECIMATE');mod.ratio=.32
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
parts['head'].scale=(1.48,1.53,1.15)
parts['hip'].location.z-=.10
parts['torso'].rotation_euler.y=.24
parts['head'].rotation_euler.y=-.10
for side,sign in [('L',1),('R',-1)]:
    parts['arm'+side].rotation_euler=(sign*.17,-.40 if side=='L' else -.52,0)
    parts['foreArm'+side].rotation_euler.y=-.38 if side=='L' else -.45
    parts['hand'+side].scale=(1.38,1.45,1.40)
    parts['hand'+side].rotation_euler.z=math.pi
    parts['leg'+side].rotation_euler.y=-.34 if side=='L' else -.42
    parts['shin'+side].rotation_euler.y=.72 if side=='L' else .80
    parts['foot'+side].rotation_euler.y=-.38
    parts['foot'+side].scale=(1.23,1.26,1.13)
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
if a.pose:
    parts['armL'].rotation_euler.x=.45;parts['foreArmL'].rotation_euler.y=-.55;parts['legR'].rotation_euler.y=-.35
    bpy.context.view_layer.update()
    (P/'pose-proof.json').write_text(json.dumps({n:list(parts[n].rotation_euler) for n in ['armL','foreArmL','legR']},indent=2))
if a.stump:
    # Cap belongs to the proximal torso and stays behind after left arm detaches.
    for o in objects:
        p=o.parent
        while p:
            if p==parts['armL']:o.hide_render=True;break
            p=p.parent
    cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
if a.render and a.view in ['turnaround','pose-sheet']:
    # Assemble already-rendered camera views in Blender, without another GPU render.
    import numpy as np
    names=['front.png','side.png','back.png','review-hero.png'] if a.view=='turnaround' else ['pose-intact.png','pose-stump.png']
    paths=[P/'renders'/n for n in names]
    panels=[]
    for path in paths:
        im=bpy.data.images.load(str(path));w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-480)//2:(w+480)//2,:])
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
    views={'cap':(4,6,2.9),'hero':(6,-4,2.9),'front':(6,0,1.35),'side':(0,-6,1.35),'back':(-6,0,1.35)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.10*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG';S.render.filepath=a.render;bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(objects),'meshes')
