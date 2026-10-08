"""Build the shared script contract, or run an existing standalone script unchanged."""
import argparse
import json
from pathlib import Path
import runpy
import sys
from types import SimpleNamespace
import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent))
parser = argparse.ArgumentParser()
parser.add_argument('--asset', required=True)
parser.add_argument('--quality', choices=['high', 'low'], default='high')
parser.add_argument('--output', required=True)
parser.add_argument('--decay')
parser.add_argument('--bake-ao', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
if bpy.app.version[:2] != (5, 2):
    raise RuntimeError(f'Expected Blender 5.2, got {bpy.app.version_string}')
manifest = json.loads((ROOT / 'src/assets/manifest.json').read_text())
definition = next(asset for asset in manifest if asset['id'] == args.asset)
script = ROOT / definition['script']
output = Path(args.output).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
# Standalone scripts consume --glb; shared scripts return a root from build(ctx).
sys.argv = [str(script), '--', '--glb', str(output), '--quality', args.quality]
if args.decay:
    sys.argv += ['--decay', args.decay]
bpy.ops.wm.read_factory_settings(use_empty=True)
namespace = runpy.run_path(str(script))
if callable(namespace.get('build')):
    from sslib import sockets, export, ao
    root = sockets.empty(args.asset)
    ctx = SimpleNamespace(root=root, quality=args.quality, seed=17, decay=args.decay)
    root = namespace['build'](ctx)
    bpy.context.view_layer.update()
    if args.bake_ao:
        ao.bake_all(root.children_recursive)
    export.glb(root, output)
if not output.exists():
    raise RuntimeError(f'{script} did not produce {output}')
