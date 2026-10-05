"""Deterministic rigid-part hero Bathrobe Neighbor. +X forward, Z up, -Y character right.
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
M={k:mat(k,v,r) for k,v,r in [('infectedSkin','c9a39a',.68),('picketWhite','f2e6dc',.85),('asphalt','465471',.86),('uiDark','25222c',.78),('blood','b3121f',.35),('survivorRed','d9363e',.73),('sidewalk','ad9295',.86)]}
M['robe']=mat('policeBlue','596d94',.88)
M['plaid']=M['sidewalk']
M['hair']=mat('woodWarm','78635b',.8)
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
# Thick cloth robe, an open shawl collar, separate overlapping skirt panels.
ell('pelvis',(0,0,.695),(.153,.225,.125),'infectedSkin','hip')
ell('exposed_chest',(.017,0,1.012),(.153,.188,.18),'infectedSkin','torso')
ell('neck',(.013,0,1.184),(.076,.088,.089),'infectedSkin','head')
def robe_radius(z):
    if z<.73:return (.21+(.73-z)*.15,.27+(.73-z)*.18)
    return (.19,.245+max(0,z-.93)*.18)
N=48;rows=34;v=[];f=[]
for j in range(rows):
    z=.49+j*.65/(rows-1);rx,ry=robe_radius(z)
    opening=.07 if z<.74 else .35
    for i in range(N):
        t=opening+(2*math.pi-2*opening)*i/(N-1)
        zz=z+(.009*math.sin(i*1.8)+.007*math.sin(i*.7) if j<2 else 0)
        v.append((rx*math.cos(t)-.018,ry*math.sin(t),zz))
for j in range(rows-1):
    for i in range(N-1):f.append((j*N+i,j*N+i+1,(j+1)*N+i+1,(j+1)*N+i))
o=mesh('robe_shell',v,f,'robe','torso',0)
mod=o.modifiers.new('cloth thickness','SOLIDIFY');mod.thickness=.016;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
# Fine woven grid ribbons follow the shell curvature at a 4 mm offset.
for j,z in enumerate([.536,.613,.69,.787,.864,.941,1.018,1.095]):
    rx,ry=robe_radius(z);opening=.08 if z<.74 else .36
    points=[]
    for i in range(49):
        t=opening+(2*math.pi-2*opening)*i/48
        points.append(((rx+.004)*math.cos(t)-.018,(ry+.004)*math.sin(t),z))
    tube('plaid_cross'+str(j),points,[.003]*len(points),'sidewalk','torso',N=4,sub=0)
    tube('plaid_cross_shadow'+str(j),[(x,y,zz+.014) for x,y,zz in points],[.005]*len(points),'asphalt','torso',N=4,sub=0)
for j in range(18):
    t=.42+j*(2*math.pi-.84)/17;points=[]
    for k in range(22):
        z=.508+k*.623/21;rx,ry=robe_radius(z)
        points.append(((rx+.004)*math.cos(t)-.018,(ry+.004)*math.sin(t),z))
    tube('plaid_vertical'+str(j),points,[.003]*len(points),'sidewalk','torso',N=4,sub=0)
for s in [-1,1]:
    # Broad shawl collar describes a V-shaped exposed chest.
    tube('shawl_collar'+str(s),[(-.045,s*.092,1.16),(.083,s*.144,1.135),(.166,s*.133,1.018),(.184,s*.075,.844),(.197,0,.727)],[(.038,.03),(.038,.037),(.033,.034),(.025,.033),(.022,.024)],'sidewalk','torso',N=12)
    o=patch('robe_front_overlap'+str(s),[(.183,s*.01,.752),(.20,s*.143,.748),(.204,s*.205,.585),(.198,s*.183,.508),(.216,s*.11,.489),(.208,s*.014,.524)],'robe','torso',.018)
    # A patch pocket with its opening, welt and stitches.
    box('pocket'+str(s),(.15,s*.231,.669),(.025,.098,.091),'robe','torso',.012,rot=(0,0,s*.23))
    tube('pocket_welt'+str(s),[(.168,s*.182,.716),(.177,s*.229,.72),(.149,s*.277,.705)],[.006,.007,.006],'sidewalk','torso',N=6)
    for j in range(3):
        tube('robe_fold'+str(s)+str(j),[(.117,s*(.15+j*.027),.82),(.15,s*(.17+j*.025),.77),(.139,s*(.18+j*.025),.74)],[.006,.013,.003],'robe','torso',N=8)
for s in [-1,1]:
    for j in range(3):
        z=.545+j*.075
        tube('front_grid_cross'+str(s)+str(j),[(.212,s*.035,z),(.215,s*.10,z+.005),(.218,s*.169,z+.012)],[.003]*3,'sidewalk','torso',N=4,sub=0)
    for j in range(2):
        y=s*(.06+j*.065)
        tube('front_grid_vertical'+str(s)+str(j),[(.222,y,.54),(.219,y,.62),(.214,y,.714)],[.003]*3,'sidewalk','torso',N=4,sub=0)
bpy.context.view_layer.update()
for o in objects:
    if o.name.startswith('front_grid'):
        for vert in o.data.vertices:
            start=Vector((.6,vert.co.y,vert.co.z));hits=[]
            for target_name in ['robe_shell','robe_front_overlap-1','robe_front_overlap1']:
                target=bpy.data.objects[target_name];inv=target.matrix_world.inverted()
                hit,loc,normal,index=target.ray_cast(inv@start,inv.to_3x3()@Vector((-1,0,0)))
                if hit:hits.append(target.matrix_world@loc)
            if hits:vert.co.x=min(hits,key=lambda q:(q-start).length).x+.004
# Belt wraps the robe at the waist; knot, loops and two hanging tails.
pts=[(.195*math.cos(i*2*math.pi/48)-.018,.274*math.sin(i*2*math.pi/48),.747+.009*math.cos(i*2*math.pi/48)) for i in range(49)]
tube('robe_belt',pts,[(.018,.025)]*49,'sidewalk','torso',N=8)
ell('belt_knot',(.207,-.035,.755),(.033,.042,.028),'sidewalk','torso')
for s in [-1,1]:
    tube('belt_loop'+str(s),[(.216,-.033,.76),(.236,s*.05-.035,.797),(.235,s*.089-.035,.773),(.22,s*.058-.035,.751)],[.013,.015,.014,.012],'sidewalk','torso',N=8)
    tube('belt_tail'+str(s),[(.216,-.037+s*.015,.737),(.241,-.028+s*.032,.642),(.258,-.043+s*.045,.501),(.248,-.028+s*.047,.453)],[(.012,.024),(.009,.025),(.008,.024),(.008,.023)],'sidewalk','torso',N=8)
# Sleeves, rolled pale cuffs, and oversized curled fingers.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(-.008,s*.237,1.076);elbow=(.021,s*.343,.899);wrist=(.086,s*.418,.744)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    o=tube('robe_sleeve'+side,[shoulder,(-.005,s*.28,1.054),(.006,s*.313,.958),elbow],[.112,.123,.111,.101],'robe','arm'+side,N=16,sub=1)
    o=tube('lower_sleeve'+side,[elbow,(.04,s*.363,.86),(.058,s*.381,.827)],[.103,.103,.098],'robe','foreArm'+side,N=16,sub=1)
    for segment,par,A,B in [('upper','arm'+side,Vector(shoulder),Vector(elbow)),('lower','foreArm'+side,Vector(elbow),Vector((.058,s*.381,.827)))]:
        tangent=(B-A).normalized();u=tangent.cross(Vector((1,0,0))).normalized();w=tangent.cross(u)
        radius=.111 if segment=='upper' else .106
        for j in range(1,4):
            center=A.lerp(B,j/4);points=[center+(u*math.cos(i*2*math.pi/24)+w*math.sin(i*2*math.pi/24))*radius for i in range(25)]
            tube('sleeve_plaid_band'+side+segment+str(j),points,[.003]*25,'sidewalk',par,N=4,sub=0)
        for j in range(6):
            t=j*2*math.pi/6;off=(u*math.cos(t)+w*math.sin(t))*radius
            tube('sleeve_plaid_length'+side+segment+str(j),[A.lerp(B,k/6)+off for k in range(1,6)],[.003]*5,'sidewalk',par,N=4,sub=0)
    tube('rolled_cuff'+side,[(.051,s*.376,.846),(.061,s*.384,.824),(.065,s*.389,.81)],[.108,.112,.10],'sidewalk','foreArm'+side,N=16)
    tube('forearm_skin'+side,[(.064,s*.389,.821),(.076,s*.405,.782),wrist],[.071,.063,.048],'infectedSkin','foreArm'+side,N=12)
    ell('palm'+side,(.087,s*.424,.72),(.063,.072,.079),'infectedSkin','hand'+side)
    for i in range(4):
        y=s*(.359+i*.043);z=.696-(.006 if i in [0,3] else .018)
        points=[(.105,y,z),(.127,y+s*(i-1.5)*.006,z-.044),(.175,y+s*(i-1.5)*.010,z-.085),(.204,y+s*(i-1.5)*.012,z-.048)]
        tube('claw'+side+str(i),points,[.021,.022,.019,.012],'infectedSkin','hand'+side,N=8)
        ell('knuckle'+side+str(i),(.115,y,z),(.025,.022,.025),'infectedSkin','hand'+side,seg=8,rings=6)
        ell('nail'+side+str(i),(.206,y+s*(i-1.5)*.012,z-.045),(.007,.013,.016),'sidewalk','hand'+side,seg=8,rings=6)
    tube('thumb'+side,[(.105,s*.366,.745),(.15,s*.343,.713),(.178,s*.356,.691)],[.03,.029,.016],'infectedSkin','hand'+side,N=10)
    hip=(0,s*.145,.694);knee=(.024,s*.205,.415);ankle=(-.019,s*.238,.155)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('bare_thigh'+side,[hip,(-.005,s*.162,.629),(.013,s*.197,.493),knee],[.116,.131,.11,.095],'infectedSkin','leg'+side,N=12)
    ell('kneecap'+side,(.079,s*.206,.425),(.074,.089,.082),'infectedSkin','shin'+side)
    tube('bare_calf'+side,[knee,(.016,s*.224,.354),(-.008,s*.235,.253),ankle],[.095,.107,.074,.06],'infectedSkin','shin'+side,N=12)
    # Open-backed plush house slippers: broad sole, toe shell, exposed heel and pompom.
    box('slipper_sole'+side,(.059,s*.241,.031),(.305,.197,.062),'sidewalk','foot'+side,.027)
    ell('slipper_toe'+side,(.12,s*.241,.085),(.106,.098,.082),'sidewalk','foot'+side,seg=16,rings=10)
    ell('bare_heel'+side,(-.041,s*.241,.103),(.067,.065,.055),'infectedSkin','foot'+side)
    tube('slipper_rim'+side,[(.032,s*.156,.105),(.041,s*.18,.148),(.037,s*.241,.163),(.04,s*.302,.148),(.032,s*.326,.106)],[.012]*5,'picketWhite','foot'+side,N=8)
    ell('pompom'+side,(.106,s*.241,.174),(.036,.035,.034),'picketWhite','foot'+side,seg=12,rings=8)
    for j in range(7):
        t=j*2*math.pi/7
        ell('pompom_tuft'+side+str(j),(.106+.028*math.cos(t),s*.241+.025*math.sin(t),.182),(.017,.017,.018),'picketWhite','foot'+side,seg=8,rings=6)
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
ell('mouth_cavity',(.156,0,1.254),(.031,.069,.077),'hair','head',seg=20,rings=12)
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
# Thick layered leaf-shaped locks, irregularly swept across the forehead and crown.
ell('hair_base',(-.035,0,1.464),(.179,.183,.159),'hair','head',seg=20,rings=12)
def lock(name,start,bend,tip,width,material='hair'):
    p0,p1,p2=map(Vector,[start,bend,tip])
    points=[p0,p0.lerp(p1,.55),p1,p1.lerp(p2,.74),p2]
    tube(name,points,[.014,(width*.85,width*.52),(width,width*.56),(width*.40,width*.29),.002],material,'head',N=8,sub=1)
for layer in range(3):
    for j in range(11):
        t=2*math.pi*j/11+.21*(layer%2);z=1.367+layer*.076
        x=-.037+.145*math.cos(t);y=.159*math.sin(t)
        lock('hair_layer'+str(layer)+'_'+str(j),(x*.6,y*.63,z+.089),
             (x-.011,y,z+.042),(x+.052*math.cos(t)-.045,y+.045*math.sin(t)-.035,z-.068),.066+(j%3)*.005,
             'sidewalk' if j in [2,7] and layer==2 else 'hair')
for j in range(5):
    y=-.136+j*.063
    lock('heavy_fringe'+str(j),(-.025,y+.048,1.577),(.10,y-.009,1.524),
         (.144,y-.065,1.505+(j%3)*.022),.065+(j%2)*.012)
for j in range(9):
    t=j*2*math.pi/9
    lock('messy_crown'+str(j),(-.028,.04*math.sin(t),1.52),
         (-.06+.08*math.cos(t),.11*math.sin(t),1.598+(j%3)*.015),
         (-.08+.17*math.cos(t),.18*math.sin(t)-.028,1.61-(j%4)*.027),.07)
# Overlapping low nape locks close the rear scalp silhouette down to the collar.
for j in range(10):
    t=1.45+j*.36
    x=-.022+.15*math.cos(t);y=.16*math.sin(t)
    lock('low_nape'+str(j),(x*.8,y*.83,1.383),(x-.027,y*1.01,1.316),
         (x-.045,y*.91,1.239+(j%2)*.012),.06)
# Uneven forehead furrows and a swept quiff define the older neighbor face.
for side in [-1,1]:
    tube('forehead_furrow'+str(side),[(.153,side*.027,1.46),(.137,side*.034,1.485),(.12,side*.055,1.5)],[.007,.008,.004],'infectedSkin','head',N=8)
lock('swept_quiff',(-.053,-.07,1.591),(.081,-.036,1.639),(.143,.096,1.536),.087)
# Surface-projected blood silhouettes, offset at least 4 mm from skin/cloth.
def stain(n,y,z,ry,rz,par,targets,front=True):
    pts=[Vector((0,y,z))]
    for i in range(12):
        t=2*math.pi*i/12;r=rng.uniform(.65,1.2)
        pts.append(Vector((0,y+math.cos(t)*ry*r,z+math.sin(t)*rz*r)))
    bpy.context.view_layer.update()
    for p in pts:
        start=Vector((.65 if front else -.65,p.y,p.z));direction=Vector((-1 if front else 1,0,0));hits=[]
        for name in targets:
            target=bpy.data.objects[name];inv=target.matrix_world.inverted()
            hit,loc,normal,index=target.ray_cast(inv@start,inv.to_3x3()@direction)
            if hit:hits.append(target.matrix_world@loc)
        if hits:p.x=min(hits,key=lambda q:(q-start).length).x+(.004 if front else -.004)
        else:p.x=.17 if front else -.21
    mesh(n,pts,[(0,i+1,(i+1)%12+1) for i in range(12)],'blood',par,0)
for j,(y,z,ry,rz) in enumerate([(-.105,1.32,.026,.059),(.11,1.284,.029,.048),(-.04,1.204,.057,.027),(-.044,1.414,.02,.025)]):
    stain('face_wound'+str(j),y,z,ry,rz,'head',['cranium','jaw','cheek-1','cheek1'])
tube('bloody_chin_drip',[(.198,-.025,1.198),(.182,-.027,1.154),(.162,-.028,1.119)],[.018,.012,.004],'blood','head',N=8)
for j in range(9):
    y=rng.uniform(-.10,.10);z=rng.uniform(.89,1.135)
    stain('chest_blood'+str(j),y,z,.025,.026,'torso',['exposed_chest'])
for side,s in [('L',1),('R',-1)]:
    for j in range(3):
        stain('hand_blood'+side+str(j),s*(.39+j*.034),.733,.023,.036,'hand'+side,['palm'+side])
    stain('calf_wound'+side,s*.224,.332,.028,.044,'shin'+side,['bare_calf'+side])
    stain('knee_wound'+side,s*.209,.438,.023,.024,'shin'+side,['kneecap'+side])
    stain('sleeve_blood'+side,s*.347,.885,.042,.021,'foreArm'+side,['lower_sleeve'+side])
for j in range(8):
    y=rng.uniform(-.22,.22);z=rng.uniform(.51,.86)
    stain('robe_blood'+str(j),y,z,.026,.029,'torso',['robe_shell','robe_front_overlap-1','robe_front_overlap1'])
for o in objects:
    if o.name.startswith('claw'):
        o.data.materials.append(M['blood'])
        for f in o.data.polygons:
            p=o.matrix_world@f.center
            if p.x>.164 and p.z<.68:f.material_index=len(o.data.materials)-1
# Small collar stitches and shoulder cloth creases, useful at hero camera distances.
for s,side in [(1,'L'),(-1,'R')]:
    for j in range(3):
        tube('sleeve_crease'+side+str(j),[(.059,s*.284,1.031-j*.034),(.106,s*.304,1.014-j*.034),(.083,s*.328,1.002-j*.034)],[.004,.012,.003],'robe','arm'+side,N=8)
# Proximal caps remain attached when limbs detach; export-hidden scale is intentional.
for key,parent,p,sz in [('head','torso',(.014,0,1.19),(.075,.084,.012)),('armL','torso',(-.008,.237,1.076),(.077,.016,.077)),('armR','torso',(-.008,-.237,1.076),(.077,.016,.077)),('foreArmL','armL',(.021,.343,.899),(.065,.014,.06)),('foreArmR','armR',(.021,-.343,.899),(.065,.014,.06)),('legL','hip',(0,.145,.694),(.09,.095,.012)),('legR','hip',(0,-.145,.694),(.09,.095,.012))]:
    o=ell('stump_'+key,p,sz,'blood',parent,seg=12,rings=6);o['stumpFor']=key;o['hidden']=True;o.scale=(0,0,0)
# Sculpted surfaces are already applied. Keep plaid boundaries intact during reduction.
for o in objects:
    if sum(len(f.vertices)-2 for f in o.data.polygons)>80:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('game mesh reduction','DECIMATE');mod.ratio=.40 if len(o.data.materials)>1 else .33
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
parts['hip'].location.z-=.10
parts['torso'].rotation_euler.y=.24
parts['head'].rotation_euler.y=-.10
for side,sign in [('L',1),('R',-1)]:
    parts['arm'+side].rotation_euler=(sign*.24,-.78 if side=='L' else -.91,0)
    parts['foreArm'+side].rotation_euler.y=-.46 if side=='L' else -.55
    parts['hand'+side].scale=(1.38,1.45,1.40)
    parts['hand'+side].rotation_euler.z=math.pi
    parts['leg'+side].location.y+=sign*.045
    parts['leg'+side].rotation_euler.y=-.40 if side=='L' else -.48
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
    # Separate the rotated arm chain from its shoulder while revealing proximal cap.
    parts['armL'].location.y+=.25;parts['armL'].location.x+=.16
    cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
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
    render_views=['hero','front','side','back'] if a.view=='review-all' or (a.view=='hero' and a.samples==24) else [a.view]
    for view in render_views:
        cam.location=views.get(view,views['hero']);cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
        dest=Path(a.render) if view=='hero' or len(render_views)==1 else Path(a.render).parent/(view+'.png')
        S.render.filepath=str(dest);bpy.ops.render.render(write_still=True)
    if len(render_views)>1:
        import numpy as np
        panels=[]
        for view in ['front','side','back','hero']:
            dest=Path(a.render) if view=='hero' else Path(a.render).parent/(view+'.png')
            im=bpy.data.images.load(str(dest));w,h=im.size
            pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
            panels.append(pixels.reshape(h,w,4)[:,(w-420)//2:(w+420)//2,:])
        data=np.concatenate(panels,axis=1);sheet=bpy.data.images.new('review_sheet',width=data.shape[1],height=data.shape[0],alpha=True)
        sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=str(Path(a.render).parent/'turnaround.png');sheet.file_format='PNG';sheet.save()
print('OK',triangles,'triangles',len(objects),'meshes')
