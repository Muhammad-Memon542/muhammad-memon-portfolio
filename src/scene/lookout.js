/**
 * The tour guide: an old salt who climbs into a crow's nest at the masthead while the
 * guided tour runs.
 *
 * Built from primitives like everything else and parented to the boat, so it rolls and
 * pitches with the hull. There's no rig and no animation clips: each frame the arms,
 * head and body ease toward the current pose, which is what makes him feel alive.
 *
 * Why the masthead? Everything on deck sits in the plane of a sail (the mainsail and
 * boom swing over the cabin, the jib covers the foredeck), and from the chase camera a
 * figure up top reads as a silhouette against the sea instead of a speck on the deck.
 */
import { M, MAT, mesh } from './primitives.js';
import { clamp, lerp, damp, lerpAngle } from '../utils.js';

const SKIN = M(0xe2ad84);
const BRASS = M(0xd9a441, { roughness: 0.35, metalness: 0.65 });
const BASKET = M(0xa06d45, { side: THREE.DoubleSide });

/* the whole nest is modelled at unit scale, then scaled up so it reads from a distance */
const SCALE = 1.35;

/*
 * Poses: target shoulder angles for each arm (x swings forward/back, z raises it out to
 * the side). Left and right are the figure's own, so its right arm is on -x.
 */
const POSES = {
  rest:     { r: [0.1, -0.14], l: [0.1, 0.14] },
  point:    { r: [-1.72, -0.18], l: [0.15, 0.2] },
  spyglass: { r: [0.05, -0.2], l: [-2.2, -0.62] },
  wave:     { r: [-0.25, -2.45], l: [0.1, 0.16] },
  cheer:    { r: [-0.35, -2.75], l: [-0.35, 2.75] }
};

const easeOutBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const Q_FWD = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));

/**
 * @param {object} deps
 * @param {THREE.Object3D} deps.parent   the boat group
 * @param {THREE.Vector3}  deps.mastTop  masthead, in the boat's local space
 * @param {THREE.Object3D} deps.flag     the boat's pennant, which climbs to the nest's staff
 */
