/*
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 * Developed at SunPro, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this software is freely
 * granted, provided that this notice is preserved.
 * atan polynomial adapted from openlibm src/s_atan.c, src/e_atan2.c, src/k_sin.c and src/k_cos.c.
 */
const atanHi = [.4636476090008061, .7853981633974483, .982793723247329, 1.5707963267948966];
const atanLo = [2.2698777452961687e-17, 3.061616997868383e-17, 1.3903311031230998e-17, 6.123233995736766e-17];
const atanCoefficients = [.3333333333333293, -.19999999999876483, .14285714272503466, -.11111110405462356, .09090887133436507, -.0769187620504483, .06661073137387531, -.058335701337905735, .049768779946159324, -.036531572744216916, .016285820115365782];
function atanPositive(value: number): number {
  let x = value, id = -1;
  if (x >= 2 ** 66) return atanHi[3] + atanLo[3];
  if (x >= .4375) {
    if (x < 1.1875) {
      if (x < .6875) { id = 0; x = (2 * x - 1) / (2 + x); }
      else { id = 1; x = (x - 1) / (x + 1); }
    } else if (x < 2.4375) { id = 2; x = (x - 1.5) / (1 + 1.5 * x); }
    else { id = 3; x = -1 / x; }
  }
  const a = atanCoefficients, z = x * x, w = z * z;
  const s1 = z * (a[0] + w * (a[2] + w * (a[4] + w * (a[6] + w * (a[8] + w * a[10])))));
  const s2 = w * (a[1] + w * (a[3] + w * (a[5] + w * (a[7] + w * a[9]))));
  return id < 0 ? x - x * (s1 + s2) : atanHi[id] - ((x * (s1 + s2) - atanLo[id]) - x);
}
/** Fixed IEEE-754 arithmetic, independent of the host transcendental implementation. */
export function deterministicAtan2(y: number, x: number): number {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  if (y === 0) return x < 0 || Object.is(x, -0) ? (Object.is(y, -0) ? -Math.PI : Math.PI) : y;
  if (x === 0) return y < 0 ? -Math.PI / 2 : Math.PI / 2;
  const ax = Math.abs(x), ay = Math.abs(y);
  const z = atanPositive(ax === Infinity && ay === Infinity ? 1 : ay / ax);
  if (x > 0) return y < 0 ? -z : z;
  return y < 0 ? (z - 1.2246467991473532e-16) - Math.PI : Math.PI - (z - 1.2246467991473532e-16);
}

const sineCoefficients = [-0.16666666666666632, 0.00833333333332249, -0.0001984126982985795, 2.7557313707070068e-06, -2.5050760253406863e-08, 1.58969099521155e-10];
const cosineCoefficients = [0.0416666666666666, -0.001388888888887411, 2.480158728947673e-05, -2.7557314351390663e-07, 2.087572321298175e-09, -1.1359647557788195e-11];
function sineKernel(x: number, y: number): number {
  const a = sineCoefficients, z = x * x, w = z * z;
  const r = a[1] + z * (a[2] + z * a[3]) + z * w * (a[4] + z * a[5]), v = z * x;
  return y === 0 ? x + v * (a[0] + z * r) : x - ((z * (.5 * y - v * r) - y) - v * a[0]);
}
function cosineKernel(x: number, y: number): number {
  const a = cosineCoefficients, z = x * x, w = z * z;
  const r = z * (a[0] + z * (a[1] + z * a[2])) + w * w * (a[3] + z * (a[4] + z * a[5]));
  const half = .5 * z, result = 1 - half;
  return result + (((1 - result) - half) + (z * r - x * y));
}
/** Simulation angles use split pi/2 reduction and the openlibm k_sin/k_cos polynomials. */
function trig(angle: number, cosine: boolean): number {
  if (!Number.isFinite(angle)) return NaN;
  if (angle === 0) return cosine ? 1 : angle;
  // Simulation angles are bounded; reduce extreme external inputs before the split subtraction.
  if (Math.abs(angle) > 1e6) angle %= 2 * Math.PI;
  const n = Math.round(angle * .6366197723675814);
  const r = angle - n * 1.5707963267341256, tail = n * 6.077100506506192e-11;
  const x = r - tail, y = (r - x) - tail;
  const quadrant = ((n + (cosine ? 1 : 0)) % 4 + 4) % 4;
  return quadrant === 0 ? sineKernel(x, y) : quadrant === 1 ? cosineKernel(x, y) : quadrant === 2 ? -sineKernel(x, y) : -cosineKernel(x, y);
}
export function deterministicSin(angle: number): number { return trig(angle, false); }
export function deterministicCos(angle: number): number { return trig(angle, true); }

export function deterministicAngleDelta(from: number, to: number): number {
  const delta = (to - from) % (2 * Math.PI);
  return delta > Math.PI ? delta - 2 * Math.PI : delta < -Math.PI ? delta + 2 * Math.PI : delta;
}
