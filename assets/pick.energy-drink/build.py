"""Energy can pickup. Metres, +X label front, Z up; solid raised markings."""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for k in ('render','glb'):p.add_argument('--'+k)
p.add_argument('--lod',type=int,choices=[0,1,2],default=0)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
SEGMENTS=(24,16,12)[a.lod]
TAB_SEGMENTS=(16,12,8)[a.lod]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}
for token,h,metal in [('policeBlue','2f6bff',.28),('sidewalk','b9a4a0',.78),('picketWhite','f2e6dc',.72),('schoolBusYellow','f2b630',.22),('uiDark','25222c',.35)]:
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 m=bpy.data.materials.new('pal_'+token);m.use_nodes=True;n=m.node_tree.nodes['Principled BSDF']
 n.inputs['Base Color'].default_value=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)+(1,)
 n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=.3 if metal else .45;M[token]=m
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='pick.energy-drink'
root['ss_physics']={'class':'light','mass':.5,'friction':.5,'restitution':.2,'centerOfMass':[0,.176,0],'pushable':True,'kickable':True,'barricadeValue':0,'barricadeHP':1,'vaultable':True,'flammable':False,'sounds':'prop.metal-light'}
body=bpy.data.objects.new('body',None);bpy.context.collection.objects.link(body);body.parent=root
def mesh(name,v,f,t):
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.data.materials.append(M[t]);o.parent=body;return o

def lathe(name,profile,t,n=None):
 n=n or SEGMENTS
 v=[(r*math.cos(i*2*math.pi/n),r*math.sin(i*2*math.pi/n),z) for r,z in profile for i in range(n)]
 f=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profile)-1) for i in range(n)]
 o=mesh(name,v,f,t)
 for face in o.data.polygons:face.use_smooth=name!='painted_shell'
 return o
# Continuous tapered shell and sculpted shoulder / foot, closed through the lid.
lathe('painted_shell',[(.063,.006),(.073,.024),(.075,.034),(.075,.311),(.074,.315),(.065,.336)],'policeBlue')
lathe('bottom_rolled_seam',[(0,0),(.063,0),(.071,.009),(.076,.023),(.076,.027),(.073,.033),(.067,.028)],'sidewalk')
lathe('shoulder_metal',[(.0755,.312),(.0755,.318),(.072,.328),(.067,.338),(.067,.342)],'sidewalk')
lathe('top_rolled_rim',[(.064,.336),(.074,.342),(.074,.348),(.068,.352),(.063,.349),(.062,.342),(.064,.336)],'picketWhite')
lathe('recessed_lid',[(0,.338),(.054,.338),(.061,.341),(.062,.344)],'sidewalk')
# Pull-tab: bevelled annulus with a true hole, plus visible rivet and dark drinking aperture.
def ring(name,cx,cy,rx,ry,innerx,innery,z,t):
 profiles=[(rx-.001,ry-.001,z),(rx,ry,z+.001),(rx,ry,z+.003),(rx-.001,ry-.001,z+.004),(innerx+.001,innery+.001,z+.004),(innerx,innery,z+.003),(innerx,innery,z+.001),(innerx+.001,innery+.001,z)]
 n=TAB_SEGMENTS;v=[(cx+x*math.cos(i*2*math.pi/n),cy+y*math.sin(i*2*math.pi/n),zz) for x,y,zz in profiles for i in range(n)]
 return mesh(name,v,[(j*n+i,j*n+(i+1)%n,((j+1)%8)*n+(i+1)%n,((j+1)%8)*n+i) for j in range(8) for i in range(n)],t)
