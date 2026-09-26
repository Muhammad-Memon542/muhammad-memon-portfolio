/**
 * Fireworks and sparkles for the guided tour: rockets that climb on a trail of sparks and
 * burst into a shell of colour, plus smaller bursts when the tour reaches an island.
 *
 * Everything is one THREE.Points object over a fixed ring buffer, so it's a single draw
 * call however much is going on, and the program is compiled on the first frame (the
 * object is always in the scene, just empty) rather than hitching when the show starts.
 */
const MAX = 1400;
const GRAVITY = 7.5;

export function createFireworks(scene) {
  const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3);
  const alpha = new Float32Array(MAX), size = new Float32Array(MAX);
  const vel = new Float32Array(MAX * 3), life = new Float32Array(MAX), span = new Float32Array(MAX), drag = new Float32Array(MAX);
  let head = 0, alive = 0;

  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const aAlpha = new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
  const aCol = new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
  const aSize = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos);
  geo.setAttribute('aAlpha', aAlpha);
  geo.setAttribute('aColor', aCol);
  geo.setAttribute('aSize', aSize);

  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 } },   /* half the drawing buffer's height, set by resize() */
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aAlpha; attribute float aSize; attribute vec3 aColor;
      uniform float uScale; varying float vA; varying vec3 vC;
      void main(){ vA = aAlpha; vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * projectionMatrix[1][1] * uScale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
    /* a white-hot core fading into the spark's colour */
    fragmentShader: `varying float vA; varying vec3 vC;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5 || vA <= 0.0) discard;
        float core = smoothstep(0.22, 0.0, d); float glow = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(mix(vC, vec3(1.0), core * 0.7), vA * glow); }`
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;
  scene.add(points);

  const tmp = new THREE.Color();
  function spawn(x, y, z, vx, vy, vz, color, sz, lifeSpan, dr) {
    const i = head; head = (head + 1) % MAX;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    tmp.set(color); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    size[i] = sz; life[i] = 0; span[i] = lifeSpan; drag[i] = dr; alpha[i] = 1;
    alive = Math.min(MAX, alive + 1);
  }

  /** a spherical shell of sparks */
  function burst(x, y, z, colors, { count = 140, speed = 16, size: sz = 1.1, span: sp = 1.7 } = {}) {
    for (let n = 0; n < count; n++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const v = speed * (0.75 + Math.random() * 0.25);
      spawn(x, y, z, Math.cos(th) * r * v, u * v, Math.sin(th) * r * v,
        colors[n % colors.length], sz * (0.7 + Math.random() * 0.6), sp * (0.7 + Math.random() * 0.5), 1.4);
    }
  }

  /* rockets in flight: they leave a trail every frame and burst at the top */
  const rockets = [];
  function launch(from, to, colors, opts = {}) {
    rockets.push({ x: from.x, y: from.y, z: from.z, from, to, t: 0, dur: opts.dur || 0.9, colors, opts });
  }

  function update(dt) {
    for (let r = rockets.length - 1; r >= 0; r--) {
      const k = rockets[r];
      k.t += dt;
      const e = Math.min(1, k.t / k.dur), ease = 1 - (1 - e) * (1 - e);
      k.x = k.from.x + (k.to.x - k.from.x) * ease;
      k.y = k.from.y + (k.to.y - k.from.y) * ease;
      k.z = k.from.z + (k.to.z - k.from.z) * ease;
      for (let n = 0; n < 3; n++) {
        spawn(k.x, k.y, k.z, (Math.random() - 0.5) * 1.5, -1 - Math.random() * 2, (Math.random() - 0.5) * 1.5,
          0xffe2a8, 0.55, 0.45 + Math.random() * 0.3, 3);
      }
      if (e >= 1) { burst(k.x, k.y, k.z, k.colors, k.opts); rockets.splice(r, 1); }
    }
    if (!alive) return;
    let live = 0;
    for (let i = 0; i < MAX; i++) {
      if (alpha[i] <= 0) continue;
      life[i] += dt;
      const t = life[i] / span[i];
      if (t >= 1) { alpha[i] = 0; continue; }
      live++;
      const f = Math.exp(-drag[i] * dt);
      vel[i * 3] *= f; vel[i * 3 + 1] = vel[i * 3 + 1] * f - GRAVITY * dt; vel[i * 3 + 2] *= f;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      /* fade out, with a crackle of twinkle near the end */
      alpha[i] = Math.pow(1 - t, 1.4) * (t > 0.6 ? 0.55 + 0.45 * Math.sin(life[i] * 40 + i) : 1);
    }
    alive = live;
    aPos.needsUpdate = aAlpha.needsUpdate = aCol.needsUpdate = aSize.needsUpdate = true;
  }

  return {
    burst, launch, update,
    get busy() { return alive > 0 || rockets.length > 0; },
    /** keep sparks the same world size at any resolution: pass the drawing buffer height */
    resize(bufferHeight) { mat.uniforms.uScale.value = bufferHeight / 2; },
    /** additive sparks vanish against a daytime sky, so switch to normal blending by day */
    setNight(night) { mat.blending = night ? THREE.AdditiveBlending : THREE.NormalBlending; }
  };
}
