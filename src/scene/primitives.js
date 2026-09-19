/**
 * Low-level scene primitives: shared materials, unit geometries, and the helpers
 * used to build every island, monument and prop.
 *
 * Nothing here touches app state — these are pure factories over the global `THREE`
 * (loaded as a classic script before the modules run; see index.html).
 */

/* ---------- materials + shared geometry ---------- */
export const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.92, metalness: 0 }, o));
export const MAT = {
  sand: M(0xe7cd98), grass: M(0x8ab65e), grass2: M(0x78a553),
  leaf: M(0x5e9446), leaf2: M(0x7fb356), leaf3: M(0x4b8248), trunk: M(0x7a5236),
  rock: M(0x8e8b85), rock2: M(0xa7a39a),
  wood: M(0xb07a4f), woodDark: M(0x6b4830), cream: M(0xf3ede1), red: M(0xd7263d), navy: M(0x1d3b56),
  stone: M(0xbab4a8), metal: M(0xb4bcc4, { roughness: 0.45, metalness: 0.45 }), dark: M(0x283039), yellow: M(0xf5c518),
  gull: M(0xdfe4e8), flowerA: M(0xf5c518), flowerB: M(0xef6f6c), flowerC: M(0xffffff),
  window: M(0x3b2f27, { emissive: 0xffbf5e, emissiveIntensity: 0 }),
  lantern: M(0xfff4cf, { emissive: 0xffd27a, emissiveIntensity: 0.4 }),
  redLight: M(0xff3b4e, { emissive: 0xff2238, emissiveIntensity: 1 }),
  glass: M(0x86dcb0, { transparent: true, opacity: 0.72, roughness: 0.15, metalness: 0.1, emissive: 0x1f6d4c, emissiveIntensity: 0.35 }),
  cloud: M(0xffffff, { roughness: 1 }),
  sail: M(0xf7f2e8, { side: THREE.DoubleSide })
};
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  trunk: new THREE.CylinderGeometry(0.16, 0.26, 1, 5),
  cone: new THREE.ConeGeometry(1, 1, 6),
  ico: new THREE.IcosahedronGeometry(1, 0),
  dodeca: new THREE.DodecahedronGeometry(1, 0)
};

/* bake transformed copies of geometry */
export const scratch = new THREE.Object3D();
export function xf(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  scratch.position.set(x, y, z); scratch.rotation.set(rx, ry, rz); scratch.scale.set(sx, sy, sz); scratch.updateMatrix();
  g.applyMatrix4(scratch.matrix);
  return g;
}
/* merge many static pieces into one mesh per material (keeps draw calls low) */
export class Batch {
  constructor() { this.buckets = new Map(); }
  add(mat, geo, matrix) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (matrix) g.applyMatrix4(matrix);
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(g);
  }
  build(parent, cast = true, receive = true) {
    for (const [mat, geos] of this.buckets) {
      let n = 0; for (const g of geos) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
      let o = 0;
      for (const g of geos) {
        pos.set(g.attributes.position.array, o * 3);
        if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
        o += g.attributes.position.count;
        g.dispose();
      }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      bg.computeBoundingSphere();
      const m = new THREE.Mesh(bg, mat); m.castShadow = cast; m.receiveShadow = receive;
      parent.add(m);
    }
    this.buckets.clear();
  }
}
export function jitter(geo, amt, rnd) {
  const p = geo.attributes.position, seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let off = seen.get(key);
    if (!off) { off = [(rnd() - 0.5) * amt, (rnd() - 0.5) * amt * 0.5, (rnd() - 0.5) * amt]; seen.set(key, off); }
    p.setXYZ(i, x + off[0], y + off[1], z + off[2]);
  }
  geo.computeVertexNormals();
  return geo;
}
export function mesh(geo, mat, parent, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true;
  parent.add(m); return m;
}
const _up = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _dir = new THREE.Vector3(), _scl = new THREE.Vector3(), _mid = new THREE.Vector3();
export function strut(b, mat, a, c, rad) {
  _dir.subVectors(c, a); const len = _dir.length(); _dir.normalize();
  _q.setFromUnitVectors(_up, _dir);
  _m4.compose(_mid.addVectors(a, c).multiplyScalar(0.5), _q, _scl.set(rad, len, rad));
  b.add(mat, GEO.cyl6.toNonIndexed(), _m4);
}
