// Adapted from folio-2025 by Bruno Simon (MIT): staged boot, without a singleton.
import { Game } from './Game';
import { installAssetVersions } from './assets/assetUrl';

installAssetVersions();

const params = new URLSearchParams(location.search);
const game = new Game(params);
const ready = game.init();
try {
  if (import.meta.env.DEV || params.get('test') === '1') {
    const { installTestApi } = await import('./debug/testApi');
    installTestApi(game, ready);
  }
  await ready;
  if (params.has('lookdev') || import.meta.env.DEV && params.has('debug')) {
    if (params.has('lookdev')) await game.loadLevel('L1', { seed: Number(params.get('seed') ?? 1) });
    const { Debug } = await import('./debug/Debug');
    const debug = new Debug(game);
    if (import.meta.hot) import.meta.hot.dispose(() => debug.dispose());
  }
  if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
} catch (error) {
  game.dispose();
  document.querySelector('#game')!.textContent = 'Minor Incident could not start. Please use a browser with WebGL2 support.';
  console.error(error);
}
