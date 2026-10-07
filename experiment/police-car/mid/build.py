# Identity features: black hood/trunk and cream cabin; bold extruded POLICE lettering;
# gold star shields; segmented red/blue light bar; warm broad headlights and push bar;
# oversized layered wheels in flared arches.
# Parts: rounded hull and tapered hood/trunk, framed inset glass, two hinged door panels,
# handles/mirrors, tyre/rim/hub wheels, arch flares, grille slats, deep bumpers, lamps.
# Drop: bolts, lug nuts, wipers, tread blocks, tiny lettering, gauges, hinges, fine trim.
import bpy, math, argparse, sys, json
from mathutils import Vector
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--render');p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=16);p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540);p.add_argument('--glb');p.add_argument('--blend');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}; static=[]; asset=[]
def mat(token,h,emit=False):
 c=tuple(int(h[i:i+2],16)/255 for i in (0,2,4));c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)
 m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token);m.diffuse_color=(*c,1);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*c,1);n.inputs['Metallic'].default_value=0;n.inputs['Roughness'].default_value=.78
 if emit:n.inputs['Emission Color'].default_value=(*c,1);n.inputs['Emission Strength'].default_value=3
 M[token]=m;return m
for t,h in [('uiDark','25222c'),('picketWhite','f2e6dc'),('sidewalk','b9a4a0'),('schoolBusYellow','f2b630'),('glassDark','30394b')]:mat(t,h)
for t,h in [('policeBlue','2f6bff'),('sirenRed','ff2d2d'),('windowGlow','ffc773')]:mat(t,h,True)
def finish(o,name,t,anim=False,bevel=0):
 o.name=name;o.data.materials.append(M[t]);bpy.context.view_layer.objects.active=o
 if bevel:
  mod=o.modifiers.new('soft toy edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 asset.append(o)
 if not anim:static.append(o);o['static']=True
 return o
def box(name,loc,size,t,b=.04,anim=False):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,t,anim,b)
def mesh(name,verts,faces,t):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return finish(o,name,t)
def panel(name,verts,t):return mesh(name,verts,[tuple(range(len(verts)))],t)
def framed(name,verts):
 center=sum((Vector(v) for v in verts),Vector())/len(verts)
 outer=[tuple(center+(Vector(v)-center)*1.07) for v in verts]
 panel(name+'_recess',outer,'uiDark')
 # Inner glass sits inside the raised dark frame. Closed ring gives actual depth.
 normal=(Vector(verts[1])-Vector(verts[0])).cross(Vector(verts[2])-Vector(verts[0])).normalized()
 if normal.y*center.y<0:normal=-normal
 if abs(center.y)<.2 and normal.x*center.x<0:normal=-normal
 raised=[tuple(Vector(v)+normal*.018) for v in outer]
 inner=[tuple(Vector(v)+normal*.018) for v in verts]
 n=len(verts);mesh(name+'_frame',raised+inner,[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],'uiDark')
 panel(name,[tuple(Vector(v)+normal*.009) for v in verts],'glassDark')
def lettering(name,word,loc,size,t,side=None):
 c=bpy.data.curves.new(name,'FONT');c.body=word;c.font=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Impact.ttf');c.size=size;c.align_x='CENTER';c.align_y='CENTER';c.extrude=.009;c.resolution_u=2
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=loc
 if side:o.rotation_euler=(math.pi/2,0,0 if side<0 else math.pi)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');return finish(o,name,t)
def lathe(name,loc,profile,t):
 n=16;verts=[(loc[0]+r*math.cos(2*math.pi*i/n),loc[1]+y,loc[2]+r*math.sin(2*math.pi*i/n)) for r,y in profile for i in range(n)]
 faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profile)-1) for i in range(n)]
 return mesh(name,verts,faces,t)
def deck(name,sections):
 vs=[]
 for x,w,z in sections:vs.extend([(x,-w,1.03),(x,w,1.03),(x,w,z),(x,0,z+.045),(x,-w,z)])
 fs=[tuple(range(4,-1,-1)),tuple(range((len(sections)-1)*5,len(sections)*5))]
 for j in range(len(sections)-1):fs.extend([(j*5+i,j*5+(i+1)%5,(j+1)*5+(i+1)%5,(j+1)*5+i) for i in range(5)])
 o=mesh(name,vs,fs,'uiDark');bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('rounded deck','BEVEL');mod.width=.035;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def cyl(name,loc,r,depth,t,anim=False):
 bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=depth,location=loc,rotation=(math.pi/2,0,0));return finish(bpy.context.object,name,t,anim,.035)
