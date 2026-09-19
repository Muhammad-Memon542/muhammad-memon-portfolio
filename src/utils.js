/**
 * Pure helpers shared across the app.
 *
 * Everything here is side-effect free: seeded RNG, small math used by the
 * simulation and camera, the wave function, and one HTML helper. Keeping these
 * apart makes them easy to reason about and reuse.
 */

/* ---------- seeded RNG ---------- */

/** Mulberry32: a tiny, fast, deterministic PRNG. Same seed -> same sequence. */
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash -> 32-bit unsigned int, used to seed per-island layouts. */
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ---------- math ---------- */

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;

/** Frame-rate independent damping factor for exponential smoothing. */
export const damp = (k, dt) => 1 - Math.exp(-k * dt);

/** Shortest signed angular difference from `a` to `b`, in (-PI, PI]. */
export function angDiff(a, b) {
  let d = (b - a + Math.PI) % (Math.PI * 2);
  if (d < 0) d += Math.PI * 2;
  return d - Math.PI;
}

export const lerpAngle = (a, b, k) => a + angDiff(a, b) * k;

/* ---------- waves ---------- */

/**
 * The ocean's height field. The GLSL string runs on the GPU (the water surface)
 * and `waveH` runs on the CPU (boat, buoys, bottles); the two must stay in sync so
 * everything floats on the same swell.
 */
export const WAVE_GLSL = `
uniform float uTime;
float waveH(vec2 p, float t){
  return sin(p.x*0.075 + t*1.05)*0.45 + sin(p.y*0.105 - t*0.85)*0.35
       + sin((p.x+p.y)*0.045 + t*0.65)*0.55 + sin((p.x-p.y)*0.18 + t*1.6)*0.12;
}`;

export function waveH(x, z, t) {
  return Math.sin(x * 0.075 + t * 1.05) * 0.45 + Math.sin(z * 0.105 - t * 0.85) * 0.35
       + Math.sin((x + z) * 0.045 + t * 0.65) * 0.55 + Math.sin((x - z) * 0.18 + t * 1.6) * 0.12;
}

/* ---------- placement ---------- */

/**
 * Pick a spot in open water: inside the chart, clear of land, and not on top of
 * anything already placed. Draws from the seeded RNG so layouts stay reproducible.
 *
 * @param {Function} rng      seeded random source
 * @param {Array<{x: number, z: number, r: number}>} islands
 * @param {Array<[number, number]>} avoid  points already occupied
 * @returns {[number, number]|null} a position, or null if nowhere free was found
 */
export function findOpenWater(rng, islands, avoid, {
  inner = 45, outer = 205, clearance = 16, spacing = 13, tries = 260,
} = {}) {
  for (let i = 0; i < tries; i++) {
    const a = rng() * Math.PI * 2;
    const d = inner + rng() * (outer - inner);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (islands.some((isl) => Math.hypot(x - isl.x, z - isl.z) < isl.r + clearance)) continue;
    if (avoid.some((p) => Math.hypot(x - p[0], z - p[1]) < spacing)) continue;
    return [x, z];
  }
  return null;
}

/* ---------- misc ---------- */

/** True for links that leave the site (so they open in a new tab). */
export const isExt = (href) => /^https?:/i.test(href);
