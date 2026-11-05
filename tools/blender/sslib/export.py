import bpy
from mathutils import Matrix
from . import naming


def merge_by_material(root, protected, preserve_vertex_colors=False):
    """Evaluate modifiers and merge static meshes within each rigid assembly."""
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    groups = {}
    colors = {}
    meshes = [o for o in root.children_recursive if o.type == 'MESH']
    for obj in meshes:
        owner = obj.parent
        while owner != root and owner.name not in protected:
            owner = owner.parent
        evaluated = obj.evaluated_get(graph)
        data = evaluated.to_mesh()
        data.calc_loop_triangles()
        transform = owner.matrix_world.inverted() @ obj.matrix_world
        for tri in data.loop_triangles:
            material = data.materials[tri.material_index]
            key = (owner.name, material.name)
            verts, faces = groups.setdefault(key, ([], []))
            layer = data.color_attributes.active_color if preserve_vertex_colors else None
            points = [transform @ data.vertices[i].co for i in tri.vertices]
            if (points[1] - points[0]).cross(points[2] - points[0]).length < 1e-12:
                continue
            start = len(verts)
            if preserve_vertex_colors:
                colors.setdefault(key, []).extend(tuple(layer.data[i if layer.domain == "CORNER" else data.loops[i].vertex_index].color) if layer else (1, 1, 1, 1) for i in tri.loops)
            verts.extend(points)
            faces.append((start, start + 1, start + 2))
        evaluated.to_mesh_clear()
    for obj in meshes:
        bpy.data.objects.remove(obj, do_unlink=True)
    for (owner_name, material_name), (verts, faces) in sorted(groups.items()):
        # Canonical welding avoids BMesh's ambiguous survivor choice for close corners.
        unique, indices, lookup = [], [], {}
        for vertex in verts:
            key = tuple(round(float(v), 6) for v in vertex)
            if key not in lookup:
                lookup[key] = len(unique)
                unique.append(key)
            indices.append(lookup[key])
        faces = [tuple(indices[i] for i in face) for face in faces]
        valid = [i for i, face in enumerate(faces) if len(set(face)) == 3]
        faces = [faces[i] for i in valid]
        mesh = bpy.data.meshes.new(owner_name + '_' + material_name)
        mesh.from_pydata(unique, [], faces)
        mesh.materials.append(bpy.data.materials[material_name])
        if preserve_vertex_colors:
            layer = mesh.color_attributes.new(name="palette", type="FLOAT_COLOR", domain="CORNER")
            mesh.color_attributes.active_color = layer
            values = colors[(owner_name, material_name)]
            for j, i in enumerate(valid):
                for k in range(3): layer.data[j * 3 + k].color = values[i * 3 + k]
        obj = bpy.data.objects.new(mesh.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = bpy.data.objects[owner_name]
        obj.matrix_parent_inverse = Matrix.Identity(4)


def glb(root, path):
    objects = [root, *root.children_recursive]
    naming.validate(objects)
    for obj in bpy.context.view_layer.objects:
        obj.select_set(obj in objects)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_extras=True,
                              export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                              export_cameras=False, export_lights=False)