body=box('body',(0,0,.72),(4.5,1.96,.76),'uiDark',.17)
# Round wheel openings in the lower shell, oversized toy wheels.
for x in [-1.42,1.42]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.57,depth=3,location=(x,0,.49),rotation=(math.pi/2,0,0));cut=bpy.context.object
 bpy.context.view_layer.objects.active=body;mod=body.modifiers.new('wheel opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
for x,label in [(1.42,'front'),(-1.42,'rear')]:
 for y,side in [(-.96,'left'),(.96,'right')]:
  sign=-1 if y<0 else 1
  wheel=lathe('tyre',(x,y,.50),[(.28,-.17),(.43,-.17),(.50,-.105),(.50,.105),(.43,.17),(.28,.17),(.28,-.17)],'uiDark')
  rim=cyl('rim',(x,y+sign*.172,.50),.315,.045,'glassDark',True)
  hub=cyl('hubcap',(x,y+sign*.206,.50),.19,.055,'sidewalk',True)
  # Join wheel surfaces with their three material primitives; origin at axle.
  for ob in [wheel,rim,hub]:ob['static']=False
  bpy.ops.object.select_all(action='DESELECT')
  for ob in [wheel,rim,hub]:ob.select_set(True)
  bpy.context.view_layer.objects.active=wheel;bpy.ops.object.join()
  wheel.name={'front_left':'wheelFL','front_right':'wheelFR','rear_left':'wheelRL','rear_right':'wheelRR'}[label+'_'+side]
  bpy.context.scene.cursor.location=(x,y,.50);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
  # Broad arch flare, a 16-step half-ring with depth rather than fine trim.
  vs=[]
  for yy,r in [(sign*.965,.56),(sign*1.025,.59),(sign*1.025,.65),(sign*.965,.65)]:
   vs.extend([(x+r*math.cos(i*math.pi/16),yy,.50+r*math.sin(i*math.pi/16)) for i in range(17)])
  fs=[(j*17+i,j*17+i+1,((j+1)%4)*17+i+1,((j+1)%4)*17+i) for j in range(4) for i in range(16)]
  mesh('arch flare',vs,fs,'glassDark')
deck('hood',[(.78,.91,1.24),(1.5,.93,1.22),(2.17,.88,1.13)])
deck('trunk',[(-2.17,.88,1.13),(-1.65,.93,1.21),(-1.24,.91,1.23)])
for side in [-1,1]:
 door=box('doorL' if side<0 else 'doorR',(-.05,side*.988,.94),(1.92,.068,.63),'picketWhite',.055,True)
 doorparts=[door]
 # Bold inset seams, sill livery strip and handles.
 box('door seam',(-.12,side*1.026,.96),(.024,.012,.55),'uiDark',.003)
 box('sill stripe',(-.05,side*1.026,.67),(1.83,.015,.065),'uiDark',.012)
 for x in [.55,-.64]:box('door handle',(x,side*1.045,1.16),(.23,.07,.065),'uiDark',.018)
 lettering('POLICE_side','POLICE',(-.34,side*1.03,.94),.43,'uiDark',side)
 # Layered gold shield, dark inset and chunky star (no microtype).
 vs=[(.64,side*1.035,.72),(.84,side*1.035,.89),(.79,side*1.035,1.11),(.50,side*1.035,1.11),(.45,side*1.035,.89)]
 panel('badge shield',vs,'schoolBusYellow')
 star=[]
 for i in range(10):
  th=math.pi/2+i*math.pi/5;r=.135 if i%2==0 else .06
  star.append((.645+r*math.cos(th),side*1.049,.94+r*math.sin(th)))
 panel('badge star',star,'uiDark')
 # Door decoration and panel share a hinge origin, preserving animation.
 group=[o for o in static if o.name.startswith(('door seam','sill stripe','door handle','POLICE_side','badge shield','badge star')) and o.location.y*side>=0 and (o.location.y!=0 or any(v.co.y*side>0 for v in o.data.vertices))]
 for o in group:
  if o.get('static'):o['static']=False;o.parent=door;o.matrix_parent_inverse=door.matrix_world.inverted()
 bpy.context.scene.cursor.location=(.91,side*.99,1);bpy.ops.object.select_all(action='DESELECT');door.select_set(True);bpy.context.view_layer.objects.active=door;bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
hoodword=lettering('hood_POLICE','POLICE',(1.46,0,1.273),.31,'picketWhite');hoodword.rotation_euler.z=math.pi/2
# Cab tapered in both axes, broad white roof and frame.
v=[(-1.32,-.91,1.15),(1.0,-.91,1.15),(1.0,.91,1.15),(-1.32,.91,1.15),(-.90,-.72,1.98),(.45,-.72,1.98),(.45,.72,1.98),(-.90,.72,1.98)]
cab=mesh('cab',v,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'picketWhite')
bpy.context.view_layer.objects.active=cab
mod=cab.modifiers.new('soft cab edges','BEVEL');mod.width=.045;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
# Flat dark glazing floating just above cab faces, one thick pillar per side.
for s in [-1,1]:
 def pt(x,z):return (x,s*(.91-(z-1.15)/.83*.19+.008),z)
 framed('front side window',[pt(.84,1.26),pt(.39,1.88),pt(-.16,1.88),pt(-.16,1.26)])
 framed('rear side window',[pt(-.26,1.26),pt(-.26,1.88),pt(-.84,1.88),pt(-1.18,1.26)])
 box('mirror',(.72,s*1.04,1.26),(.29,.23,.19),'uiDark',.06)
framed('windshield',[(.944,-.80,1.26),(.944,.80,1.26),(.532,.65,1.88),(.532,-.65,1.88)])
framed('rear glass',[(-1.27,.80,1.26),(-1.27,-.80,1.26),(-.96,-.65,1.88),(-.96,.65,1.88)])
box('rounded roof',(-.225,0,1.985),(1.40,1.47,.12),'picketWhite',.06)
box('lightbar base',(-.24,0,2.03),(.46,1.58,.13),'uiDark',.04)
for i,y in enumerate([-.66,-.40,-.14,.14,.40,.66]):
 box('sirenL' if y<0 else 'sirenR',(-.24,y,2.19),(.42,.235,.22),'sirenRed' if abs(y)>.5 else 'policeBlue',.035,True)
 # Large bright front lamp strip in each separate pod.
 box('lightbar lens',(-.018,y,2.19),(.024,.16,.10),'windowGlow',.012)
box('grille recess',(2.251,0,.89),(.05,1.02,.35),'glassDark',.025)
for z in [.78,.88,.98]:box('grille slat',(2.289,0,z),(.05,.91,.035),'sidewalk',0)
for y in [-.69,.69]:
 box('headlight frame',(2.25,y,.96),(.10,.49,.34),'uiDark',.035)
 box('lightsFront',(2.31,y,.98),(.045,.34,.24),'windowGlow',.025,True)
 box('lightsFront_indicator',(2.311,y+(-.20 if y<0 else .20),.96),(.05,.085,.24),'windowGlow',.015,True)
for y in [-.78,.78]:
 box('tail housing',(-2.23,y,.95),(.10,.32,.40),'uiDark',.04)
 box('lightsBrake',(-2.29,y,.99),(.055,.24,.25),'sirenRed',.025,True)
 box('lightsBrake_reverse',(-2.29,y,.81),(.055,.24,.07),'windowGlow',.015,True)
box('front bumper',(2.26,0,.55),(.22,1.91,.20),'sidewalk',.06)
box('rear bumper',(-2.26,0,.55),(.18,1.91,.18),'sidewalk',.05)
for y in [-.50,.50]:box('push upright',(2.43,y,.79),(.20,.16,.83),'uiDark',.055)
box('push crossbar',(2.45,0,.71),(.20,1.14,.17),'uiDark',.045)
# Group the articulated door decorations by material, then retain hinge-local transforms.
for doorname in ['doorL','doorR']:
 door=bpy.data.objects.get(doorname)
 children=[o for o in bpy.data.objects if o.parent==door]
 for m in M.values():
  obs=[o for o in bpy.data.objects if o.type=='MESH' and o.parent==door and o.data.materials[0]==m]
  if not obs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=doorname+'_'+m.name
# Independent lamp lenses merge into named, material-separated assemblies.
for prefix in ['sirenL','sirenR','lightsFront','lightsBrake']:
 obs=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith(prefix)]
 if len(obs)>1:
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=prefix.replace(' ','_')
# Join all static surfaces per material; wheels and siren lenses retain joint origins.
for m in M.values():
 objs=[o for o in bpy.data.objects if o.type=='MESH' and o.get('static') and o.data.materials[0]==m]
 if not objs:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();objs[0].name='body' if m==M['uiDark'] else 'static_'+m.name
