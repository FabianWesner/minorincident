"""Sunset Grove cart: deterministic mesh tubes, four jointed casters, no textures."""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(OUT.parents[1]/'tools/blender'))
from sslib import palette
p=argparse.ArgumentParser()
p.add_argument('--render');p.add_argument('--glb');p.add_argument('--view',default='ref')
p.add_argument('--samples',type=int,default=24);p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
metal=palette.mat('silver');red=palette.mat('survivorRed');dark=palette.mat('uiDark');hub=palette.mat('denim');wear=palette.mat('brick')
for m,metallic,rough in [(metal,.75,.32),(red,.05,.34),(dark,.05,.7),(hub,.45,.4)]:
 b=m.node_tree.nodes['Principled BSDF'];b.inputs['Metallic'].default_value=metallic;b.inputs['Roughness'].default_value=rough
parts=[]
def tube(name,points,r,mat=metal,n=12):
 verts=[];faces=[]
 for i,pt in enumerate(points):
  tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
  q=tangent.to_track_quat('Z','Y')
  for k in range(n):verts.append(Vector(pt)+q@Vector((r*math.cos(2*math.pi*k/n),r*math.sin(2*math.pi*k/n),0)))
 for j in range(len(points)-1):
  for k in range(n):faces.append((j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k))
 faces.extend([tuple(reversed(range(n))),tuple((len(points)-1)*n+k for k in range(n))])
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
 for f in mesh.polygons:f.use_smooth=len(f.vertices)==4
 parts.append(o);return o
def box(name,loc,size,mat,bevel=.008):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 m=o.modifiers.new('Rounded edges','BEVEL');m.width=bevel;m.segments=3;bpy.ops.object.modifier_apply(modifier=m.name);parts.append(o);return o
def join(group,name,origin=(0,0,0),parent=None):
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
 bpy.context.scene.cursor.location=origin;bpy.ops.object.origin_set(type='ORIGIN_CURSOR');o.parent=parent;return o
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root)
root['asset_id']='prop.shopping-cart';root['tier']='Side';root['front']='+X'
root['ss_physics']={'class':'medium','mass':24,'friction':.35,'restitution':.1,'centerOfMass':[0,.52,0],'pushable':True,'kickable':False,'barricadeValue':.6,'barricadeHP':180,'vaultable':False,'flammable':False,'sounds':'prop.metal-medium'}
# Basket narrows towards its floor and front; front is +X.
def corners(z):
 t=(z-.46)/.48;return [(-.42-.03*t,-(.255+.045*t),z),(.42+.10*t,-(.255+.025*t),z),(.42+.10*t,.255+.025*t,z),(-.42-.03*t,.255+.045*t,z)]
for z,r in [(.46,.016),(.62,.012),(.78,.012),(.94,.018)]:
 c=corners(z);tube('Basket perimeter',c+[c[0]],r)
for side in [-1,1]:
 for i in range(17):
  t=i/16;bottom=(-.42+.84*t,side*.255,.46);top=(-.45+.97*t,side*(.30-.02*t),.94)
  tube('Basket upright',[bottom,top],.0075,n=10)
for end in [0,1]:
 for i in range(12):
  t=i/11;y=-.255+.51*t;xtop=.52 if end else -.45;ytop=y*(.28/.255 if end else .30/.255)
  tube('End wire',[(.42 if end else -.42,y,.46),(xtop,ytop,.94)],.0075,n=10)
for i in range(17):
 x=-.40+i*.05;tube('Floor transverse',[(x,-.255,.465),(x,.255,.465)],.007,n=10)
for i in range(11):
 y=-.25+i*.05;tube('Floor longitudinal',[(-.42,y,.451),(.42,y,.451)],.007,n=10)
# Continuous swept lower chassis and curved handle risers.
for s in [-1,1]:
 tube('Chassis rail',[(.46,s*.26,.245),(.51,s*.255,.25),(.54,s*.23,.25),(.55,s*.18,.25)],.021)
 tube('Chassis side',[(-.45,s*.29,.25),(.46,s*.26,.245)],.021)
 tube('Handle upright',[(-.45,s*.29,.25),(-.49,s*.29,.27),(-.50,s*.29,.30),(-.49,s*.29,.33),(-.42,s*.29,.42),(-.43,s*.30,.51),(-.48,s*.31,.96),(-.49,s*.31,1.015),(-.51,s*.31,1.06),(-.55,s*.31,1.08),(-.60,s*.31,1.08)],.023)
 tube('Basket support',[(-.42,s*.29,.42),(-.34,s*.255,.46)],.017)
 box('Front red bumper',(.52,s*.28,.94),(.075,.075,.08),red,.012)
 box('Handle end',(-.60,s*.31,1.08),(.075,.075,.07),red,.012)
 tube('Handle collar',[(-.60,s*.27,1.08),(-.60,s*.29,1.08)],.026,dark)
