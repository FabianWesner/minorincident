"""Deterministic rigid-part hero infected adult skater. +X forward, Z up, -Y character right.
Run through experiment/tools/blender_run.py. All subdivision is applied before GLB.
"""
import argparse, math, sys, json, random
from pathlib import Path
import bpy, bmesh
from mathutils import Vector, Matrix
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser()
ap.add_argument('--render'); ap.add_argument('--glb'); ap.add_argument('--view',default='review-set')
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
M={k:mat(k,v,r) for k,v,r in [('infectedSkin','c9a39a',.68),('picketWhite','f2e6dc',.85),('asphalt','5b4f5c',.8),('uiDark','25222c',.78),('blood','b3121f',.35),('survivorRed','bd243c',.73),('sidewalk','b9a4a0',.8),('woodWarm','694536',.8),('backpackTeal','51586d',.85)]}
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

# Open layered hoodie: ivory tee inside a thick charcoal outer shell.
ell('pelvis',(0,0,.695),(.153,.225,.125),'backpackTeal','hip')
ell('tee',(.017,0,.938),(.174,.224,.257),'picketWhite','torso',seg=16,rings=10)
ell('neck',(.013,0,1.184),(.076,.088,.089),'infectedSkin','head')
v=[];f=[];N=24
for j,(z,rx,ry) in enumerate([(.702,.173,.224),(.72,.183,.234),(.84,.17,.23),(1.055,.166,.254),(1.125,.137,.21),(1.14,.132,.205)]):
    for i in range(N):
        t=.67+(2*math.pi-1.34)*i/(N-1);v.append((rx*math.cos(t)-.012,ry*math.sin(t),z+(.012*math.sin(i*2.7) if j==0 else 0)))
for j in range(5):
    for i in range(N-1):f.append((j*N+i,j*N+i+1,(j+1)*N+i+1,(j+1)*N+i))
o=mesh('hoodie_shell',v,f,'asphalt','torso',2)
mod=o.modifiers.new('cloth thickness','SOLIDIFY');mod.thickness=.016;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
# Hood rests behind the head; a raised pale inner rim frames both neck sides.
ell('folded_hood_back',(-.14,0,1.11),(.113,.23,.12),'asphalt','torso',seg=16,rings=10)
hoodpts=[(.15,-.095,1.047),(.102,-.176,1.108),(-.025,-.214,1.177),(-.144,-.163,1.194),(-.18,0,1.20),(-.144,.163,1.194),(-.025,.214,1.177),(.102,.176,1.108),(.15,.095,1.047)]
tube('hood_rolled_edge',hoodpts,[.034,.045,.047,.046,.044,.046,.047,.045,.034],'asphalt','torso',N=12)
tube('hood_ivory_lining',[(x+.022,y,z+.009) for x,y,z in hoodpts],[.022,.029,.033,.025,.022,.025,.033,.029,.022],'picketWhite','torso',N=10)
for s in [-1,1]:
    patch('zipper_placket'+str(s),[(.16,s*.069,1.078),(.193,s*.093,1.024),(.19,s*.106,.85),(.16,s*.09,.732),(.144,s*.111,.737),(.166,s*.129,.876),(.169,s*.118,1.018)],'asphalt','torso',.018)
    tube('zipper_tape'+str(s),[(.175,s*.073,1.066),(.20,s*.102,.99),(.196,s*.112,.86),(.174,s*.092,.751)],[.006]*4,'uiDark','torso',N=6,sub=0)
    for j in range(15):
        z=.772+j*.018;y=s*(.098+.013*math.sin(j/14*math.pi))
        box('zip_tooth'+str(s)+str(j),(.203 if j>3 else .188,y,z),(.007,.008,.006),'sidewalk','torso',.002)
    tube('hood_drawstring'+str(s),[(.17,s*.105,1.082),(.21,s*.113,.989),(.21,s*.115,.949)],[.0045,.005,.004],'sidewalk','torso',N=6,sub=0)
    box('drawstring_aglet'+str(s),(.21,s*.115,.944),(.008,.008,.025),'woodWarm','torso',.003)
    tube('hoodie_hem'+str(s),[(.157,s*.105,.728),(.07,s*.219,.725),(-.12,s*.183,.72),(-.18,0,.717)],[.017]*4,'asphalt','torso',N=8)
    box('hoodie_pocket'+str(s),(.13,s*.186,.827),(.025,.083,.022),'uiDark','torso',.008,rot=(s*.3,0,0))
    for j in range(3):
        tube('cloth_drape'+str(s)+str(j),[(.137,s*.13,.92-j*.055),(.153,s*.179,.907-j*.055),(.08,s*.219,.875-j*.055)],[.004,.011,.002],'asphalt','torso',N=8)