for name,loc in [('driverSeat',(.1,-.4,1.2)),('exitL',(0,-1.4,0)),('exitR',(0,1.4,0))]:
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc
bpy.context.scene.unit_settings.system='METRIC'
bpy.ops.object.select_all(action='SELECT')
if a.glb:bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
if a.blend:bpy.ops.wm.save_as_mainfile(filepath=a.blend)
if a.render:
 groundmat=bpy.data.materials.new('stage');groundmat.diffuse_color=(.16,.12,.18,1)
 bpy.ops.mesh.primitive_plane_add(size=200);g=bpy.context.object;g.data.materials.append(groundmat);g.location.z=-.015
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples
 scene.world.color=(.3,.3,.3)
 def area(loc,power,color,size):
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
 area((3,-4,7),1100,(1,.79,.56),5);area((-4,1,5),900,(.58,.67,1),5)
 bpy.ops.object.camera_add();cam=bpy.context.object;target=Vector((0,0,1));dist=37 if a.view=='game' else 12
 elev=math.radians(36 if a.view=='game' else 27);az=math.radians(45 if a.view=='game' else 38);cam.location=target+Vector((math.cos(az)*math.cos(elev),-math.sin(az)*math.cos(elev),math.sin(elev)))*dist;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(25 if a.view=='game' else 38);scene.camera=cam
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)

print('OK build')