# Flattened ellipse under tab reads as the punched opening.
n=TAB_SEGMENTS;v=[(-.031+.017*math.cos(i*2*math.pi/n),.020*math.sin(i*2*math.pi/n),.3415) for i in range(n)]
mesh('drink_aperture',v,[tuple(range(n))],'uiDark')
ring('pull_tab',-.009,0,.031,.016,.022,.009,.345,'picketWhite')
lathe('tab_rivet',[(0,.350),(.005,.350),(.006,.352),(.005,.354),(0,.354)],'sidewalk',TAB_SEGMENTS)
# Wrap each bolt face to the cylindrical shell; offset >=4mm everywhere.
# Triangulated in the Y/Z plane before cylindrical projection.
def badge(name,coords,r,t):
 from mathutils.geometry import tessellate_polygon
 points=[Vector((0,y,z)) for y,z in coords];tris=tessellate_polygon([points]);v=[];f=[]
 for tri in tris:
  tri=[points[v] if isinstance(v,int) else v for v in tri]
  # Subdivide planar triangles to follow the can without chord intersections.
  steps=2;indices={}
  for i in range(steps+1):
   for j in range(steps+1-i):
    q=tri[0]+(tri[1]-tri[0])*i/steps+(tri[2]-tri[0])*j/steps
    indices[i,j]=len(v);v.append((math.sqrt(r*r-q.y*q.y),q.y,q.z))
  for i in range(steps):
   for j in range(steps-i):
    f.append((indices[i,j],indices[i+1,j],indices[i,j+1]))
    if j<steps-i-1:f.append((indices[i+1,j],indices[i+1,j+1],indices[i,j+1]))
 o=mesh(name,v,f,t)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.000001);bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
 for face in o.data.polygons:face.use_smooth=True
 o.rotation_euler.z=math.radians(-20)
 mod=o.modifiers.new('solid marking','SOLIDIFY');mod.thickness=.001;mod.offset=1
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
bolt=[(-.006,.282),(.039,.282),(.008,.218),(.034,.218),(-.036,.086),(-.007,.191),(-.039,.191)]
badge('lightning_bolt',bolt,.080,'schoolBusYellow')
for y,z in [(.024,.055),(.033,.061)]:badge('small_label_mark',[(y-.002,z-.007),(y+.002,z-.007),(y+.002,z+.007),(y-.002,z+.007)],.080,'schoolBusYellow')
# Merge all static surfaces by palette, retaining the body and root contract.
for m in M.values():
 obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==m]
 if not obs:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name='body_'+m.name
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
col=bpy.data.objects.new('col:body',None);bpy.context.collection.objects.link(col);col.parent=root;col.location.z=.176;col['collider']='cylinder';col['shape']='cylinder';col['radius']=.076;col['height']=.352
asset=list(bpy.context.scene.objects)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=17;scene.render.bake.target='VERTEX_COLORS'
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
 attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER');o.data.color_attributes.active_color=attr;o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.bake(type='AO')
tri=0
for o in meshes:o.data.calc_loop_triangles();tri+=len(o.data.loop_triangles)
report={'id':'pick.energy-drink','tier':'Side','triangles':tri,'draw_calls':len(meshes),'materials':sorted(m.name for m in M.values()),'nodes_ok':all(bpy.data.objects.get(n) is not None for n in ('root','body','col:body')),'within_budget':tri<=2500 and len(meshes)<=6,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,'gaps':['Canonical policeBlue replaces reference violet; palette contains no violet token.']}
if a.lod==0:(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
else:(HERE/f'geometry.lod{a.lod}.json').write_text(json.dumps({'triangles':tri,'draw_calls':len(meshes)},indent=2)+'\n')
if a.glb:
 bpy.ops.object.select_all(action='DESELECT')
 for o in asset:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if a.render:
 world=bpy.data.worlds.new('studio');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.21,.29,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5
 bpy.ops.mesh.primitive_plane_add(size=200);m=bpy.data.materials.new('stage');m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.035,.029,.043,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8;bpy.context.object.data.materials.append(m)
 target=Vector((0,0,.177))
 for loc,power,size,color in [((1,-1,2),55,1.2,(1,.77,.5)),((-1,.5,1),35,1,(.63,.57,1))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam
 cam.location={'ref':(1,-.38,.66),'game':(1,-1,1.6),'front':(1,0,.177),'side':(0,-1,.177),'rear':(-1,.3,.5)}[a.view]
 cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.74
 scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.view_settings.view_transform='AgX'
 scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True);print('RENDER OK')

 if a.view=='ref' and Path(a.render).name=='hero.png':
  cam.location=(1,-1,1.6);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
  scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
  scene.render.filepath=str(Path(a.render).resolve().with_name('game.png'));bpy.ops.render.render(write_still=True)
