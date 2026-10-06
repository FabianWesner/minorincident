"""Deterministic rigid-part hero Hazmat. +X forward, Z up, -Y character right.
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
M={k:mat(k,v,r) for k,v,r in [('infectedSkin','c9a39a',.68),('picketWhite','f2e6dc',.85),('asphalt','5b4f5c',.8),('uiDark','25222c',.78),('blood','b3121f',.35),('sidewalk','b9a4a0',.8)]}
M['schoolBusYellow']=mat('schoolBusYellow','f2b630',.62)
M['woodWarm']=mat('woodWarm','b0703f',.73)
M['leak']=mat('foliage','7da23c',.22, .45)
M['visor']=mat('backpackTeal','2f6e6a',.17)
M['visor'].node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.16
M['visor'].diffuse_color=(.027,.16,.145,.16)
M['visor'].surface_render_method='BLENDED'
M['eye']=mat('infectedEye','ff3b2f',.24,2.5)
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o
node('root',(0,0,0));node('hip',(-.04,0,.68),'root');node('torso',(-.02,0,.79),'hip');node('head',(.08,0,1.16),'torso');node('backpackSocket',(-.24,0,1.02),'torso')
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
# Suit volumes follow the bent limbs; decorations belong to the corresponding joint.
ell('suit_hip',(-.05,0,.695),(.19,.245,.16),'schoolBusYellow','hip',seg=16,rings=10)
ell('suit_torso',(.006,0,.95),(.195,.251,.265),'schoolBusYellow','torso',rot=(0,.17,0),seg=20,rings=12)
def cut(name,center,size):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=center)
    c=bpy.context.object;c.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o=bpy.data.objects[name];mod=o.modifiers.new('real torn opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=c
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(c,do_unlink=True)
def cyl(n,p,r,depth,m,par,axis=(1,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=depth,location=p);o=bpy.context.object
    o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    mod=o.modifiers.new('rounded rim','BEVEL');mod.width=.009;mod.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,n,m,par)
def tear(name,p,size,par):
    cut(name,p,size)
    ell(name+'_lining',(p[0]-(.036 if p[0]>0 else -.036),p[1],p[2]),(size[0]*.38,size[1]*.93,size[2]*.90),'blood',par)
    for j in range(5):
        t=j*math.tau/5+.13*(j%2); y=p[1]+size[1]*math.cos(t);z=p[2]+size[2]*math.sin(t)
        patch(name+'_rag'+str(j),[(p[0]-.009,y-.022,z+.017),(p[0]+.005,y+.02,z+.011),(p[0]+.016,y+.006,z-.017-(j%3)*.009)],'schoolBusYellow',par,.012)
# Zipper and waist folds.
tube('zipper_tape',[(.17,0,.72),(.209,0,.9),(.19,0,1.1)],[.014]*3,'woodWarm','torso',N=8)
for j in range(14):box('zipper_tooth'+str(j),(.209,0,.80+j*.018),(.016,.018,.006),'sidewalk','torso',.002)
box('zipper_pull',(.212,0,1.067),(.024,.02,.04),'uiDark','torso',.006)
for s,side in [(1,'L'),(-1,'R')]:
    sh=(.005,s*.236,1.08);el=(.10,s*.345,.91);wr=(.20,s*.40,.77)
    node('arm'+side,sh,'torso');node('foreArm'+side,el,'arm'+side);node('hand'+side,wr,'foreArm'+side)
    tube('sleeve'+side,[sh,(.035,s*.275,1.06),(.085,s*.33,.96),el],[.113,.13,.113,.099],'schoolBusYellow','arm'+side,N=12)
    tube('lower_sleeve'+side,[el,(.145,s*.378,.85),wr],[.111,.118,.085],'schoolBusYellow','foreArm'+side,N=12)
    tube('glove_gauntlet'+side,[(.172,s*.39,.82),wr,(.223,s*.411,.734)],[.09,.096,.081],'uiDark','foreArm'+side,N=12)
    tube('glove_seal'+side,[(.164,s*.386,.825),(.173,s*.39,.812)],[.096,.096],'asphalt','foreArm'+side,N=12)
    ell('glove_palm'+side,(.236,s*.408,.72),(.087,.095,.085),'uiDark','hand'+side,seg=12,rings=8)
    for j in range(4):
        y=s*(.333+j*.047);z=.715-(j%2)*.009
        tube('rubber_claw'+side+str(j),[(.253,y,z),(.287,y,z-.048),(.319,y,z-.086),(.34,y,z-.051)],[.026,.028,.024,.014],'uiDark','hand'+side,N=8)
        ell('glove_knuckle'+side+str(j),(.29,y,z),(.023,.025,.02),'asphalt','hand'+side)
    tube('thumb'+side,[(.225,s*.335,.755),(.28,s*.31,.72),(.309,s*.334,.69)],[.035,.033,.024],'uiDark','hand'+side,N=8)
    hp=(-.04,s*.13,.70);kn=(.07,s*.19,.41);an=(-.025,s*.23,.17)
    node('leg'+side,hp,'hip');node('shin'+side,kn,'leg'+side);node('foot'+side,an,'shin'+side)
    tube('thigh'+side,[hp,(-.01,s*.151,.61),(.067,s*.18,.46),kn],[.137,.149,.135,.118],'schoolBusYellow','leg'+side,N=12)
    tube('calf'+side,[kn,(.031,s*.217,.33),an],[.12,.126,.094],'schoolBusYellow','shin'+side,N=12)
    for j,z in enumerate([.57,.48,.38,.27]):
        par='leg'+side if j<2 else 'shin'+side
        tube('suit_crease'+side+str(j),[(.075,s*.10,z+.024),(.123,s*.18,z),(.071,s*.275,z-.014)],[.005,.022,.006],'schoolBusYellow',par,N=8)
    tube('boot_shaft'+side,[(-.025,s*.23,.16),(-.016,s*.224,.23)],[.094,.105],'uiDark','foot'+side,N=12)
    tube('boot_top_seal'+side,[(-.014,s*.224,.242),(-.012,s*.224,.257)],[.112,.11],'asphalt','foot'+side,N=12)
    box('boot_sole'+side,(.049,s*.23,.036),(.348,.232,.072),'uiDark','foot'+side,.027)
    box('boot_welt'+side,(.052,s*.23,.075),(.35,.236,.025),'woodWarm','foot'+side,.012)
    ell('boot_upper'+side,(.04,s*.23,.118),(.168,.11,.097),'uiDark','foot'+side,seg=12,rings=8)
    ell('toe_guard'+side,(.139,s*.23,.103),(.09,.111,.066),'asphalt','foot'+side)
    for j in range(6):
        box('boot_tread'+side+str(j),(-.092+j*.055,s*.23,.009),(.029,.219,.018),'uiDark','foot'+side,.004)
    for j in range(4):
        tube('boot_lace'+side+str(j),[(-.014+j*.021,s*.17,.19-j*.011),(.009+j*.02,s*.23,.201-j*.013),(-.012+j*.021,s*.29,.19-j*.011)],[.004]*3,'sidewalk','foot'+side,N=6,sub=0)
    tear('sleeve'+side,(.124,s*.289,1.018),(.065,.048,.06),'arm'+side)
    tear('thigh'+side,(.155,s*.173,.495),(.08,.062,.062),'leg'+side)
# Hood is a sculpted shell with a true front opening, not a solid ball over the face.
ell('hood',(.034,0,1.39),(.254,.263,.281),'schoolBusYellow','head',seg=24,rings=16)
for vertex in bpy.data.objects['hood'].data.vertices:
    z=vertex.co.z
    if z>.13:
        vertex.co.z += .029*((z-.13)/.15)**2
        vertex.co.x -= .016*((z-.13)/.15)
cut('hood',(.25,0,1.355),(.237,.217,.24))
ell('skull',(.081,0,1.393),(.17,.19,.215),'infectedSkin','head',seg=16,rings=12)
ell('jaw',(.136,0,1.263),(.126,.148,.103),'infectedSkin','head')
# Rubber mask gasket surrounding the visible face.
pts=[(.242,.206*math.cos(t),1.37+.214*math.sin(t)) for t in [i*math.tau/32 for i in range(33)]]
tube('mask_gasket',pts,[.031]*len(pts),'uiDark','head',N=8)
# Separate visor lobes retain an unmistakable infected face and crack network.
for s in [-1,1]:
    ell('orbital_wound'+str(s),(.293,s*.088,1.418),(.014,.057,.054),'blood','head')
    ell('red_eye'+str(s),(.309,s*.088,1.421),(.016,.037,.04),'eye','head')
    ell('eye_hotspot'+str(s),(.323,s*.089,1.427),(.005,.013,.015),'picketWhite','head')
    tube('furrowed_brow'+str(s),[(.31,s*.039,1.46),(.302,s*.094,1.485),(.286,s*.15,1.474)],[.018,.02,.009],'uiDark','head',N=8)
    ell('cheek'+str(s),(.231,s*.109,1.302),(.039,.048,.043),'infectedSkin','head')
ell('nose_bridge',(.285,0,1.366),(.047,.034,.061),'infectedSkin','head')
ell('nose_tip',(.311,0,1.346),(.027,.044,.025),'infectedSkin','head')
ell('mouth',(.255,0,1.266),(.024,.065,.05),'uiDark','head')
for j in range(4):box('tooth'+str(j),(.278,-.037+j*.024,1.286),(.018,.017,.022),'picketWhite','head',.004)
# A single curved transparent shield sits ahead of the sculpted face.
v=[];f=[];ny=12;nz=10
for k in range(nz+1):
    z=1.319+k*.023
    for j in range(ny+1):
        y=-.184+j*.368/ny
        x=.354-.032*(y/.184)**2-.008*((z-1.434)/.115)**2
        v.append((x,y,z))
for k in range(nz):
    for j in range(ny):
        i=k*(ny+1)+j;f.append((i,i+1,i+ny+2,i+ny+1))
mesh('curved_visor',v,f,'visor','head',0)
tube('visor_brow_seal',[(.304,-.187,1.50),(.323,-.138,1.545),(.333,0,1.56),(.323,.138,1.545),(.304,.187,1.50)],[.018]*5,'uiDark','head',N=8)
for sign in [-1,1]:
    tube('mask_side_strap'+str(sign),[(.252,sign*.184,1.305),(.088,sign*.251,1.338),(-.081,sign*.233,1.369)],[.014,.021,.011],'asphalt','head',N=8)
    box('visor_fastener'+str(sign),(.307,sign*.186,1.474),(.026,.024,.034),'asphalt','head',.005)
    ell('visor_fastener_screw'+str(sign),(.326,sign*.186,1.475),(.006,.009,.009),'sidewalk','head',seg=8,rings=6)
tube('visor_reflection',[(.349,-.125,1.484),(.345,-.141,1.457),(.344,-.151,1.432)],[.003]*3,'picketWhite','head',N=6,sub=0)
# Missing shard at the cracked upper left leaves a ragged, layered silhouette.
patch('visor_broken_shard',[(.344,-.13,1.514),(.349,-.09,1.5),(.345,-.109,1.482),(.351,-.117,1.49)],'sidewalk','head',.005)
# Respirator triangle and three canisters, modelled grilles and screws.
ell('mask_muzzle',(.269,0,1.245),(.091,.103,.091),'uiDark','head')
for j,(y,z,r) in enumerate([(0,1.228,.071),(-.168,1.289,.06),(.168,1.289,.06)]):
    cyl('filter_body'+str(j),(.297,y,z),r,.08,'asphalt','head')
    cyl('filter_rim'+str(j),(.342,y,z),r*.94,.017,'woodWarm','head')
    cyl('filter_inset'+str(j),(.355,y,z),r*.76,.013,'uiDark','head')
    for k in range(6):
        t=k*math.tau/6
        ell('filter_port'+str(j)+str(k),(.366,y+r*.45*math.cos(t),z+r*.45*math.sin(t)),(.004,.009,.008),'asphalt','head',seg=8,rings=6)
for j,pts in enumerate([[(.301,-.11,1.51),(.305,-.071,1.471),(.307,-.12,1.447),(.309,-.084,1.403),(.299,-.143,1.363)],[(.306,-.071,1.471),(.304,-.027,1.491)],[(.307,-.12,1.447),(.299,-.163,1.46)],[(.308,.06,1.494),(.31,.109,1.458),(.307,.082,1.393),(.305,.142,1.371)]]):
    tube('visor_crack'+str(j),[(.361-.032*(y/.184)**2,y,z) for _,y,z in pts],[.003]*len(pts),'uiDark','head',N=6,sub=0)
tube('hood_center_seam',[(-.185,0,1.33),(-.197,0,1.47),(-.126,0,1.62),(.016,0,1.674),(.17,0,1.605)],[.005]*5,'woodWarm','head',N=6)
for s in [-1,1]:
    tube('hood_fold'+str(s),[(.067,s*.237,1.28),(-.012,s*.254,1.39),(.039,s*.21,1.54)],[.009,.014,.004],'schoolBusYellow','head',N=8)
tear('hood',(.178,-.099,1.603),(.059,.047,.046),'head')
# Rear tank with four metal retaining hoops, valve, hazard sign and harness.
box('air_pack_frame',(-.227,0,.981),(.076,.3,.36),'uiDark','torso',.025)
cyl('tank',(-.303,0,1.018),.102,.405,'sidewalk','torso',axis=(0,0,1))
ell('tank_cap',(-.303,0,1.239),(.103,.103,.069),'asphalt','torso')
ell('tank_bottom',(-.303,0,.794),(.103,.103,.053),'asphalt','torso')
for j,z in enumerate([.84,.94,1.09,1.19]):cyl('tank_hoop'+str(j),(-.303,0,z),.111,.028,'uiDark','torso',axis=(0,0,1))
box('hazard_plate',(-.411,0,.998),(.017,.137,.119),'schoolBusYellow','torso',.009)
# Warning triangle in the rear Y/Z plane.
tube('warning_triangle',[(-.425,-.054,.954),(-.425,.054,.954),(-.425,0,1.05),(-.425,-.054,.954)],[.007]*4,'uiDark','torso',N=6,sub=0)
box('warning_mark',(-.432,0,1.012),(.01,.01,.032),'uiDark','torso',.003)
ell('warning_dot',(-.434,0,.977),(.006,.007,.007),'uiDark','torso',seg=8,rings=6)
cyl('tank_valve',(-.303,0,.743),.031,.06,'asphalt','torso',axis=(0,0,1))
for s in [-1,1]:
    tube('harness'+str(s),[(-.262,s*.138,.839),(-.20,s*.177,1.124),(-.022,s*.226,1.157),(.155,s*.179,1.057),(.19,s*.144,.89)],[.027,.028,.035,.032,.028],'uiDark','torso',N=8)
    box('harness_buckle'+str(s),(.191,s*.169,1.013),(.032,.063,.07),'schoolBusYellow','torso',.009)
    box('buckle_inset'+str(s),(.213,s*.169,1.013),(.014,.034,.039),'uiDark','torso',.005)
    for j in range(3):ell('harness_rivet'+str(s)+str(j),(-.274,s*.14,.867+j*.092),(.009,.01,.01),'sidewalk','torso',seg=8,rings=6)
tube('air_hose',[(-.3,-.087,.758),(-.23,-.274,.72),(.03,-.291,.81),(.20,-.24,1.06),(.272,-.17,1.25)],[.022]*5,'uiDark','torso',N=10)
# Actual chest tear and flowing contamination.
ell('toxic_spill',(.195,-.10,.853),(.043,.066,.063),'leak','torso',seg=12,rings=8)
tear('suit_torso',(.189,-.091,.876),(.086,.079,.107),'torso')
for j in range(5):
    y=-.139+j*.027;z=.896-(j%2)*.04
    ell('toxic_chest'+str(j),(.173,y,z),(.038,.025,.038),'leak','torso')
    tube('toxic_rivulet'+str(j),[(.199,y,z),(.205+j*.003,y+.014-j*.003,.795-j*.019),(.174-j*.004,y+.008,.695-j*.029)],[.014,.011,.003],'leak','torso',N=8)
for j,(par,x,y,z) in enumerate([('shinL',.12,.21,.36),('handR',.318,-.425,.654),('legL',.169,.174,.52)]):
    tube('green_drip'+str(j),[(x,y,z),(x+.008,y,z-.085),(x+.016,y,z-.13)],[.012,.008,.003],'leak',par,N=8)
    ell('green_drop'+str(j),(x+.016,y,z-.148),(.009,.008,.015),'leak',par,seg=8,rings=6)
# Worn cloth flecks as raised shards (minimum 3mm off cloth).
for j in range(20):
    y=rng.uniform(-.17,.17);z=rng.uniform(.78,1.09)
    x=.006+.195*math.sqrt(max(.04,1-(y/.251)**2-((z-.95)/.265)**2))+.006
    patch('suit_stain'+str(j),[(x,y-.009,z+.01),(x+.004,y+.012,z+.007),(x,y+.005,z-.014)],'blood' if j%3 else 'woodWarm','torso')
# Overlapping cloth at the joints and broad creases prevent a segmented toy silhouette.
for sign,side in [(1,'L'),(-1,'R')]:
    ell('elbow_cloth'+side,(.10,sign*.345,.912),(.11,.108,.103),'schoolBusYellow','foreArm'+side)
    ell('knee_cloth'+side,(.068,sign*.19,.408),(.113,.115,.096),'schoolBusYellow','shin'+side)
    for j in range(4):
        z=1.035-j*.045;yy=sign*(.282+j*.012)
        tube('upper_arm_fold'+side+str(j),[(.069,yy-sign*.047,z+.018),(.134,yy,z),(.093,yy+sign*.051,z-.019)],[.003,.017,.004],'schoolBusYellow','arm'+side,N=8)
    for j in range(3):
        z=.878-j*.032
        tube('cuff_cloth_fold'+side+str(j),[(.152,sign*.336,z+.012),(.215,sign*.378,z),(.179,sign*.417,z-.012)],[.004,.018,.005],'schoolBusYellow','foreArm'+side,N=8)
    for j in range(3):
        z=.964-j*.081
        tube('abdomen_fold'+side+str(j),[(.177,sign*.067,z+.022),(.193,sign*.12,z),(.138,sign*.201,z-.025)],[.003,.014,.004],'schoolBusYellow','torso',N=8)
    tube('trouser_outer_seam'+side,[(-.026,sign*.273,.622),(.007,sign*.295,.524),(.02,sign*.304,.414),(-.035,sign*.323,.287)],[.004]*4,'woodWarm','leg'+side,N=6,sub=0)
    tear('calf'+side,(-.074,sign*.222,.312),(.083,.052,.058),'shin'+side)
# The hood's raised stitched spine follows its actual rear curvature.
hood_points=[]
for j in range(19):
    t=-1.05+j*2.47/18
    hood_points.append((.034-.260*math.cos(t),0,1.39+.288*math.sin(t)))
tube('hood_stitched_spine',hood_points,[.005]*19,'woodWarm','head',N=6,sub=0)
for sign in [-1,1]:
    for j in range(3):
        z=1.26+j*.063
        tube('hood_drapery'+str(sign)+str(j),[(-.074,sign*.222,z+.004),(.009,sign*.267,z-.024),(.106,sign*.229,z-.038)],[.002,.012,.003],'schoolBusYellow','head',N=8)
# Rear abrasions and longer rag tongues echo the worn turnaround.
for j,(y,z) in enumerate([(-.137,.755),(.169,.803)]):
    tear('suit_hip',(-.175,y,z),(.063,.045,.052),'hip')
for j in range(9):
    y=-.174+j*.043;z=.785+(j%3)*.065
    x=-.05-.19*math.sqrt(max(.06,1-(y/.245)**2-((z-.695)/.16)**2))-.005
    patch('back_weathering'+str(j),[(x,y-.007,z+.01),(x-.004,y+.009,z+.006),(x,y+.005,z-.012)],'blood','hip')
# Project broad irregular stains onto the actual garment, four millimetres proud.
# Unlike flat planes, these follow the sculpted cloth and remain stable under rotation.
def stain(n,target,y,z,ry,rz,material,par,front=True):
    target=bpy.data.objects[target];bpy.context.view_layer.update()
    inv=target.matrix_world.inverted();direction=Vector((-1,0,0) if front else (1,0,0))
    samples=[(y,z)]+[(y+math.cos(j*math.tau/9)*ry*(.75+(j%3)*.16),z+math.sin(j*math.tau/9)*rz*(.76+(j%4)*.09)) for j in range(9)]
    verts=[]
    for yy,zz in samples:
        start=Vector((.8 if front else -.8,yy,zz))
        hit,point,normal,_=target.ray_cast(inv@start,inv.to_3x3()@direction)
        if not hit:return
        verts.append(target.matrix_world@point+target.matrix_world.to_3x3()@normal*.0045)
    mesh(n,verts,[(0,j+1,(j+1)%9+1) for j in range(9)],material,par,0)
for j,(target,y,z,ry,rz,material,par) in enumerate([
    ('hood',-.14,1.565,.032,.047,'blood','head'),
    ('hood',.16,1.529,.029,.027,'woodWarm','head'),
    ('sleeveL',.288,1.05,.039,.033,'blood','armL'),
    ('sleeveR',-.289,1.016,.044,.044,'blood','armR'),
    ('lower_sleeveR',-.359,.858,.033,.028,'woodWarm','foreArmR'),
    ('suit_torso',.09,.81,.04,.043,'blood','torso'),
    ('suit_torso',.12,1.05,.031,.028,'woodWarm','torso'),
    ('suit_hip',-.113,.719,.048,.027,'blood','hip'),
    ('thighR',-.165,.561,.044,.058,'blood','legR'),
    ('thighL',.213,.61,.031,.023,'woodWarm','legL'),
    ('calfR',-.21,.328,.046,.036,'woodWarm','shinR'),
    ('calfL',.205,.285,.032,.027,'blood','shinL')]):stain('broad_front_stain'+str(j),target,y,z,ry,rz,material,par)
for j,(target,y,z,ry,rz,par) in enumerate([
    ('hood',-.11,1.515,.028,.044,'head'),('hood',.125,1.39,.033,.028,'head'),
    ('suit_torso',-.156,.914,.042,.031,'torso'),('suit_torso',.154,1.015,.027,.026,'torso'),
    ('suit_hip',-.123,.7,.032,.029,'hip'),('thighL',.174,.557,.034,.037,'legL'),
    ('thighR',-.143,.629,.039,.035,'legR'),('sleeveR',-.28,1.047,.029,.041,'armR')]):
    stain('broad_rear_stain'+str(j),target,y,z,ry,rz,'blood' if j%2 else 'woodWarm',par,False)
# Proximal stump caps are exported at zero scale and can be shown by the game.
for key,parent in [('head','torso'),('armL','torso'),('armR','torso'),('foreArmL','armL'),('foreArmR','armR'),('legL','hip'),('legR','hip')]:
    p=parts[key].matrix_world.translation.copy();sz=(.076,.09,.014) if key=='head' or key.startswith('leg') else (.084,.017,.082)
    distal=('foreArm'+key[-1] if key.startswith('arm') else 'hand'+key[-1] if key.startswith('foreArm') else 'shin'+key[-1] if key.startswith('leg') else None)
    direction=parts[distal].matrix_world.translation-p if distal else Vector((0,0,1))
    axis='Z' if key=='head' or key.startswith('leg') else 'Y'
    rotation=direction.to_track_quat(axis,'Y' if axis=='Z' else 'Z').to_euler()
    o=ell('stump_'+key,p,sz,'blood',parent,rot=rotation);o['stumpFor']=key;o['hidden']=True;o.scale=(0,0,0)
# Applied subdivision defines the sculpted forms; reduce redundant triangles for the crowd budget.
for o in objects:
    if sum(len(f.vertices)-2 for f in o.data.polygons)>80:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('game mesh reduction','DECIMATE');mod.ratio=.38
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
# Subtle asymmetry and forward hunch; bake it into the rigid rest geometry.
parts['torso'].rotation_euler.y=.15
parts['head'].rotation_euler.y=-.09
parts['armR'].rotation_euler.y=-.14
for side in ['L','R']:parts['hand'+side].scale=(1.16,1.18,1.16)
for cap in caps:cap.scale=(1,1,1)
bpy.context.view_layer.update()
world={o:o.matrix_world.copy() for o in list(parts.values())+objects}
positions={o:world[o].translation.copy() for o in parts.values()}
parents={o:o.parent for o in parts.values()}
for o in objects:
    o.data.transform(world[o]);o.matrix_world=Matrix.Identity(4)
for o in parts.values():
    o.parent=None;o.matrix_world=Matrix.Translation(positions[o])
for o in parts.values():
    if parents[o]:
        o.parent=parents[o];o.matrix_parent_inverse=Matrix.Identity(4);o.location=positions[o]-positions[parents[o]]
bpy.context.view_layer.update()
for o in objects:
    o.matrix_parent_inverse=Matrix.Identity(4)
    o.matrix_basis=o.parent.matrix_world.inverted()
for cap in caps:cap.scale=(0,0,0)
bpy.context.view_layer.update()
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
if a.stump:
    # Detachment leaves the cap on the proximal torso.
    for o in objects:
        p=o.parent
        while p:
            if p==parts['armL']:o.hide_render=True;break
            p=p.parent
    cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False

def sheet(names,out):
    import numpy as np
    panels=[]
    for name in names:
        im=bpy.data.images.load(str(P/'renders'/name),check_existing=False);w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-420)//2:(w+420)//2,:])
    data=np.concatenate(panels,axis=1)
    im=bpy.data.images.new('review_sheet',width=data.shape[1],height=data.shape[0],alpha=True)
    im.pixels.foreach_set(data.ravel());im.filepath_raw=str(out);im.file_format='PNG';im.save()
if a.render and a.view in ['turnaround','pose-sheet']:
    sheet(['pose-intact.png','pose-stump.png'] if a.view=='pose-sheet' else ['front.png','side.png','back.png','review-hero.png'],a.render)
    print('OK',a.view);sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),460,(1,.83,.69),3);light('cool fill',(1,4,3),260,(.63,.72,1),3);light('amber rim',(-3,1,3.5),600,(1,.46,.2),2)
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='studio_floor';ground.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,2.9),'front':(6,0,1.35),'side':(0,-6,1.35),'back':(-6,0,1.35)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.97*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG'
    if a.view=='review-set' or Path(a.render).stem=='round1':
        for view in ['front','side','back','hero']:
            cam.location=views[view];cam.rotation_euler=(Vector((.08,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.render.filepath=str(P/'renders'/('review-hero.png' if view=='hero' else view+'.png'))
            bpy.ops.render.render(write_still=True)
        bpy.data.images['Render Result'].save_render(a.render)
    else:
        S.render.filepath=a.render;bpy.ops.render.render(write_still=True)
        if a.view=='final-set':
            # Export and hero are the rest model; pose changes are preview-only.
            parts['armL'].rotation_euler.x=.45
            parts['foreArmL'].rotation_euler.y=-.55
            parts['legR'].rotation_euler.y=-.35
            cam.location=views['front'];cam.rotation_euler=(Vector((.08,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.render.resolution_x=960;S.render.resolution_y=540;S.cycles.samples=24
            for mode in ['intact','stump']:
                if mode=='stump':
                    cam.location=(6,4,2.9);cam.rotation_euler=(Vector((.08,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
                    for o in objects:
                        parent=o.parent
                        while parent:
                            if parent==parts['armL']:o.hide_render=True;break
                            parent=parent.parent
                    cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
                S.render.filepath=str(P/'renders'/('pose-'+mode+'.png'));bpy.ops.render.render(write_still=True)
            sheet(['pose-intact.png','pose-stump.png'],P/'renders'/'pose-test.png')
            sheet(['front.png','side.png','back.png','review-hero.png'],P/'renders'/'turnaround.png')
print('OK',triangles,'triangles',len(objects),'meshes')
