"""TRELLIS hazmat source, palette-sampled and suspended from a gantry rope.
Run simplify.mjs first; the input is a retained TRELLIS source, not a new sculpt.
"""
import argparse, sys, math, json
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
from sslib import palette
p=argparse.ArgumentParser();p.add_argument('--field',action='store_true');p.add_argument('--source',default='/private/tmp/s186-trellis-hazmat.glb');p.add_argument('--glb',default=str(HERE/'model.glb'));a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.source)
figure=next(o for o in bpy.data.objects if o.type=='MESH')
image=next(n.image for n in figure.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image.name=='Image_0')
w,h=image.size; pixels=list(image.pixels[:]); uv=figure.data.uv_layers.active.data
# Quantize the source texture to the established world palette for instanced district rendering.
tokens=['schoolBusYellow','woodWarm','uiDark','asphalt','blood','foliage','infectedSkin','sidewalk','picketWhite']
materials=[palette.mat(n) for n in tokens]
colors=[tuple(m.diffuse_color[:3]) for m in materials]
figure.data.materials.clear()
for m in materials: figure.data.materials.append(m)
for poly in figure.data.polygons:
 u=sum(uv[i].uv.x for i in poly.loop_indices)/len(poly.loop_indices)%1
 v=sum(uv[i].uv.y for i in poly.loop_indices)/len(poly.loop_indices)%1
 i=(min(h-1,int(v*h))*w+min(w-1,int(u*w)))*4; color=pixels[i:i+3]
 poly.material_index=min(range(len(colors)),key=lambda j:sum((colors[j][k]-color[k])**2 for k in range(3)))
# Bake the imported transform and normalize to a 1.8 m figure, with feet at 2.7 m.
bpy.context.view_layer.update(); world=figure.matrix_world.copy()
coords=[world @ v.co for v in figure.data.vertices]; lo=[min(v[i] for v in coords) for i in range(3)];hi=[max(v[i] for v in coords) for i in range(3)]
scale=1.8/(hi[2]-lo[2]); centre=((hi[0]+lo[0])/2,(hi[1]+lo[1])/2)
for vertex in figure.data.vertices:
 v=world @ vertex.co;vertex.co=((v.x-centre[0])*scale,(v.y-centre[1])*scale,(v.z-lo[2])*scale+2.7-5.25)
# Keep broad suit masses readable at the game camera. The source texture's
# tiny wound/strap samples otherwise become noisy palette flecks after reduction.
for poly in figure.data.polygons:
 point=sum((figure.data.vertices[i].co for i in poly.vertices),Vector())/len(poly.vertices)
 height=point.z+5.25-2.7
 dark=poly.material_index in (2,3)
 extremity=height < .30 or (height > 1.30 and dark) or (abs(point.x) > .45 and height < .9 and dark)
 poly.material_index=2 if extremity else 0
figure.parent=None;figure.matrix_world.identity();figure.name='effigy-mesh'
for o in list(bpy.data.objects):
 if o != figure: bpy.data.objects.remove(o,do_unlink=True)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='prop.l10-hazmat-scarecrow' if a.field else 'prop.l10-warning-effigy'
swing=bpy.data.objects.new('swing',None);bpy.context.collection.objects.link(swing);swing.parent=root;swing.location=(0,0,2.55 if a.field else 5.16);figure.parent=swing
if a.field:
 bpy.ops.mesh.primitive_cube_add(size=1,location=(-.3,0,1.25));pole=bpy.context.object;pole.name='stake';pole.dimensions=(.10,.10,2.5);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);pole.data.materials.append(palette.mat('woodWarm'));pole.parent=root
else:
 bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=.025,depth=.78,location=(0,0,-.39));rope=bpy.context.object;rope.name='rope';rope.data.materials.append(palette.mat('woodWarm'));rope.parent=swing
front=bpy.data.objects.new('front',None);bpy.context.collection.objects.link(front);front.parent=root;front.location=(1,0,0)
bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
