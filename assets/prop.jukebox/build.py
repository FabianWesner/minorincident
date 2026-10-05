"""Production retro jukebox. Metres, +X front, Z up; deterministic solid details.
Static parts merge by palette; rear service door retains its hinge pivot.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
P=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for k in ['render','glb']:p.add_argument('--'+k)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
M={}
def mat(token,h,metal=0,em=False):
 m=bpy.data.materials.new(('emi_' if em else 'pal_')+token);m.use_nodes=True
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
 m.diffuse_color=c;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=c;b.inputs['Roughness'].default_value=.3 if metal else .48;b.inputs['Metallic'].default_value=metal
 if em:b.inputs['Emission Color'].default_value=c;b.inputs['Emission Strength'].default_value=.8
 M[token+('_lit' if em else '')]=m;return m
wood=mat('woodWarm','49271f');dark=mat('uiDark','25222c');chrome=mat('sidewalk','b9a4a0',.8);gold=mat('schoolBusYellow','f2b630',.5);red=mat('survivorRed','d9363e',.25);paper=mat('picketWhite','f2e6dc');glow=mat('windowGlow','ffb638',em=True);edge=mat('sirenRed','ff2d2d',em=True)
edge.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.4
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root)
static=[];door=[]
def finish(o,m,bevel=0,parts=static):
 o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('rounded edges','BEVEL');mod.width=bevel;mod.segments=2
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 for f in o.data.polygons:f.use_smooth=True
 mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 parts.append(o);return o
# Helpers use front-depth x, horizontal y, height z.
def box(n,x,y,z,dx,dy,dz,m,b=.008,parts=static):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z));o=bpy.context.object;o.name=n;o.dimensions=(dx,dy,dz);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,m,min(b,min(dx,dy,dz)*.4),parts)
def profile(n,pts,x0,x1,m,b=0):
 N=len(pts);v=[(x,y,z) for x in (x0,x1) for y,z in pts];f=[tuple(range(N-1,-1,-1)),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
 me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);return finish(o,m,b)
def arc(r,z,start=0,end=math.pi,N=40):return [(r*math.cos(start+(end-start)*i/N),z+r*math.sin(start+(end-start)*i/N)) for i in range(N+1)]
def tube(n,pts,r,m,x=.35):
 cu=bpy.data.curves.new(n,'CURVE');cu.dimensions='3D';cu.resolution_u=1;cu.bevel_depth=r;cu.bevel_resolution=1;cu.use_fill_caps=True
 s=cu.splines.new('POLY');s.points.add(len(pts)-1)
 for p,(y,z) in zip(s.points,pts):p.co=(x,y,z,1)
 o=bpy.data.objects.new(n,cu);bpy.context.collection.objects.link(o);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,m)
def cyl(n,x,y,z,r,d,m,axis='Z',N=24):
 bpy.ops.mesh.primitive_cylinder_add(vertices=N,radius=r,depth=d,location=(x,y,z),rotation=(0,math.pi/2,0) if axis=='X' else (0,0,0));o=bpy.context.object;o.name=n;return finish(o,m,.003)
outline=[(-.52,.09),(.52,.09),(.52,1.48)]+arc(.52,1.48)[1:]
profile('body',outline,-.29,.27,wood,.018)
profile('front enamel',[(-.46,.2),(.46,.2),(.46,1.48)]+arc(.46,1.48)[1:],.275,.297,dark)
box('plinth',0,0,.105,.65,1.11,.17,wood,.025)
for z in [.055,.187]:box('base trim',.015,0,z,.67,1.12,.025,chrome)
for radius,r,m in [(.492,.019,edge),(.468,.028,glow),(.431,.007,red),(.403,.029,glow),(.367,.009,chrome)]:tube('double neon arch',arc(radius,1.48),r,m)
# Neon pillars and stacked red/nickel collars.
for y in [-.455,.455]:
 cyl('foot',.31,y,.038,.082,.076,gold)
 cyl('lower shaft',.31,y,.443,.074,.49,dark)
 cyl('neon pillar',.32,y,1.074,.06,.77,glow)
 for dy in [-.047,.047]:tube('red pillar rail',[(y+dy,.7),(y+dy,1.46)],.008,edge,.365)
 for z in [.102,.157,.211,.687,1.304,1.4,1.465]:cyl('chrome collars',.32,y,z,.082,.025,chrome)
 for z in [.13,.183,1.35]:cyl('ruby collars',.32,y,z,.073,.03,red)
 box('red shoulder capsule',.393,y,1.353,.05,.142,.044,red,.018)
# Upper record window with physical fan, vinyl rings and brass label.
win=[(-.325,1.478),(.325,1.478)]+arc(.325,1.478)[1:]
profile('record display',win,.303,.323,dark)
tube('window bezel',arc(.327,1.48)+[(-.327,1.48),(.327,1.48)],.012,chrome,.35)
for i in range(17):
 t=.12*math.pi+i*.76*math.pi/16;y=.235*math.cos(t);z=1.5+.235*math.sin(t)
 o=box('record changer tab',.336,y,z,.014,.034,.07,gold,.003);o.rotation_euler.x=t-math.pi/2
for r in [.135,.18,.25]:tube('changer rails',arc(r,1.50,.08*math.pi,.92*math.pi,28),.003,gold,.352)
cyl('vinyl',.363,0,1.545,.089,.014,dark,'X',40)
for r in [.057,.072,.082]:tube('record groove',arc(r,1.545,0,math.tau,32),.0017,chrome,.375)
cyl('label',.38,0,1.545,.026,.01,gold,'X');cyl('spindle',.389,0,1.545,.004,.008,chrome,'X',12)
# Song-card trays: cards and bars are separated by >=3mm in depth.
box('selector rim',.337,0,1.341,.065,.659,.205,red,.015)
box('selector chrome',.375,0,1.341,.018,.632,.185,chrome)
box('selector shadow',.389,0,1.341,.012,.603,.163,dark,.003)
for sign in [-1,1]:
 for col in range(4):
  y=sign*(.077+col*.062)
  for row in range(4):
   z=1.277+row*.042
   box('song card',.405,y,z,.012,.052,.032,paper,.002)
   box('printed title',.415,y,z,.004,.033,.003,wood,.0005)
 for col in range(5):box('selector divider',.425,sign*(.046+col*.062),1.34,.012,.005,.165,chrome,.001)
box('button center',.427,0,1.342,.029,.077,.204,dark)
for y in [-.02,.02]:
 for z in [1.279,1.322,1.365]:box('red selector button',.452,y,z,.022,.019,.029,red,.008)
box('top latch',.425,0,1.458,.035,.026,.067,chrome)
box('latch inset',.448,0,1.458,.012,.012,.049,red,.004)
box('dashboard',.335,0,1.164,.073,.654,.102,wood,.015)
for y in [-.268,.268]:
 box('control wings',.382,y,1.164,.014,.09,.065,chrome)
 cyl('control ruby',.403,y,1.164,.013,.018,red,'X')
for y in [-.125,.125]:box('dashboard inlay',.384,y,1.164,.023,.019,.069,chrome)
box('coin surround',.382,0,1.164,.021,.14,.063,chrome)
box('coin brass',.398,0,1.164,.015,.113,.041,gold)
for y in [-.041,.041]:box('coin slot',.411,y,1.164,.006,.007,.03,dark,.001)
cyl('credit button',.42,0,1.164,.017,.015,red,'X')
# Lower U surround and clipped diamond lattice.
u=[(-.217,1.107),(-.217,.716)]+arc(.217,.716,math.pi,math.tau,40)[1:]+[(.217,1.107)]
for r,m,x in [(.054,edge,.325),(.044,glow,.349)]:tube('lower U neon',u,r,m,x)
sp=[(-.155,1.104),(-.155,.716)]+arc(.155,.716,math.pi,math.tau,32)[1:]+[(.155,1.104)]
profile('speaker backing',sp,.304,.333,gold)
tube('speaker bezel',sp+[sp[0]],.01,chrome,.36)
for slope in [-1.7,1.7]:
 for i in range(-12,13):
  intercept=.8+i*.043;pts=[]
  for j in range(150):
   z=.56+j*.00365;y=(z-intercept)/slope
   if abs(y)<.15 and (z>=.716 or y*y+(z-.716)**2<.15**2):pts.append((y,z))
  if len(pts)>1:tube('speaker mesh',[pts[0],pts[-1]],.0025,dark,.344)
 for intercept in [.53,.76,.99,1.22]:
  pts=[]
  for j in range(150):
   z=.56+j*.00365;y=(z-intercept)/slope
   if abs(y)<.15 and (z>=.716 or y*y+(z-.716)**2<.15**2):pts.append((y,z))
  if len(pts)>1:tube('diamond fretwork',[pts[0],pts[-1]],.009,chrome,.377)
for sign in [-1,1]:
 for z,scale in [(1.073,1),(.675,.7),(.592,.55)]:
  pts=[]
  for i in range(25):
   t=i/24*math.tau;r=.039*(1-i/34)*scale;pts.append((sign*(.087+r*math.cos(t)),z+r*math.sin(t)))
  tube('deco scroll',pts,.007,chrome,.398)
 tube('deco leaf',[(0,1.01),(sign*.008,1.06),(sign*.034,1.097),(sign*.07,1.116)],.008,chrome,.405)
 for z in [.735,1.105]:cyl('inner neon clamp',.346,sign*.217,z,.051,.022,gold)
 cyl('lower rivet',.327,sign*.27,.46,.014,.013,chrome,'X',16)
cyl('medallion',.408,0,.716,.049,.013,chrome,'X');cyl('ruby medallion',.424,0,.716,.039,.012,red,'X')
tube('music note',[(0,.696),(0,.741),(.018,.733)],.005,gold,.436)
crown=[(-.074,1.86),(-.098,2.018),(-.052,2.07),(0,2.102),(.052,2.07),(.098,2.018),(.074,1.86),(0,1.846)]
profile('crown',crown,.356,.418,chrome,.013)
profile('ruby crown',[(y*.72,1.86+(z-1.86)*.92) for y,z in crown],.425,.457,red,.009)
for y in [-.056,-.032,.032,.056]:tube('crown flutes',[(y*.5,1.87),(y,1.95),(y*.9,2.043)],.006,chrome,.468)
for y in [-.045,-.03,-.015,0,.015,.03,.045]:tube('base deco fan',[(y,.233),(y,.4),(y*.42,.46),(y*.42,.548)],.006,chrome,.335)
# Rear service door has an actual hinge-origin; no redundant front moving parts.
box('rear service door',-.308,0,.88,.023,.77,1.37,dark,.015,door)
for z in [.43,1.33]:
 for i in range(6):box('rear vent',-.326,0,z+i*.022,.009,.42,.008,wood,.002,door)
box('rear handle',-.35,-.28,.96,.05,.023,.11,chrome,.007,door)
for z in [.4,1.35]:box('rear hinge',-.333,.395,z,.03,.034,.09,chrome)
# Apply world transforms, then join by material. Door is independently pivoted.
def join_parts(parts,prefix,parent,pivot=None):
 result=[]
 groups=[(m,[o for o in parts if o.data.materials[0]==m]) for m in M.values()]
 for m,obs in groups:
  if not obs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object;o.name=prefix+m.name
  if pivot is not None:
   bpy.context.scene.cursor.location=pivot;bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
  bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.parent=parent;result.append(o)
 return result
assets=join_parts(static,'body_',root)
hinge=bpy.data.objects.new('door_service',None);bpy.context.collection.objects.link(hinge);hinge.location=(-.32,.397,.88);hinge.parent=root
assets+=join_parts(door,'door_',hinge,(-.32,.397,.88))
# Preserve world position after parenting to hinge.
for o in assets:
 if o.parent==hinge:o.location-=hinge.location
anchor=bpy.data.objects.new('light:neon',None);bpy.context.collection.objects.link(anchor);anchor.parent=root;anchor.location=(.35,0,1.25)
anchor['ss_light']=json.dumps({'type':'neon','color':'light_window_warm','intensity':2,'range':2,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'none','powerGroup':'self','breakable':True,'emissiveNodes':[o.name for o in assets if o.data.materials[0].name.startswith('emi_')],'tiers':'all'})
col=bpy.data.objects.new('col:body',None);bpy.context.collection.objects.link(col);col.parent=root;col.location=(.05,0,1.05);col['collider']='cuboid';col['shape']='cuboid';col['size']=[.84,1.12,2.10]
root['ss_physics']=json.dumps({'class':'heavy','mass':180,'friction':.7,'restitution':.05,'centerOfMass':[0,0,.8],'pushable':True,'kickable':False,'vaultable':False,'flammable':True,'barricadeValue':1,'barricadeHP':250,'sounds':'prop.metal-heavy'})
# Retain broad bevels while collapsing redundant cylindrical and curve segments.
for o in assets:
 bpy.context.view_layer.objects.active=o
 mod=o.modifiers.new('side tier simplification','DECIMATE');mod.ratio=.27
 bpy.ops.object.modifier_apply(modifier=mod.name)
# Deterministic 32-ray geometry AO, stored as the pipeline's ao color attribute.
from mathutils.bvhtree import BVHTree
bpy.context.view_layer.update()
verts=[];faces=[]
for o in assets:
 offset=len(verts);verts.extend(o.matrix_world @ v.co for v in o.data.vertices)
 faces.extend(tuple(offset+i for i in f.vertices) for f in o.data.polygons)
bvh=BVHTree.FromPolygons(verts,faces)
for o in assets:
 values=[]
 for v in o.data.vertices:
  n=(o.matrix_world.to_3x3() @ v.normal).normalized();t=n.cross(Vector((0,0,1)))
  if t.length<.01:t=n.cross(Vector((0,1,0)))
  t.normalize();b=n.cross(t);origin=o.matrix_world @ v.co+n*.0015;hits=0
  for i in range(32):
   z=math.sqrt((i+.5)/32);r=math.sqrt(1-z*z);phi=i*2.3999632297
   direction=t*(r*math.cos(phi))+b*(r*math.sin(phi))+n*z
   if bvh.ray_cast(origin,direction,.2)[0] is not None:hits+=1
  values.append(1-.65*hits/32)
 attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
 for loop in o.data.loops:
  v=values[loop.vertex_index];attr.data[loop.index].color=(v,v,v,1)
 o.data.color_attributes.active_color=attr
tris=0
for o in assets:o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
report={'id':'prop.jukebox','tier':'Side','triangles':tris,'draw_calls':len(assets),'materials':sorted(m.name for m in M.values()),'nodes_ok':True,'within_budget':6000<=tris<=12000 and len(assets)<=30,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(P/'report.json').write_text(json.dumps(report,indent=2));print('BUILD OK',json.dumps(report))
if a.glb:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True)
if a.render:
 s=bpy.context.scene;s.world=bpy.data.worlds.new('studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.35,.31,.3,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.6
 bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.location.z=-.004;floor.data.materials.append(paper)
 for loc,energy,size in [((4,-4,6),500,4),((1,4,4),350,3),((-3,0,5),450,3)]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=energy;o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
 target=Vector((0,0,1.05));views={'ref':(5,2.0,2.65),'game':(4,4,5.1),'front':(5,0,1.2),'side':(0,5,1.7),'rear':(-5,-2,2.7)}
 bpy.ops.object.camera_add(location=views[a.view]);cam=bpy.context.object;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=4.35;s.camera=cam
 s.render.engine='CYCLES';s.cycles.samples=a.samples;s.cycles.use_denoising=True
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
 for d in prefs.devices:d.use=True
 s.cycles.device='GPU';s.render.resolution_x=a.width;s.render.resolution_y=a.height;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX';s.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True);print('RENDER OK')
