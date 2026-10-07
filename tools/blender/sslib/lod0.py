"""Camera-reviewed LOD delivery helpers for reproducible asset builds.

Mark covered faces before baking and delete them only at export, preserving AO
and custom normals. Keep removable assemblies separate. Lower tiers retain the
LOD0 assembly hull while meeting the existing delivery ratios.
"""
from collections import defaultdict


def stabilize_ao(objects):
    for obj in objects:
        if obj.type != 'MESH':
            continue
        mesh = obj.data
        color = mesh.color_attributes.get('ao')
        if color is None or color.domain != 'CORNER':
            continue
        groups = defaultdict(list)
        normals = mesh.corner_normals
        for loop in mesh.loops:
            position = mesh.vertices[loop.vertex_index].co
            normal = normals[loop.index].vector
            key = tuple(round(v, 6) for v in position) + tuple(round(v, 4) for v in normal)
            groups[key].append(loop.index)
        for indices in groups.values():
            if len(indices) < 2:
                continue
            mean = tuple(sum(color.data[i].color[c] for i in indices) / len(indices) for c in range(4))
            for i in indices:
                color.data[i].color = mean


def prune_hidden_faces(objects, groups=None, occlusion=False, game_camera=False, defer=False):
    """Delete hidden faces; never cross a removable/hinged assembly.

    Volume occluders must be outward-wound, closed and convex. AABB broad phase and outward half-space
    tests reject nonconvex shells and boundary faces. Custom corner normals and
    face attributes survive deletion. Optional near-grazing occlusion probes also
    catch covered backs across small gaps; callers must review those at game zoom.
    """
    import math
    import bpy
    import bmesh
    from mathutils import Vector

    objects = [o for o in objects if o.type == 'MESH']
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    evaluated = [(o, bpy.data.meshes.new_from_object(o.evaluated_get(deps),
                 preserve_all_data_layers=True, depsgraph=deps)) for o in objects]
    for obj, data in evaluated:
        obj.modifiers.clear()
        obj.data = data
    def opaque(obj):
        for material in obj.data.materials:
            if material is None:
                continue
            if material.diffuse_color[3] < .999:
                return False
            if material.use_nodes and any(node.type == 'BSDF_PRINCIPLED' and node.inputs['Alpha'].default_value < .999
                                          for node in material.node_tree.nodes):
                return False
        return True

    references = {}
    grid = defaultdict(list)
    cell_size = 1.5
    epsilon = 1e-5
    for obj in objects:
        data = obj.data
        points = [obj.matrix_world @ v.co for v in data.vertices]
        if not points:
            continue
        lo = tuple(min(p[i] for p in points) for i in range(3))
        hi = tuple(max(p[i] for p in points) for i in range(3))
        if not opaque(obj) or len(data.polygons) > 160 or min(hi[i]-lo[i] for i in range(3)) < epsilon:
            continue
        edges = defaultdict(int)
        for face in data.polygons:
            for edge in face.edge_keys:
                edges[edge] += 1
        if not edges or any(n != 2 for n in edges.values()):
            continue
        center = sum(points, Vector()) / len(points)
        normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
        planes = {}
        convex = True
        for face in data.polygons:
            normal = (normal_matrix @ face.normal).normalized()
            origin = points[face.vertices[0]]
            if normal.dot(center-origin) > epsilon:
                convex = False
                break
            distance = normal.dot(origin)
            if any(normal.dot(p)-distance > epsilon for p in points):
                convex = False
                break
            key = tuple(round(v, 5) for v in normal) + (round(distance, 5),)
            planes[key] = (normal, distance)
        if not convex:
            continue
        group = groups[obj] if groups else obj.parent
        references[obj] = (lo, hi, list(planes.values()))
        for x in range(math.floor(lo[0]/cell_size), math.floor(hi[0]/cell_size)+1):
            for y in range(math.floor(lo[1]/cell_size), math.floor(hi[1]/cell_size)+1):
                for z in range(math.floor(lo[2]/cell_size), math.floor(hi[2]/cell_size)+1):
                    grid[(group, x, y, z)].append(obj)
    trees = {}
    if occlusion or game_camera:
        from mathutils.bvhtree import BVHTree
        grouped = defaultdict(list)
        for obj in objects:
            grouped[groups[obj] if groups else obj.parent].append(obj)
        for group, members in grouped.items():
            vertices, faces = [], []
            for obj in members:
                if not opaque(obj):
                    continue
                offset = len(vertices)
                vertices.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
                faces.extend(tuple(offset+i for i in face.vertices) for face in obj.data.polygons)
            trees[group] = BVHTree.FromPolygons(vertices, faces)
        directions = [Vector((0, 0, 1))]
        # Cover the normal and two near-grazing rings around the whole hemisphere.
        for elevation in (45, 82):
            angle = math.radians(elevation)
            directions.extend(Vector((math.sin(angle)*math.cos(i*math.tau/8),
                                      math.sin(angle)*math.sin(i*math.tau/8), math.cos(angle)))
                              for i in range(8))
    # The game looks down at 36 degrees with a 25-degree vertical field of view.
    # Probe a wider 20..60 degree cone at every azimuth; never apply this to
    # hinged parts, vehicles, or assets intended for a ground-level camera.
    camera_rays = [Vector((math.cos(math.radians(e))*math.cos(i*math.tau/32),
                           math.cos(math.radians(e))*math.sin(i*math.tau/32),
                           math.sin(math.radians(e))))
                   for e in (20, 36, 60) for i in range(32)] if game_camera else []
    # Keep one representative face per assembly/material. Builders join these
    # buckets before AO baking, which rejects an empty mesh, and runtime node
    # names must survive even when a whole material is hidden.
    representatives = {}
    if occlusion or game_camera:
        for obj in objects:
            group = groups[obj] if groups else obj.parent
            for face in obj.data.polygons:
                material = obj.data.materials[face.material_index] if obj.data.materials else None
                key = (group, material)
                if key not in representatives or face.area > representatives[key][0]:
                    representatives[key] = (face.area, obj, face.index)
    protected = {(obj, index) for _, obj, index in representatives.values()}
    def blocked(tree, start, direction, distance=.35):
        # BVH rays hit both windings; Eevee culls the back face. Skip those hits
        # (including the opposite side of an inward-wound source box).
        for _ in range(128):
            hit, normal, _, travelled = tree.ray_cast(start, direction, distance)
            if hit is None:
                return False
            if normal.dot(direction) < -.0001:
                return True
            step = travelled + .0002
            distance -= step
            if distance <= 0:
                return False
            start = hit + direction * .0002
        return False
    removed = 0
    for obj in objects:
        data = obj.data
        points = [obj.matrix_world @ v.co for v in data.vertices]
        hidden = []
        group = groups[obj] if groups else obj.parent
        for face in data.polygons:
            polygon = [points[i] for i in face.vertices]
            center = sum(polygon, Vector()) / len(polygon)
            key = (group, *(math.floor(v/cell_size) for v in center))
            for other in grid[key]:
                if other == obj:
                    continue
                lo, hi, planes = references[other]
                if any(any(p[i] <= lo[i]+epsilon or p[i] >= hi[i]-epsilon for i in range(3)) for p in polygon):
                    continue
                if all(all(normal.dot(p)-distance < -epsilon for p in polygon) for normal, distance in planes):
                    hidden.append(face.index)
                    break
        if occlusion or game_camera:
            tree = trees[group]
            normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
            enclosed = set(hidden)
            for face in data.polygons:
                if face.index in enclosed or len(face.vertices) > 16:
                    continue
                normal = (normal_matrix @ face.normal).normalized()
                rotation = Vector((0, 0, 1)).rotation_difference(normal)
                fixed_assembly = group is None or (group if isinstance(group, str) else group.name) in ('body', 'roof', 'interior', 'inside')
                if game_camera and fixed_assembly:
                    # All rays in the continuous cone face away from this polygon.
                    if normal.z < -math.cos(math.radians(20)) - .001:
                        hidden.append(face.index)
                        continue
                    rays = [d for d in camera_rays if normal.dot(d) > -.02]
                elif occlusion:
                    rays = [rotation @ d for d in directions]
                else:
                    continue
                polygon = [points[i] for i in face.vertices]
                center = sum(polygon, Vector()) / len(polygon)
                samples = [center, *polygon, *((polygon[i]+polygon[(i+1)%len(polygon)])/2 for i in range(len(polygon)))]
                covered = True
                for sample in samples:
                    start = sample + normal * .0001
                    if any(not blocked(tree, start, direction) for direction in rays):
                        covered = False
                        break
                if covered:
                    hidden.append(face.index)
        hidden = sorted(set(index for index in hidden if (obj, index) not in protected))
        if not hidden:
            continue
        if defer:
            marker = data.attributes.get('diet_hidden') or data.attributes.new(name='diet_hidden', type='INT', domain='FACE')
            for index in hidden:
                marker.data[index].value = 1
        else:
            _delete_faces(obj, hidden)
        removed += len(hidden)
    print('HIDDEN FACES OK', removed, 'faces marked' if defer else 'faces removed', flush=True)
    return removed


