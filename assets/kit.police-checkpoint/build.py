"""Sunset Grove modular checkpoint. +X is lane approach; dimensions are metres."""
import bpy, math, sys, argparse, json
from pathlib import Path
from mathutils import Vector
P=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for k in ['render','glb']:p.add_argument('--'+k)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24);p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}; groups={}
def material(t,h,em=False):
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
 m=bpy.data.materials.new(('emi_' if em else 'pal_')+t);m.diffuse_color=(*c,1);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*c,1);n.inputs['Roughness'].default_value=.72
 if em:n.inputs['Emission Color'].default_value=(*c,1);n.inputs['Emission Strength'].default_value=3
 M[t]=m
for t,h in [('uiDark','25222c'),('sidewalk','b9a4a0'),('asphalt','5b4f5c'),('picketWhite','f2e6dc'),('policeBlue','2f6bff'),('schoolBusYellow','f2b630'),('survivorRed','d9363e'),('grass','6f8f3a')]:material(t,h)
material('windowGlow','ffc773',True);material('sirenRed','ff2d2d',True)
def empty(n,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=parent;return o
root=empty('root');root['asset_id']='kit.police-checkpoint';interior=empty('interior',parent=root);roof=empty('roof',parent=root)
def finish(o,n,t,group='static',bevel=0):
 o.name=n;o.data.materials.append(M[t]);bpy.context.view_layer.objects.active=o
 if bevel:
  m=o.modifiers.new('soft edges','BEVEL');m.width=bevel;m.segments=1;bpy.ops.object.modifier_apply(modifier=m.name)
  m=o.modifiers.new('normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=m.name)
 groups.setdefault(group,[]).append(o);return o
def box(n,l,s,t,b=.025,g='static'):
 bpy.ops.mesh.primitive_cube_add(size=1,location=l);o=bpy.context.object;o.dimensions=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,n,t,g,b)
def mesh(n,v,f,t,g='static'):
 d=bpy.data.meshes.new(n);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(n,d);bpy.context.collection.objects.link(o);return finish(o,n,t,g)
def beam(n,start,end,w,t,g='static'):
 d=Vector(end)-Vector(start);o=box(n,(Vector(start)+Vector(end))/2,(w,w,d.length),t,0,g);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def cyl(n,l,r,depth,t,g='static',rot=(0,0,0),vertices=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=l,rotation=rot);return finish(bpy.context.object,n,t,g,0)
def text(n,word,l,size,t,g='static'):
 c=bpy.data.curves.new(n,'FONT');c.body=word;c.size=size;c.align_x='CENTER';c.align_y='CENTER';c.extrude=.007;c.resolution_u=1; c.font=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Impact.ttf')
 o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);o.location=l;o.rotation_euler=(math.pi/2,0,math.pi/2)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');return finish(o,n,t,g)
def light(n,l,nodes,kind='point',color='light_sodium',intensity=3):
 o=empty('light:'+n,l,root);o['ss_light']=json.dumps(dict(type=kind,color=color,intensity=intensity,range=10,angle=65,penumbra=.4,pool=True,beam='soft',flare=True,reflect=True,shadow='none',heroPriority=1,flicker='none',animation=None,powerGroup='self',breakable=True,emissiveNodes=nodes,tiers='all'));return o
# A thin modular diorama foundation with a clear open road.
box('foundation',(0,0,.11),(9.4,8.2,.22),'sidewalk',.07)
box('lane',(0,.3,.237),(9.15,3.15,.025),'asphalt',.01)
for x in [-3.8,-2.5,-1.2,.1,1.4,2.7,4]:
 for y in [-3.85,3.85]:box('curb',(x,y,.26),(1.25,.35,.22),'sidewalk',.045)
for x in [1.25,2.35]:
 for y in [-.8,.1,1]:box('crosswalk',(x,y,.258),(.45,.65,.012),'picketWhite',0)
mesh('direction arrow',[(.3,-.12,.26),(.3,.32,.26),(-.15,.32,.26),(-.15,.6,.26),(-.7,.1,.26),(-.15,-.4,.26),(-.15,-.12,.26)],[(0,1,2,3,4,5,6)],'picketWhite')
# Command canopy, pyramidal cloth roof with visible seam ribs and deep valance.
cx,cy=-2.05,-1.55
for x in [cx-1.35,cx+1.35]:
 for y in [cy-1.55,cy+1.55]:
  box('tent foot',(x,y,.31),(.28,.28,.14),'uiDark');box('tent leg',(x,y,1.5),(.085,.085,2.3),'picketWhite',.01)
