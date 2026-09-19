/**
 * Flotsam: everything inanimate bobbing around in the open sea.
 *
 * Navigation buoys mark the harbour approach; barrels and crates drift in loose rafts
 * that scatter when you plough through them; a half-sunken wreck gives the empty water
 * a landmark; and there's a rubber duck out there somewhere.
 *
 * Each object returns a plain descriptor that the simulation in main.js integrates:
 *
 *   x, z      world position          vx, vz   velocity
 *   r         collision radius        yaw      heading, driven by `spin`
 *   yOff      rest height relative to the wave surface
 *   bob       how much it rocks with the swell
 *   push      how hard the boat throws it     kick  how much it slows the boat
 *   drag      linear damping                  onMap whether it appears on the chart
 *
 * Lighter objects use a bigger `push` and less `drag`, so crates skitter away while
 * the moored buoys barely shift.
 */
import { M, MAT, GEO, Batch, mesh, xf } from './primitives.js';
import { findOpenWater } from '../utils.js';

const TAU = Math.PI * 2;

/* Materials specific to flotsam; the shared palette lives in primitives.js. */
const FMAT = {
  duck: M(0xf7c948),
  beak: M(0xe8762c),
  eye: M(0x20262e),
  wreck: M(0x5a4433),
  wreckDark: M(0x3d2f24),
};

/* Reusable shapes. Always wrap these in xf() before handing them to a Batch, which
   mutates and disposes the geometry it is given. */
const SHAPE = {
  buoyLow: new THREE.CylinderGeometry(0.72, 0.92, 1, 10),
  buoyMid: new THREE.CylinderGeometry(0.52, 0.72, 0.75, 10),
  buoyTop: new THREE.ConeGeometry(0.52, 0.85, 10),
  buoyLamp: new THREE.SphereGeometry(0.16, 6, 4),
  cyl10: new THREE.CylinderGeometry(1, 1, 1, 10),
  sphere: new THREE.SphereGeometry(1, 8, 6),
  cone: new THREE.ConeGeometry(1, 1, 8),
};

/* ------------------------------------------------------------------ builders */

function buildBuoy(group) {
  mesh(SHAPE.buoyLow, MAT.red, group, 0, 0.1, 0);
  mesh(SHAPE.buoyMid, MAT.cream, group, 0, 0.98, 0);
  mesh(SHAPE.buoyTop, MAT.red, group, 0, 1.78, 0);
  mesh(SHAPE.buoyLamp, MAT.lantern, group, 0, 2.28, 0, false);
}

/** A cask: staves, a wider belly, and two iron hoops. Batched to 2 draw calls. */
function buildBarrel(group) {
  const b = new Batch();
  b.add(MAT.wood, xf(SHAPE.cyl10, 0, 0, 0, 0, 0, 0, 0.54, 1.75, 0.54));
  b.add(MAT.wood, xf(SHAPE.cyl10, 0, 0, 0, 0, 0, 0, 0.63, 0.78, 0.63));
  for (const y of [0.54, -0.54]) {
    b.add(MAT.woodDark, xf(SHAPE.cyl10, 0, y, 0, 0, 0, 0, 0.6, 0.14, 0.6));
  }
  b.add(MAT.woodDark, xf(SHAPE.cyl10, 0, 0.89, 0, 0, 0, 0, 0.47, 0.09, 0.47));
  b.build(group);
}

/** A slatted cargo crate with a dark frame. */
function buildCrate(group) {
  const b = new Batch();
  const s = 1.22, t = 0.12;
  b.add(MAT.wood, xf(GEO.box, 0, 0, 0, 0, 0, 0, s, s, s));
  // frame: a belt around the middle plus four corner posts
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    b.add(MAT.woodDark, xf(GEO.box, ax * s / 2, 0, az * s / 2, 0, 0, 0,
      ax ? t : s * 1.02, t * 1.6, az ? t : s * 1.02));
  }
  for (const cx of [-1, 1]) for (const cz of [-1, 1]) {
    b.add(MAT.woodDark, xf(GEO.box, cx * s / 2, 0, cz * s / 2, 0, 0, 0, t, s * 1.02, t));
  }
  b.build(group);
}

