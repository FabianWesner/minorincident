// r42-l9pin: run the folded pocket check (tests/helpers/r39Markers.ts) outside the big missions test.
import { checkL9ApcPocket } from '../../../tests/helpers/r39Markers';
await checkL9ApcPocket();
console.log('pocket check passed');
