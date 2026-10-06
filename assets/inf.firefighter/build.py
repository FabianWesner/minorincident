"""Deterministic rigid-part hero infected firefighter. +X forward, Z up, -Y character right.
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
M={k:mat(k,v,r) for k,v,r in [('infectedSkin','c9a39a',.68),('picketWhite','f2e6dc',.85),('asphalt','5b4f5c',.8),('uiDark','25222c',.78),('blood','b3121f',.35),('survivorRed','d9363e',.73),('sidewalk','b9a4a0',.8)]}
palette=json.loads(Path('src/assets/palette.json').read_text())
for token in ['khaki','khakiLight','khakiSeam','silver','hairChestnut','hairHighlight','woodWarm','schoolBusYellow','brass']:
    M[token]=mat(token,palette[token].lstrip('#'),.6)
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
# Turnout jacket: separate sculpted shell, raised collar, storm flap and pockets.
ell('pelvis',(0,0,.67),(.17,.23,.13),'khaki','hip')
ell('jacket_body',(.015,0,.96),(.21,.27,.26),'khaki','torso',seg=16,rings=10)
ell('jacket_hem',(.008,0,.755),(.219,.272,.09),'khakiLight','torso',seg=16,rings=8)
ell('hood',(-.10,0,1.135),(.145,.186,.113),'khakiLight','torso',seg=14,rings=8)
for s in [-1,1]:
    tube('collar'+str(s),[(.07,s*.08,1.19),(.126,s*.13,1.16),(.178,s*.115,1.075)],[.045,.052,.025],'khakiLight','torso')
    box('chest_pocket'+str(s),(.211,s*.138,.952),(.04,.107,.117),'khakiLight','torso',.018)
    box('pocket_flap'+str(s),(.24,s*.138,1.003),(.018,.122,.039),'khaki','torso',.007)
    ell('pocket_snap'+str(s),(.252,s*.138,.999),(.008,.009,.009),'brass','torso',seg=8)
box('storm_flap',(.224,0,.987),(.032,.048,.29),'khakiLight','torso',.01)
for j in range(5):ell('jacket_snap'+str(j),(.246,0,.869+j*.052),(.008,.009,.009),'brass','torso',seg=8)
# Wrapped reflector bands: broad yellow webbing with silver centers.
def band(n,z,rx,ry,width,parent):
    for label,dz,h,m in [('yellow',0,width,'schoolBusYellow'),('silver',0,width*.42,'silver')]:
        v=[];f=[];N=48
        for zz in [z+dz-h/2,z+dz+h/2]:
            for j in range(N):
                t=j*math.tau/N;v.append((.008+(rx+(.005 if label=='silver' else 0))*math.cos(t),(ry+(.005 if label=='silver' else 0))*math.sin(t),zz))
        for j in range(N):f.append((j,(j+1)%N,(j+1)%N+N,j+N))
        o=mesh(n+label,v,f,m,parent,0);mod=o.modifiers.new('webbing thickness','SOLIDIFY');mod.thickness=.005;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
band('chest_reflector',.84,.215,.271,.053,'torso')
band('hem_reflector',.741,.21,.261,.058,'torso')
band('belt',.792,.23,.278,.05,'torso')
# Black waist belt lies above reflector, with metallic buckle.
for s in [-1,1]:
    tube('belt_half'+str(s),[(.23,0,.789),(.21,s*.2,.789),(-.05,s*.281,.789),(-.224,s*.13,.789)],[.024]*4,'uiDark','torso',N=8)
box('belt_buckle',(.254,0,.789),(.023,.089,.063),'silver','torso',.007)
box('belt_buckle_inset',(.269,0,.789),(.01,.059,.038),'uiDark','torso',.005)
# Articulated limbs. Elbows forward, gloves huge, legs planted with bent knees.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(0,s*.263,1.108);elbow=(.05,s*.374,.946);wrist=(.177,s*.4,.852)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    tube('upper_sleeve'+side,[shoulder,(.01,s*.29,1.09),(.034,s*.343,.998),elbow],[.112,.133,.12,.10],'khaki','arm'+side,N=12)
    tube('lower_sleeve'+side,[elbow,(.102,s*.394,.921),wrist],[.115,.118,.087],'khakiLight','foreArm'+side,N=12)
    # Reflector cuff cylinders aligned to forearm, no flat decals.
    axis=(Vector(wrist)-Vector(elbow)).normalized()
    for k,t in enumerate([.28,.52]):
        mid=Vector(elbow).lerp(Vector(wrist),t)
        tube('cuff_yellow'+side+str(k),[mid-axis*.017,mid,mid+axis*.017],[.12]*3,'schoolBusYellow','foreArm'+side,N=16,sub=0)
        tube('cuff_silver'+side+str(k),[mid-axis*.006,mid+axis*.006],[.124]*2,'silver','foreArm'+side,N=16,sub=0)
    tube('black_glove_cuff'+side,[Vector(wrist)-axis*.025,Vector(wrist)+axis*.02],[.092,.096],'uiDark','hand'+side,N=12)
    ell('glove_palm'+side,(.217,s*.402,.821),(.085,.089,.09),'uiDark','hand'+side)
    for i in range(4):
        y=s*(.338+i*.041);z=.80+(i%2)*.007
        tube('glove_finger'+side+str(i),[(.24,y,z),(.28,y,z-.045),(.265,y,z-.08),(.222,y,z-.074)],[.024,.025,.022,.017],'asphalt','hand'+side,N=8)
        ell('glove_knuckle'+side+str(i),(.276,y,z),(.024,.023,.025),'asphalt','hand'+side,seg=8)
    tube('thumb'+side,[(.214,s*.323,.86),(.274,s*.313,.83),(.297,s*.331,.798)],[.037,.033,.024],'uiDark','hand'+side)
    hip=(0,s*.135,.68);knee=(.068,s*.195,.419);ankle=(-.027,s*.224,.157)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('thigh'+side,[hip,(.008,s*.154,.615),(.047,s*.183,.49),knee],[.139,.149,.131,.113],'khaki','leg'+side,N=12)
    tube('calf'+side,[knee,(.054,s*.208,.351),(-.001,s*.218,.232),ankle],[.12,.127,.115,.105],'khakiLight','shin'+side,N=12)
    for j,z in enumerate([.32,.263]):
        axis=(Vector(ankle)-Vector(knee)).normalized();mid=Vector(knee).lerp(Vector(ankle),(.419-z)/.262)
        tube('ankle_yellow'+side+str(j),[mid-axis*.022,mid+axis*.022],[.131,.13],'schoolBusYellow','shin'+side,N=16,sub=0)
        tube('ankle_silver'+side+str(j),[mid-axis*.008,mid+axis*.008],[.135,.134],'silver','shin'+side,N=16,sub=0)
    for j,z in enumerate([.61,.52,.40,.20]):
        par='leg'+side if j<2 else 'shin'+side
        ell('cloth_crease'+side+str(j),(.04,s*.196,z),(.132,.125,.033),'khaki',''+par,rot=(s*.12,-.15,0),seg=10)
    box('boot_sole'+side,(.048,s*.228,.036),(.326,.222,.072),'uiDark','foot'+side,.025)
    box('boot_welt'+side,(.048,s*.228,.071),(.328,.226,.026),'khakiSeam','foot'+side,.012)
    ell('boot'+side,(.046,s*.228,.133),(.167,.107,.096),'uiDark','foot'+side,seg=14)
    ell('boot_toe'+side,(.148,s*.228,.122),(.081,.11,.063),'asphalt','foot'+side)
    box('boot_tongue'+side,(-.019,s*.228,.203),(.104,.115,.048),'asphalt','foot'+side,.015)
    for j in range(5):box('boot_tread'+side+str(j),(-.074+j*.062,s*.228,.008),(.032,.226,.016),'uiDark','foot'+side,.004)
    for j in range(3):tube('boot_lace'+side+str(j),[(.01+j*.029,s*.175,.212-j*.014),(.018+j*.029,s*.228,.228-j*.014),(.01+j*.029,s*.282,.212-j*.014)],[.005]*3,'khakiSeam','foot'+side,N=6,sub=0)
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
# Thick chestnut hair locks remain visible beneath the helmet at ears and nape.
for j in range(15):
    t=.55+j*(math.tau-1.1)/14
    x=-.025+.158*math.cos(t);y=.17*math.sin(t)
    tube('hair_lock'+str(j),[(x*.8,y*.82,1.477),(x,y,1.403),(x-.026,y*1.08,1.33),(x-.052,y*1.01,1.29)],[.034,.049,.036,.003],'hairChestnut','head',N=8)
    if j%3==0:tube('hair_highlight'+str(j),[(x+.008,y,1.43),(x+.012,y*1.02,1.37),(x-.035,y*1.03,1.315)],[.004,.006,.002],'hairHighlight','head',N=6)
# Red firefighter helmet: sculpted dome, wide rolled brim and raised radial ribs.
ell('helmet_brim',(-.009,0,1.473),(.266,.243,.025),'survivorRed','head',seg=24,rings=8)
ell('helmet_black_rim',(-.01,0,1.46),(.255,.237,.015),'uiDark','head',seg=24,rings=8)
ell('helmet_dome',(-.035,0,1.522),(.21,.203,.169),'survivorRed','head',seg=24,rings=14)
for j in range(8):
    t=j*math.tau/8
    pts=[]
    for k in range(8):
        angle=.1+k*1.38/7;pts.append((-.035+.214*math.sin(angle)*math.cos(t),.207*math.sin(angle)*math.sin(t),1.522+.172*math.cos(angle)))
    tube('helmet_rib'+str(j),pts,[.009]*8,'survivorRed','head',N=6)
# Circumferential helmet reflector belt.
for j in range(24):
    t=j*math.tau/24
    box('helmet_band'+str(j),(-.035+.205*math.cos(t),.20*math.sin(t),1.508),(.013,.054,.028),'schoolBusYellow','head',.004,rot=(0,0,t))
# Shield front with layered border and an invented fire-department emblem.
shield=[(.235,-.071,1.492),(.235,.071,1.492),(.235,.08,1.586),(.235,.054,1.622),(.235,0,1.65),(.235,-.054,1.622),(.235,-.08,1.586)]
patch('helmet_shield_border',shield,'brass','head',.016)
patch('helmet_shield',[(x+.007,y*.86,1.567+(z-1.567)*.87) for x,y,z in shield],'uiDark','head',.013)
# Stylized crossed axes and central flame on the shield.
for s in [-1,1]:
    tube('badge_cross_axe'+str(s),[(.25,-s*.041,1.52),(.25,s*.04,1.607)],[.004,.004],'brass','head',N=6,sub=0)
    box('badge_axe_head'+str(s),(.254,s*.03,1.599),(.008,.026,.02),'brass','head',.003)
patch('badge_flame',[(.261,-.018,1.54),(.261,-.022,1.565),(.261,-.009,1.59),(.261,0,1.578),(.261,.009,1.604),(.261,.022,1.56),(.261,.014,1.54)],'schoolBusYellow','head')
ell('shield_rivet',(.258,0,1.621),(.007,.007,.007),'silver','head',seg=8)
# Conform the shield and emblem to the helmet's sloping forehead.
for o in objects:
    if o.name.startswith(('helmet_shield','badge_','shield_rivet')):
        bpy.context.view_layer.update();world=o.matrix_world.copy();inv=world.inverted()
        for vertex in o.data.vertices:
            p=world@vertex.co;p.x-=.65*(p.z-1.492);vertex.co=inv@p
# SCBA harness and rear cylinder, mounted to backpackSocket.
for s in [-1,1]:
    tube('shoulder_harness'+str(s),[(.226,s*.16,.81),(.226,s*.199,.99),(.11,s*.198,1.166),(-.13,s*.177,1.183),(-.242,s*.151,1.085)],[.023,.035,.039,.033,.026],'uiDark','torso',N=8)
    box('strap_buckle'+str(s),(.26,s*.195,1.01),(.025,.065,.07),'silver','torso',.008)
    box('strap_buckle_inner'+str(s),(.276,s*.195,1.01),(.011,.038,.043),'uiDark','torso',.004)
    box('rear_harness_rail'+str(s),(-.258,s*.113,.962),(.053,.041,.455),'uiDark','backpackSocket',.014)
box('airpack_frame',(-.273,0,.972),(.055,.243,.417),'asphalt','backpackSocket',.018)
tube('air_cylinder',[(-.357,0,z) for z in [.74,.77,.80,1.19,1.22,1.25]],[(.04,.035),(.09,.08),(.116,.10),(.116,.10),(.09,.08),(.04,.035)],'silver','backpackSocket',N=16)
for z in [.82,1.15]:
    tube('tank_retainer'+str(z),[(-.359,-.116,z),(-.461,0,z),(-.359,.116,z)],[.018]*3,'uiDark','backpackSocket',N=8)
for z in [.854,1.18]:
    # Bands wrap around cylinder in XY.
    pts=[(-.357+.103*math.cos(j*math.tau/32),.12*math.sin(j*math.tau/32),z) for j in range(33)]
    tube('tank_yellow'+str(z),pts,[.011]*33,'schoolBusYellow','backpackSocket',N=6,sub=0)
ell('tank_bottom',(-.357,0,.759),(.101,.112,.058),'asphalt','backpackSocket')
box('tank_valve',(-.357,0,.71),(.083,.087,.069),'brass','backpackSocket',.012)
ell('valve_wheel',(-.406,0,.69),(.037,.063,.02),'uiDark','backpackSocket')
tube('breathing_hose',[(-.37,-.095,.722),(-.28,-.245,.76),(-.13,-.305,.913),(.06,-.267,1.15)],[.023]*4,'uiDark','torso',N=10)
# Hazard mark on rear tank, raised to avoid z fighting.
patch('tank_hazard', [(-.47,-.043,1.036),(-.47,.043,1.036),(-.47,0,1.111)],'schoolBusYellow','backpackSocket',-.006)
for j in range(3):
    t=j*math.tau/3;ell('hazard_lobe'+str(j),(-.48,.018*math.cos(t),1.067+.018*math.sin(t)),(.004,.012,.012),'uiDark','backpackSocket',seg=8)
# Socketed axe: walnut shaft across the gloves, red head with bright cutting bevel.
node('weaponSocketR',(.244,-.405,.81),'handR');node('weaponSocketL',(.244,.405,.81),'handL')
node('axe',(.244,-.405,.81),'weaponSocketR')
tube('axe_handle',[(.31,-.58,.67),(.28,-.42,.79),(.20,.26,1.06),(.17,.47,1.15)],[.028,.03,.028,.024],'woodWarm','axe',N=12)
tube('axe_handle_grain',[(.329,-.55,.688),(.304,-.38,.806),(.229,.28,1.075)],[.003]*3,'brass','axe',N=6)
ell('axe_endcap',(.311,-.581,.67),(.036,.032,.036),'survivorRed','axe')
patch('axe_head',[(.178,.29,1.142),(.178,.51,1.24),(.178,.63,1.055),(.178,.53,.999),(.178,.36,1.068)],'survivorRed','axe',.076)
patch('axe_cutting_edge',[(.192,.53,.999),(.192,.63,1.055),(.192,.653,1.023),(.192,.55,.963)],'silver','axe',.101)
patch('axe_pick',[(.178,.30,1.157),(.178,.25,1.235),(.178,.13,1.292),(.178,.265,1.087)],'survivorRed','axe',.071)
box('axe_eye_plate',(.199,.393,1.139),(.016,.075,.061),'silver','axe',.007,rot=(.35,0,0))
ell('axe_pin',(.214,.393,1.139),(.008,.012,.012),'brass','axe',seg=8)

# True torn openings expose stylized wound surfaces, edged by ragged cloth tongues.
def tear(target,center,size,parent):
    obj=bpy.data.objects[target]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=center)
    cutter=bpy.context.object;cutter.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=obj.modifiers.new('torn opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
    ell('exposed_'+target,(center[0]-.033,center[1],center[2]),(size[0]*.43,size[1]*.88,size[2]*.85),'blood',parent)
    for j in range(4):
        y=center[1]-size[1]+j*size[1]*.52
        patch('rag_'+target+str(j),[(center[0],y,center[2]+size[2]*.75),(center[0]+.004,y+.024,center[2]+size[2]*.78),(center[0]+.008,y+.013,center[2]+size[2]*.30)],'khaki',parent)
tear('thighR',(.15,-.184,.494),(.07,.076,.077),'legR')
tear('upper_sleeveR',(.118,-.319,1.047),(.063,.055,.057),'armR')
tear('upper_sleeveL',(.115,.322,1.044),(.055,.053,.047),'armL')
# Stains projected onto the exact outer shell, with >= 3 mm separation.
def stain(name,target,y,z,ry,rz,front=True):
    obj=bpy.data.objects[target];bpy.context.view_layer.update();inv=obj.matrix_world.inverted();direction=Vector((-1,0,0) if front else (1,0,0));startx=.8 if front else -.8
    vertices=[]
    for j in range(10):
        t=j*math.tau/10;r=rng.uniform(.62,1.12);start=Vector((startx,y+ry*math.cos(t)*r,z+rz*math.sin(t)*r))
        hit,loc,normal,index=obj.ray_cast(inv@start,inv.to_3x3()@direction)
        if not hit:return
        world=obj.matrix_world@loc;world.x+=.004 if front else -.004;vertices.append(world)
    o=mesh(name,vertices,[tuple(range(len(vertices)))],'blood',obj.parent.name,0)
    for face in o.data.polygons:face.use_smooth=False
for j,(target,y,z,ry,rz,front) in enumerate([
    ('jacket_body',-.14,1.06,.045,.066,True),('jacket_body',.10,.90,.03,.04,True),('jacket_hem',-.10,.745,.04,.041,True),
    ('thighL',.19,.53,.041,.068,True),('calfR',-.224,.37,.04,.029,True),
    ('upper_sleeveR',-.315,1.09,.04,.035,True),('lower_sleeveL',.39,.94,.032,.03,True),
    ('jacket_body',.15,.965,.036,.06,False),('jacket_body',-.13,1.05,.041,.041,False),
    ('cranium',-.11,1.32,.025,.049,True),('jaw',-.06,1.205,.04,.029,True)]):stain('blood_stain'+str(j),target,y,z,ry,rz,front)
tube('cheek_blood',[(.168,-.118,1.365),(.162,-.12,1.30),(.174,-.078,1.26)],[.009,.012,.004],'blood','head',N=6)
tube('chin_blood',[(.188,-.017,1.19),(.16,-.025,1.15),(.143,-.025,1.122)],[.014,.013,.002],'blood','head',N=6)
for j in range(5):
    stain('jacket_fleck'+str(j),'jacket_body',-.14+j*.054,.92+(j%2)*.106,.009,.013)
# Hidden proximal caps survive when the distal limb is detached.
for key,parent,p,sz in [('head','torso',(.015,0,1.19),(.075,.084,.012)),('armL','torso',(0,.263,1.108),(.083,.017,.083)),('armR','torso',(0,-.263,1.108),(.083,.017,.083)),('foreArmL','armL',(.05,.374,.946),(.071,.016,.066)),('foreArmR','armR',(.05,-.374,.946),(.071,.016,.066)),('legL','hip',(0,.135,.68),(.105,.106,.015)),('legR','hip',(0,-.135,.68),(.105,.106,.015))]:
    o=ell('stump_'+key,p,sz,'blood',parent,seg=12);o['stumpFor']=key;o['hidden']=True;o.scale=(0,0,0)
# Head is one third of the silhouette, matching the accepted infected proportions.
parts['head'].scale=(1.23,1.28,1.21)
parts['root'].scale=(.95,.95,.95)
for sign in [-1,1]:
    tube('jacket_side_seam'+str(sign),[(-.02,sign*.275,.77),(-.005,sign*.274,.94),(-.02,sign*.252,1.09)],[.004]*3,'khakiSeam','torso',N=6,sub=0)
    tube('cheek_wound'+str(sign),[(.172,sign*.105,1.338),(.18,sign*.097,1.29),(.19,sign*.06,1.232)],[.007,.012,.006],'blood','head',N=6)
# Purposeful cloth folds across jacket and sleeves.
for side,sign in [('L',1),('R',-1)]:
    for j,z in enumerate([1.03,.977,.924]):
        tube('sleeve_fold'+side+str(j),[(.08,sign*.287,z+.02),(.135,sign*.327,z),(.11,sign*.357,z-.017)],[.009,.014,.004],'khakiLight','arm'+side,N=8)
    for j,z in enumerate([.9,.965,1.055]):
        tube('jacket_wrinkle'+side+str(j),[(.19,sign*.055,z+.014),(.215,sign*.113,z),(.17,sign*.198,z-.025)],[.003,.008,.002],'khakiLight','torso',N=8)
# Match the reference axe direction: high on the model's right, low on its left.
reflection=Matrix.Translation((0,0,.81))@Matrix.Rotation(.24,4,'X')@Matrix.Translation((0,0,-.95))@Matrix.Scale(-1,4,Vector((0,1,0)))
for o in objects:
    if o.parent==parts['axe']:
        bpy.context.view_layer.update();o.data.transform(o.matrix_world.inverted()@reflection@o.matrix_world)
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
parts['torso'].scale=(1.05,1.08,1)
parts['torso'].rotation_euler.y=.10
parts['head'].location.z-=.027
for side in ['L','R']:
    parts['hand'+side].scale=(1.12,1.12,1.12)

# Applied subdivision is reduced gently before triangulation.
for o in objects:
    if sum(len(f.vertices)-2 for f in o.data.polygons)>100:
        bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('crowd budget','DECIMATE');mod.ratio=.44;bpy.ops.object.modifier_apply(modifier=mod.name)

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
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','weaponSocketR','weaponSocketL','backpackSocket']+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
triangles=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
(P/'build-stats.json').write_text(json.dumps({'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in bpy.data.objects]},indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if a.pose:
    parts['armL'].rotation_euler.x=.55;parts['foreArmL'].rotation_euler.y=-.75;parts['legR'].rotation_euler.y=-.4
    bpy.data.objects['stump_armL'].scale=(1,1,1)
    for o in objects:
        p=o.parent
        while p:
            if p==parts['armR']:o.hide_render=True;break
            p=p.parent
    bpy.data.objects['stump_armR'].scale=(1,1,1)
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
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.13*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG';S.render.filepath=a.render;bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(objects),'meshes')