v=[(cx-1.5,cy-1.7,2.7),(cx+1.5,cy-1.7,2.7),(cx+1.5,cy+1.7,2.7),(cx-1.5,cy+1.7,2.7),(cx,cy-.8,3.52),(cx,cy+.8,3.52),(cx,cy,3.28),(cx+1.5,cy,2.7),(cx-1.5,cy,2.7)]
mesh('cloth',v,[(0,1,4),(1,7,6,4),(7,2,5,6),(2,3,5),(3,8,6,5),(8,0,4,6),(3,2,1,0)],'policeBlue','roof')
for i,j in [(0,4),(1,4),(2,5),(3,5),(7,6),(8,6),(4,6),(5,6)]:beam('roof seam',v[i],v[j],.026,'policeBlue','roof')
for x in [cx-1.5,cx+1.5]:box('valance',(x,cy,2.50),(.055,3.4,.40),'policeBlue',.02,'roof')
for y in [cy-1.7,cy+1.7]:box('valance',(cx,y,2.50),(3,.055,.40),'policeBlue',.02,'roof')
text('tent POLICE','POLICE',(cx+1.533,cy,2.51),.57,'picketWhite','roof')
# The town is Sunset Grove; canopy uses the reference POLICE marking.
# Tables, chairs, paperwork, radio, laptop: readable multipart furnishings.
for y in [cy-.8,cy+.75]:
 box('table',(cx,y,1.05),(1.55,1.05,.10),'schoolBusYellow',.03,'interior')
 for dx in [-.63,.63]:
  for dy in [-.38,.38]:beam('table leg',(cx+dx,y+dy,.27),(cx+dx,y+dy,1),.07,'uiDark','interior')
 box('paper',(cx+.25,y,1.111),(.45,.35,.018),'picketWhite',.005,'interior')
 box('laptop',(cx-.3,y,1.13),(.35,.42,.06),'uiDark',.015,'interior');o=box('screen',(cx-.47,y,1.30),(.04,.40,.28),'uiDark',.02,'interior');o.rotation_euler.y=-.15
 box('screen inset',(cx-.439,y,1.30),(.012,.33,.20),'asphalt',.005,'interior')
 box('chair seat',(cx-.9,y,.64),(.5,.55,.08),'uiDark',.035,'interior');box('chair back',(cx-1.13,y,.87),(.08,.55,.4),'uiDark',.035,'interior')
 for dy in [-.2,.2]:beam('chair frame',(cx-1.07,y+dy,.28),(cx-.69,y+dy,.62),.045,'schoolBusYellow','interior')
# Hard cases, generators and portable twin flood towers.
for x,y in [(-2.6,-3.25),(-3.1,2.85)]:
 box('equipment case',(x,y,.68),(.85,.7,.83),'grass',.065)
 for yy in [y-.24,y+.24]:box('case band',(x,yy,.69),(.88,.06,.86),'uiDark',.01)
 for yy in [y-.2,y+.2]:box('case latch',(x+.448,yy,.75),(.035,.10,.16),'sidewalk',.01)
for i,(x,y) in enumerate([(-.6,-3.25),(-3.5,2.95)]):
 box('generator',(x,y,.63),(1.1,.85,.76),'schoolBusYellow',.065)
 box('generator panel',(x+.56,y,.65),(.022,.60,.44),'uiDark',.02)
 for j in range(5):box('vent',(x+.58,y-.22+j*.105,.64),(.015,.045,.29),'sidewalk',.004)
 box('tower base',(x,y,1.05),(.4,.4,.16),'uiDark');box('mast',(x,y,2.61),(.12,.12,3.1),'sidewalk',.01)
 for z in [1.2,2.5,3.65]:box('mast collar',(x,y,z),(.19,.19,.12),'uiDark',.02)
 g='lamp_flood_'+str(i)
 for yy in [y-.37,y+.37]:
  for z in [3.9,4.25]:
   box('flood housing',(x,yy,z),(.22,.59,.3),'uiDark',.025,g)
   box('flood inset',(x+.118,yy,z),(.027,.51,.24),'uiDark',.01,g)
   box('flood lens',(x+.139,yy,z),(.018,.45,.19),'windowGlow',.012,g)
 light('flood_'+str(i),(x+.2,y,4),[g],'spot','light_led_white',6)
