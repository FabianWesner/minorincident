/** Project a scanline on the actual bundled front-window primitive, so camera
 * rotation is removed before measuring the pattern's movement within its frame. */
export async function windowLine(page: import('@playwright/test').Page): Promise<number[][]> {
  return page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
    let line: number[][] = [];
    game.view.labProbes().districts?.traverse(object => {
      const mesh = object as import('three').InstancedMesh;
      // Static batches keep the instance matrix API while disabling Three's implicit TSL transform.
      if (!(mesh.isInstancedMesh || mesh.userData.staticInstanceAttributes) || !mesh.count || !mesh.geometry.hasAttribute('_window')) return;
      const g = mesh.geometry, mask = g.getAttribute('_window'), light = g.getAttribute('_light'), normal = g.getAttribute('normal'), positions = g.getAttribute('position');
      const vertices: number[][] = [];
      const instance = mesh.matrixWorld.clone(); mesh.getMatrixAt(0, instance);
      const referenced = new Set(Array.from(g.index?.array ?? Array.from({ length: mask.count }, (_, i) => i)));
      for (const i of referenced) if (mask.getX(i) === 1 && light.getX(i) === 2 && normal.getX(i) > .8) vertices.push(mesh.position.clone().set(positions.getX(i), positions.getY(i), positions.getZ(i)).applyMatrix4(instance).applyMatrix4(mesh.matrixWorld).toArray());
      if (!vertices.length) return;
      const min = [0, 1, 2].map(axis => Math.min(...vertices.map(p => p[axis]))), max = [0, 1, 2].map(axis => Math.max(...vertices.map(p => p[axis])));
      line = Array.from({ length: 200 }, (_, i) => window.__SS__!.camera.project(max[0] + .002, min[1] + (max[1] - min[1]) * .7, min[2] + (max[2] - min[2]) * i / 199));
    });
    return line;
  });
}