def _delete_faces(obj, hidden):
    import bmesh
    data = obj.data
    normals = {(face.index, loop.vertex_index): tuple(data.corner_normals[loop.index].vector)
               for face in data.polygons for loop in (data.loops[i] for i in face.loop_indices)}
    bm = bmesh.new()
    bm.from_mesh(data)
    bm.faces.ensure_lookup_table()
    source = bm.faces.layers.int.new('diet_source_face')
    for face in bm.faces:
        face[source] = face.index
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in hidden], context='FACES_ONLY')
    bm.to_mesh(data)
    bm.free()
    original = data.attributes['diet_source_face']
    loop_normals = [None] * len(data.loops)
    for face in data.polygons:
        for index in face.loop_indices:
            loop_normals[index] = normals[(original.data[face.index].value, data.loops[index].vertex_index)]
    data.normals_split_custom_set(loop_normals)
    data.attributes.remove(original)

def apply_hidden_faces(objects):
    """Apply marked deletion after AO baking, retaining baked corner colours."""
    for obj in objects:
        if obj.type != 'MESH':
            continue
        marker = obj.data.attributes.get('diet_hidden')
        if marker is not None:
            hidden = [i for i, value in enumerate(marker.data) if value.value]
            obj.data.attributes.remove(marker)
            if hidden:
                _delete_faces(obj, hidden)


