/**
 * Island monuments: the landmark that gives each island its silhouette.
 *
 * Every builder receives the island's group, its content definition and a seeded RNG,
 * and adds meshes to that group. Anything that needs to move each frame registers a
 * callback on `animators` rather than driving its own loop.
 */
import { M, MAT, GEO, Batch, mesh, scratch, strut, xf } from './primitives.js';
import { lerp } from '../utils.js';

export function addTree(b, x, y, z, rnd) {
  const s = 0.8 + rnd() * 0.5;
  scratch.position.set(x, y, z); scratch.rotation.set(0, rnd() * 6.28, 0); scratch.scale.set(s, s, s); scratch.updateMatrix();
  const base = scratch.matrix.clone();
  const leaf = [MAT.leaf, MAT.leaf2, MAT.leaf3][Math.floor(rnd() * 3)];
  if (rnd() < 0.55) {
    const h = 2.2 + rnd() * 1.4;
    b.add(MAT.trunk, xf(GEO.trunk, 0, 0.5, 0), base);
    b.add(leaf, xf(GEO.cone, 0, 1 + h * 0.45, 0, 0, 0, 0, 1.35, h, 1.35), base);
    b.add(leaf, xf(GEO.cone, 0, 1 + h * 0.95, 0, 0, 0.5, 0, 0.95, h * 0.7, 0.95), base);
  } else {
    const r = 1.1 + rnd() * 0.5;
    b.add(MAT.trunk, xf(GEO.trunk, 0, 0.8, 0, 0, 0, 0, 1, 1.6, 1), base);
    b.add(leaf, xf(GEO.ico, 0, 1.6 + r * 0.7, 0, rnd(), rnd(), 0, r), base);
    if (rnd() < 0.6) b.add(leaf, xf(GEO.ico, r * 0.65, 1.4 + r * 0.45, 0.2, rnd(), rnd(), 0, r * 0.6), base);
  }
}

/**
 * Create the monument builders, keyed by `island.kind`.
 *
 * @param {object}   deps
 * @param {Array<Function>} deps.animators     per-frame callbacks, invoked with (time, dt)
 * @param {THREE.Material}  deps.beamMaterial  shared additive material for the lighthouse beams
 * @param {Function}        deps.onLantern     called with the lighthouse's point light, so the
 *                                             day/night palette can dim it
 * @returns {Record<string, (group: THREE.Group, def: object, rnd: Function) => void>}
 */
