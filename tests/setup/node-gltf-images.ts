import { Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Node has no image decoder (GLTFLoader reads `self.URL` / createImageBitmap). Textured GLBs (the female courier skin
 * since 10-24) would otherwise fail to parse in unit tests; geometry, skins and nodes are what the tests read.
 * Every loader gets a plugin that resolves textures to an empty Texture. Browser builds never load this file. */
const marked = new WeakSet<GLTFLoader>();
const parse = GLTFLoader.prototype.parse;
GLTFLoader.prototype.parse = function (this: GLTFLoader, ...args: Parameters<GLTFLoader['parse']>) {
  if (!marked.has(this)) { marked.add(this); this.register(() => ({ name: 'node_test_images', loadTexture: () => Promise.resolve(new Texture()) }) as never); }
  return parse.apply(this, args);
};