/** The bath toy. Slightly too large to be plausible, which is the point. */
function buildDuck(group) {
  const body = mesh(SHAPE.sphere, FMAT.duck, group, 0, 0, 0);
  body.scale.set(1.25, 1.0, 1.55);
  const head = mesh(SHAPE.sphere, FMAT.duck, group, 0, 1.0, 0.62);
  head.scale.setScalar(0.62);
  const beak = mesh(SHAPE.cone, FMAT.beak, group, 0, 0.92, 1.3);
  beak.scale.set(0.26, 0.5, 0.26);
  beak.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    mesh(SHAPE.sphere, FMAT.eye, group, s * 0.28, 1.16, 1.0, false).scale.setScalar(0.1);
  }
  const tail = mesh(SHAPE.cone, FMAT.duck, group, 0, 0.42, -1.4);
  tail.scale.set(0.42, 0.8, 0.42);
  tail.rotation.x = -1.1;
}

/* ---------------------------------------------------------------- factory */

/* `yOff` sets the waterline: the mesh is centred on the wave surface plus this. These
   sit higher than real buoyancy would, because the camera looks down at a shallow angle
   and anything half-submerged flattens into a disc from up there. */
const PRESET = {
  buoy:   { r: 1.0,  yOff: -0.15, bob: 0.12, push: 1.7, kick: 0.12, drag: 1.1,  onMap: true },
  barrel: { r: 0.82, yOff: 0.30,  bob: 0.20, push: 2.5, kick: 0.05, drag: 0.85, onMap: false },
  crate:  { r: 0.95, yOff: 0.16,  bob: 0.24, push: 2.3, kick: 0.06, drag: 0.95, onMap: false },
  duck:   { r: 1.45, yOff: -0.30, bob: 0.17, push: 3.0, kick: 0.04, drag: 0.8,  onMap: false },
};

/**
 * Populate the sea.
 *
 * @param {object} o
 * @param {THREE.Scene} o.scene
 * @param {Function} o.rng               seeded RNG, so the layout is identical every load
 * @param {Array}    o.islands           built islands, used to keep clear of land
 * @param {Array<[number, number]>} o.bottlePositions  keeps flotsam off the hidden bottles
 * @param {number}   o.harborAngle       direction of the Home Harbor pier
 * @param {object}   [o.quality]         tier settings: how much to build, and whether it casts shadows
 * @returns {{floaters: Array, buoys: Array}} `buoys` is the subset drawn on the chart
 */
