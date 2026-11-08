"""Equipment light metadata derived from the source emitter geometry, shared with the GLB repair."""
import json
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

RECORDS = {r['id']: r for r in json.loads((Path(__file__).resolve().parents[2] / 'assets/equipment-lights.json').read_text())}


def install(asset, root=None):
    objects = root.children_recursive if root else list(bpy.context.scene.objects)
    meshes = [o for o in objects if o.type == 'MESH' and any(m and m.name.startswith('emi_') for m in o.data.materials)]
    if asset == 'wpn.minigun-mounted':
        for obj in meshes:
            if any(m and m.name == 'emi_orange' for m in obj.data.materials):
                obj['decorativeEmissive'] = 'Heat sleeve; the minigun overheating mechanic owns its visibility and glow, not a steady lamp.'
    if asset not in RECORDS or not meshes:
        return
    bpy.context.view_layer.update()
    points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    low = Vector(tuple(min(v[k] for v in points) for k in range(3)))
    high = Vector(tuple(max(v[k] for v in points) for k in range(3)))
    anchor = bpy.data.objects.new('light:equipment', None)
    bpy.context.scene.collection.objects.link(anchor)
    anchor.parent = root
    anchor.matrix_world = Matrix.Translation((low + high) / 2)
    settings = {k: v for k, v in RECORDS[asset].items() if k != 'id'}
    anchor['ss_light'] = json.dumps(dict(type='point', **settings, beam='none', flare=False, shadow='none', heroPriority=0,
                                        flicker='none', powerGroup='self', breakable=False,
                                        emissiveNodes=sorted(o.name for o in meshes), tiers='all'))