export function createLookout({ parent, mastTop, flag }) {
  const root = new THREE.Group();
  root.position.copy(mastTop);
  root.visible = false;
  parent.add(root);

  /* ---------- crow's nest ---------- */
  const nest = new THREE.Group(); root.add(nest);
  mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.52, 12, 1, true), BASKET, nest, 0, 0.26, 0);
  mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 12), MAT.woodDark, nest, 0, 0.03, 0);
  const rim = mesh(new THREE.TorusGeometry(0.5, 0.05, 5, 18), MAT.woodDark, nest, 0, 0.52, 0);
  rim.rotation.x = Math.PI / 2;
  const band = mesh(new THREE.TorusGeometry(0.45, 0.03, 4, 18), MAT.woodDark, nest, 0, 0.2, 0);
  band.rotation.x = Math.PI / 2;
  const STAFF_H = 1.75, STAFF_Z = -0.47;
  mesh(new THREE.CylinderGeometry(0.028, 0.034, STAFF_H, 5), MAT.woodDark, nest, 0, STAFF_H / 2, STAFF_Z);

  /* ---------- the lookout ---------- */
  const body = new THREE.Group(); root.add(body);     /* turns to face things */
  const guy = new THREE.Group(); body.add(guy);       /* bobs, hops, climbs in and out */
  guy.position.z = 0.06;
  mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.72, 8), MAT.navy, guy, 0, 0.4, 0);
  for (const y of [0.56, 0.66]) mesh(new THREE.BoxGeometry(0.045, 0.045, 0.03), MAT.yellow, guy, 0, y, 0.205, false);
  const scarf = mesh(new THREE.ConeGeometry(0.13, 0.16, 6), MAT.red, guy, 0, 0.74, 0.1, false);
  scarf.rotation.x = Math.PI;

  const head = new THREE.Group(); head.position.y = 0.95; guy.add(head);
  mesh(new THREE.IcosahedronGeometry(0.2, 1), SKIN, head);
  for (const x of [-0.07, 0.07]) mesh(new THREE.BoxGeometry(0.04, 0.05, 0.02), MAT.dark, head, x, 0.03, 0.185, false);
  mesh(new THREE.IcosahedronGeometry(0.045, 0), SKIN, head, 0, -0.02, 0.2, false);
  const beard = mesh(new THREE.IcosahedronGeometry(0.17, 0), MAT.cream, head, 0, -0.1, 0.07, false);
  beard.scale.set(1.05, 0.85, 0.85);
  /* captain's cap: white crown, navy band, black peak, gold badge */
  const cap = new THREE.Group(); cap.position.y = 0.16; cap.rotation.x = -0.12; head.add(cap);
  mesh(new THREE.CylinderGeometry(0.21, 0.18, 0.13, 10), MAT.cream, cap, 0, 0.06, 0);
  mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 10), MAT.navy, cap, 0, -0.01, 0, false);
  const peak = mesh(new THREE.BoxGeometry(0.26, 0.025, 0.13), MAT.dark, cap, 0, -0.03, 0.18, false);
  peak.rotation.x = 0.28;
  mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), MAT.yellow, cap, 0, 0.05, 0.2, false);

  function arm(side) {
    const pivot = new THREE.Group(); pivot.position.set(0.25 * side, 0.7, 0); guy.add(pivot);
    mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.42, 6), MAT.navy, pivot, 0, -0.21, 0);
    mesh(new THREE.IcosahedronGeometry(0.068, 0), SKIN, pivot, 0, -0.44, 0, false);
    return pivot;
  }
  const armR = arm(-1), armL = arm(1);
  /* the spyglass lives in the left hand but always points where he's facing */
  const spyGeo = new THREE.CylinderGeometry(0.036, 0.028, 0.36, 8); spyGeo.translate(0, 0.1, 0);
  const spy = mesh(spyGeo, BRASS, armL, 0, -0.44, 0, false);
  mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.04, 8), BRASS, spy, 0, 0.27, 0, false);

  /* where speech bubbles hang from: just above the cap */
  const anchor = new THREE.Object3D(); anchor.position.y = 1.5; guy.add(anchor);

  /* ---------- behaviour ---------- */
  const flagHome = flag.position.clone();
  const flagUp = new THREE.Vector3(0, STAFF_H * SCALE, STAFF_Z * SCALE).add(mastTop);
  const s = {
    want: false,      /* should he be up? */
    up: 0,            /* 0 = tucked away, 1 = fully out (drives the pop-up sequence) */
    pose: 'rest', yaw: 0, yawTarget: 0,
    talk: false, hop: 0, t: 0
  };

  function update(dt, time, reduceMotion) {
    s.t += dt;
    const target = s.want ? 1 : 0;
    const speed = s.want ? 1.15 : 1.6;
    s.up = reduceMotion ? target : clamp(s.up + Math.sign(target - s.up) * dt * speed, 0, 1);
    if (s.up <= 0) { root.visible = false; flag.position.copy(flagHome); return; }
    root.visible = true;

    /* the nest swells into place first, then he pops up out of it */
    const nestK = easeOutBack(clamp(s.up / 0.55, 0, 1));
    const guyK = clamp((s.up - 0.35) / 0.65, 0, 1);
    root.scale.setScalar(Math.max(0.001, nestK) * SCALE);
    flag.position.lerpVectors(flagHome, flagUp, clamp(nestK, 0, 1));
    guy.position.y = lerp(-0.95, 0, easeOutBack(guyK));
    guy.visible = guyK > 0;

    const p = POSES[s.pose] || POSES.rest;
    const k = damp(7, dt);
    armR.rotation.x = lerp(armR.rotation.x, p.r[0], k);
    armL.rotation.x = lerp(armL.rotation.x, p.l[0], k);
    let rz = p.r[1], lz = p.l[1];
    if (s.pose === 'wave') rz += Math.sin(time * 9) * 0.38;
    if (s.pose === 'cheer') { rz += Math.sin(time * 11) * 0.2; lz -= Math.sin(time * 11) * 0.2; }
    armR.rotation.z = lerp(armR.rotation.z, rz, k);
    armL.rotation.z = lerp(armL.rotation.z, lz, k);
    spy.quaternion.copy(armL.quaternion).invert().multiply(Q_FWD);

    s.yaw = lerpAngle(s.yaw, s.yawTarget, damp(4, dt));
    body.rotation.y = s.yaw;

    /* chatter while talking, a hop of joy when cheering, a slow sway the rest of the time */
    head.rotation.x = s.talk && !reduceMotion ? Math.sin(time * 14) * 0.09 : lerp(head.rotation.x, 0, k);
    head.rotation.z = Math.sin(time * 1.3) * 0.05;
    if (s.pose === 'cheer' && !reduceMotion) s.hop = Math.abs(Math.sin(time * 6)) * 0.14;
    else s.hop = lerp(s.hop, 0, k);
    guy.position.y += s.hop;
    guy.rotation.z = Math.sin(time * 0.9) * 0.04;
  }

  return {
    anchor,
    get shown() { return s.up > 0.9 && s.want; },
    show() { s.want = true; },
    hide() { s.want = false; s.talk = false; },
    pose(name) { s.pose = name; },
    /** yaw relative to the boat's heading (0 = facing the bow) */
    face(yaw) { s.yawTarget = yaw; },
    talk(on) { s.talk = on; },
    update
  };
}
