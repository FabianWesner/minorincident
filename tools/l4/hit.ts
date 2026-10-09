import { l4Route, l4RoutePose } from '../../src/data/l4';
const route = l4Route(), p = l4RoutePose(route, 20);
console.log(p, route.pts.slice(0, 5));