export function createMonumentBuilders({ animators, beamMaterial, onLantern }) {
  return {
    lighthouse(g) {
      mesh(new THREE.CylinderGeometry(2.7, 3.1, 1.2, 10), MAT.stone, g, 0, 0.6, 0);
      let y = 1.2;
      for (let i = 0; i < 5; i++) {
        const r0 = 2.25 - i * 0.22;
        mesh(new THREE.CylinderGeometry(r0 - 0.22, r0, 2.2, 14), i % 2 ? MAT.cream : MAT.red, g, 0, y + 1.1, 0);
        y += 2.2;
      }
      mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.3, 14), MAT.dark, g, 0, y + 0.15, 0); y += 0.3;
      mesh(new THREE.CylinderGeometry(0.98, 0.98, 1.6, 8), MAT.lantern, g, 0, y + 0.8, 0, false);
      mesh(new THREE.ConeGeometry(1.4, 1.5, 8), MAT.red, g, 0, y + 2.35, 0);
      mesh(new THREE.SphereGeometry(0.22, 6, 4), MAT.dark, g, 0, y + 3.2, 0);
      const pivot = new THREE.Group(); pivot.position.y = y + 0.8; g.add(pivot);
      const beamGeo = new THREE.ConeGeometry(4.5, 48, 24, 1, true);
      beamGeo.translate(0, -24, 0); beamGeo.rotateZ(Math.PI / 2);
      for (const ry of [0, Math.PI]) { const bm = new THREE.Mesh(beamGeo, beamMaterial); bm.rotation.set(0, ry, -0.06); pivot.add(bm); }
      const lantern = new THREE.PointLight(0xffd27a, 0, 80, 1.6);
      lantern.position.y = y + 0.8;
      g.add(lantern);
      onLantern(lantern);
      animators.push(t => { pivot.rotation.y = t * 0.7; });
    },
    cabin(g) {
      mesh(GEO.box, MAT.wood, g, 0, 1.6, 0).scale.set(5.2, 3.2, 4.2);
      const roofGeo = new THREE.CylinderGeometry(3, 3, 5.9, 3); roofGeo.rotateZ(Math.PI / 2); roofGeo.rotateX(-Math.PI / 2);
      mesh(roofGeo, MAT.red, g, 0, 4.13, 0).scale.set(1, 0.62, 1.08);
      mesh(GEO.box, MAT.woodDark, g, 0, 0.95, 2.12).scale.set(1.1, 1.9, 0.1);
      for (const x of [-1.6, 1.6]) mesh(GEO.box, MAT.window, g, x, 1.9, 2.12).scale.set(0.9, 0.8, 0.1);
      mesh(GEO.box, MAT.window, g, 2.62, 1.9, 0).scale.set(0.1, 0.8, 1.1);
      mesh(GEO.box, MAT.stone, g, 1.5, 4.4, -0.6).scale.set(0.7, 1.8, 0.7);
      mesh(GEO.box, MAT.wood, g, 0, 0.3, 2.9).scale.set(3.2, 0.25, 1.4);
      const puffs = [];
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(GEO.ico, new THREE.MeshStandardMaterial({ color: 0xe9eef0, flatShading: true, transparent: true, opacity: 0.6, depthWrite: false }));
        g.add(m); puffs.push(m);
      }
      animators.push(t => {
        puffs.forEach((m, i) => {
          const p = (t * 0.28 + i / 6) % 1;
          m.position.set(1.5 + p * 1.8, 5.3 + p * 6, -0.6 + p * 0.6);
          m.scale.setScalar(0.35 + p * 1.1);
          m.rotation.set(p * 3, p * 2, 0);
          m.material.opacity = 0.65 * (1 - p);
        });
      });
    },
    crystal(g, def) {
      const c = new THREE.Color(def.color);
      mesh(new THREE.CylinderGeometry(1.8, 2.3, 1.2, 6), MAT.stone, g, 0, 0.6, 0);
      const mat = M(c, { emissive: c, emissiveIntensity: 0.28, roughness: 0.35 });
      const gem = mesh(new THREE.OctahedronGeometry(2.4, 0), mat, g, 0, 6.5, 0); gem.scale.set(1, 1.55, 1);
      const sats = [0, 1, 2].map(() => mesh(new THREE.OctahedronGeometry(0.55, 0), mat, g, 0, 6.5, 0));
      animators.push(t => {
        gem.rotation.y = t * 0.6; gem.position.y = 6.5 + Math.sin(t * 1.3) * 0.45;
        sats.forEach((s, i) => { const a = t * 0.9 + i * 2.094; s.position.set(Math.cos(a) * 3.8, 6.5 + Math.sin(t * 1.7 + i) * 0.8, Math.sin(a) * 3.8); s.rotation.y = t * 2; });
      });
    },
    knot(g, def) {
      const c = new THREE.Color(def.color);
      mesh(new THREE.CylinderGeometry(1.2, 1.7, 2.4, 8), MAT.stone, g, 0, 1.2, 0);
      const k = mesh(new THREE.TorusKnotGeometry(2.1, 0.62, 90, 8, 2, 3), M(c, { emissive: c, emissiveIntensity: 0.22, roughness: 0.4 }), g, 0, 7, 0);
      animators.push(t => { k.rotation.set(t * 0.35, t * 0.5, 0); k.position.y = 7 + Math.sin(t * 1.1) * 0.4; });
    },
    stack(g, def) {
      const base = new THREE.Color(def.color), cubes = [];
      let y = 0.1;
      for (let i = 0; i < 5; i++) {
        const s = 2.6 - i * 0.35;
        const m = mesh(GEO.box, M(base.clone().offsetHSL(0, 0, (i - 2) * 0.06), { roughness: 0.6 }), g, 0, y + s / 2, 0);
        m.scale.setScalar(s); cubes.push(m); y += s;
      }
      animators.push(t => { cubes.forEach((m, i) => { m.rotation.y = Math.sin(t * 0.6 + i * 0.7) * 0.6 + i * 0.25; m.position.x = Math.sin(t * 0.9 + i) * 0.12 * i; }); });
    },
    observatory(g) {
      mesh(new THREE.CylinderGeometry(3, 3.2, 3.2, 14), MAT.cream, g, 0, 1.6, 0);
      mesh(GEO.box, MAT.navy, g, 0, 1.0, 3.08).scale.set(1.2, 2, 0.15);
      const dome = new THREE.Group(); dome.position.y = 3.2; g.add(dome);
      mesh(new THREE.SphereGeometry(3.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.metal, dome);
      mesh(new THREE.CylinderGeometry(0.38, 0.55, 4.2, 8), MAT.navy, dome, 0, 2.2, 1.4).rotation.x = 0.7;
      animators.push(t => { dome.rotation.y = t * 0.15; });
    },
    logbook(g, def) {
      const S = new THREE.Group(); S.scale.setScalar(1.35); g.add(S);
      const cover = M(new THREE.Color(def.color), { roughness: 0.75 });
      mesh(new THREE.CylinderGeometry(2.1, 2.5, 1.1, 8), MAT.stone, S, 0, 0.55, 0);
      mesh(GEO.box, MAT.woodDark, S, 0, 2.55, 0).scale.set(0.8, 3, 0.8);
      const book = new THREE.Group(); book.position.set(0, 4.3, 0); book.rotation.x = 0.42; S.add(book);
      mesh(GEO.box, MAT.woodDark, book, 0, -0.2, 0).scale.set(4.4, 0.22, 3.2);
      for (const side of [-1, 1]) {
        const pv = new THREE.Group(); pv.rotation.z = side * 0.13; book.add(pv);
        const b = new Batch();
        b.add(cover, xf(GEO.box, side * 1.6, 0.05, 0, 0, 0, 0, 3.25, 0.16, 4.5));
        b.add(MAT.cream, xf(GEO.box, side * 1.52, 0.27, 0, 0, 0, 0, 3.0, 0.3, 4.2));
        for (let i = 0; i < 7; i++) {
          const w = i === 0 ? 1.2 : (i % 3 === 2 ? 1.5 : 2.3), z = -1.6 + i * 0.52;
          b.add(MAT.navy, xf(GEO.box, side * (0.35 + w / 2), 0.43, z, 0, 0, 0, w, 0.03, 0.13));
        }
        b.build(pv, true, true);
      }
      const ribbon = mesh(GEO.box, MAT.red, book, 0.15, 0.3, 2.55, false); ribbon.scale.set(0.2, 0.03, 1.1); ribbon.rotation.x = 0.9;
      const turn = new THREE.Group(); turn.position.y = 0.46; book.add(turn);
      const leaf = mesh(GEO.box, MAT.cream, turn, 1.5, 0, 0); leaf.scale.set(2.95, 0.04, 4.1); leaf.visible = false;
      animators.push(t => {
        const p = (t % 5.5) / 5.5;
        if (p < 0.26) { const k = p / 0.26, e = k * k * (3 - 2 * k); turn.rotation.z = lerp(0.13, Math.PI - 0.13, e); leaf.visible = true; }
        else leaf.visible = false;
      });
    },
    tower(g) {
      const b = new Batch(), H = 15, R0 = 1.9, R1 = 0.35, L = 6;
      const leg = (i, h) => { const a = i * 2.094 + 0.5, rr = lerp(R0, R1, h / H); return new THREE.Vector3(Math.cos(a) * rr, h, Math.sin(a) * rr); };
      for (let i = 0; i < 3; i++) strut(b, MAT.cream, leg(i, 0), leg(i, H), 0.13);
      for (let k = 0; k <= L; k++) {
        const h = k * H / L;
        for (let i = 0; i < 3; i++) {
          strut(b, MAT.red, leg(i, h), leg((i + 1) % 3, h), 0.07);
          if (k < L) strut(b, MAT.cream, leg(i, h), leg((i + 1) % 3, h + H / L), 0.05);
        }
      }
      strut(b, MAT.dark, new THREE.Vector3(0, H, 0), new THREE.Vector3(0, H + 3, 0), 0.06);
      b.build(g);
      mesh(new THREE.SphereGeometry(0.32, 8, 6), MAT.redLight, g, 0, H + 3.2, 0, false);
      mesh(GEO.box, MAT.cream, g, 3.1, 1.1, 0.8).scale.set(2.4, 2.2, 2.2);
      mesh(GEO.box, MAT.red, g, 3.1, 2.35, 0.8).scale.set(2.7, 0.3, 2.5);
      const rings = [0, 1, 2].map(() => {
        const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 6, 40), new THREE.MeshBasicMaterial({ color: 0xf5c518, transparent: true, depthWrite: false }));
        m.rotation.x = Math.PI / 2; m.position.y = H + 3.2; g.add(m); return m;
      });
      animators.push(t => {
        MAT.redLight.emissiveIntensity = Math.sin(t * 3) > 0.2 ? 1.3 : 0.25;
        rings.forEach((m, i) => { const p = (t * 0.35 + i / 3) % 1; m.scale.setScalar(0.5 + p * 9); m.material.opacity = 0.75 * (1 - p); });
      });
    }
  };
}