def shoe_lace(name,points,side):
    # Fit laces to canvas/tongue surfaces with at least 3mm clearance.
    bpy.context.view_layer.update();fitted=[]
    for x,y,z in points:
        hits=[]
        for prefix in ['canvas_shoe','shoe_tongue','rubber_toecap']:
            target=bpy.data.objects[prefix+side];inv=target.matrix_world.inverted()
            hit,loc,normal,index=target.ray_cast(inv@Vector((x,y,.4)),inv.to_3x3()@Vector((0,0,-1)))
            if hit:hits.append((target.matrix_world@loc).z)
        fitted.append((x,y,max(hits)+.008 if hits else z))
    return tube(name,fitted,[.004]*len(fitted),'picketWhite','foot'+side,N=6,sub=0)

# Thick reaching arms and curved, separately sculpted finger volumes.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(-.008,s*.237,1.076);elbow=(.021,s*.343,.899);wrist=(.086,s*.418,.744)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    tube('upper_sleeve'+side,[shoulder,(-.005,s*.28,1.054),(.006,s*.313,.958),elbow],[.099,.112,.094,.091],'asphalt','arm'+side,N=12)
    tube('rolled_cuff'+side,[(.018,s*.336,.928),(.03,s*.357,.89),(.043,s*.37,.864)],[.102,.108,.081],'asphalt','foreArm'+side,N=12)
    tube('forearm_skin'+side,[(.041,s*.364,.855),(.064,s*.396,.797),wrist],[.068,.068,.047],'infectedSkin','foreArm'+side,N=12)
    tube('wrist_band'+side,[(.074,s*.407,.782),(.081,s*.415,.767),(.084,s*.416,.756)],[.053,.059,.053],'uiDark','foreArm'+side,N=12)
    box('wrist_clasp'+side,(.135,s*.416,.769),(.02,.035,.019),'sidewalk','foreArm'+side,.005)
    ell('palm'+side,(.087,s*.424,.72),(.058,.066,.075),'infectedSkin','hand'+side)
    for i in range(4):
        y=s*(.365+i*.039);z=.696-(.006 if i in [0,3] else .018)
        points=[(.105,y,z),(.127,y+s*(i-1.5)*.006,z-.044),(.175,y+s*(i-1.5)*.010,z-.085),(.204,y+s*(i-1.5)*.012,z-.048)]
        tube('finger'+side+str(i),points,[.019,.02,.017,.011],'infectedSkin','hand'+side,N=8)
        ell('knuckle'+side+str(i),(.115,y,z),(.023,.02,.023),'infectedSkin','hand'+side,seg=8,rings=6)
        ell('nail'+side+str(i),(.206,y+s*(i-1.5)*.012,z-.045),(.006,.011,.014),'sidewalk','hand'+side,seg=8,rings=6)
    tube('thumb'+side,[(.105,s*.37,.745),(.15,s*.353,.713),(.178,s*.366,.691)],[.028,.026,.015],'infectedSkin','hand'+side,N=10)
    for j in range(3):
        tube('sleeve_fold'+side+str(j),[(.058,s*.273,.999-j*.034),(.096,s*.3,.986-j*.032),(.06,s*.335,.978-j*.032)],[.006,.014,.004],'asphalt','arm'+side,N=8)
    hip=(0,s*.124,.694);knee=(.024,s*.176,.415);ankle=(-.019,s*.198,.155)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('jeans_thigh'+side,[hip,(-.005,s*.137,.629),(.013,s*.168,.493),knee],[.122,.133,.112,.095],'backpackTeal','leg'+side,N=12)
    tube('jeans_calf'+side,[knee,(.016,s*.186,.362),(-.008,s*.195,.264),ankle],[.097,.101,.091,.079],'backpackTeal','shin'+side,N=12)
    for j,z in enumerate([.365,.28,.201,.163]):
        ell('denim_fold'+side+str(j),(-.006,s*.189,z),(.092,.102,.03),'backpackTeal','shin'+side,rot=(s*.18,-.24,0),seg=12,rings=6)
    # Protective pad is an open dark ring around an exposed bruised knee, as drawn.
    ell('knee_exposed'+side,(.116,s*.171,.442),(.044,.071,.067),'infectedSkin','shin'+side)
    pts=[(.132,s*.171+.079*math.cos(t),.442+.078*math.sin(t)) for t in [i*2*math.pi/20 for i in range(21)]]
    tube('kneepad_rim'+side,pts,[.014]*len(pts),'uiDark','shin'+side,N=8)
    for zz in [.392,.487]:
        radius=.108 if zz>.415 else .097
        pts=[(.02+radius*math.cos(t),s*.171+radius*math.sin(t),zz) for t in [i*2*math.pi/16 for i in range(17)]]
        parent=('leg' if zz>.415 else 'shin')+side
        tube('kneepad_strap'+side+str(zz),pts,[(.013,.009)]*len(pts),'uiDark',parent,N=6)
    for yy in [s*.171-.064,s*.171+.064]:
        ell('pad_rivet'+side+str(yy),(.146,yy,.469),(.007,.008,.008),'sidewalk','shin'+side,seg=8,rings=6)
    for j in range(3):
        tube('denim_crease'+side+str(j),[(.082,s*.096,.61-j*.055),(.127,s*.15,.594-j*.055),(.074,s*.228,.582-j*.055)],[.003,.009,.002],'backpackTeal','leg'+side,N=8)
    # Front and back pockets, raised seam stitching and waistband loops.
    patch('rear_pocket'+side,[(-.145,s*.06,.686),(-.149,s*.182,.668),(-.143,s*.201,.602),(-.134,s*.13,.57),(-.133,s*.073,.605)],'backpackTeal','leg'+side,.009)
    tube('rear_pocket_stitch'+side,[(-.154,s*.07,.674),(-.154,s*.087,.61),(-.149,s*.135,.591),(-.155,s*.19,.618),(-.154,s*.179,.657)],[.0025]*5,'woodWarm','leg'+side,N=6,sub=0)
    tube('denim_outer_seam'+side,[(-.03,s*.246,.65),(-.014,s*.278,.51),(-.025,s*.272,.43)],[.003]*3,'woodWarm','leg'+side,N=6,sub=0)
    # Canvas skate shoes, thick foxing, curved rubber toe cap, crossed laces.
    box('shoe_sole'+side,(.048,s*.204,.034),(.31,.20,.068),'picketWhite','foot'+side,.025)
    box('sole_pinstripe'+side,(.048,s*.204,.045),(.313,.203,.009),'blood','foot'+side,.004)
    ell('canvas_shoe'+side,(.031,s*.204,.122),(.148,.095,.093),'survivorRed','foot'+side,seg=16,rings=10)
    ell('rubber_toecap'+side,(.137,s*.204,.099),(.068,.096,.056),'picketWhite','foot'+side,seg=16,rings=8)
    ell('shoe_tongue'+side,(-.003,s*.204,.195),(.065,.059,.033),'blood','foot'+side)
    ell('ankle_collar'+side,(-.045,s*.204,.193),(.067,.085,.024),'uiDark','foot'+side)
    for j in range(5):
        x=-.015+j*.027;z=.230-j*.015
        for ss in [-1,1]:
            ell('lace_eyelet'+side+str(j)+str(ss),(x,s*.204+ss*.046,z-.012),(.006,.008,.006),'sidewalk','foot'+side,seg=8,rings=6)
        shoe_lace('crosslaceA'+side+str(j),[(x-.007,s*.158,z-.004),(x+.007,s*.204,z+.008),(x+.015,s*.25,z-.016)],side)
        shoe_lace('crosslaceB'+side+str(j),[(x+.015,s*.158,z-.016),(x+.007,s*.204,z+.01),(x-.007,s*.25,z-.004)],side)
    for ss in [-1,1]:
        tube('shoe_side_stripe'+side+str(ss),[(-.072,s*.204+ss*.087,.149),(-.025,s*.204+ss*.096,.118),(.015,s*.204+ss*.091,.144)],[.008,.009,.007],'picketWhite','foot'+side,N=6)
    for j in range(7):
        box('sole_tread'+side+str(j),(-.074+j*.04,s*.204,.009),(.016,.177,.015),'uiDark','foot'+side,.004)
    box('heel_label'+side,(-.107,s*.204,.075),(.009,.052,.023),'blood','foot'+side,.004)
