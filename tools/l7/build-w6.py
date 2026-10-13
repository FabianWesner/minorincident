"""Derive W6 from the reviewed W5 shells, preserving foundations and named sockets.
Remove a ragged upper street-facing corner; no substitute panels or box shells.
"""
import bpy, bmesh, hashlib, json, sys
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/blender'))
from sslib import export
ASSETS = ['apartment-block-a', 'apartment-block-b', 'town-hall', 'church', 'kessler-hardware', 'metro-entrance', 'storefront-row']
REPORT = ROOT / 'docs/reports/l7-district/geometry.json'
report = {}
# `-- --only name[,name]` rebuilds just those shells and keeps the other entries of the report.
if '--only' in sys.argv:
    ASSETS = sys.argv[sys.argv.index('--only') + 1].split(',')
    report = json.loads(REPORT.read_text())
for name in ASSETS:
    report[name] = {}
    for lod in range(3):
        suffix = f'.lod{lod}' if lod else ''
        source = ROOT / f'assets/bld.{name}/model.w5{suffix}.glb'
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(source))
        root = bpy.data.objects['root']
        meshes = [o for o in root.children_recursive if o.type == 'MESH']
        points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
        lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
        hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
        size = hi - lo
        before = after = 0
        for obj in meshes:
            bm = bmesh.new(); bm.from_mesh(obj.data)
            before += len(bm.faces)
            doomed = []
            for face in bm.faces:
                p = obj.matrix_world @ face.calc_center_median()
                # Blender is Z-up. Alternating setbacks expose existing floors,
                # retaining the whole foundation and the opposite landmark silhouette.
                step = int((p.y - lo.y) / max(.1, size.y / 7)) % 3
                if not (name == 'church' and p.x > lo.x + size.x * .78) and p.x > lo.x + size.x * .48 and p.y < lo.y + size.y * .60 and p.z > lo.z + size.z * (.42 + step * .07):
                    doomed.append(face)
            bmesh.ops.delete(bm, geom=doomed, context='FACES')
            after += len(bm.faces)
            bm.to_mesh(obj.data); bm.free()
        if after >= before: raise ValueError(f'{name}: no further destruction')
        root['decay'] = 'w6'; root['derivedFrom'] = str(source.relative_to(ROOT))
        root['sourceSha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
        target = ROOT / f'assets/bld.{name}/model.w6{suffix}.glb'
        export.glb(root, target)
        report[name][f'lod{lod}'] = {'source': str(source.relative_to(ROOT)), 'sourceSha256': root['sourceSha256'], 'facesBefore': before, 'facesAfter': after, 'bytes': target.stat().st_size}
REPORT.write_text(json.dumps(report, indent=2) + '\n')
