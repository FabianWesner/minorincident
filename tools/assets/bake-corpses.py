"""Build corpse-only rigid LODs from intact models with headless Blender.

Collapse edges on the intact shells instead of selecting sparse triangles from
an already reduced living LOD. Rig nodes/materials survive; living tiers do not
use these files. Small clothing details may collapse, but whole bodies persist.
"""
import bpy
import bmesh
from mathutils.bvhtree import BVHTree
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODELS = ['inf.common-worker', 'inf.jogger', 'inf.cashier', 'inf.delivery-driver',
          'inf.suburban-mom', 'inf.bbq-dad', 'inf.bathrobe-neighbor']
for model in MODELS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/assets/models' / (model + '.glb')))
    for original in list(bpy.context.scene.objects):
        if original.type != 'MESH':
            continue
        # glTF splits vertices at normal/material seams. Restore the original
        # closed topology before collapsing edges; keep separate nearby shells.
        topology = bmesh.new()
        topology.from_mesh(original.data)
        bmesh.ops.remove_doubles(topology, verts=list(topology.verts), dist=.00001)
        topology.to_mesh(original.data)
        topology.free()
        count = len(original.data.polygons)
        source_materials = [p.material_index for p in original.data.polygons]
        areas = {}
        for polygon in original.data.polygons:
            areas[polygon.material_index] = areas.get(polygon.material_index, 0) + polygon.area
        dominant = max(areas, key=areas.get)
        joint = original
        while joint.parent and joint.name not in ['head', 'torso', 'hip', 'armL', 'armR', 'legL', 'legR', 'handL', 'handR', 'footL', 'footR']:
            joint = joint.parent
        surface = BVHTree.FromPolygons([v.co.copy() for v in original.data.vertices],
                                       [list(p.vertices) for p in original.data.polygons])
        # Imported garment layers and decals can be open, overlapping shells.
        # A small voxel union makes one solid part before the coarse collapse;
        # index/edge reduction alone cannot repair these disconnected surfaces.
        bpy.context.view_layer.objects.active = original
        if joint.name in ['torso', 'hip']:
            # A coarse garment needs one continuous volume. Retaining every
            # sculpted bite/fold produces spikes and a very high genus surface.
            topology = bmesh.new()
            topology.from_mesh(original.data)
            bmesh.ops.delete(topology, geom=list(topology.faces), context='FACES_ONLY')
            bmesh.ops.convex_hull(topology, input=list(topology.verts), use_existing_faces=False)
            bmesh.ops.delete(topology, geom=[e for e in topology.edges if not e.link_faces], context='EDGES')
            bmesh.ops.delete(topology, geom=[v for v in topology.verts if not v.link_faces], context='VERTS')
            bmesh.ops.recalc_face_normals(topology, faces=list(topology.faces))
            topology.to_mesh(original.data)
            topology.free()
        else:
            remesh = original.modifiers.new('solid corpse part', 'REMESH')
            remesh.mode = 'VOXEL'
            remesh.voxel_size = .03
            remesh.use_smooth_shade = True
            bpy.ops.object.modifier_apply(modifier=remesh.name)
        topology = bmesh.new()
        topology.from_mesh(original.data)
        remaining, components = set(topology.faces), []
        while remaining:
            first = remaining.pop()
            pending, component = [first], [first]
            while pending:
                face = pending.pop()
                for edge in face.edges:
                    for neighbor in edge.link_faces:
                        if neighbor in remaining:
                            remaining.remove(neighbor)
                            pending.append(neighbor)
                            component.append(neighbor)
            components.append(component)
        largest = max((sum(f.calc_area() for f in c) for c in components), default=0)
        for component in components:
            if sum(f.calc_area() for f in component) >= largest * .02:
                continue
            # Tiny paint/sculpt fragments are decoration; preserve emissive eyes.
            nearest = surface.find_nearest(component[0].calc_center_median())
            material = original.data.materials[source_materials[nearest[2]]] if nearest[2] is not None else None
            if material and material.name.startswith('emi_'):
                continue
            bmesh.ops.delete(topology, geom=component, context='FACES')
        topology.to_mesh(original.data)
        topology.free()
        target = max(16, int(count * .018))
        triangles = sum(len(p.vertices) - 2 for p in original.data.polygons)
        if triangles > target:
            bpy.context.view_layer.objects.active = original
            modifier = original.modifiers.new('closed corpse shell', 'DECIMATE')
            modifier.ratio = target / triangles
            modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        for polygon in original.data.polygons:
            nearest = surface.find_nearest(polygon.center)
            if nearest[2] is not None:
                # At corpse distance, one garment swatch reads as clothing.
                # Sampling overlapping bite/sculpt layers per coarse face made
                # the intact volume look like multicolored triangular fragments.
                polygon.material_index = source_materials[nearest[2]] if joint.name == 'head' else dominant
            polygon.use_smooth = True
    bpy.context.scene['corpseSource'] = model + '.glb'
    bpy.ops.export_scene.gltf(filepath=str(ROOT / 'public/assets/models' / (model + '.corpse.glb')),
                              export_format='GLB', export_animations=False, export_yup=True)
    triangles = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == 'MESH')
    print('CORPSE', model, triangles, flush=True)