box('waistband',(0,0,.707),(.285,.421,.045),'backpackTeal','hip',.014)
box('jeans_button',(.163,0,.708),(.014,.024,.023),'sidewalk','hip',.005)
for s in [-1,1]:box('belt_loop'+str(s),(.13,s*.146,.708),(.018,.025,.056),'backpackTeal','hip',.005)

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

# Layered thick brown hair locks below the beanie.
ell('hair_base',(-.035,0,1.443),(.176,.18,.128),'woodWarm','head',seg=16,rings=10)
def lock(name,start,bend,tip,width):
    p0,p1,p2=map(Vector,[start,bend,tip])
    tube(name,[p0,p0.lerp(p1,.55),p1,p1.lerp(p2,.74),p2],[.014,(width*.85,width*.52),(width,width*.56),(width*.4,width*.29),.002],'woodWarm','head',N=8)
for j in range(18):
    t=2*math.pi*j/18;x=-.037+.15*math.cos(t);y=.166*math.sin(t)
    lock('side_lock'+str(j),(x*.6,y*.7,1.499),(x,y,1.419),(x+.042*math.cos(t)-.019,y+.025*math.sin(t),1.32+(j%3)*.02),.048)
for j in range(6):
    y=-.134+j*.052
    lock('swept_fringe'+str(j),(.011,y+.041,1.51),(.128,y,1.479),(.159,y-.043,1.401+(j%3)*.021),.062)