export function createFlotsam({ scene, rng, islands, bottlePositions, harborAngle, quality = {} }) {
  const {
    flotsamRafts = 5, flotsamSingles = 7, extraBuoys = 8, flotsamShadows = true,
  } = quality;
  const floaters = [];
  const taken = bottlePositions.map(([x, z]) => [x, z]);

  const add = (kind, x, z, build, scale = 1) => {
    const g = new THREE.Group();
    build(g);
    if (scale !== 1) g.scale.setScalar(scale);
    /* dozens of small shadow casters are not worth a shadow pass on a phone */
    if (!flotsamShadows) g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    scene.add(g);
    const f = {
      kind, g, x, z, vx: 0, vz: 0, spin: 0,
      yaw: rng() * TAU, ph: rng() * 6,
      ...PRESET[kind],
    };
    if (scale !== 1) f.r *= scale;
    floaters.push(f);
    taken.push([x, z]);
    return f;
  };

  /* Channel markers fanned across the harbour approach. */
  for (let i = 0; i < 5; i++) {
    const a = harborAngle + (i - 2) * 0.28;
    add('buoy', Math.cos(a) * 52, Math.sin(a) * 52, buildBuoy);
  }
  /* Scattered marks further out. */
  for (let i = 0; i < extraBuoys; i++) {
    const spot = findOpenWater(rng, islands, taken, { spacing: 15 });
    if (spot) add('buoy', spot[0], spot[1], buildBuoy);
  }

  /* Rafts of barrels and stacks of crates: the things worth crashing into. */
  const rafts = [
    { kind: 'barrel', build: buildBarrel, count: 7, spread: 3.0 },
    { kind: 'barrel', build: buildBarrel, count: 6, spread: 2.8 },
    { kind: 'crate', build: buildCrate, count: 5, spread: 3.1 },
    { kind: 'barrel', build: buildBarrel, count: 8, spread: 3.4 },
    { kind: 'crate', build: buildCrate, count: 6, spread: 3.3 },
  ];
  for (const raft of rafts.slice(0, flotsamRafts)) {
    const spot = findOpenWater(rng, islands, taken, { spacing: 26, clearance: 22 });
    if (!spot) continue;
    const [cx, cz] = spot;
    for (let i = 0; i < raft.count; i++) {
      /* rough ring with jitter, so a raft reads as a cluster rather than a pattern */
      const a = (i / raft.count) * TAU + rng() * 0.7;
      const d = raft.spread * (0.35 + rng() * 0.8);
      add(raft.kind, cx + Math.cos(a) * d, cz + Math.sin(a) * d, raft.build,
        0.85 + rng() * 0.35);
    }
  }

  /* A few loose singles so the open water is never completely empty. */
  for (let i = 0; i < flotsamSingles; i++) {
    const spot = findOpenWater(rng, islands, taken, { spacing: 17 });
    if (!spot) continue;
    const kind = rng() < 0.6 ? 'barrel' : 'crate';
    add(kind, spot[0], spot[1], kind === 'barrel' ? buildBarrel : buildCrate,
      0.85 + rng() * 0.3);
  }

  /* One rubber duck, well away from the harbour so finding it feels like a find. */
  const duckSpot = findOpenWater(rng, islands, taken, { inner: 110, outer: 200, spacing: 20 });
  if (duckSpot) add('duck', duckSpot[0], duckSpot[1], buildDuck, 1.35);

  return { floaters, buoys: floaters.filter((f) => f.onMap) };
}

/**
 * A wrecked ship, listing in open water: a snapped mast, a torn sail and a few ribs.
 * Purely scenery, but it takes a collider so you can't sail through it.
 *
 * @returns {{x: number, z: number, r: number}} collider for the caller to register
 */
export function createShipwreck({ scene, x, z, angle = 0 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = angle;
  scene.add(g);

  const b = new Batch();
  const lean = 0.42;

  /* hull: a broken wedge of deck breaching the surface */
  b.add(FMAT.wreck, xf(GEO.box, 0, 0.3, 0, 0, 0, lean, 7.4, 1.5, 3.2));
  b.add(FMAT.wreckDark, xf(GEO.box, 0, 1.05, 0, 0, 0, lean, 6.2, 0.35, 2.7));
  /* ribs poking out of the water along the open side */
  for (let i = -2; i <= 2; i++) {
    b.add(FMAT.wreckDark, xf(GEO.cyl6, i * 1.25, 1.2 + Math.abs(i) * 0.12, 1.25,
      0.22, 0, lean + 0.1, 0.16, 2.6, 0.16));
  }
  /* the mast, snapped short, with a spar across it */
  b.add(FMAT.wreck, xf(GEO.cyl6, -0.6, 4.1, 0, 0, 0, lean + 0.12, 0.3, 8.2, 0.3));
  b.add(FMAT.wreck, xf(GEO.cyl6, -2.1, 6.6, 0, Math.PI / 2, 0, 0, 0.18, 4.4, 0.18));
  b.build(g);

  /* a torn sail hanging off the spar */
  const sail = new THREE.BufferGeometry();
  sail.setAttribute('position', new THREE.Float32BufferAttribute([
    -2.1, 6.5, -2.0, -2.1, 6.5, 1.9, -1.0, 2.9, -0.6,
    -2.1, 6.5, 1.9, -1.3, 3.4, 1.4, -1.0, 2.9, -0.6,
  ], 3));
  sail.computeVertexNormals();
  mesh(sail, MAT.sail, g, 0, 0, 0);

  return { x, z, r: 4.6 };
}
