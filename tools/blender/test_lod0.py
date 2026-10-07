"""Headless smoke check for LOD0 pruning; run via experiment/tools/blender_run.py."""
import sys
from pathlib import Path
import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
from sslib.lod0 import prune_hidden_faces
bpy.ops.wm.read_factory_settings(use_empty=True)
root=bpy.data.objects.new('body',None);bpy.context.scene.collection.objects.link(root)
roof=bpy.data.objects.new('roof',None);bpy.context.scene.collection.objects.link(roof)
def cube(name,size,parent,pos=(0,0,0)):
 bpy.ops.mesh.primitive_cube_add(size=size,location=pos);o=bpy.context.object;o.name=name;o.parent=parent;return o
outer=cube('outer',3,root);inner=cube('inner',1,root);exposed=cube('exposed',1,root,(3,0,0));separate=cube('roof-interior',1,roof)
attribute=inner.data.attributes.new(name='detail',type='INT',domain='FACE')
for x in attribute.data:x.value=2
assert prune_hidden_faces([outer,inner,exposed,separate])==6
assert len(outer.data.polygons)==6 and len(inner.data.polygons)==0 and len(exposed.data.polygons)==6 and len(separate.data.polygons)==6
# Intersecting cubes retain every partially exposed face.
bpy.ops.wm.read_factory_settings(use_empty=True)
a=cube('a',2,None);b=cube('b',1.5,None,(1.2,0,0))
assert prune_hidden_faces([a,b])==1
assert len(a.data.polygons)==6 and len(b.data.polygons)==5
print('TEST OK hidden-only pruning and visibility group protection')

# Camera pruning removes the unobservable underside, retaining vertical/top faces
# and every face of a hinged assembly. Custom normals and FACE data survive.
bpy.ops.wm.read_factory_settings(use_empty=True)
root=bpy.data.objects.new('body',None);bpy.context.scene.collection.objects.link(root)
hinge=bpy.data.objects.new('door',None);bpy.context.scene.collection.objects.link(hinge)
static=cube('static',2,root);moving=cube('moving',1,hinge,(4,0,0))
for obj in (static,moving):
 attr=obj.data.attributes.new(name='detail',type='INT',domain='FACE')
 for value in attr.data:value.value=7
assert prune_hidden_faces([static,moving],game_camera=True)==1
assert len(static.data.polygons)==5 and len(moving.data.polygons)==6
assert all(value.value==7 for value in static.data.attributes['detail'].data)
assert all(abs(loop.vector.length-1)<1e-5 for loop in static.data.corner_normals)
print('TEST OK game camera cone, hinge protection and attribute preservation')

# Ray tests must match backface-culling rather than treating inward source boxes
# as opaque outward shells.
import bmesh
bpy.ops.wm.read_factory_settings(use_empty=True)
inward=cube('inward',2,None)
bm=bmesh.new();bm.from_mesh(inward.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(inward.data);bm.free()
assert prune_hidden_faces([inward],occlusion=True)==0
# Deferred deletion leaves the entire AO occluder in place until export, and
# keeps each retained baked corner value through triangulation and BMesh edits.
from sslib.lod0 import apply_hidden_faces
bpy.ops.wm.read_factory_settings(use_empty=True)
root=bpy.data.objects.new('body',None);bpy.context.scene.collection.objects.link(root)
static=cube('static',2,root)
assert prune_hidden_faces([static],game_camera=True,defer=True)==1
assert len(static.data.polygons)==6
colors=static.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
for face in static.data.polygons:
 for index in face.loop_indices:colors.data[index].color=(face.index/10,face.index/10,face.index/10,1)
expected=sorted(round(colors.data[face.loop_start].color[0],3) for face in static.data.polygons if not static.data.attributes['diet_hidden'].data[face.index].value)
apply_hidden_faces([static])
assert len(static.data.polygons)==5 and static.data.attributes.get('diet_hidden') is None
assert sorted(round(static.data.color_attributes['ao'].data[face.loop_start].color[0],3) for face in static.data.polygons)==expected
print('TEST OK inward winding and deferred baked AO preservation')

# Evaluating an already baked weighted-normal mesh must retain its corner normals.
bpy.ops.wm.read_factory_settings(use_empty=True)
weighted=cube('weighted',2,None)
bevel=weighted.modifiers.new('bevel','BEVEL');bevel.width=.1;bevel.segments=2
bpy.ops.object.modifier_apply(modifier=bevel.name)
modifier=weighted.modifiers.new('normals','WEIGHTED_NORMAL')
bpy.ops.object.modifier_apply(modifier=modifier.name)
def key(mesh,face,loop):
 return tuple(sorted(tuple(round(v,6) for v in mesh.vertices[i].co) for i in face.vertices)),tuple(round(v,6) for v in mesh.vertices[loop.vertex_index].co)
reference={key(weighted.data,face,weighted.data.loops[i]):tuple(weighted.data.corner_normals[i].vector) for face in weighted.data.polygons for i in face.loop_indices}
prune_hidden_faces([weighted],game_camera=True,defer=True)
apply_hidden_faces([weighted])
# Ensure the normal assertion also covers actual face deletion, even when the
# largest-face safeguard retains this cube's underside.
from sslib.lod0 import _delete_faces
_delete_faces(weighted, [0])
from mathutils import Vector
assert all((weighted.data.corner_normals[i].vector-Vector(reference[key(weighted.data,face,weighted.data.loops[i])])).length<.0001 for face in weighted.data.polygons for i in face.loop_indices)
print('TEST OK weighted-normal retention through evaluation and face deletion')

# Detailed convex cylinder shells can hide fasteners without altering the shell.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=1.2,depth=2)
shell=bpy.context.object
bevel=shell.modifiers.new('rounded rim','BEVEL');bevel.width=.08;bevel.segments=3
bpy.ops.object.modifier_apply(modifier=bevel.name)
fastener=cube('covered fastener',.6,None)
assert 160 < len(shell.data.polygons) <= 512
assert prune_hidden_faces([shell,fastener]) == 0
assert prune_hidden_faces([shell,fastener],max_occluder_faces=512) == 6
assert len(shell.data.polygons)>160 and len(fastener.data.polygons)==0
print('TEST OK detailed convex cylinder coverage')