# Soft knitted dome and folded brim, with deliberate raised ribs.
tube('beanie_dome',[(-.034,0,z) for z in [1.509,1.519,1.56,1.616,1.659,1.686,1.696]],
     [.175,.181,.177,.147,.10,.045,.003],'survivorRed','head',N=32,sub=2)
pts=[(-.034+.177*math.cos(t),.182*math.sin(t),1.527) for t in [i*2*math.pi/32 for i in range(33)]]
tube('beanie_folded_brim',pts,[(.037,.024)]*len(pts),'survivorRed','head',N=12)
for j in range(32):
    t=j*2*math.pi/32
    ps=[(-.034+r*math.cos(t),r*math.sin(t),z) for z,r in [(1.544,.177),(1.563,.173),(1.604,.152),(1.644,.117),(1.674,.073),(1.692,.028)]]
    tube('knit_crown_rib'+str(j),ps,[.0035,.004,.004,.004,.003,.002],'survivorRed','head',N=6,sub=0)
    ps=[(-.034+r*math.cos(t),r*math.sin(t),z) for z,r in [(1.494,.187),(1.51,.201),(1.54,.201),(1.561,.187)]]
    tube('knit_brim_rib'+str(j),ps,[.002,.003,.003,.002],'survivorRed','head',N=6,sub=0)
