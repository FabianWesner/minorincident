"""Hero firefighter. Meters, +X forward, Z up. Applied sculpt smoothing; rigid joint hierarchy.
Build/render only with experiment/tools/blender_run.py. No image textures.
"""
import argparse, math, sys, json
from pathlib import Path
import bpy, bmesh
from mathutils import Vector, Matrix
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P.parents[1]/'tools/blender'))
from sslib import palette
ap=argparse.ArgumentParser()
for k in ['render','glb','montage']:ap.add_argument('--'+k)
ap.add_argument('--view',default='hero');ap.add_argument('--pose',action='store_true')
for k,v in [('width',960),('height',540),('samples',24)]:ap.add_argument('--'+k,type=int,default=v)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if a.montage:a.render=a.montage;a.view='turnaround'
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene;S.unit_settings.system='METRIC';parts={};objects=[]
M={k:palette.mat(k) for k in ['brass','schoolBusYellow','picketWhite','uiDark','asphalt','survivorRed','brick','skinWarm','skinShadow','hairChestnut','hairWarm','eyeBrown','mouth','khakiLight','khakiSeam','silver','navy']}
for k,m in M.items():m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.72
M['survivorRed'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.3
M['silver'].node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.65
M['silver'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.32
# Warm cloth and skin both use shared palette tokens; no custom texture or material names.
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
    if len(points)==2 and sub:
        p0,p1=map(Vector,points);r0,r1=radii
        points=[p0,p0.lerp(p1,.12),p0.lerp(p1,.88),p1]
        radii=[r0,r0,r1,r1]
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
def rings(n,levels,m,par,N=24,sub=1):
 v=[];f=[]
 for z,rx,ry,cx in levels:
  for i in range(N):
   t=i*2*math.pi/N;v.append((cx+rx*math.cos(t),ry*math.sin(t),z))
 for j in range(len(levels)-1):
  for i in range(N):k=j*N+i;kk=j*N+(i+1)%N;f.append((k,kk,kk+N,k+N))
 f.extend([tuple(range(N-1,-1,-1)),tuple((len(levels)-1)*N+i for i in range(N))])
 return mesh(n,v,f,m,par,sub)
def band(n,z,rx,ry,h,m,par,cx=0):
 rx*=1.065;ry*=1.065
 if m=='schoolBusYellow':h*=1.3
 return rings(n,[(z-h/2,rx,ry,cx),(z-h/2+.003,rx,ry,cx),(z+h/2-.003,rx,ry,cx),(z+h/2,rx,ry,cx)],m,par,sub=1)
def text(n,body,p,size,m,par,back=False,tilt=0):
 bpy.ops.object.text_add(location=p);o=bpy.context.object;o.name=n;o.data.body=body;o.data.align_x='CENTER';o.data.align_y='CENTER';o.data.size=size;o.data.extrude=.0015;o.data.bevel_depth=.0005
 # local text x => world Y; local y => Z; outward normal => X.
 o.rotation_euler=Matrix(((0,0,1),(1,0,0),(0,1,0))).to_euler()
 if back:o.rotation_euler=Matrix(((0,0,-1),(-1,0,0),(0,1,0))).to_euler()
 if tilt:o.rotation_euler=(Matrix.Rotation(tilt,3,'Y')@o.rotation_euler.to_matrix()).to_euler()
 bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,n,m,par)
node('root',(0,0,0));node('hip',(0,0,.58),'root');node('torso',(0,0,.69),'hip');node('head',(0,0,1.035),'torso');node('backpackSocket',(-.16,0,.94),'torso')
ell('pelvis',(0,0,.58),(.13,.17,.1),'brass','hip')
rings('coat',[(.52,.14,.19,0),(.535,.153,.203,0),(.59,.155,.205,0),(.7,.135,.18,0),(.9,.143,.201,0),(.978,.11,.165,0),(.985,.10,.14,0)],'brass','torso',sub=2)
for z,rx,ry,h in [(.56,.157,.21,.049),(.765,.147,.193,.047)]:
 band('coat_yellow',z,rx,ry,h,'schoolBusYellow','torso');band('coat_reflective',z,rx+.003,ry+.003,.018,'picketWhite','torso')
box('coat_storm_flap',(.154,0,.75),(.025,.04,.3),'brass','torso')
ell('neck',(0,0,1.026),(.055,.065,.082),'skinWarm','head')
ell('undershirt',(.105,0,.975),(.026,.082,.052),'navy','torso')
# Raised open collar and its turned-out wings.
for s in [-1,1]:
 tube('collar', [(.12,s*.044,.946),(.08,s*.1,1.006),(-.055,s*.11,1.015),(-.1,s*.045,1.023)], [.025,.032,.033,.027],'khakiLight','torso',N=12)
 box('collar_tip',(.12,s*.071,.972),(.026,.075,.07),'khakiLight','torso',.012,rot=(s*.3,.15,0))
# Belt, pouches and SCBA harness. Broad tapes instead of decorative round cords.
band('utility_belt',.651,.149,.193,.068,'uiDark','torso')
box('buckle',(.16,0,.65),(.02,.075,.051),'silver','torso',.006)
box('buckle_inset',(.173,0,.65),(.011,.054,.032),'uiDark','torso',.003)
for s in [-1,1]:
 box('belt_pouch',(.123,s*.146,.65),(.065,.072,.092),'navy','torso',.013)
 box('pouch_flap',(.162,s*.146,.678),(.02,.076,.041),'uiDark','torso',.007)
 ell('pouch_snap',(.177,s*.146,.674),(.006,.008,.008),'silver','torso',seg=8)
 # Shoulder tape front/back contour, flattened elliptical tube.
 tube('harness',[(.15,s*.107,.68),(.154,s*.137,.85),(.12,s*.155,.956),(-.008,s*.162,.995),(-.15,s*.133,.954),(-.17,s*.113,.72)],[(.029,.013)]*6,'uiDark','torso',N=8,sub=1)
 box('strap_buckle',(.178,s*.135,.896),(.018,.048,.049),'silver','torso',.004)
 box('strap_buckle_hole',(.191,s*.135,.896),(.012,.03,.031),'uiDark','torso',.003)
 tube('harness_D_ring',[(.18,s*.122,.787),(.2,s*.135,.776),(.2,s*.153,.79),(.179,s*.15,.801),(.18,s*.122,.787)],[.004]*5,'silver','torso',N=8)
 box('jacket_pocket',(.134,s*.09,.838),(.025,.077,.089),'khakiLight','torso',.008)
box('radio',(.187,.082,.805),(.05,.057,.091),'uiDark','torso',.009)
box('radio_face',(.216,.082,.814),(.009,.038,.042),'navy','torso',.003)
for j in range(3):box('radio_grille',(.222,.082,.827-j*.009),(.004,.028,.003),'silver','torso',.001)
tube('radio_aerial',[(.18,.095,.85),(.18,.095,.925)],[.004,.003],'uiDark','torso',N=8,sub=0)
tube('diagonal_sling',[(.169,-.145,.91),(.204,-.062,.79),(.18,.105,.66)],[(.017,.009)]*3,'uiDark','torso',N=8)
box('chest_clip',(.179,-.1,.85),(.035,.029,.045),'navy','torso',.005)
# Symmetric relaxed articulated limbs; overlaps at joints prevent holes in motion.
for s,side in [(1,'L'),(-1,'R')]:
 shoulder=(0,s*.184,.932);elbow=(.009,s*.253,.783);wrist=(.024,s*.287,.636)
 node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
 ell('shoulder_joint'+side,shoulder,(.073,.078,.077),'brass','arm'+side,seg=12,rings=8)
 ell('elbow_joint'+side,elbow,(.07,.072,.07),'brass','foreArm'+side,seg=12,rings=8)
 tube('upper_sleeve'+side,[shoulder,(0,s*.218,.91),(.01,s*.241,.82),elbow],[.085,.092,.079,.074],'brass','arm'+side,N=12)
 tube('lower_sleeve'+side,[elbow,(.015,s*.273,.733),wrist],[.077,.081,.07],'brass','foreArm'+side,N=12)
 for z,y in [(.7,.28)]:
  tube('cuff_yellow'+side,[(.02,s*y,z+.025),(.022,s*(y+.008),z-.026)],[.084,.081],'schoolBusYellow','foreArm'+side,N=16)
  tube('cuff_silver'+side,[(.021,s*(y+.003),z+.009),(.022,s*(y+.006),z-.009)],[.087,.086],'picketWhite','foreArm'+side,N=16)
 tube('cuff_edge'+side,[(.025,s*.285,.65),(.025,s*.29,.625)],[.074,.072],'khakiLight','foreArm'+side,N=12)
 for j in range(3):
  ell('sleeve_fold'+side+str(j),(.024,s*(.235+j*.015),.825-j*.039),(.071,.061,.016),'khakiLight','arm'+side if j==0 else 'foreArm'+side,rot=(s*.15,.1,0),seg=10)
 ell('glove_palm'+side,(.03,s*.296,.592),(.054,.056,.068),'uiDark','hand'+side)
 box('glove_pad'+side,(.071,s*.297,.605),(.028,.082,.056),'navy','hand'+side,.012)
 for j in range(4):
  y=s*(.258+j*.025)
  tube('glove_finger'+side+str(j),[(.043,y,.576),(.055,y,.544),(.068,y,.535)],[.014,.015,.011],'uiDark','hand'+side,N=8)
  ell('finger_joint'+side+str(j),(.067,y,.56),(.009,.013,.012),'navy','hand'+side,seg=8)
 tube('glove_thumb'+side,[(.05,s*.251,.611),(.083,s*.244,.582),(.087,s*.256,.567)],[.02,.019,.013],'uiDark','hand'+side,N=10)
 node('weaponSocket'+side,(.063,s*.292,.56),'hand'+side)
 h=(0,s*.097,.57);k=(.012,s*.111,.339);ank=(.006,s*.12,.119)
 node('leg'+side,h,'hip');node('shin'+side,k,'leg'+side);node('foot'+side,ank,'shin'+side)
 ell('knee_joint'+side,k,(.08,.081,.08),'brass','shin'+side,seg=12,rings=8)
 tube('trouser_thigh'+side,[h,(0,s*.102,.528),(.01,s*.11,.399),k],[.102,.108,.093,.085],'brass','leg'+side,N=12)
 tube('trouser_calf'+side,[k,(.006,s*.12,.28),ank],[.087,.09,.078],'brass','shin'+side,N=12)
 box('cargo_pocket'+side,(-.008,s*.195,.459),(.126,.038,.136),'khakiLight','leg'+side,.015)
 box('cargo_flap'+side,(-.008,s*.22,.503),(.134,.019,.039),'brass','leg'+side,.008)
 box('knee_pad'+side,(.097,s*.11,.342),(.033,.134,.12),'navy','shin'+side,.028,rot=(0,-.1,0))
 for yy in [-.043,.043]:ell('pad_rivet',(.119,s*.11+yy,.376),(.006,.007,.007),'uiDark','shin'+side,seg=8)
 for z in [.175]:
  tube('ankle_yellow'+side,[(.006,s*.12,z+.026),(.006,s*.12,z-.026)],[.095,.093],'schoolBusYellow','shin'+side,N=16)
  tube('ankle_reflective'+side,[(.006,s*.12,z+.01),(.006,s*.12,z-.01)],[.098,.097],'picketWhite','shin'+side,N=16)
 for z in [.432,.277,.12]:
  ell('trouser_fold',(.01,s*.12,z),(.084,.08,.018),'khakiLight','leg'+side if z>.34 else 'shin'+side,rot=(s*.12,.1,0),seg=10)
 box('boot_sole'+side,(.041,s*.123,.028),(.238,.167,.056),'uiDark','foot'+side,.018)
 box('boot_welt'+side,(.041,s*.123,.055),(.238,.169,.024),'asphalt','foot'+side,.013)
 ell('boot'+side,(.045,s*.123,.091),(.118,.082,.058),'uiDark','foot'+side)
 ell('boot_shaft'+side,(-.017,s*.123,.127),(.066,.071,.063),'navy','foot'+side)
 ell('boot_toe'+side,(.107,s*.123,.085),(.058,.082,.047),'navy','foot'+side)
 for j in range(4):
  tube('boot_lace'+side+str(j),[(-.011+j*.017,s*.079,.143-j*.006),(.005+j*.017,s*.123,.154-j*.006),(-.011+j*.017,s*.166,.143-j*.006)],[.003]*3,'schoolBusYellow','foot'+side,N=6,sub=0)
 for j in range(6):box('boot_tread',(-.05+j*.038,s*.123,.01),(.021,.17,.02),'uiDark','foot'+side,.004)
 # Shoulder insignia in side plane, with raised layers.
 ell('shoulder_patch',(.008,s*.283,.889),(.055,.012,.06),'schoolBusYellow','arm'+side)
 ell('shoulder_patch_red',(.008,s*.296,.889),(.046,.006,.05),'survivorRed','arm'+side)
 box('patch_cross',(.008,s*.304,.889),(.015,.006,.055),'picketWhite','arm'+side,.003)
 box('patch_cross_bar',(.008,s*.304,.889),(.046,.006,.015),'picketWhite','arm'+side,.003)
# Face: sculpted chin, cheeks, complete inset eyes, small smiling mouth.
ell('face',(0,0,1.154),(.144,.153,.151),'skinWarm','head',seg=20,rings=14)
ell('chin',(.049,0,1.061),(.091,.101,.049),'skinWarm','head',seg=16,rings=10)
for s in [-1,1]:
 ell('ear',(-.002,s*.138,1.14),(.036,.026,.046),'skinWarm','head')
 ell('ear_inner',(.022,s*.151,1.14),(.011,.01,.028),'skinShadow','head')
 ell('eye_outline',(.127,s*.063,1.177),(.009,.036,.041),'hairChestnut','head',seg=16,rings=10)
 ell('eye_white',(.135,s*.063,1.178),(.008,.03,.034),'picketWhite','head',seg=16,rings=10)
 ell('iris',(.142,s*.059,1.178),(.004,.017,.025),'eyeBrown','head',seg=16,rings=10)
 ell('pupil',(.145,s*.059,1.179),(.003,.009,.019),'uiDark','head',seg=12,rings=8)
 ell('eye_glint',(.148,s*.053,1.189),(.003,.006,.008),'picketWhite','head',seg=8,rings=6)
 tube('eyebrow',[(.138,s*.028,1.213),(.145,s*.061,1.224),(.121,s*.098,1.212)],[.01,.012,.008],'hairChestnut','head',N=8)
ell('nose_bridge',(.13,0,1.148),(.02,.02,.032),'skinWarm','head')
ell('nose_tip',(.16,0,1.132),(.018,.024,.017),'skinWarm','head')
tube('smile',[(.123,-.04,1.091),(.139,-.021,1.082),(.142,0,1.08),(.139,.024,1.083),(.121,.041,1.093)],[.0025]*5,'mouth','head',N=6)
# Thick short brown hair volumes visible beneath helmet, individually tapered locks.
ell('hair_cap',(-.033,0,1.232),(.119,.143,.102),'hairChestnut','head',seg=16,rings=10)
for j in range(14):
 t=j*2*math.pi/14
 tube('hair_lock', [(-.024+.095*math.cos(t),.112*math.sin(t),1.249),(-.027+.12*math.cos(t),.137*math.sin(t),1.21),(-.029+.12*math.cos(t),.134*math.sin(t),1.169+(j%3)*.009)],[.025,.035,.006],'hairWarm' if j%4==0 else 'hairChestnut','head',N=8)
for j in range(5):
 y=-.095+j*.045
 tube('fringe',[(.051,y+.012,1.256),(.102,y,1.247),(.116,y-.018,1.216+(j%2)*.01)],[.025,.031,.003],'hairChestnut','head',N=8)
# Fire helmet: swept oval brim, crown shell, ribs, raised shield, panel reflectors.
rings('helmet_brim',[(1.244,.199,.207,-.025),(1.25,.205,.213,-.025),(1.261,.205,.213,-.025),(1.267,.19,.196,-.025)],'survivorRed','head',N=40,sub=1)
band('brim_piping',1.258,.207,.215,.01,'brick','head',cx=-.025)
rings('helmet_crown',[(1.264,.144,.166,-.025),(1.278,.148,.171,-.025),(1.326,.139,.16,-.025),(1.38,.113,.132,-.025),(1.412,.06,.07,-.025),(1.425,.009,.01,-.025)],'survivorRed','head',N=32,sub=2)
band('helmet_bottom_band',1.28,.152,.175,.023,'brick','head',cx=-.025)
for j in range(8):
 t=j*2*math.pi/8
 pts=[(-.025+r*math.cos(t),ry*math.sin(t),z) for z,r,ry in [(1.278,.153,.176),(1.329,.144,.165),(1.384,.114,.134),(1.418,.047,.056),(1.43,.002,.002)]]
 tube('helmet_rib',pts,[.007]*5,'brick','head',N=8)
 # Curved crown panels between ribs; material patch is a separate mesh shell.
 v=[];f=[]
 for z,rx,ry in [(1.312,.151,.173),(1.351,.135,.156)]:
  for k in range(5):
   angle=t+.15+k*.12;v.append((-.025+rx*math.cos(angle),ry*math.sin(angle),z))
 for k in range(4):f.append((k,k+1,k+6,k+5))
 mesh('helmet_reflector',v,f,'schoolBusYellow','head',sub=0)
 ell('helmet_fastener',(-.025+.157*math.cos(t),.179*math.sin(t),1.282),(.007,.007,.009),'silver','head',seg=8)
shield=[(.137,-.056,1.278),(.151,.056,1.278),(.143,.064,1.371),(.122,.042,1.399),(.118,0,1.425),(.122,-.042,1.399),(.143,-.064,1.371)]
patch('helmet_shield_border',shield,'schoolBusYellow','head',.013)
patch('helmet_shield',[(x+.005,y*.9,1.35+(z-1.35)*.9) for x,y,z in shield],'uiDark','head',.01)
text('helmet_23','23',(.16,0,1.342),.071,'picketWhite','head',tilt=-.15)
text('helmet_FIRE','FIRE',(.141,0,1.392),.018,'picketWhite','head',tilt=-.35)
for s in [-1,1]:ell('shield_screw',(.171,s*.041,1.291),(.005,.006,.006),'silver','head',seg=8)
# Air tank and back frame, metal capsule, two cradle belts, brass valve and curled hose.
box('SCBA_backplate',(-.164,0,.829),(.062,.173,.31),'uiDark','torso',.028)
ell('air_cylinder',(-.227,0,.859),(.078,.079,.203),'silver','torso',seg=20,rings=14)
rings('tank_body',[(.71,.074,.075,-.227),(.72,.079,.079,-.227),(.995,.079,.079,-.227),(1.008,.074,.075,-.227)],'silver','torso',N=24,sub=1)
for z in [.785,.955]:
 band('tank_cradle',z,.085,.086,.037,'uiDark','torso',cx=-.227)
 box('tank_strap_latch',(-.315,0,z),(.017,.054,.039),'navy','torso',.005)
for z in [.835,.905]:band('tank_gold',z,.084,.084,.013,'schoolBusYellow','torso',cx=-.227)
text('tank_FD','FD',(-.311,0,.866),.056,'uiDark','torso',back=True)
ell('valve',(-.227,0,.66),(.025,.025,.033),'silver','torso')
ell('valve_wheel',(-.26,0,.647),(.009,.03,.03),'uiDark','torso')
ell('valve_center',(-.273,0,.647),(.005,.015,.015),'schoolBusYellow','torso')
tube('air_hose',[(-.23,.022,.66),(-.241,.101,.652),(-.206,.135,.686),(-.18,.152,.79),(-.149,.17,.91),(-.03,.184,.98),(.122,.15,.927),(.18,.126,.825)],[.012]*8,'uiDark','torso',N=10)
# Tailoring seams and broad shallow folds add purposeful garment structure.
for sign,side in [(1,'L'),(-1,'R')]:
 tube('coat_seam'+side,[(.118,sign*.128,.57),(.125,sign*.112,.69),(.112,sign*.122,.82),(.104,sign*.135,.92)],[.0025]*4,'khakiSeam','torso',N=6,sub=0)
 for j,z in enumerate([.593,.705,.874]):
  tube('coat_crease'+side+str(j),[(.139,sign*.035,z),(.15,sign*.079,z+.013),(.12,sign*.137,z-.008)],[(.004,.006),(.006,.013),(.002,.004)],'khakiLight','torso',N=8)
 for j,z in enumerate([.45,.405]):
  tube('trouser_front_crease'+side+str(j),[(.071,sign*.053,z+.018),(.106,sign*.1,z),(.075,sign*.155,z-.013)],[(.005,.007),(.007,.014),(.002,.004)],'khakiLight','leg'+side,N=8)
 tube('pocket_stitch'+side,[(.079,sign*.055,.811),(.15,sign*.065,.8),(.151,sign*.108,.8)],[.002]*3,'khakiSeam','torso',N=6,sub=0)
for z in [.918,.885]:ell('coat_button',(.172,0,z),(.006,.008,.008),'uiDark','torso',seg=8)
# Reduce redundant applied subdivision without changing joint structure.
for o in objects:
 if len(o.data.polygons)>80:
  bpy.context.view_layer.objects.active=o
  mod=o.modifiers.new('game density','DECIMATE');mod.ratio=.52;bpy.ops.object.modifier_apply(modifier=mod.name)
# Join decorations per rigid parent into one mesh; material slots preserve palette identity.
for parent in list(parts.values()):
 group=[o for o in bpy.data.objects if o.type=='MESH' and o.parent==parent]
 if not group:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();o=group[0];o.name=parent.name+'__geometry'
 # Origin is the joint even for the rigid mesh child.
 world=o.matrix_world.copy();bpy.context.view_layer.update();joint=parent.matrix_world.translation
 for vert in o.data.vertices:vert.co=world@vert.co-joint
 o.matrix_world=Matrix.Translation(joint)
objects=[o for o in bpy.data.objects if o.type=='MESH']
# Widen the head including its helmet, while keeping the neck joint unit-scaled.
for vert in bpy.data.objects['head__geometry'].data.vertices:
 vert.co.x*=1.15;vert.co.y*=1.15;vert.co.z*=1.06
for o in objects:
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
required='root hip torso head armL armR foreArmL foreArmR handL handR legL legR shinL shinR footL footR weaponSocketR weaponSocketL backpackSocket'.split()
triangles=sum(len(o.data.polygons) for o in objects)
stats={'id':'npc.firefighter-alive','triangles':triangles,'meshes':len(objects),'nodes_ok':all(n in parts for n in required),'missing_nodes':[n for n in required if n not in parts]}
(P/'build-stats.json').write_text(json.dumps(stats,indent=2))
if a.glb:
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects+list(parts.values()):o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if a.pose:
 parts['armL'].rotation_euler.x=.6;parts['armL'].rotation_euler.y=-.55;parts['foreArmL'].rotation_euler.y=-.9;parts['legR'].rotation_euler.y=-.45;parts['shinR'].rotation_euler.y=.5
if a.render and a.view=='turnaround':
 import numpy as np
 panels=[]
 for name in ['front','side','back','review-hero']:
  im=bpy.data.images.load(str(P/'renders'/f'{name}.png'));w,h=im.size;pix=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pix);panels.append(pix.reshape(h,w,4)[:,(w-330)//2:(w+330)//2,:])
 data=np.concatenate(panels,axis=1);im=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True);im.pixels.foreach_set(data.ravel());im.filepath_raw=a.render;im.file_format='PNG';im.save();print('OK turnaround');sys.exit(0)
if a.render:
 world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5
 def light(n,p,power,color,size):
  d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.75))-o.location).to_track_quat('-Z','Y').to_euler()
 light('warm key',(3,-4,5),420,(1,.84,.7),3);light('cool fill',(1,4,3),230,(.65,.74,1),3);light('amber rim',(-3,1,3.5),450,(1,.55,.28),2)
 bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='studio_floor';floor.data.materials.append(palette.mat('asphalt'))
 cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
 views={'hero':(6,-4,2.65),'front':(6,0,1.05),'side':(0,-6,1.05),'back':(-6,0,1.05)}
 cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((-.01,0,.72))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.72*max(a.width/a.height,1)
 S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
 S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
 S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG';S.render.filepath=a.render
 if a.view=='all':
  for view,name in [('front','front'),('side','side'),('back','back'),('hero','review-hero')]:
   cam.location=views[view];cam.rotation_euler=(Vector((-.01,0,.72))-cam.location).to_track_quat('-Z','Y').to_euler()
   S.render.filepath=str(Path(a.render).parent/(name+'.png'));bpy.ops.render.render(write_still=True)
 else:bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(objects),'meshes')