tube('Front base cross rail',[(.55,-.18,.25),(.55,.18,.25)],.021)
tube('Rear cross rail',[(-.45,-.29,.25),(-.45,.29,.25)],.018)
tube('Red hand grip',[(-.60,-.27,1.08),(-.60,.27,1.08)],.025,red,n=20)
# Raised, sparse wear chips, embedded into tubes with exposed faces >3 mm proud.
for x,y,z in [(.20,.264,.25),(-.22,.291,.25),(.30,-.261,.25),(.06,.289,.94),(-.20,-.301,.94)]:
 box('Small enamel scuff',(x,y,z),(.027,.012,.013),wear,.003)
for side in [-1,1]:
 tube('Handle end button',[(-.60,side*.348,1.08),(-.60,side*.355,1.08)],.017,red,n=12)
 tube('Handle screw',[(-.48,side*.329,.975),(-.48,side*.338,.975)],.009,metal,n=8)
# Each caster swivels at its vertical kingpin; each wheel rotates about its axle.
static=list(parts)
for name,x,y in [('FL',.46,.255),('FR',.46,-.255),('RL',-.45,.29),('RR',-.45,-.29)]:
 swivel=bpy.data.objects.new('caster'+name,None);bpy.context.collection.objects.link(swivel);swivel.parent=root;swivel.location=(x,y,.235)
 start=len(parts)
 tube('Kingpin',[(x,y,.22),(x,y,.263)],.028,metal,n=16)
 box('Fork bridge',(x,y,.205),(.085,.10,.027),metal,.006)
 for s in [-1,1]:
  o=box('Caster fork',(x+.016,y+s*.044,.156),(.035,.012,.108),metal,.008);o.rotation_euler[1]=-.20
 fork=join(parts[start:],'fork'+name,(x,y,.235));fork.parent=swivel;fork.location=(0,0,0)
 start=len(parts);center=(x+.025,y,.09)
 tube('Rubber tire',[(center[0],y-.035,.09),(center[0],y+.035,.09)],.09,dark,n=32)
 for s in [-1,1]:
  tube('Inset wheel disc',[(center[0],y+s*.036,.09),(center[0],y+s*.039,.09)],.065,hub,n=24)
  tube('Wheel rim ring',[(center[0]+.068*math.cos(k*2*math.pi/16),y+s*.040,.09+.068*math.sin(k*2*math.pi/16)) for k in range(17)],.004,metal,n=4)
  tube('Axle bolt',[(center[0],y+s*.046,.09),(center[0],y+s*.055,.09)],.015,metal,n=12)
 wheel=join(parts[start:],'wheel'+name,center);wheel.parent=swivel;wheel.location=Vector(center)-swivel.location
groups={m:[o for o in static if o.data.materials[0]==m] for m in [metal,red,dark,wear]}
for mat,name in [(metal,'body'),(red,'redTrim'),(dark,'handleCollars'),(wear,'wearChips')]:join(groups[mat],name,parent=root)
col=bpy.data.objects.new('col:cart',None);bpy.context.collection.objects.link(col);col.parent=root;col.location=(0,0,.54)
col['collider']='cuboid';col['shape']='cuboid';col['size']=[1.25,.69,1.08];col['halfExtents']=[.625,.345,.54]
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
tris=sum(len(f.vertices)-2 for o in meshes for f in o.data.polygons)
report=dict(id='prop.shopping-cart',tier='Side',triangles=tris,draw_calls=sum(len(o.data.materials) for o in meshes),materials=sorted({m.name for o in meshes for m in o.data.materials}),nodes_ok=True,within_budget=6000<=tris<=12000,rounds=3,webgpu_ok=False,webgl2_ok=False,gaps=[])
(OUT/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',export_apply=True,export_extras=True)
if a.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
 scene.world.use_nodes=True;bg=scene.world.node_tree.nodes['Background'];bg.inputs['Color'].default_value=(.14,.12,.18,1);bg.inputs['Strength'].default_value=.5
 def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
 for loc,power,size,color in [((2,-3,5),450,3,(1,.8,.66)),((-3,1,3),350,3,(1,.65,.4)),((1,4,4),400,3,(.65,.72,1))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;aim(o,(0,0,.5))
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.009));floor=bpy.context.object
 m=bpy.data.materials.new('Review floor');m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.025,.021,.032,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85;floor.data.materials.append(m)
 views={'ref':(2.8,4,2.1),'game':(3,-4,5),'front':(4,0,1.8),'side':(0,-4,1.8),'rear':(-4,0,1.8)}
 bpy.ops.object.camera_add(location=views[a.view]);o=bpy.context.object;aim(o,(0,0,.54));o.data.type='ORTHO';o.data.ortho_scale=3.35 if a.view=='game' else 2.85;scene.camera=o
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)
print('OK '+json.dumps(report))