# Wounds, irregular tears and raised blood stains projected to the garment surface.
def tear(name,center,size,lining=None,parent=None):
    target=bpy.data.objects[name]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=center)
    cutter=bpy.context.object;cutter.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=target.modifiers.new('torn opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=target;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    if lining:ell(name+'_exposed',lining,(size[0]*.35,size[1]*.87,size[2]*.87),'infectedSkin',parent)
def stain(n,target,y,z,ry,rz,back=False):
    obj=bpy.data.objects[target];bpy.context.view_layer.update();inv=obj.matrix_world.inverted()
    x=-.5 if back else .5;direction=Vector((1,0,0) if back else (-1,0,0));points=[]
    for j in range(11):
        t=j*2*math.pi/10;r=1 if j==0 else rng.uniform(.75,1.2)
        yy=y+(0 if j==0 else ry*r*math.cos(t));zz=z+(0 if j==0 else rz*r*math.sin(t))
        hit,loc,normal,index=obj.ray_cast(inv@Vector((x,yy,zz)),inv.to_3x3()@direction)
        if not hit:return
        p=obj.matrix_world@loc;norm=(obj.matrix_world.to_3x3()@normal).normalized();points.append(p+norm*.004)
    mesh(n,points,[(0,j,j+1 if j<10 else 1) for j in range(1,11)],'blood',obj.parent.name,0)
for s,side in [(1,'L'),(-1,'R')]:
    tear('upper_sleeve'+side,(.099,s*.303,.99),(.059,.041,.043),(.045,s*.303,.99),'arm'+side)
    tear('jeans_thigh'+side,(.11,s*.183,.55),(.065,.04,.03),(.061,s*.183,.55),'leg'+side)
    tear('jeans_calf'+side,(.089,s*.211,.291),(.05,.037,.029),(.049,s*.211,.291),'shin'+side)
    for j in range(3):
        patch('sleeve_rag'+side+str(j),[(.101,s*(.28+j*.018),1.022),(.11,s*(.3+j*.018),1.013),(.1,s*(.29+j*.018),.976-j*.008)],'asphalt','arm'+side)
        patch('jean_rag'+side+str(j),[(.13,s*(.16+j*.015),.573),(.133,s*(.18+j*.015),.576),(.137,s*(.17+j*.015),.55-j*.008)],'backpackTeal','leg'+side)
    for j,(target,y,z,ry,rz) in enumerate([('upper_sleeve'+side,s*.303,1.015,.027,.025),('forearm_skin'+side,s*.397,.801,.026,.037),('palm'+side,s*.421,.731,.032,.028),('knee_exposed'+side,s*.179,.445,.017,.023),('jeans_thigh'+side,s*.183,.579,.026,.019),('rubber_toecap'+side,s*.207,.12,.035,.018)]):
        stain('blood_'+side+str(j),target,y,z,ry,rz)
for j,(y,z,ry,rz) in enumerate([(-.037,1.044,.033,.055),(.02,.935,.038,.028),(-.017,.854,.02,.054),(.1,.79,.02,.018)]):stain('tee_blood'+str(j),'tee',y,z,ry,rz)
tear('hoodie_shell',(-.18,-.08,.973),(.07,.036,.05))
tear('hoodie_shell',(-.17,.137,.81),(.065,.031,.043))
for j,(y,z,ry,rz) in enumerate([(-.11,.89,.039,.046),(.13,1.035,.031,.044),(-.08,.77,.045,.024)]):stain('hoodie_back_blood'+str(j),'hoodie_shell',y,z,ry,rz,True)
for j,(y,z,ry,rz) in enumerate([(-.109,1.305,.02,.026),(.104,1.31,.015,.019),(-.04,1.204,.026,.027)]):stain('face_smear'+str(j),'jaw' if j==2 else 'cranium',y,z,ry,rz)
for sign in [-1,1]:
    stain('cheek_wound'+str(sign),'cheek'+str(sign),sign*.112,1.291,.022,.025)
tube('chin_drip',[(.176,-.018,1.199),(.162,-.018,1.161),(.138,-.013,1.134)],[.015,.009,.003],'blood','head',N=6)
for side,sign in [('L',1),('R',-1)]:
    for j in range(3):
        yy=sign*(.12+j*.026)
        patch('hoodie_hem_rag'+side+str(j),[(.151,yy,.769),(.17,yy+sign*.024,.761),(.159,yy+sign*.009,.706-j*.007)],'asphalt','torso')
for j,(y,z) in enumerate([(-.08,.973),(.137,.81)]):
    patch('back_torn_flap'+str(j),[(-.197,y-.025,z+.036),(-.207,y+.015,z+.028),(-.214,y+.01,z-.01),(-.195,y-.017,z+.008)],'asphalt','torso',.008)
# Rear hoodie drape and a true cutout on each side, revealing the pale tee.
for s in [-1,1]:
    tube('hood_seam'+str(s),[(-.204,s*.09,1.175),(-.238,s*.06,1.112),(-.202,0,1.053)],[.003,.004,.002],'sidewalk','torso',N=6,sub=0)
    tube('back_cloth_fold'+str(s),[(-.157,s*.17,1.027),(-.189,s*.14,.915),(-.18,s*.053,.817)],[.003,.009,.003],'asphalt','torso',N=8)

# Caps stay on proximal parts so they remain when distal nodes are detached.
for key,parent,p,sz in [('head','torso',(.014,0,1.19),(.075,.084,.012)),('armL','torso',(-.008,.237,1.076),(.077,.016,.077)),('armR','torso',(-.008,-.237,1.076),(.077,.016,.077)),('foreArmL','armL',(.021,.343,.899),(.065,.014,.06)),('foreArmR','armR',(.021,-.343,.899),(.065,.014,.06)),('legL','hip',(0,.124,.694),(.09,.095,.012)),('legR','hip',(0,-.124,.694),(.09,.095,.012))]:
    o=ell('stump_'+key,p,sz,'blood',parent,seg=12,rings=6);o['stumpFor']=key;o['hidden']=True;o.scale=(0,0,0)
# Applied subdivision defines the sculpted forms; reduce redundant triangles for the crowd budget.
raw_triangles=sum(len(f.vertices)-2 for o in objects for f in o.data.polygons)
reduction=min(.72,32500/raw_triangles)
for o in objects:
    if sum(len(f.vertices)-2 for f in o.data.polygons)>80:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('game mesh reduction','DECIMATE');mod.ratio=reduction
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
parts['head'].scale=(1.53,1.60,1.20)
parts['hip'].location.z-=.15
parts['torso'].rotation_euler.y=.30
parts['head'].rotation_euler.y=-.10
for side,sign in [('L',1),('R',-1)]:
    parts['arm'+side].rotation_euler=(sign*.17,-.66 if side=='L' else -.81,0)
    parts['foreArm'+side].rotation_euler.y=-.40 if side=='L' else -.49
    parts['hand'+side].scale=(1.38,1.45,1.40)
    parts['hand'+side].rotation_euler.z=math.pi
    parts['leg'+side].rotation_euler.x=sign*.23
    parts['leg'+side].rotation_euler.y=-.34 if side=='L' else -.42
    parts['shin'+side].rotation_euler.y=.72 if side=='L' else .80
    parts['foot'+side].rotation_euler.y=-.38
    parts['foot'+side].scale=(1.23,1.26,1.13)
# Keep skate soles level while hips and knees spread into the crouch.
bpy.context.view_layer.update()
for side in ['L','R']:
    foot=parts['foot'+side]
    foot.matrix_world=Matrix.Translation(foot.matrix_world.translation) @ Matrix.Diagonal((1.23,1.26,1.13,1))
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
def test_pose():
    parts['armL'].rotation_euler.x=.45
    parts['foreArmL'].rotation_euler.y=-.55
    parts['legR'].rotation_euler.y=-.35

def show_stump():
    for o in objects:
        parent=o.parent
        while parent:
            if parent==parts['armL']:o.hide_render=True;break
            parent=parent.parent
    cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False

def contact_sheet(names,path):
    import numpy as np
    panels=[]
    for name in names:
        im=bpy.data.images.load(str(P/'renders'/name));w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-420)//2:(w+420)//2,:])
    data=np.concatenate(panels,axis=1)
    sheet=bpy.data.images.new('contact-sheet',width=data.shape[1],height=data.shape[0],alpha=True)
    sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=str(path);sheet.file_format='PNG';sheet.save()

