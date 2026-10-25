"""Recover a continuous exterior when a cast export retains only closed rigid partitions.

Voxel union at 512 cells over the height removes internal cut caps. UVs transfer from
the nearest original triangle; no texture rebake, authored placement or hand repair.
"""
import json
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform, closest_point_on_tri

source, output = sys.argv[sys.argv.index('--') + 1:]
data = json.loads(Path(source).read_text())
points = [Vector((data['pos'][i], -data['pos'][i + 2], data['pos'][i + 1])) for i in range(0, len(data['pos']), 3)]
triangles = [data['tris'][i:i + 3] for i in range(0, len(data['tris']), 3)]
tree = BVHTree.FromPolygons(points, triangles, all_triangles=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
mesh = bpy.data.meshes.new('continuous_skin')
mesh.from_pydata(points, [], triangles)
mesh.update()
obj = bpy.data.objects.new('continuous_skin', mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
height = max(p.z for p in points) - min(p.z for p in points)
obj.data.remesh_voxel_size = height / 512
obj.data.use_remesh_preserve_volume = True
bpy.ops.object.voxel_remesh()
modifier = obj.modifiers.new('delivery_surface', 'DECIMATE')
modifier.ratio = min(1, max(4, len(triangles) - 64) / max(1, sum(len(p.vertices) - 2 for p in obj.data.polygons)))
bpy.ops.object.modifier_apply(modifier=modifier.name)
modifier = obj.modifiers.new('triangles', 'TRIANGULATE')
bpy.ops.object.modifier_apply(modifier=modifier.name)
# Voxelization can leave sub-centimetre scraps around fine source cuts. Drop only components below 0.1% of
# total area, then close their tiny boundary rings. The anatomical exterior is retained as one continuous shell.
bm = bmesh.new()
bm.from_mesh(obj.data)
remaining = set(bm.faces)
components = []
while remaining:
    stack = [remaining.pop()]
    component = []
    while stack:
        face = stack.pop()
        component.append(face)
        for edge in face.edges:
            for adjacent in edge.link_faces:
                if adjacent in remaining:
                    remaining.remove(adjacent)
                    stack.append(adjacent)
    components.append(component)
area = sum(face.calc_area() for face in bm.faces)
scraps = [face for component in components if sum(face.calc_area() for face in component) < area * .001 for face in component]
bmesh.ops.delete(bm, geom=scraps, context='FACES')
loose = [vertex for vertex in bm.verts if not vertex.link_faces]
bmesh.ops.delete(bm, geom=loose, context='VERTS')
boundary = [edge for edge in bm.edges if edge.is_boundary]
if boundary:
    bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
bmesh.ops.triangulate(bm, faces=list(bm.faces))
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
bm.to_mesh(obj.data)
bm.free()
uv = obj.data.uv_layers.new(name='UVMap')
for polygon in obj.data.polygons:
    center = sum((obj.data.vertices[i].co for i in polygon.vertices), Vector()) / len(polygon.vertices)
    _, _, face, _ = tree.find_nearest(center)
    a, b, c = triangles[face]
    tex = [Vector((data['uv'][i * 2], data['uv'][i * 2 + 1], 0)) for i in (a, b, c)]
    # A target triangle must stay inside one source UV chart. Independent corner projections can interpolate
    # across unrelated atlas islands and paint stripes even when every sampled corner itself is correct.
    for index in polygon.loop_indices:
        point = obj.data.vertices[obj.data.loops[index].vertex_index].co
        nearest = closest_point_on_tri(point, points[a], points[b], points[c])
        mapped = barycentric_transform(nearest, points[a], points[b], points[c], *tex)
        uv.data[index].uv = (mapped.x, 1 - mapped.y)
for polygon in obj.data.polygons:
    polygon.use_smooth = True
bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', use_selection=True, export_materials='NONE', export_yup=True)