# Striped A-frame barriers; markings stand 8 mm above face.
for i,(x,y) in enumerate([(3.45,2.25),(3.45,-.4),(.35,-2.9)]):
 for yy in [y-.72,y+.72]:
  for dx in [-.33,.33]:beam('barrier leg',(x+dx,yy,.26),(x,yy,1.35),.115,'picketWhite')
  beam('brace',(x-.29,yy,.5),(x+.29,yy,.5),.075,'sidewalk')
 box('barrier board',(x,y,1.25),(.12,1.85,.38),'picketWhite',.025)
 for yy in [y-.68,y-.15,y+.38]:
  mesh('red stripe',[(x+.069,yy-.18,1.065),(x+.069,yy+.05,1.065),(x+.069,yy+.30,1.435),(x+.069,yy+.07,1.435)],[(0,1,2,3)],'survivorRed')
 for j,yy in enumerate([y-.75,y+.75]):
  box('beacon mount',(x,yy,1.52),(.12,.16,.13),'uiDark')
  g='lamp_barrier_'+str(i)+'_'+str(j);cyl('beacon',(x,yy,1.65),.105,.11,'windowGlow',g,(0,math.pi/2,0));light(g,(x,yy,1.65),[g])
# Traffic cones with stacked tapered bands, no overlapping surfaces.
for x,y in [(3,-3.1),(1.3,-2.15),(-.2,1.6),(-2.2,1.1),(1.1,3.1),(3.7,-2.25)]:
 box('cone foot',(x,y,.30),(.5,.5,.08),'survivorRed',.025)
 for z1,z2,r1,r2,t in [(.34,.53,.20,.155,'survivorRed'),(.53,.66,.155,.12,'picketWhite'),(.66,.79,.12,.085,'survivorRed'),(.79,.89,.085,.057,'picketWhite'),(.89,1.02,.057,.025,'survivorRed')]:
  bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=r1,radius2=r2,depth=z2-z1,location=(x,y,(z1+z2)/2));finish(bpy.context.object,'cone band',t)
# Rear chain-link fence; diagonals clipped at panel bounds.
for y in [-3.5,-1.75,0,1.75,3.5]:
 box('fence post',(-4.2,y,1.35),(.09,.09,2.2),'sidewalk',.01);cyl('post cap',(-4.2,y,2.47),.072,.08,'schoolBusYellow')
for lo in [-3.5,-1.75,0,1.75]:
 hi=lo+1.75
 for z in [.45,2.35]:beam('fence rail',(-4.2,lo,z),(-4.2,hi,z),.045,'sidewalk')
 for sign in [-1,1]:
  for k in range(-8,9):
   b=k*.25
   pts=[]
   for yy in [0,1.75]:
    zz=sign*yy+b
    if 0<=zz<=1.9:pts.append((yy,zz))
   for zz in [0,1.9]:
    yy=(zz-b)/sign
    if 0<=yy<=1.75:pts.append((yy,zz))
   if len(pts)>=2:beam('chain link',(-4.19,lo+pts[0][0],.45+pts[0][1]),(-4.19,lo+pts[1][0],.45+pts[1][1]),.013,'sidewalk')
# Traffic signal tower, three hooded lenses.
x,y=-3.8,.6
box('signal plinth',(x,y,.47),(.65,.65,.42),'uiDark');box('signal pole',(x,y,1.94),(.16,.16,2.7),'sidewalk')
box('signal housing',(x,y,3.36),(.32,.40,1.04),'uiDark')
for i,(z,t) in enumerate([(3.69,'sirenRed'),(3.36,'schoolBusYellow'),(3.03,'grass')]):
 cyl('signal rim',(x+.19,y,z),.14,.11,'uiDark',rot=(0,math.pi/2,0));cyl('signal lens',(x+.255,y,z),.105,.028,t,rot=(0,math.pi/2,0))
box('signal controller',(x+.17,y,1.72),(.25,.32,.48),'uiDark')
light('signal_red',(-3.55,.6,3.69),['static_sirenRed'],'beacon','light_siren_red',3)
# Towable illuminated sign, layered tyres and support outriggers.
x,y=2,-2.7
box('trailer chassis',(x,y,.61),(1.65,1.02,.28),'schoolBusYellow',.055)
beam('drawbar',(x-.6,y,.56),(x-1.28,y,.56),.12,'uiDark');box('hitch',(x-1.32,y,.56),(.20,.20,.14),'sidewalk')
for side in [-1,1]:
 g='wheelL' if side<0 else 'wheelR';yy=y+side*.58
 cyl('tyre',(x,yy,.54),.30,.20,'uiDark',g,(math.pi/2,0,0),20)
 cyl('rim',(x,yy+side*.108,.54),.20,.025,'sidewalk',g,(math.pi/2,0,0),16)
 cyl('hub',(x,yy+side*.13,.54),.10,.05,'sidewalk',g,(math.pi/2,0,0))
 box('fender',(x,yy,.87),(.76,.30,.12),'schoolBusYellow',.04)
for xx in [x-.67,x+.67]:
 for yy in [y-.42,y+.42]:box('jack',(xx,yy,.53),(.075,.075,.52),'sidewalk',.01);box('jack foot',(xx,yy,.28),(.22,.19,.065),'uiDark')
