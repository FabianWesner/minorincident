# Identity: black hood/trunk + white doors/roof; red-blue light bar; chunky wheels;
# broad warm headlights and dark grille; thick front push bumper; gold door badge.
# Simplified parts: beveled lower hull, hood/trunk, tapered cab, dark window panels,
# four 12-sided tires with plain hubs, three-piece light bar, bumper/grille, badge.
# Drop: lettering, panel seams, wipers, hinges, handles, tread, lug nuts, tiny trim.
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
def cyl(name,loc,r,depth,t,anim=False):
 bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=depth,location=loc,rotation=(math.pi/2,0,0));return finish(bpy.context.object,name,t,anim,.035)
body=box('body',(0,0,.72),(4.5,1.96,.76),'uiDark',.17)
# Round wheel openings in the lower shell, oversized toy wheels.
for x in [-1.42,1.42]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.57,depth=3,location=(x,0,.49),rotation=(math.pi/2,0,0));cut=bpy.context.object
 bpy.context.view_layer.objects.active=body;mod=body.modifiers.new('wheel opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
for x,label in [(1.42,'front'),(-1.42,'rear')]:
 for y,side in [(-.96,'left'),(.96,'right')]:
  wheel=cyl('wheel_'+label+'_'+side,(x,y,.49),.49,.34,'uiDark',True);hub=cyl('hub',(x,y+(-.18 if y<0 else .18),.49),.265,.04,'sidewalk',True)
  bpy.ops.object.select_all(action='DESELECT');wheel.select_set(True);hub.select_set(True);bpy.context.view_layer.objects.active=wheel;bpy.ops.object.join();asset.remove(hub)
  wheel['contract_name']={'front_left':'wheelFL','front_right':'wheelFR','rear_left':'wheelRL','rear_right':'wheelRR'}[label+'_'+side]
box('hood',(1.48,0,1.08),(1.40,1.87,.24),'uiDark',.10)
box('trunk',(-1.70,0,1.06),(.95,1.87,.24),'uiDark',.10)
for y in [-.986,.986]:box('white doors',(-.05,y,.94),(1.92,.055,.63),'picketWhite',.025)
# Cab tapered in both axes, broad white roof and frame.
v=[(-1.32,-.91,1.15),(1.0,-.91,1.15),(1.0,.91,1.15),(-1.32,.91,1.15),(-.90,-.72,1.98),(.45,-.72,1.98),(.45,.72,1.98),(-.90,.72,1.98)]
cab=mesh('cab',v,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'picketWhite')
bpy.context.view_layer.objects.active=cab
mod=cab.modifiers.new('soft cab edges','BEVEL');mod.width=.045;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
# Flat dark glazing floating just above cab faces, one thick pillar per side.
for s in [-1,1]:
 def pt(x,z):return (x,s*(.91-(z-1.15)/.83*.19+.008),z)
 panel('front side window',[pt(.84,1.26),pt(.39,1.88),pt(-.16,1.88),pt(-.16,1.26)],'glassDark')
 panel('rear side window',[pt(-.26,1.26),pt(-.26,1.88),pt(-.84,1.88),pt(-1.18,1.26)],'glassDark')
 box('mirror',(.72,s*1.04,1.26),(.29,.23,.19),'uiDark',.06)
 panel('gold shield',[(.22,s*1.018,.79),(.39,s*1.018,.95),(.35,s*1.018,1.12),(.09,s*1.018,1.12),(.05,s*1.018,.95)],'schoolBusYellow')
panel('windshield',[(.944,-.80,1.26),(.944,.80,1.26),(.532,.65,1.88),(.532,-.65,1.88)],'glassDark')
panel('rear glass',[(-1.27,.80,1.26),(-1.27,-.80,1.26),(-.96,-.65,1.88),(-.96,.65,1.88)],'glassDark')
box('lightbar base',(-.24,0,2.03),(.46,1.58,.13),'uiDark',.04)
box('sirenL',(-.24,-.49,2.19),(.42,.65,.25),'sirenRed',.05,True)
box('sirenR',(-.24,.49,2.19),(.42,.65,.25),'policeBlue',.05,True)
box('lightbar middle',(-.24,0,2.17),(.40,.31,.20),'picketWhite',.025)
box('grille',(2.251,0,.87),(.04,.93,.31),'glassDark',.015)
for y in [-.69,.69]:box('lightsFront',(2.25,y,.95),(.10,.43,.28),'windowGlow',.035)
for y in [-.78,.78]:box('lightsBrake',(-2.23,y,.95),(.09,.26,.34),'sirenRed',.025)
box('front bumper',(2.26,0,.55),(.22,1.91,.20),'sidewalk',.06)
box('rear bumper',(-2.26,0,.55),(.18,1.91,.18),'sidewalk',.05)
for y in [-.50,.50]:box('push upright',(2.43,y,.79),(.20,.16,.83),'uiDark',.055)
box('push crossbar',(2.45,0,.71),(.20,1.14,.17),'uiDark',.045)
# Join all static surfaces per material; wheels and siren lenses retain joint origins.
for m in M.values():
 objs=[o for o in bpy.data.objects if o.type=='MESH' and o.get('static') and o.data.materials[0]==m]
 if not objs:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();objs[0].name='body' if m==M['uiDark'] else 'static_'+m.name
for name,loc in [('driverSeat',(.1,-.4,1.2)),('exitL',(0,-1.4,0)),('exitR',(0,1.4,0))]:
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc
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