_lod0_triangles = {}
_lod0_bounds = {}


def prepare_export_lod(objects, path, position_bits=14, lod1_ratio=.11):
    """Keep authored lower tiers within the reduced LOD0's delivery ratios.

    LOD0 applies only the reviewed hidden-face marks after AO baking. Builds
    opt into 14-bit shipping positions; the packer keeps normals/AO precision.
    Lower tiers use temporary meshes and stay within the LOD0 assembly hull,
    including tiers whose palettes differ from the hero.
    """
    import json
    import re
    import struct
    from pathlib import Path
    import bpy

    apply_hidden_faces(objects)
    meshes = [o for o in objects if o.type == 'MESH']
    target_path = Path(path)
    match = re.search(r'\.lod([12])$', target_path.stem)
    base_path = target_path.with_name(re.sub(r'\.lod[12]$', '', target_path.stem) + '.glb')
    key = str(base_path.resolve())
    for obj in meshes:
        root = obj
        while root.parent:
            root = root.parent
        root['lod0_position_bits'] = position_bits

    def triangles():
        total = 0
        for obj in meshes:
            obj.data.calc_loop_triangles()
            total += len(obj.data.loop_triangles)
        return total

    if not match:
        _lod0_triangles[key] = triangles()
        points = [obj.matrix_world @ obj.data.vertices[i].co for obj in meshes
                  for i in {i for face in obj.data.polygons for i in face.vertices}]
        _lod0_bounds[key] = [(min(p[i] for p in points), max(p[i] for p in points)) for i in range(3)] if points else None
        return
    base = _lod0_triangles.get(key)
    if base is None and base_path.exists():
        data = base_path.read_bytes()
        source = json.loads(data[20:20+struct.unpack_from('<I', data, 12)[0]])
        base = sum(source['accessors'][primitive['indices']]['count']//3
                   for mesh in source['meshes'] for primitive in mesh['primitives'] if 'indices' in primitive)
    if base is None:
        return
    level = int(match.group(1))
    budget = max(1, min(15000 if level == 1 else 4000, int(base * (lod1_ratio if level == 1 else .04))))
    high_bounds = _lod0_bounds.get(key)
    def clamp_high(obj):
        hull = high_bounds
        if hull is None:
            return
        inverse = obj.matrix_world.inverted()
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            for axis, (lo, hi) in enumerate(hull):
                point[axis] = max(lo, min(hi, point[axis]))
            vertex.co = inverse @ point
    for obj in meshes:
        clamp_high(obj)
    bounds = {obj: [(min(v.co[i] for v in obj.data.vertices), max(v.co[i] for v in obj.data.vertices))
                    for i in range(3)] for obj in meshes if obj.data.vertices}
    for _ in range(4):
        count = triangles()
        if count <= budget:
            break
        for obj in meshes:
            obj.data.calc_loop_triangles()
            if len(obj.data.loop_triangles) <= 12 or obj.get('lod_geometry_fixed', False):
                continue
            modifier = obj.modifiers.new('Delivery LOD budget', 'DECIMATE')
            modifier.ratio = max(.01, budget / count * .85)
            modifier.use_collapse_triangulate = True
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            for vertex in obj.data.vertices:
                for axis, (lo, hi) in enumerate(bounds[obj]):
                    vertex.co[axis] = max(lo, min(hi, vertex.co[axis]))
            clamp_high(obj)
    # Disconnected details reach a collapse floor. Omit the smallest complete
    # components at distance, keeping every mesh's extents and at least one part.
    if triangles() > budget:
        import bmesh
        candidates = []
        working = {}
        for obj in meshes:
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bm.faces.ensure_lookup_table()
            working[obj] = bm
            used = {vertex for face in bm.faces for vertex in face.verts}
            if not used:
                continue
            hull = [(min(v.co[i] for v in used), max(v.co[i] for v in used)) for i in range(3)]
            seen = set()
            for start in bm.faces:
                if start in seen:
                    continue
                component, pending = [], [start]
                while pending:
                    face = pending.pop()
                    if face in seen:
                        continue
                    seen.add(face)
                    component.append(face)
                    pending.extend(other for edge in face.edges for other in edge.link_faces if other not in seen)
                vertices = {v for face in component for v in face.verts}
                boundary = any(abs(v.co[i]-edge) < 1e-6 for v in vertices for i in range(3) for edge in hull[i])
                if not boundary:
                    candidates.append((sum(face.calc_area() for face in component), obj, component))
        count = triangles()
        for _, obj, component in sorted(candidates, key=lambda entry: entry[0]):
            if count <= budget:
                break
            count -= sum(len(face.verts)-2 for face in component)
            bmesh.ops.delete(working[obj], geom=component, context='FACES_ONLY')
        for obj, bm in working.items():
            bm.to_mesh(obj.data)
            bm.free()
    print('LOD BUDGET ' + ('OK' if triangles() <= budget else 'OVER'), level, triangles(), '/', budget, flush=True)

