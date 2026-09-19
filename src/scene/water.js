/**
 * The ocean surface.
 *
 * A standard Three.js material with its shader patched via `onBeforeCompile`: the
 * vertex stage displaces the plane by the shared wave function (so the surface agrees
 * with the boat and floating props), and the fragment stage adds depth-based colour,
 * shoreline foam, a sky reflection and sun glints.
 *
 * The island positions arrive as a uniform array so the water knows where to shallow
 * out and break into foam.
 */
import { WAVE_GLSL } from '../utils.js';

const WATER_FRAG_PARS = `
uniform float uTime, uGlint, uFresnel, uFoamK;
uniform vec3 uDeep, uShallow, uCrest, uFoam, uGlintCol, uSkyTop, uSkyHor, uSunDir;
uniform vec3 uIsl[N_ISL];
varying vec3 vWPos;
float wHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float wNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x), f.y); }`;
const WATER_COLOR = `
  float dC = 1e5;
  for (int i = 0; i < N_ISL; i++) dC = min(dC, length(vWPos.xz - uIsl[i].xy) - uIsl[i].z);
  float wave = vWPos.y;
  float shallow = 1.0 - smoothstep(0.0, 17.0, dC); shallow *= shallow;
  vec3 wcol = mix(uDeep, uShallow, shallow);
  wcol *= 1.0 - 0.1 * smoothstep(9.0, 15.0, dC) * (1.0 - smoothstep(15.0, 24.0, dC));   /* darker drop-off where the shallows end */
  #ifndef CHEAP_WATER
  wcol *= 0.95 + 0.1 * wNoise(vWPos.xz * 0.016 + uTime * 0.015);
  #endif
  wcol = mix(wcol, uCrest, smoothstep(0.6, 1.45, wave) * 0.35);
  wcol *= 1.0 - (1.0 - smoothstep(-1.4, -0.3, wave)) * 0.18;
  float fn = wNoise(vWPos.xz * 0.45 + vec2(uTime * 0.2, -uTime * 0.12));
  float foam = 1.0 - smoothstep(0.1, 0.4, dC - fn * 1.3);
  float lap = fract(dC * 0.2 + uTime * 0.28);   /* swell rolls in toward the shore */
  float ring = smoothstep(0.0, 0.05, lap) * (1.0 - smoothstep(0.1, 0.2, lap));
  foam = max(foam, ring * (1.0 - smoothstep(1.0, 9.0, dC)) * smoothstep(0.35, 0.6, fn) * 0.6);
  foam *= uFoamK;
  diffuseColor.rgb = mix(wcol, uFoam, foam);`;
/* tilt each facet's lighting normal a little more than the geometry does, so the low-poly facets read clearly */
const WATER_NORMAL = `
  vec3 fN = inverseTransformDirection(normal, viewMatrix);
  fN = normalize(vec3(fN.x * 2.3, fN.y, fN.z * 2.3));
  normal = normalize((viewMatrix * vec4(fN, 0.0)).xyz);`;
const WATER_OUT = `
  vec3 wN = fN;
  vec3 wV = normalize(cameraPosition - vWPos);
  float fres = pow(1.0 - clamp(dot(wN, wV), 0.0, 1.0), 5.0);
  vec3 wR = reflect(-wV, wN);
  vec3 skyRefl = mix(uSkyHor, uSkyTop, pow(clamp(wR.y, 0.0, 1.0), 0.6));
  vec3 wOut = mix(outgoingLight, skyRefl, clamp(fres * uFresnel, 0.0, 1.0) * (1.0 - foam));
  #ifdef CHEAP_WATER
  /* phones skip the sun sparkle: several hashes and a pow() on every water pixel */
  gl_FragColor = vec4(wOut, diffuseColor.a);
  #else
  vec2 sp = vWPos.xz * 2.6;
  vec2 cell = floor(sp);
  float tw = fract(wHash(cell) + uTime * (0.5 + wHash(cell + 7.0)));
  float dot_ = 1.0 - smoothstep(0.08, 0.3, length(fract(sp) - 0.5));
  float sparkle = step(0.86, wHash(cell + 3.1)) * dot_ * smoothstep(0.0, 0.2, tw) * (1.0 - smoothstep(0.2, 0.55, tw));
  float glint = pow(max(dot(wR, uSunDir), 0.0), 70.0) * sparkle * uGlint * (1.0 - foam);
  gl_FragColor = vec4(wOut + uGlintCol * glint, diffuseColor.a);
  #endif`;

/**
 * Build the water mesh.
 *
 * @param {object}  options
 * @param {object}  options.skyUniforms  shared sky colour uniforms, reused for reflections
 * @param {number}  options.islandCount  size of the island uniform array
 * @param {number}  options.segments     plane subdivision (fewer = cheaper vertices)
 * @param {boolean} options.cheap        skip the per-pixel sparkle and colour noise
 * @returns {{mesh: THREE.Mesh, uniforms: object, step: number}} `step` is the lattice
 *   spacing the caller snaps the mesh to, so the water appears to stay still as it follows the boat.
 */
export function createWater({ skyUniforms, islandCount, segments = 256, cheap = false }) {
  const N_ISL = islandCount;
  const waterU = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() }, uCrest: { value: new THREE.Color() },
    uFoam: { value: new THREE.Color() }, uGlintCol: { value: new THREE.Color() },
    uSkyTop: skyUniforms.uTop, uSkyHor: skyUniforms.uHor,
    uSunDir: { value: new THREE.Vector3(-90, 110, 70).normalize() },
    uGlint: { value: 1 }, uFresnel: { value: 0.5 }, uFoamK: { value: 1 },
    uIsl: { value: Array.from({ length: N_ISL }, () => new THREE.Vector3(0, 0, -999)) }
  };
  const WATER_SIZE = 900, WATER_SEGS = segments, WSTEP = WATER_SIZE / WATER_SEGS;
  const waterGeo = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGS, WATER_SEGS);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.62, metalness: 0 });
  waterMat.defines = cheap ? { N_ISL, CHEAP_WATER: '' } : { N_ISL };
  waterMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, waterU);
    shader.vertexShader = WAVE_GLSL + `
  varying vec3 vWPos;
  vec2 latticeJitter(vec2 w){
    vec2 k = floor(w / ${WSTEP.toFixed(6)} + 0.5);
    vec2 h = fract(sin(vec2(dot(k, vec2(127.1, 311.7)), dot(k, vec2(269.5, 183.3)))) * 43758.5453);
    return (h - 0.5) * ${(WSTEP * 0.62).toFixed(6)};
  }
  ` + shader.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
   vec4 wPosW = modelMatrix * vec4(position, 1.0);
   vec2 jit = latticeJitter(wPosW.xz);
   wPosW.xz += jit; transformed.xz += jit;
   float wH = waveH(wPosW.xz, uTime);
   transformed.y += wH;
   vWPos = vec3(wPosW.x, wPosW.y + wH, wPosW.z);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + WATER_FRAG_PARS)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + WATER_COLOR)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + WATER_NORMAL)
      .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', WATER_OUT);
  };

  const water = new THREE.Mesh(waterGeo, waterMat);
  water.receiveShadow = true;
  water.frustumCulled = false;

  return { mesh: water, uniforms: waterU, step: WSTEP };
}
