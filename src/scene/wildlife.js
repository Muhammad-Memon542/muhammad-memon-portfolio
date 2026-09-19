/**
 * Things that are alive: gulls wheeling over the islands, and dolphins working the
 * open water in pods.
 *
 * Both are pure scenery — no collision, no interaction. Dolphins spend most of each
 * cycle below the surface (hidden by the opaque water) and breach in an arc, kicking
 * up a splash on the way out and back in.
 */
import { M, MAT, GEO, Batch, mesh, xf } from './primitives.js';
import { findOpenWater, waveH } from '../utils.js';

const TAU = Math.PI * 2;

const WMAT = {
  skin: M(0x50718c),
  belly: M(0xc8d6dd),
};

const SHAPE = {
  sphere: new THREE.SphereGeometry(1, 8, 6),
  cone: new THREE.ConeGeometry(1, 1, 8),
  wing: (() => {
    const g = new THREE.BoxGeometry(1.6, 0.06, 0.55);
    g.translate(0.8, 0, 0);
    return g;
  })(),
};

/* ------------------------------------------------------------------- gulls */

/**
 * @param {Array<{x: number, z: number, radius: number, height: number}>} anchors
 *   one circling gull per anchor
 */
function createGulls(scene, rng, anchors) {
  return anchors.map((a, i) => {
    const g = new THREE.Group();
    mesh(GEO.box, MAT.gull, g, 0, 0, 0, false).scale.set(0.35, 0.3, 1.1);
    const wl = mesh(SHAPE.wing, MAT.gull, g, 0.1, 0.05, 0, false);
    const wr = mesh(SHAPE.wing, MAT.gull, g, -0.1, 0.05, 0, false);
    wr.rotation.y = Math.PI;
    scene.add(g);
    return {
      g, wl, wr,
      cx: a.x, cz: a.z, R: a.radius, h: a.height,
      sp: (i % 2 ? -1 : 1) * (0.25 + rng() * 0.15),
      ph: rng() * 6,
    };
  });
}

function updateGulls(gulls, time) {
  for (const g of gulls) {
    const a = time * g.sp + g.ph;
    g.g.position.set(
      g.cx + Math.cos(a) * g.R,
      g.h + Math.sin(time * 0.7 + g.ph) * 1.5,
      g.cz + Math.sin(a) * g.R
    );
    const tx = -Math.sin(a) * Math.sign(g.sp);
    const tz = Math.cos(a) * Math.sign(g.sp);
    g.g.rotation.set(0, Math.atan2(tx, tz), -Math.sign(g.sp) * 0.25);
    const flap = Math.sin(time * 7 + g.ph) * 0.5;
    g.wl.rotation.z = flap;
    g.wr.rotation.z = flap;
  }
}

/* ---------------------------------------------------------------- dolphins */

/** A single rigid dolphin, batched down to two draw calls. */
function buildDolphin(group) {
  const b = new Batch();
  b.add(WMAT.skin, xf(SHAPE.sphere, 0, 0, 0, 0, 0, 0, 0.5, 0.58, 1.75));
  b.add(WMAT.skin, xf(SHAPE.cone, 0, 0, 1.95, Math.PI / 2, 0, 0, 0.26, 1.0, 0.26));
  b.add(WMAT.belly, xf(SHAPE.sphere, 0, -0.2, 0.1, 0, 0, 0, 0.38, 0.36, 1.35));
  /* dorsal fin */
  b.add(WMAT.skin, xf(GEO.cone, 0, 0.62, -0.1, -0.35, 0, 0, 0.5, 0.95, 0.16));
  /* tail stock and flukes */
  b.add(WMAT.skin, xf(SHAPE.sphere, 0, 0.02, -1.75, 0, 0, 0, 0.18, 0.2, 0.55));
  for (const s of [-1, 1]) {
    b.add(WMAT.skin, xf(GEO.cone, s * 0.42, 0.02, -2.15, 0, 0, s * 1.35, 0.55, 0.9, 0.12));
  }
  /* flippers */
  for (const s of [-1, 1]) {
    b.add(WMAT.skin, xf(GEO.cone, s * 0.45, -0.18, 0.55, 0.5, 0, s * 1.1, 0.42, 0.8, 0.12));
  }
  b.build(group, true, false);
}

function createDolphins(scene, rng, islands, avoid, pods) {
  const dolphins = [];
  for (let pod = 0; pod < pods; pod++) {
    const spot = findOpenWater(rng, islands, avoid, { inner: 70, outer: 195, spacing: 48, clearance: 26 });
    if (!spot) continue;
    avoid.push(spot);
    const [cx, cz] = spot;
    const dir = rng() < 0.5 ? -1 : 1;
    const period = 5.5 + rng() * 3;
    const count = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      buildDolphin(g);
      g.scale.setScalar(0.9 + rng() * 0.3);
      scene.add(g);
      dolphins.push({
        g, cx, cz,
        R: 15 + i * 3.4 + rng() * 2,
        sp: dir * (0.16 + rng() * 0.05),
        ph: rng() * TAU,
        /* stagger the pod so they porpoise one after another */
        period,
        offset: (i / count) * period + rng() * 0.4,
        leapFrac: 0.3,
        height: 2.6 + rng() * 1.1,
        up: false,
      });
    }
  }
  return dolphins;
}

function updateDolphins(dolphins, time, onSplash) {
  for (const d of dolphins) {
    const a = time * d.sp + d.ph;
    const x = d.cx + Math.cos(a) * d.R;
    const z = d.cz + Math.sin(a) * d.R;
    const surface = waveH(x, z, time);

    const cycle = ((time + d.offset) % d.period) / d.period;
    const leaping = cycle < d.leapFrac;
    let y = surface - 2.4;
    let pitch = 0;
    if (leaping) {
      const k = cycle / d.leapFrac;
      y = surface + Math.sin(k * Math.PI) * d.height - 0.35;
      pitch = -Math.cos(k * Math.PI) * 1.05;
    }
    /* splash on the way out and on the way back in */
    if (leaping !== d.up) {
      d.up = leaping;
      if (onSplash) onSplash(x, z, 3.2);
    }

    d.g.position.set(x, y, z);
    const tx = -Math.sin(a) * Math.sign(d.sp);
    const tz = Math.cos(a) * Math.sign(d.sp);
    d.g.rotation.set(pitch, Math.atan2(tx, tz), Math.sin(a * 2) * 0.12);
  }
}

/* ----------------------------------------------------------------- factory */

/**
 * Build the gulls and dolphin pods.
 *
 * @param {object} o
 * @param {THREE.Scene} o.scene
 * @param {Function} o.rng
 * @param {Array}    o.islands       used to keep pods clear of land
 * @param {Array}    o.gullAnchors   {x, z, radius, height} per gull
 * @param {Array<[number, number]>} [o.avoid]  points the pods should stay away from
 * @param {number}   [o.pods]       how many dolphin pods to create
 * @returns {{update: (time: number, onSplash?: Function) => void, gulls: Array, dolphins: Array}}
 */
export function createWildlife({ scene, rng, islands, gullAnchors, avoid = [], pods = 3 }) {
  const gulls = createGulls(scene, rng, gullAnchors);
  const dolphins = createDolphins(scene, rng, islands, [...avoid], pods);
  return {
    gulls,
    dolphins,
    update(time, onSplash) {
      updateGulls(gulls, time);
      updateDolphins(dolphins, time, onSplash);
    },
  };
}