if a.pose:test_pose()
if a.stump:show_stump()
if a.render and a.view in ['turnaround','pose-sheet']:
    names=['pose-articulated.png','pose-stump.png'] if a.view=='pose-sheet' else ['front.png','side.png','back.png','review-hero.png']
    contact_sheet(names,a.render);print('OK contact sheet');sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),460,(1,.83,.69),3);light('cool fill',(1,4,3),260,(.63,.72,1),3);light('amber rim',(-3,1,3.5),600,(1,.46,.2),2)
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='studio_floor';ground.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'stump':(5,4,2.8),'hero':(6,-4,2.9),'front':(6,0,1.35),'side':(0,-6,1.35),'back':(-6,0,1.35)}
    cam.data.type='ORTHO';cam.data.ortho_scale=2.10*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    S.cycles.device='CPU'
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG'
    batch=a.view in ['review-set','final-set']
    render_views=['front','side','back','hero'] if batch else [a.view]
    if a.view=='final-set':render_views+=['hero-final','pose-articulated','pose-stump']
    for view in render_views:
        if view=='pose-articulated':test_pose()
        if view=='pose-stump':show_stump()
        camera_view='stump' if view=='pose-stump' else ('hero' if view in ['hero-final','pose-articulated'] else view)
        cam.location=views.get(camera_view,views['hero'])
        cam.rotation_euler=(Vector((.13,0,.82))-cam.location).to_track_quat('-Z','Y').to_euler()
        if a.view=='final-set':
            S.render.resolution_x=1600 if view=='hero-final' else 960
            S.render.resolution_y=900 if view=='hero-final' else 540
            S.cycles.samples=96 if view=='hero-final' else 24
        if batch:
            name='hero.png' if view=='hero-final' else ('review-hero.png' if view=='hero' else view+'.png')
            path=P/'renders'/name
        else:path=Path(a.render)
        S.render.filepath=str(path);bpy.ops.render.render(write_still=True)
        if batch and view=='hero':bpy.data.images['Render Result'].save_render(str(a.render))
    if a.view=='final-set':
        contact_sheet(['front.png','side.png','back.png','review-hero.png'],P/'renders'/'turnaround.png')
        contact_sheet(['pose-articulated.png','pose-stump.png'],P/'renders'/'pose-test.png')
print('OK',triangles,'triangles',len(objects),'meshes')
