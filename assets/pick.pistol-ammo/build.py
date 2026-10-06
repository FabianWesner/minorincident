"""Open olive pistol-ammunition pickup. Deterministic, metres, +X front."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
for k in ('render', 'glb'): p.add_argument('--'+k)
p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960)
p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M = {}
# Palette identities with muted olive and metallic brass/copper asset finishes.
for token, color, metal, rough in [('grass','66633b',.35,.48),('uiDark','25222c',.25,.5),('schoolBusYellow','d6a03b',.75,.29),('woodWarm','b66a3d',.7,.3)]:
 m=bpy.data.materials.new('pal_'+token); m.use_nodes=True
 rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
 bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
 bs.inputs['Metallic'].default_value=metal; bs.inputs['Roughness'].default_value=rough; M[token]=m

def empty(name, loc=(0,0,0), parent=None):
 o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc; o.parent=parent; return o
root=empty('root'); root['asset_id']='pick.pistol-ammo'
body=empty('body',parent=root)
empty('front',(.17,0,.12),root)
lid=empty('lid',(-.145,0,.23),root)
handle=empty('handle',(0,-.292,.16),root)

def finish(o,name,mat,parent=body,bevel=0):
 o.name=name; o.data.materials.append(M[mat]); bpy.context.view_layer.objects.active=o
 if bevel:
  mod=o.modifiers.new('soft edges','BEVEL'); mod.width=bevel; mod.segments=1; bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.context.view_layer.update(); world=o.matrix_world.copy(); o.parent=parent; o.matrix_world=world; return o

def box(name,loc,size,mat='grass',parent=body,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,name,mat,parent,min(bevel,min(size)*.28))

def cyl(name,loc,r,depth,mat='uiDark',axis='Z',parent=body):
 bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=r,depth=depth,location=loc); o=bpy.context.object
 if axis=='Y': o.rotation_euler.x=math.pi/2
 if axis=='X': o.rotation_euler.y=math.pi/2
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); return finish(o,name,mat,parent,0)

def lathe(name,x,y,profile,mat):
 n=6; v=[(x+r*math.cos(i*2*math.pi/n),y+r*math.sin(i*2*math.pi/n),z) for r,z in profile for i in range(n)]
 f=[tuple(range(n-1,-1,-1)),tuple((len(profile)-1)*n+i for i in range(n))]
 for j in range(len(profile)-1):
  for i in range(n): k=(i+1)%n; f.append((j*n+i,j*n+k,(j+1)*n+k,(j+1)*n+i))
 me=bpy.data.meshes.new(name); me.from_pydata(v,[],f); me.update(); o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); finish(o,name,mat)
 for face in me.polygons: face.use_smooth=len(face.vertices)==4
# Hollow case, thick rolled top rails and lower seams.
box('floor',(0,0,.014),(.32,.58,.028),bevel=.003)
for x in (-.153,.153):
 box('long wall',(x,0,.122),(.014,.58,.216))
 box('rolled rim',(x,0,.233),(.023,.596,.025))
 box('lower seam',(x,0,.027),(.020,.58,.012),'uiDark')
for y in (-.283,.283):
 box('end wall',(0,y,.122),(.294,.014,.216))
 box('end rim',(0,y,.233),(.32,.024,.025))
for x in (-.155,.155):
 for y in (-.283,.283):
  box('corner upright',(x,y,.119),(.025,.024,.223),'uiDark')
  box('olive corner cap',(x,y,.237),(.029,.032,.030))
  box('corner foot',(x,y,.027),(.032,.052,.054))
# Dark recessed cartridge tray leaves a visible perimeter well.
box('tray',(0,0,.158),(.269,.532,.026),'uiDark')
# Three merged brass bundles and nine broad six-sided tips replace 21 detailed rounds.
for x in (-.088,0,.088):
 box('brass bundle',(x,0,.211),(.062,.486,.063),'schoolBusYellow',bevel=.004)
 for y in (-.164,0,.164):
  lathe('copper bundle tip',x,y,[(.033,.242),(.027,.265),(.012,.284)],'woodWarm')
# Lid is authored flat at hinge height, then rotated open around its Y hinge.
box('lid shell',(.015,0,.242),(.32,.592,.020),parent=lid,bevel=.003)
box('lid recessed shadow',(.015,0,.228),(.283,.550,.009),'grass',lid)
box('lid inner panel',(.015,0,.219),(.244,.496,.010),'grass',lid)
for x in (-.139,.169): box('lid long frame',(x,0,.223),(.018,.588,.028),parent=lid)
for y in (-.284,.284): box('lid end frame',(.015,y,.223),(.310,.020,.028),parent=lid)
for y in (-.215,.215):
 cyl('hinge pin',(-.146,y,.238),.014,.069,'uiDark','Y')
 box('hinge strap',(-.136,y,.231),(.038,.057,.034))
 box('lid clasp',(.161,y,.269),(.035,.038,.012),'grass',lid)
lid.rotation_euler.y=-math.radians(108)
# End folding handle with open centre, hinge blocks and backing plate.
box('handle backing',(0,-.295,.17),(.166,.013,.045),'uiDark')
for x in (-.069,.069):
 box('handle hinge',(x,-.308,.158),(.026,.022,.043),'uiDark')
 box('handle upright',(x,-.321,.108),(.016,.016,.105),'woodWarm',handle)
box('handle crossbar',(0,-.321,.060),(.145,.017,.020),'woodWarm',handle)
# Static geometry merged by material; movable groups retained with joint pivots.
for parent in (body,lid,handle):
 for mat in M.values():
  obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==mat]
  if not obs: continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs: o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); o=obs[0]; o.name=parent.name+'_'+mat.name
  # Joined meshes use the assembly origin so animations pivot consistently.
  scene_cursor=bpy.context.scene.cursor; scene_cursor.location=parent.matrix_world.translation
  bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
asset=list(bpy.context.scene.objects); meshes=[o for o in asset if o.type=='MESH']
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.seed=17
scene.render.bake.target='VERTEX_COLORS'; bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
 attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER'); o.data.color_attributes.active_color=attr; o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]; bpy.ops.object.bake(type='AO')
tri=0
for o in meshes: o.data.calc_loop_triangles(); tri+=len(o.data.loop_triangles)
report={'id':'pick.pistol-ammo','tier':'Side','triangles':tri,'draw_calls':len(meshes),'materials':sorted(m.name for m in M.values()),'nodes_ok':all(bpy.data.objects.get(n) is not None for n in ('root','body','lid','handle')),'within_budget':tri<=2500 and len(meshes)<=6,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,'gaps':['Detailed rounds replaced with three brass bundles and nine chunky tips; fine wear and rivets omitted.']}
# Preserve the previous mesh node names as transform anchors after material consolidation.
for name,parent in [('body_pal_asphalt',body),('lid_pal_asphalt',lid),('lid_pal_uiDark',lid),('lid_pal_woodWarm',lid)]:
 empty(name,parent=parent)
asset=list(bpy.context.scene.objects)
if a.glb:
 bpy.ops.object.select_all(action='DESELECT')
 for o in asset: o.select_set(True)
 def export_glb(path):
  bpy.ops.export_scene.gltf(filepath=str(path.resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
 output=Path(a.glb)
 export_glb(output)
 report['lods']={}
 for level,ratio in ((1,.5),(2,.25)):
  for o in meshes:
   mod=o.modifiers.new('LOD simplification','DECIMATE'); mod.ratio=ratio; mod.use_collapse_triangulate=True
  bpy.context.view_layer.update(); deps=bpy.context.evaluated_depsgraph_get(); count=0
  for o in meshes:
   evaluated=o.evaluated_get(deps); me=evaluated.to_mesh(); me.calc_loop_triangles(); count+=len(me.loop_triangles); evaluated.to_mesh_clear()
  export_glb(output.with_name(output.stem+'.lod'+str(level)+output.suffix))
  report['lods']['lod'+str(level)]={'triangles':count,'draw_calls':len(meshes)}
  for o in meshes: o.modifiers.remove(o.modifiers['LOD simplification'])
(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if a.render:
 world=bpy.data.worlds.new('studio'); scene.world=world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.19,.16,.22,1); world.node_tree.nodes['Background'].inputs[1].default_value=.5
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.004)); m=bpy.data.materials.new('stage'); m.use_nodes=True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.028,.024,.035,1); bpy.context.object.data.materials.append(m)
 for loc,power,size,color in [((1,-1,2),110,1.2,(1,.82,.62)),((-1,1,1.6),80,1.0,(.68,.75,1))]:
  bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.data.energy=power; o.data.size=size; o.data.color=color; o.rotation_euler=(Vector((0,0,.25))-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(); cam=bpy.context.object; scene.camera=cam; target=Vector((-.055,0,.255))
 cam.location={'ref':(1.2,-1.5,1.05),'game':(1.5,-1.5,2),'front':(2,0,.6),'side':(0,-2,.7),'rear':(-2,-1,1)}[a.view]
 cam.data.type='ORTHO'; cam.data.ortho_scale=1.40 if a.view!='game' else 1.65; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.cycles.samples=a.samples; scene.cycles.use_denoising=True; scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100; scene.view_settings.view_transform='AgX'; scene.render.filepath=str(Path(a.render).resolve()); bpy.ops.render.render(write_still=True); print('RENDER OK')