for yy in [y-.42,y+.42]:box('sign upright',(x,yy,1.29),(.09,.09,1.12),'uiDark',.015)
box('sign frame',(x,y,1.79),(.20,1.72,1.18),'schoolBusYellow',.04)
box('sign bezel',(x+.113,y,1.79),(.045,1.62,1.08),'uiDark',.022)
box('display',(x+.142,y,1.79),(.014,1.46,.92),'asphalt',.005)
text('stop','STOP',(x+.16,y,2.01),.62,'windowGlow');text('here','HERE',(x+.16,y,1.56),.62,'windowGlow')
light('message',(x+.2,y,1.8),['static_windowGlow'],'neon','light_sodium',2)
# Raised generator access plates and top handles.
for x,y in [(-.6,-3.25),(-3.5,2.95)]:
 box('access hatch',(x,y-.438,.65),(.54,.026,.40),'schoolBusYellow',.02)
 box('hatch latch',(x+.13,y-.46,.70),(.08,.02,.13),'uiDark',.006)
 for yy in [y-.23,y+.23]:box('lifting handle',(x,yy,1.035),(.28,.06,.055),'uiDark',.01)
# Merge static by material, and moving multipart assemblies by named joint.
for group,obs in groups.items():
 buckets={}
 for o in obs:buckets.setdefault(o.data.materials[0].name if group in ['static','roof','interior'] else group,[]).append(o)
 for key,parts in buckets.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in parts:o.select_set(True)
  bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=parts[0]
  o.name=(group+'_'+key.removeprefix('pal_').removeprefix('emi_')) if group in ['static','roof','interior'] else group
  parent=roof if group=='roof' else interior if group=='interior' else root
  o.parent=parent
  pivot=(2,-2.7+(-.58 if group=='wheelL' else .58),.54) if group.startswith('wheel') else ((-.6,-3.25,3.8) if group=='lamp_flood_0' else (-3.5,2.95,3.8) if group=='lamp_flood_1' else o.location)
  bpy.context.scene.cursor.location=pivot;bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
exported=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in exported:o.data.calc_loop_triangles()
tris=sum(len(o.data.loop_triangles) for o in exported);draws=sum(len(o.data.materials) for o in exported)
# Deterministic baked corner AO is shared by Blender and runtime.
sys.path.insert(0,str(P.parents[1]/'tools'/'blender'))
from sslib.ao import bake_all
bake_all(exported,samples=32)
if a.glb:
 bpy.ops.object.select_all(action='DESELECT')
 for o in bpy.context.scene.objects:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
(P/'metrics.json').write_text(json.dumps(dict(triangles=tris,draw_calls=draws,materials=sorted(m.name for m in M.values()),nodes=[o.name for o in bpy.context.scene.objects]),indent=2))
if a.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.world.color=(.18,.18,.18)
 box('studio',(0,0,-.055),(200,200,.1),'uiDark',0)
 def area(loc,power,size,color):
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
 area((2,-6,12),2100,8,(1,.80,.61));area((-7,1,8),1700,7,(.65,.72,1));area((4,8,10),1800,6,(1,.72,.43))
 bpy.ops.object.camera_add();cam=bpy.context.object;target=Vector((0,0,1.9));loc={'ref':(13,-16,13),'game':(15,-15,19),'front':(20,0,7),'side':(0,-20,8),'rear':(-18,12,10)}[a.view];cam.location=loc;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=19 if a.view=='game' else 17.4;scene.camera=cam
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.view_settings.exposure=-.5;scene.render.image_settings.file_format='PNG';scene.render.filepath=a.render
 tree=bpy.data.node_groups.new('Checkpoint compositor','CompositorNodeTree');scene.compositing_node_group=tree;n=tree.nodes;rl=n.new('CompositorNodeRLayers');gl=n.new('CompositorNodeGlare');gl.inputs['Type'].default_value='Fog Glow';gl.inputs['Threshold'].default_value=1.2;gl.inputs['Strength'].default_value=.3;tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor');out=n.new('NodeGroupOutput');tree.links.new(rl.outputs['Image'],gl.inputs['Image']);tree.links.new(gl.outputs['Image'],out.inputs['Image']);bpy.ops.render.render(write_still=True)
 if a.view=='ref':
  cam.location=(15,-15,19);cam.data.ortho_scale=19;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x=960;scene.render.resolution_y=540;scene.cycles.samples=24
  image_path=Path(a.render);scene.render.filepath=str(image_path.with_name(image_path.name.replace('-ref','-game') if '-ref' in image_path.name else 'game.png'));bpy.ops.render.render(write_still=True)
print('OK',tris,'triangles',draws,'draw calls')
