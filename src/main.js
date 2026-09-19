/**
 * Archipelago portfolio - application entry point.
 *
 * A low-poly 3D archipelago you sail through to explore the portfolio. This module
 * owns the whole runtime: the Three.js scene, the boat physics and autopilot, the
 * overlay UI (dock, side panel, resume, plain-text fallback) and the parchment map.
 *
 * Three.js r128 is loaded as a classic script before this module and exposes the
 * global `THREE` (see index.html).
 *
 * Related modules:
 *   content.js        all editable copy
 *   utils.js          pure math, seeded RNG, the shared wave function
 *   scene/primitives  materials, unit geometry, mesh + batching helpers
 *   scene/water       the custom water shader
 *   scene/monuments   per-island landmarks
 *   scene/palette     day / dusk / night colour stops
 */
import { CONTENT } from './content.js';
import {
  mulberry32, hashStr, clamp, lerp, damp, angDiff, lerpAngle, waveH, isExt, findOpenWater,
} from './utils.js';
import { MAT, GEO, Batch, jitter, mesh, xf } from './scene/primitives.js';
import { createWater } from './scene/water.js';
import { addTree, createMonumentBuilders } from './scene/monuments.js';
import { PALETTE, SKY_COLS, SKY_NUMS } from './scene/palette.js';
import { createFlotsam, createShipwreck } from './scene/flotsam.js';
import { createWildlife } from './scene/wildlife.js';
import { detectQuality, measureViewport, onViewportChange } from './scene/quality.js';

(() => {
'use strict';

/* ---------- DOM ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const ui = {
  canvas: $('#scene'), labels: $('#labels'), intro: $('#intro'), start: $('#start'),
  plain: $('#plain'), plainBody: $('#plain-body'), plainClose: $('#plain-close'),
  panel: $('#panel'), panelBody: $('#panel-body'), panelClose: $('#panel-close'),
  dock: $('#dock'), dockTitle: $('#dock-title'), dockSub: $('#dock-sub'), dockFlag: $('#dock-flag'), dockBtn: $('#dock-btn'),
  toast: $('#toast'), statIslands: $('#stat-islands'), statBottles: $('#stat-bottles'),
  harbor: $('#harbor-btn'), hint: $('#hint'), joy: $('#joystick'), knob: $('#knob'),
  dockLabel: $('#dock-btn-label'), dockKbd: $('#dock-kbd'),
  scroll: $('#scroll'), scrollPaper: $('#scroll-paper'), scrollToggle: $('#scroll-toggle'), scrollToggleText: $('#scroll-toggle-text'), scrollTop: $('#scroll-top'), scrollBottom: $('#scroll-bottom'), smap: $('#smap'),
  resume: $('#resume'), resumeSheet: $('#resume-sheet'), resumeClose: $('#resume-close'), resumeDl: $('#resume-dl')
};
const hudEl = $('.hud');
if (hudEl) hudEl.inert = true;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- input mode ---------- */
/*
 * The on-screen wheel belongs only on a device actually being driven by touch, so a
 * computer never gets one. `(pointer: coarse)` alone isn't enough: a touchscreen laptop
 * can report a coarse primary pointer while sitting in front of someone with a mouse,
 * which is why we also require that no fine pointer exists at all.
 *
 * After that the mode follows real input, the way Bruno Simon's folio-2025 switches
 * between MODE_TOUCH and MODE_MOUSEKEYBOARD: touch the screen and the wheel appears,
 * reach for the mouse or keyboard and it goes away again. The `touch` class also swaps
 * the on-screen instructions between "steer with the wheel" and "sail with WASD".
 */
let touchMode = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
document.body.classList.toggle('touch', touchMode);

function setTouchMode(on) {
  if (on === touchMode) return;
  touchMode = on;
  document.body.classList.toggle('touch', on);
}
addEventListener('pointerdown', (e) => setTouchMode(e.pointerType === 'touch'), { capture: true, passive: true });
addEventListener('keydown', () => setTouchMode(false), { capture: true });

document.title = `${CONTENT.name}, ${CONTENT.role.toLowerCase()}`;
$$('[data-name]').forEach(el => { el.textContent = CONTENT.name; });
$$('[data-role]').forEach(el => { el.textContent = CONTENT.role; });
$$('[data-tagline]').forEach(el => { el.textContent = CONTENT.tagline; });

/* ---------- shared HTML builders (panel + plain page) ---------- */
const COVER_SVG = {
  crystal: '<polygon points="100,8 138,60 100,112 62,60" fill="currentColor"/><polygon points="62,60 138,60 100,112" fill="rgba(0,0,0,.14)"/>',
  knot: '<g fill="none" stroke="currentColor" stroke-width="9"><ellipse cx="100" cy="60" rx="48" ry="20"/><ellipse cx="100" cy="60" rx="48" ry="20" transform="rotate(60 100 60)"/><ellipse cx="100" cy="60" rx="48" ry="20" transform="rotate(-60 100 60)"/></g>',
  stack: '<g fill="currentColor"><rect x="66" y="78" width="68" height="34" rx="2"/><rect x="74" y="48" width="52" height="28" rx="2" transform="rotate(-7 100 62)"/><rect x="83" y="22" width="36" height="24" rx="2" transform="rotate(9 100 34)"/></g>'
};
const coverHTML = (d) => `<div class="cover" style="--c:${d.color}" aria-hidden="true"><svg viewBox="0 0 200 120">${d.cover || COVER_SVG[d.kind] || ''}</svg></div>`;
const metaHTML = (d) => d.meta ? `<dl class="meta">${d.meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : '';
const tagsHTML = (d) => d.tags ? `<ul class="tags">${d.tags.map(t => `<li>${t}</li>`).join('')}</ul>` : '';
function linksHTML(d) {
  const parts = (d.links || []).map((l, i) =>
    `<a class="btn ${i === 0 ? 'btn-primary' : 'btn-outline'}" href="${l.href}"${isExt(l.href) ? ' target="_blank" rel="noopener"' : ''}>${l.label}</a>`);
  if ((d.actions || []).includes('resume')) {
    parts.push(`<button class="btn ${parts.length ? 'btn-outline' : 'btn-primary'}" type="button" data-open-resume>Open resume</button>`);
  }
  return parts.length ? `<div class="links">${parts.join('')}</div>` : '';
}

function panelHTML(d) {
  return `<div class="pc" style="--c:${d.color}">
    <div class="pc-head"><span class="pennant"></span><div><h2 id="panel-title">${d.title}</h2><p class="sub">${d.sub}</p></div></div>
    ${d.section === 'work' ? coverHTML(d) : ''}
    <p class="lede">${d.summary}</p>
    ${metaHTML(d)}
    <div class="prose">${d.body || ''}</div>
    ${tagsHTML(d)}${linksHTML(d)}
  </div>`;
}

function buildPlain(notice) {
  const sec = (s) => CONTENT.islands.filter(i => i.section === s);
  const home = sec('home')[0], about = sec('about')[0], lab = sec('lab')[0], contact = sec('contact')[0], res = sec('resume')[0];
  const block = (h, d) => d ? `<section class="p-sec"><h2>${h}</h2><p class="lede">${d.summary}</p>${metaHTML(d)}<div class="prose">${d.body || ''}</div>${tagsHTML(d)}${linksHTML(d)}</section>` : '';
  ui.plainBody.innerHTML = `
    ${notice ? `<p class="notice">${notice}</p>` : ''}
    <header class="p-head"><h1>${CONTENT.name}</h1><p class="p-role">${CONTENT.role}</p>${home ? `<p class="lede">${home.summary}</p>` : ''}</header>
    ${block('Resume', res)}
    ${block('About', about)}
    <section class="p-sec"><h2>Projects and work</h2>
      ${sec('work').map(w => `<article class="p-work" style="--c:${w.color}">${coverHTML(w)}<div>
        <h3>${w.title}</h3><p class="sub">${w.sub}</p><p class="lede">${w.summary}</p>${metaHTML(w)}<div class="prose">${w.body}</div>${linksHTML(w)}</div></article>`).join('')}
    </section>
    ${block(lab ? (lab.heading || 'Experiments') : '', lab)}
    ${block('Contact', contact)}`;
}

/* ---------- state + UI actions ---------- */
const state = { mode: 'intro', panel: null, plain: false, resume: false, near: null, auto: null, visited: new Set(), bottles: 0, camBlend: 0, lastEdgeToast: -99, shake: 0, dead: false };
const back = { panel: null, plain: null, resume: null };
function restoreFocus(el) {
  if (el && el !== document.body && document.contains(el) && el.getClientRects().length && !el.closest('[aria-hidden="true"]')) el.focus({ preventScroll: true });
}
let islands = [];

const toastQ = []; let toastBusy = false;
function toast(html, ms = 4200) { toastQ.push([html, ms]); if (!toastBusy) nextToast(); }
function nextToast() {
  const it = toastQ.shift();
  if (!it) { toastBusy = false; return; }
  toastBusy = true;
  ui.toast.innerHTML = it[0];
  ui.toast.classList.add('show');
  setTimeout(() => { ui.toast.classList.remove('show'); setTimeout(nextToast, 350); }, it[1]);
}
function updateStats() {
  ui.statIslands.textContent = `${state.visited.size}/${CONTENT.islands.length}`;
  ui.statBottles.textContent = `${state.bottles}/${CONTENT.bottles.length}`;
}
function markVisited(isl) {
  if (state.visited.has(isl.def.id)) return;
  state.visited.add(isl.def.id);
  if (isl.el) isl.el.classList.add('visited');
  updateStats();
  if (islands.length) syncMapMarks();
  if (state.visited.size === CONTENT.islands.length) toast(`<strong>Every island visited</strong>${CONTENT.allIslands}`, 5200);
}
function openPanel(isl) {
  if (!isl) return;
  if (state.auto) cancelCourse();
  if (isl.def.section === 'resume') { closePanel(); markVisited(isl); openResume(); return; }
  if (!state.panel) back.panel = document.activeElement;
  state.panel = isl;
  ui.panelBody.innerHTML = panelHTML(isl.def);
  ui.panel.classList.add('open');
  ui.panel.setAttribute('aria-hidden', 'false');
  document.body.classList.add('panel-open');
  ui.panel.scrollTop = 0;
  ui.panel.focus({ preventScroll: true });
  ui.hint.classList.remove('show');
  markVisited(isl);
}
function closePanel() {
  if (!state.panel) return;
  state.panel = null;
  ui.panel.classList.remove('open');
  ui.panel.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('panel-open');
  if (document.activeElement && ui.panel.contains(document.activeElement)) document.activeElement.blur();
  restoreFocus(back.panel); back.panel = null;
}
function openPlain() {
  if (!state.plain) back.plain = document.activeElement;
  state.plain = true;
  ui.plain.classList.add('open');
  ui.plain.setAttribute('aria-hidden', 'false');
  ui.plain.scrollTop = 0;
  setTimeout(() => ui.plainClose.focus({ preventScroll: true }), 60);
}
function closePlain() {
  state.plain = false;
  ui.plain.classList.remove('open');
  ui.plain.setAttribute('aria-hidden', 'true');
  restoreFocus(back.plain); back.plain = null;
  if (state.mode === 'intro' && !ui.intro.contains(document.activeElement)) ui.start.focus({ preventScroll: true });
}

/* ---------- resume viewer ---------- */
function resumeHTML() {
  const R = CONTENT.resume;
  const contact = R.contact.map(c => c.href ? `<a href="${c.href}"${isExt(c.href) ? ' target="_blank" rel="noopener"' : ''}>${c.label}</a>` : `<span>${c.label}</span>`)
    .join('<span class="rs-sep" aria-hidden="true"></span>');
  const entry = (e) => `<div class="rs-entry">
      <div class="rs-line"><h3>${e.title}${e.tech ? ` <span class="rs-tech">| ${e.tech}</span>` : ''}</h3>${e.right ? `<span class="rs-right">${e.right}</span>` : ''}</div>
      ${e.sub || e.subRight ? `<div class="rs-line rs-sub"><span>${e.sub || ''}</span>${e.subRight ? `<span class="rs-right">${e.subRight}</span>` : ''}</div>` : ''}
      ${e.bullets ? `<ul>${e.bullets.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}
    </div>`;
  return `<header class="rs-head"><h1 id="resume-title">${CONTENT.name}</h1><p class="rs-contact">${contact}</p></header>
    ${R.sections.map(sct => `<section class="rs-sec"><h2>${sct.title}</h2>${sct.rows
      ? `<dl class="rs-skills">${sct.rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`
      : sct.entries.map(entry).join('')}</section>`).join('')}`;
}
let resumeBuilt = false;
function openResume() {
  closeMapOverlay();
  if (!resumeBuilt) { ui.resumeSheet.innerHTML = resumeHTML(); resumeBuilt = true; }
  if (!state.resume) back.resume = document.activeElement;
  state.resume = true;
  ui.resume.classList.add('open');
  ui.resume.setAttribute('aria-hidden', 'false');
  ui.resume.scrollTop = 0;
  ui.hint.classList.remove('show');
  setTimeout(() => ui.resumeClose.focus({ preventScroll: true }), 60);
}
function closeResume() {
  if (!state.resume) return;
  state.resume = false;
  ui.resume.classList.remove('open');
  ui.resume.setAttribute('aria-hidden', 'true');
  restoreFocus(back.resume); back.resume = null;
}
buildPlain();
updateStats();
/* point the resume download link at the PDF that ships in /assets */
if (ui.resumeDl) {
  ui.resumeDl.href = `assets/${encodeURIComponent(CONTENT.resume.filename)}`;
  ui.resumeDl.setAttribute('download', CONTENT.resume.filename);
}
$$('[data-open-plain]').forEach(b => b.addEventListener('click', openPlain));
ui.plainClose.addEventListener('click', closePlain);
ui.panelClose.addEventListener('click', closePanel);
ui.resumeClose.addEventListener('click', closeResume);
document.addEventListener('click', (e) => {
  const t = e.target instanceof Element ? e.target : null;
  if (!t) return;
  if (t.closest('[data-open-resume]')) { e.preventDefault(); openResume(); }
});

/* ---------- bail out gracefully without WebGL ---------- */
function fallback(msg) {
  document.body.classList.add('no-webgl');
  document.body.classList.remove('is-intro');
  buildPlain(msg || 'Your browser couldn’t start the 3D scene, so here is the same portfolio as a regular page.');
  openPlain();
}
addEventListener('keydown', (e) => { if (e.code === 'Escape' && state.resume) { closeResume(); e.stopImmediatePropagation(); } }, true);
if (typeof THREE === 'undefined') { fallback(); return; }
/* Pick a quality tier before touching the GPU: it decides MSAA, pixel ratio, shadow
   resolution and how much scenery gets built. See src/scene/quality.js. */
const quality = detectQuality();
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: ui.canvas,
    antialias: quality.antialias,
    powerPreference: 'high-performance'
  });
} catch (e) { renderer = null; }
if (!renderer) { fallback(); return; }
ui.canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault(); state.dead = true;
  fallback('The 3D scene stopped responding, so here is the same portfolio as a regular page.');
});

/* =================================================================
   3D WORLD
   ================================================================= */
const WORLD_R = 235, BOAT_R = 1.8;
const viewport = measureViewport();
renderer.setPixelRatio(quality.pixelRatio);
renderer.setSize(viewport.width, viewport.height);
renderer.shadowMap.enabled = true;
/* soft shadows cost several taps per fragment; phones get the cheap filter */
renderer.shadowMap.type = quality.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf6d5ae, 110, 390);
const camera = new THREE.PerspectiveCamera(55, viewport.ratio, 0.5, 2600);

/* ---------- seeded RNG: keeps the island + scatter layout identical every load ---------- */
const rng = mulberry32(20260918);

/* ---------- sky, stars, lights ---------- */
const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false,
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 uTop; uniform vec3 uHor; varying vec3 vDir; void main(){ float h = max(vDir.y, 0.0); gl_FragColor = vec4(mix(uHor, uTop, pow(h, 0.55)), 1.0); }'
}));
sky.renderOrder = -1; sky.frustumCulled = false;
scene.add(sky);

const starPos = [];
for (let i = 0; i < quality.stars; i++) {
  const y = 0.08 + rng() * 0.92, th = rng() * Math.PI * 2, s = Math.sqrt(1 - y * y);
  starPos.push(Math.cos(th) * s * 1100, y * 1100, Math.sin(th) * s * 1100);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
const stars = new THREE.Points(starGeo, starMat); stars.frustumCulled = false; scene.add(stars);

const hemi = new THREE.HemisphereLight(0xffffff, 0x336677, 0.75);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1);
const SUN_OFF = new THREE.Vector3(-90, 110, 70);
sun.castShadow = true;
sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 420 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

/* ---------- water ---------- */
/* The wave shape (waveH) drives the boat, buoys and bottles as well as the surface
   itself; src/scene/water.js holds the shader that colours and lights it. */
const { mesh: water, uniforms: waterU, step: WSTEP } = createWater({
  skyUniforms: skyU,
  islandCount: CONTENT.islands.length,
  segments: quality.waterSegments,
  cheap: quality.cheapWater
});
scene.add(water);

/* ---------- islands ---------- */
const colliders = [];
const animators = [];
const beamU = { uColor: { value: new THREE.Color(0xfff1b8) }, uOpacity: { value: 0.1 } };
const beamMat = new THREE.ShaderMaterial({
  uniforms: beamU, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  vertexShader: 'varying float vK; void main(){ vK = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying float vK; void main(){ gl_FragColor = vec4(uColor, uOpacity * pow(vK, 1.6)); }'
});
let lanternLight = null;

const MONUMENTS = createMonumentBuilders({
  animators,
  beamMaterial: beamMat,
  onLantern: (light) => { lanternLight = light; }
});

/* where a (non-indexed) mesh crosses the horizontal plane y = y0, as a polygon sorted around the island centre */
function sliceAt(geo, y0) {
  const p = geo.attributes.position, pts = [];
  for (let i = 0; i < p.count; i += 3) for (let e = 0; e < 3; e++) {
    const a = i + e, c = i + (e + 1) % 3, ya = p.getY(a), yc = p.getY(c);
    if ((ya - y0) * (yc - y0) < 0) {
      const t = (y0 - ya) / (yc - ya);
      pts.push([p.getX(a) + (p.getX(c) - p.getX(a)) * t, p.getZ(a) + (p.getZ(c) - p.getZ(a)) * t]);
    }
  }
  pts.sort((u, v) => Math.atan2(u[1], u[0]) - Math.atan2(v[1], v[0]));
  const out = [];
  for (const q of pts) { const l = out[out.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.05) out.push(q); }
  if (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 0.05) out.pop();
  return out;
}
function buildIsland(def) {
  const rnd = mulberry32(hashStr(def.id));
  const r = def.r, [x, z] = def.pos, TOP = 3.8;
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const b = new Batch();
  const sandGeo = xf(jitter(new THREE.CylinderGeometry(r * 1.1, r * 1.35, 6, 16, 1), r * 0.07, rnd), 0, -1.4, 0);
  const coast = sliceAt(sandGeo, 0);            /* the true waterline, used by the scroll map */
  b.add(MAT.sand, sandGeo);
  const grassMat = rnd() < 0.5 ? MAT.grass : MAT.grass2;
  const grassGeo = xf(jitter(new THREE.CylinderGeometry(r * 0.8, r * 0.97, 2.4, 13, 1), r * 0.05, rnd), 0, 2.6, 0);
  const grass = sliceAt(grassGeo, TOP - 0.25);
  b.add(grassMat, grassGeo);
  const rocks = [], trees = [];

  const pa = def.pier ?? Math.atan2(-z, -x);
  const dx = Math.cos(pa), dz = Math.sin(pa);
  const p0 = r * 0.85, plen = 10, deckY = 1.95;
  b.add(MAT.wood, xf(GEO.box, dx * (p0 + plen / 2), deckY, dz * (p0 + plen / 2), 0, -pa, 0, plen, 0.28, 2.4));
  for (let i = 0; i < 4; i++) {
    const d = p0 + 1.5 + i * (plen - 2) / 3;
    for (const s of [-1, 1]) b.add(MAT.woodDark, xf(GEO.cyl6, dx * d - dz * s * 1.05, deckY - 2.1, dz * d + dx * s * 1.05, 0, 0, 0, 0.17, 4.2, 0.17));
  }
  const le = p0 + plen - 0.6;
  b.add(MAT.woodDark, xf(GEO.cyl6, dx * le - dz * 1.05, deckY + 1, dz * le + dx * 1.05, 0, 0, 0, 0.09, 2, 0.09));
  b.add(MAT.lantern, xf(GEO.box, dx * le - dz * 1.05, deckY + 2.1, dz * le + dx * 1.05, 0, 0, 0, 0.36, 0.45, 0.36));

  const nRocks = 4 + Math.floor(rnd() * 4);
  for (let i = 0; i < nRocks; i++) {
    let a = rnd() * Math.PI * 2;
    if (Math.abs(angDiff(a, pa)) < 0.45) a += 0.9;
    const d = r * (1.02 + rnd() * 0.22), s = 0.7 + rnd() * 1.3;
    rocks.push([Math.cos(a) * d, Math.sin(a) * d, s]);
    b.add(rnd() < 0.5 ? MAT.rock : MAT.rock2, xf(GEO.dodeca, Math.cos(a) * d, 0.4 + rnd() * 0.6, Math.sin(a) * d, rnd() * 3, rnd() * 3, 0, s, s * 0.75, s));
  }
  const clear = ['cabin', 'observatory', 'tower', 'logbook'].includes(def.kind) ? 0.5 : 0.4;
  const nTrees = Math.round(r * 0.65);
  for (let i = 0; i < nTrees; i++) {
    const a = rnd() * Math.PI * 2, d = r * (clear + rnd() * (0.72 - clear));
    trees.push([Math.cos(a) * d, Math.sin(a) * d]);
    addTree(b, Math.cos(a) * d, TOP - 0.1, Math.sin(a) * d, rnd);
  }
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2, d = r * (0.3 + rnd() * 0.45);
    b.add([MAT.flowerA, MAT.flowerB, MAT.flowerC][i % 3], xf(GEO.ico, Math.cos(a) * d, TOP + 0.1, Math.sin(a) * d, 0, 0, 0, 0.2));
  }
  b.build(g);

  rnd(); /* keeps the seeded layout identical to earlier versions */

  colliders.push({ x, z, r: r * 1.22, island: true });
  for (let i = 0; i < 3; i++) { const d = p0 + 2 + i * 3.2; colliders.push({ x: x + dx * d, z: z + dz * d, r: 1.4 }); }

  const mg = new THREE.Group(); mg.position.y = TOP; mg.rotation.y = Math.atan2(dx, dz); g.add(mg);
  if (MONUMENTS[def.kind]) MONUMENTS[def.kind](mg, def, rnd);

  const el = document.createElement('div');
  el.className = 'ilabel';
  el.style.setProperty('--c', def.color);
  el.innerHTML = `<span class="pennant"></span><span><strong>${def.title}</strong><small>${def.sub}</small></span>
    <svg class="tick" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  el.title = def.section === 'resume' ? `Sail to ${def.title} and open the resume` : `Sail to ${def.title}`;
  ui.labels.appendChild(el);
  const dockD = p0 + plen + 4.5;
  const isl = { def, x, z, r, el, lv: -1, labelY: def.labelY || 14, dockX: x + dx * dockD, dockZ: z + dz * dockD, pierX: dx, pierZ: dz,
    coast, grass, rocks, trees, pier: { a: pa, from: p0, to: p0 + plen } };
  el.addEventListener('click', () => setCourse(isl));
  return isl;
}
islands = CONTENT.islands.map(buildIsland);
islands.forEach((isl, i) => {
  const rr = isl.coast.reduce((a, [x, z]) => a + Math.hypot(x, z), 0) / Math.max(1, isl.coast.length);
  waterU.uIsl.value[i].set(isl.x, isl.z, rr);
});
const home = islands.find(i => i.def.section === 'home') || islands[0];

/* ---------- the boat ---------- */
const boat = { x: home.dockX, z: home.dockZ, h: Math.atan2(home.pierX, home.pierZ), vx: 0, vz: 0, turn: 0, y: 0, pitch: 0, roll: 0 };
const boatG = new THREE.Group(); boatG.rotation.order = 'YXZ'; scene.add(boatG);
const hullShape = new THREE.Shape();
hullShape.moveTo(0, 2.7);
hullShape.quadraticCurveTo(1.2, 1.5, 1.2, 0);
hullShape.lineTo(1.02, -1.9);
hullShape.lineTo(-1.02, -1.9);
hullShape.lineTo(-1.2, 0);
hullShape.quadraticCurveTo(-1.2, 1.5, 0, 2.7);
const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 1, curveSegments: 5 });
hullGeo.rotateX(Math.PI / 2);
{ const p = hullGeo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.5) p.setX(i, p.getX(i) * 0.62); }
hullGeo.translate(0, 0.75, 0);
mesh(hullGeo, MAT.navy, boatG);
const deckGeo = new THREE.ShapeGeometry(hullShape, 5);
deckGeo.rotateX(-Math.PI / 2); deckGeo.rotateY(Math.PI); deckGeo.scale(0.9, 1, 0.9); deckGeo.translate(0, 0.885, 0);
mesh(deckGeo, MAT.wood, boatG);
mesh(GEO.box, MAT.cream, boatG, 0, 1.3, -0.55).scale.set(1.3, 0.85, 1.5);
mesh(GEO.box, MAT.yellow, boatG, 0, 1.78, -0.55).scale.set(1.45, 0.14, 1.7);
for (const s of [-1, 1]) mesh(GEO.box, MAT.dark, boatG, s * 0.66, 1.35, -0.55, false).scale.set(0.04, 0.3, 0.9);
mesh(new THREE.CylinderGeometry(0.06, 0.09, 4.6, 6), MAT.woodDark, boatG, 0, 3.1, 0.45);
const sailPivot = new THREE.Group(); sailPivot.position.set(0, 0, 0.45); boatG.add(sailPivot);
/*
 * The rig clears the cabin on both axes.
 *
 * Fore/aft: the clew and boom stop at pivot z -1.9 (boat z -1.45). The deck edge is at
 * -1.71 and the transom at -1.9, so nothing overhangs the stern as the boat rolls.
 *
 * Vertically: the boom rides at y 2.02, above the coachroof (which tops out at 1.85).
 * Sitting it any lower runs the spar straight through the cabin and leaves its aft tip
 * poking out of the back like a loose rod.
 */
const BOOM_Y = 2.02;

/* Single flat triangles, deliberately. Everything in this scene is flat-shaded and
   faceted, so a subdivided, cambered sail reads as noise rather than cloth — the crisp
   silhouette is what fits the art style. */
const mainGeo = new THREE.BufferGeometry();
mainGeo.setAttribute('position', new THREE.Float32BufferAttribute(
  [0, BOOM_Y + 0.06, -0.06, 0, 5.2, -0.06, 0, BOOM_Y + 0.11, -1.9], 3));
mainGeo.computeVertexNormals();
mesh(mainGeo, MAT.sail, sailPivot);
mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 5), MAT.woodDark, sailPivot, 0, BOOM_Y, -0.95).rotation.x = Math.PI / 2;
const jibGeo = new THREE.BufferGeometry();
jibGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 5.0, 0.52, 0, 1.0, 0.6, 0, 1.0, 2.35], 3));
jibGeo.computeVertexNormals();
mesh(jibGeo, MAT.sail, boatG);
const flagPivot = new THREE.Group(); flagPivot.position.set(0, 5.45, 0.45); boatG.add(flagPivot);
const flagGeo = new THREE.BufferGeometry();
flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.5, 0, 0, -0.25, -0.95], 3));
flagGeo.computeVertexNormals();
mesh(flagGeo, new THREE.MeshStandardMaterial({ color: 0xd7263d, side: THREE.DoubleSide, flatShading: true }), flagPivot, 0, 0, 0, false);

/* ---------- wake particles ---------- */
const wakeGeo = new THREE.PlaneGeometry(2, 2); wakeGeo.rotateX(-Math.PI / 2);
/* a soft, slightly lumpy foam puff drawn once into a small texture */
const wakeTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), fr = mulberry32(7);
  for (let i = 0; i < 9; i++) {
    const a = fr() * 6.28, d = fr() * 9, x = 32 + Math.cos(a) * d, y = 32 + Math.sin(a) * d, r = 14 + fr() * 10;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
})();
const wake = [];
for (let i = 0; i < quality.wakePuffs; i++) {
  const m = new THREE.Mesh(wakeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, map: wakeTex, transparent: true, opacity: 0, depthWrite: false }));
  m.visible = false; scene.add(m);
  wake.push({ m, life: 0, max: 1, x: 0, z: 0, vx: 0, vz: 0, s0: 0.4, s1: 2, o: 0.5 });
}
let wakeIdx = 0, wakeTimer = 0;
function spawnWake(x, z, vx, vz, max, s0, s1, o) {
  const p = wake[wakeIdx]; wakeIdx = (wakeIdx + 1) % wake.length;
  Object.assign(p, { x, z, vx, vz, life: 0, max, s0, s1, o: Math.min(1, o * 1.8) }); p.m.visible = true;
  p.m.rotation.y = rng() * 6.28;   /* each puff turned differently so the foam never looks stamped */
}
function splash(x, z, strength) {
  const n = Math.min(10, 3 + Math.floor(strength));
  for (let i = 0; i < n; i++) { const a = rng() * 6.28, v = 1 + rng() * strength * 0.4; spawnWake(x, z, Math.cos(a) * v, Math.sin(a) * v, 0.9, 0.3, 1.4, 0.7); }
}

/* ---------- flotsam: buoys, drifting cargo and one stray bath toy ---------- */
const { floaters, buoys } = createFlotsam({
  scene, rng, islands, quality,
  bottlePositions: CONTENT.bottles.map(b => b.pos),
  harborAngle: Math.atan2(home.pierZ, home.pierX)
});

/* a wrecked ship gives the empty stretch of water something to find */
{
  const spot = findOpenWater(rng, islands, floaters.map(f => [f.x, f.z]),
    { inner: 115, outer: 190, spacing: 26, clearance: 30 });
  if (spot) colliders.push(createShipwreck({ scene, x: spot[0], z: spot[1], angle: rng() * Math.PI * 2 }));
}

/* easter egg: bump the duck and it says hello, once */
{
  const duck = floaters.find(f => f.kind === 'duck');
  if (duck) duck.onBump = () => {
    duck.onBump = null;
    toast('<strong>Quack.</strong>Someone lost a bath toy all the way out here.', 5000);
  };
}

/* ---------- message bottles ---------- */
const BOT = { body: new THREE.CylinderGeometry(0.35, 0.35, 1.1, 8), neck: new THREE.CylinderGeometry(0.15, 0.3, 0.5, 8), cork: new THREE.CylinderGeometry(0.14, 0.14, 0.25, 6), note: new THREE.CylinderGeometry(0.2, 0.2, 0.8, 6) };
const pingGeo = new THREE.RingGeometry(1, 1.22, 32); pingGeo.rotateX(-Math.PI / 2);
const bottles = CONTENT.bottles.map((b, i) => {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.rotation.z = 1.25; g.add(inner);
  mesh(BOT.note, MAT.cream, inner, 0, 0, 0, false);
  mesh(BOT.body, MAT.glass, inner);
  mesh(BOT.neck, MAT.glass, inner, 0, 0.8, 0);
  mesh(BOT.cork, MAT.wood, inner, 0, 1.15, 0);
  g.scale.setScalar(1.4); scene.add(g);
  const ping = new THREE.Mesh(pingGeo, new THREE.MeshBasicMaterial({ color: 0xf5c518, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(ping);
  return { note: b.note, x: b.pos[0], z: b.pos[1], g, ping, found: false, gone: 0, ph: i * 1.7 };
});

/* ---------- wildlife + clouds ---------- */
const byId = (id) => islands.find(i => i.def.id === id);
const wildlife = createWildlife({
  scene, rng, islands, pods: quality.dolphinPods,
  /* one circling gull per entry: [island, orbit radius, height] */
  gullAnchors: [[home, 24, 20], [home, 34, 26], [byId('lectra'), 22, 22], [byId('about'), 20, 19],
                [byId('resume'), 21, 23], [byId('contact'), 24, 27]]
    .filter(([isl]) => isl)
    .map(([isl, radius, height]) => ({ x: isl.x, z: isl.z, radius, height })),
  avoid: floaters.map(f => [f.x, f.z]).concat(CONTENT.bottles.map(b => b.pos))
});
const clouds = [];
for (let i = 0; i < quality.clouds; i++) {
  const g = new THREE.Group(), n = 3 + Math.floor(rng() * 3);
  for (let j = 0; j < n; j++) {
    const s = 4 + rng() * 5;
    const m = mesh(GEO.ico, MAT.cloud, g, (j - n / 2) * s * 0.9, rng() * 2, rng() * 4 - 2, false);
    m.receiveShadow = false; m.scale.set(s, s * 0.7, s); m.rotation.set(rng(), rng(), 0);
  }
  g.position.set(rng() * 840 - 420, 55 + rng() * 35, rng() * 840 - 420);
  scene.add(g); clouds.push({ g, sp: 1 + rng() * 1.5 });
}

function isDark() {
  const sky = document.documentElement.getAttribute('data-sky');
  if (sky === 'night') return true;
  if (sky === 'day') return false;
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return matchMedia('(prefers-color-scheme: dark)').matches;
}
/* 0 = day, 1 = night; switching glides through a dusk palette at 0.5 */
const SKY_C = {};
for (const stop of ['day', 'dusk', 'night']) { SKY_C[stop] = {}; for (const k of SKY_COLS) SKY_C[stop][k] = new THREE.Color(PALETTE[stop][k]); }
const SKY_MIX = {}; for (const k of SKY_COLS) SKY_MIX[k] = new THREE.Color();
function setSky(k) {
  const [a, b, t] = k <= 0.5 ? ['day', 'dusk', k * 2] : ['dusk', 'night', (k - 0.5) * 2];
  const p = {};
  for (const key of SKY_COLS) p[key] = SKY_MIX[key].copy(SKY_C[a][key]).lerp(SKY_C[b][key], t);
  for (const key of SKY_NUMS) p[key] = lerp(PALETTE[a][key], PALETTE[b][key], t);
  skyU.uTop.value.copy(p.top); skyU.uHor.value.copy(p.hor);
  scene.fog.color.copy(p.hor); renderer.setClearColor(p.hor);
  hemi.color.copy(p.hs); hemi.groundColor.copy(p.hg); hemi.intensity = p.hi;
  sun.color.copy(p.sun); sun.intensity = p.si;
  beamU.uOpacity.value = p.beam;
  if (lanternLight) lanternLight.intensity = p.lamp;
  MAT.window.emissiveIntensity = p.win;
  MAT.lantern.emissiveIntensity = p.lan;
  starMat.opacity = p.stars;
  MAT.cloud.color.copy(p.cloud);
  waterU.uDeep.value.copy(p.deep); waterU.uShallow.value.copy(p.shallow); waterU.uCrest.value.copy(p.crest);
  waterU.uFoam.value.copy(p.foamCol); waterU.uGlintCol.value.copy(p.glintCol);
  wake.forEach(w => w.m.material.color.copy(p.foamCol));
  waterU.uGlint.value = p.glint; waterU.uFresnel.value = p.fres; waterU.uFoamK.value = p.foam;
}
let skyK = isDark() ? 1 : 0, skyTarget = skyK;
setSky(skyK);
const skyBtns = $$('[data-sky-set]');
function syncSkyButtons() { const night = skyTarget === 1; skyBtns.forEach(b => b.setAttribute('aria-pressed', String((b.dataset.skySet === 'night') === night))); }
function applyPalette() {
  skyTarget = isDark() ? 1 : 0;
  if (reduceMotion) { skyK = skyTarget; setSky(skyK); }
  syncSkyButtons();
}
function stepSky(dt) {
  if (skyK === skyTarget) return;
  skyK = skyTarget > skyK ? Math.min(skyTarget, skyK + dt / 2.4) : Math.max(skyTarget, skyK - dt / 2.4);
  setSky(skyK * skyK * (3 - 2 * skyK));
}
skyBtns.forEach(b => b.addEventListener('click', () => {
  const mode = b.dataset.skySet;
  document.documentElement.setAttribute('data-sky', mode);   /* the observer below picks this up */
  try { localStorage.setItem('archipelago-sky', mode); } catch (e) { /* storage off: the choice lasts this visit */ }
}));
syncSkyButtons();
const mq = matchMedia('(prefers-color-scheme: dark)');
if (mq.addEventListener) mq.addEventListener('change', applyPalette); else if (mq.addListener) mq.addListener(applyPalette);
if (window.MutationObserver) new MutationObserver(applyPalette).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-sky'] });

/* =================================================================
   INPUT
   ================================================================= */
const keys = new Set();
const joy = { x: 0, y: 0, active: false, id: null };
addEventListener('keydown', (e) => {
  const inControl = e.target instanceof Element && !!e.target.closest('button, a, input, textarea, [role="button"]');
  if (e.code === 'Escape') {
    if (state.plain) closePlain();
    else if (SM.open && isNarrow()) { setScroll(false); ui.scrollToggle.focus({ preventScroll: true }); }
    else if (state.panel) closePanel();
    else if (state.auto) cancelCourse();
    return;
  }
  if (state.plain || state.resume || state.mode === 'intro') return;
  if (!state.panel && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.repeat || inControl || state.panel) return;
  if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyE') && state.near && !state.auto) { e.preventDefault(); openPanel(state.near); }
  if (e.code === 'KeyR') respawn();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function moveJoy(e) {
  const r = ui.joy.getBoundingClientRect(), R = r.width / 2, max = R * 0.7;
  let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
  const d = Math.hypot(dx, dy);
  if (d > max) { dx *= max / d; dy *= max / d; }
  joy.x = dx / max; joy.y = -dy / max;
  ui.knob.style.transform = `translate(${dx}px, ${dy}px)`;
}
ui.joy.addEventListener('pointerdown', (e) => { joy.active = true; joy.id = e.pointerId; ui.joy.setPointerCapture(e.pointerId); moveJoy(e); e.preventDefault(); });
ui.joy.addEventListener('pointermove', (e) => { if (joy.active && e.pointerId === joy.id) moveJoy(e); });
const endJoy = (e) => { if (e.pointerId !== joy.id) return; joy.active = false; joy.x = joy.y = 0; ui.knob.style.transform = ''; };
ui.joy.addEventListener('pointerup', endJoy);
ui.joy.addEventListener('pointercancel', endJoy);

const cam = { dist: 16, heading: boat.h };
addEventListener('wheel', (e) => {
  if (state.mode !== 'sail' || state.plain || state.resume) return;
  if (e.target instanceof Element && e.target.closest('.panel,.plain,.resume,.scroll')) return;
  cam.dist = clamp(cam.dist + e.deltaY * 0.012, 10, 32); e.preventDefault();
}, { passive: false });

/* ---------- autopilot: steer toward the chosen island's pier, easing round anything in the way ---------- */
const AP = { side: 1, slow: 0, back: 0, t: 0 };
function setCourse(isl) {
  if (!isl || state.mode !== 'sail' || state.dead) return;
  closeMapOverlay(); closePanel(); closeResume();
  if (Math.hypot(isl.dockX - boat.x, isl.dockZ - boat.z) < 7) { openPanel(isl); return; }
  state.auto = isl; Object.assign(AP, { side: 1, slow: 0, back: 0, t: 0 });
  ui.hint.classList.remove('show');
  refreshDock();
}
function cancelCourse() { if (!state.auto) return; state.auto = null; refreshDock(); }
function autopilot(dt) {
  const T = state.auto, dx = T.dockX - boat.x, dz = T.dockZ - boat.z, dist = Math.hypot(dx, dz);
  AP.t += dt;
  if (dist < 4.5) { openPanel(T); return { thr: 0, steer: 0, boost: false }; }
  if (AP.t > 60) { cancelCourse(); toast('<strong>Autopilot gave up</strong>Something is in the way. Take the helm with the arrow keys or the wheel.'); return { thr: 0, steer: 0, boost: false }; }
  let ax = dx / dist, az = dz / dist;
  for (const c of colliders) {
    const ex = boat.x - c.x, ez = boat.z - c.z, e = Math.hypot(ex, ez), R = c.island ? 15 : 5;
    if (e >= c.r + BOAT_R + R || e < 1e-4) continue;
    const ux = ex / e, uz = ez / e;
    if (-(ax * ux + az * uz) < -0.25) continue;
    const w = Math.pow(clamp(1 - (e - c.r - BOAT_R) / R, 0, 1), 2) * (c.island ? 2.6 : 1.6), tw = c.island ? 1 : 0.6;
    let tx = -uz, tz = ux; if ((tx * dx + tz * dz) * AP.side < 0) { tx = uz; tz = -ux; }
    ax += (ux * 0.5 + tx * tw) * w; az += (uz * 0.5 + tz * tw) * w;
  }
  const vF = boat.vx * Math.sin(boat.h) + boat.vz * Math.cos(boat.h);
  const err = angDiff(boat.h, Math.atan2(ax, az)), steer = clamp(err * 2.4, -1, 1);
  if (AP.back > 0) { AP.back -= dt; return { thr: -0.8, steer: -steer, boost: false }; }
  const vd = clamp(Math.sqrt(dist) * 4.4 - 3, 3, 36);
  let thr = clamp((vd - vF) * 0.3, -1, 1); if (Math.abs(err) > 1.1) thr = Math.min(thr, 0.3);
  AP.slow = (Math.hypot(boat.vx, boat.vz) < 2.5 && dist > 8) ? AP.slow + dt : 0;
  if (AP.slow > 1) { AP.side *= -1; AP.slow = -2; AP.back = 0.9; }
  return { thr, steer, boost: dist > 45 && Math.abs(err) < 0.35 };
}

function getInput(dt) {
  if (state.mode !== 'sail' || state.panel || state.plain || state.resume) return { thr: 0, steer: 0, boost: false };
  const k = keys;
  let thr = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
  let steer = (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) - (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0);
  if (joy.active && Math.hypot(joy.x, joy.y) > 0.12) { thr += joy.y; steer -= joy.x; }
  if (state.auto) {
    if (thr === 0 && steer === 0) return autopilot(dt);
    cancelCourse();
  }
  const boost = k.has('ShiftLeft') || k.has('ShiftRight') || (joy.active && Math.hypot(joy.x, joy.y) > 0.97 && joy.y > 0.6);
  return { thr: clamp(thr, -1, 1), steer: clamp(steer, -1, 1), boost };
}

function respawn() {
  closePanel(); closeMapOverlay(); cancelCourse();
  boat.x = home.dockX; boat.z = home.dockZ; boat.h = Math.atan2(home.pierX, home.pierZ);
  boat.vx = boat.vz = boat.turn = 0;
  cam.heading = boat.h;
}
ui.harbor.addEventListener('click', () => { respawn(); ui.harbor.blur(); });
ui.dockBtn.addEventListener('click', () => { if (state.auto) cancelCourse(); else openPanel(state.near); });

function start() {
  if (state.mode !== 'intro') return;
  state.mode = 'sail';
  if (hudEl) hudEl.inert = false;
  state.camBlend = reduceMotion ? 60 : 0.45;
  document.body.classList.remove('is-intro');
  ui.intro.classList.add('gone');
  ui.intro.setAttribute('aria-hidden', 'true');
  if (document.activeElement) document.activeElement.blur();
  setTimeout(() => { ui.intro.hidden = true; }, 950);
  if (touchMode) toast('<strong>Push the wheel to sail</strong>Up goes forward, sideways turns. Or open the map in the top corner and tap an island.', 6500);
  else { ui.hint.classList.add('show'); setTimeout(() => ui.hint.classList.remove('show'), 11000); }
}
ui.start.addEventListener('click', start);

/* =================================================================
   SIMULATION
   ================================================================= */
let time = 0;
function stepBoat(dt, inp) {
  const fx = Math.sin(boat.h), fz = Math.cos(boat.h);
  let vF = boat.vx * fx + boat.vz * fz;
  let vS = boat.vx * fz - boat.vz * fx;
  const boost = inp.boost && inp.thr > 0 ? 1.65 : 1;
  vF += (inp.thr > 0 ? inp.thr * 19 * boost : inp.thr * 10) * dt;
  vF *= Math.exp(-0.85 * dt);
  vS *= Math.exp(-3.5 * dt);
  boat.turn = lerp(boat.turn, inp.steer, damp(6, dt));
  const sf = clamp(Math.abs(vF) / 7, 0.3, 1), dir = vF < -0.3 ? -1 : 1;
  boat.h += boat.turn * 1.55 * sf * dir * dt;
  const nx = Math.sin(boat.h), nz = Math.cos(boat.h);
  boat.vx = nx * vF + nz * vS; boat.vz = nz * vF - nx * vS;
  boat.x += boat.vx * dt; boat.z += boat.vz * dt;

  for (const c of colliders) {
    const dx = boat.x - c.x, dz = boat.z - c.z, d = Math.hypot(dx, dz), min = c.r + BOAT_R;
    if (d < min && d > 1e-4) {
      const ux = dx / d, uz = dz / d;
      boat.x = c.x + ux * min; boat.z = c.z + uz * min;
      const vn = boat.vx * ux + boat.vz * uz;
      if (vn < 0) {
        boat.vx -= 1.35 * vn * ux; boat.vz -= 1.35 * vn * uz;
        if (vn < -4) { splash(boat.x - ux * BOAT_R, boat.z - uz * BOAT_R, -vn); if (!reduceMotion) state.shake = Math.min(0.8, -vn * 0.05); }
      }
    }
  }
  const d0 = Math.hypot(boat.x, boat.z);
  if (d0 > WORLD_R) {
    const ux = boat.x / d0, uz = boat.z / d0, over = d0 - WORLD_R;
    boat.vx -= ux * over * 4 * dt; boat.vz -= uz * over * 4 * dt;
    if (over > 30) { boat.x = ux * (WORLD_R + 30); boat.z = uz * (WORLD_R + 30); }
    if (time - state.lastEdgeToast > 9) { state.lastEdgeToast = time; toast('<strong>Edge of the chart</strong>Nothing out here but open water. Turn back toward the islands.'); }
  }
  const sp = Math.hypot(boat.vx, boat.vz);
  if (sp > 2.2) {
    wakeTimer -= dt;
    if (wakeTimer <= 0) {
      wakeTimer = 0.045;
      const lx = nz, lz = -nx, sx = boat.x - nx * 2, sz = boat.z - nz * 2, out = 0.7 + sp * 0.12;
      for (const s of [-1, 1]) spawnWake(sx + lx * s * 0.7, sz + lz * s * 0.7, lx * s * out + boat.vx * 0.1, lz * s * out + boat.vz * 0.1, 1.4 + sp * 0.02, 0.35, 1.6 + sp * 0.05, 0.5);
    }
  }
}

function poseBoat(dt) {
  const fx = Math.sin(boat.h), fz = Math.cos(boat.h), lx = fz, lz = -fx;
  const hc = waveH(boat.x, boat.z, time);
  const hf = waveH(boat.x + fx * 2.2, boat.z + fz * 2.2, time), hb = waveH(boat.x - fx * 2.2, boat.z - fz * 2.2, time);
  const hl = waveH(boat.x + lx * 1.2, boat.z + lz * 1.2, time), hr = waveH(boat.x - lx * 1.2, boat.z - lz * 1.2, time);
  const vF = boat.vx * fx + boat.vz * fz;
  const tp = Math.atan2(hb - hf, 4.4) - clamp(vF * 0.006, -0.05, 0.12);
  const tr = Math.atan2(hl - hr, 2.4) + boat.turn * clamp(Math.abs(vF) / 18, 0, 1) * 0.2;
  const k = damp(8, dt);
  boat.pitch = lerp(boat.pitch, tp, k); boat.roll = lerp(boat.roll, tr, k);
  boat.y = lerp(boat.y, (hc + hf + hb) / 3, damp(10, dt));
  boatG.position.set(boat.x, boat.y, boat.z);
  boatG.rotation.set(boat.pitch, boat.h, boat.roll);
  sailPivot.rotation.y = lerp(sailPivot.rotation.y, -boat.turn * 0.45 + Math.sin(time * 6) * 0.015, damp(3, dt));
  flagPivot.rotation.y = Math.sin(time * 7) * 0.3 - boat.turn * 0.4;
}

function stepFloaters(dt) {
  for (const b of floaters) {
    b.x += b.vx * dt; b.z += b.vz * dt;
    const f = Math.exp(-b.drag * dt); b.vx *= f; b.vz *= f;
    b.spin *= Math.exp(-1.5 * dt); b.yaw += b.spin * dt;
    const dx = b.x - boat.x, dz = b.z - boat.z, d = Math.hypot(dx, dz), min = b.r + BOAT_R;
    if (d < min && d > 1e-4) {
      const ux = dx / d, uz = dz / d;
      b.x = boat.x + ux * min; b.z = boat.z + uz * min;
      const rel = (b.vx - boat.vx) * ux + (b.vz - boat.vz) * uz;
      if (rel < 0) {
        /* light cargo is thrown further and barely slows the boat; buoys are heavy */
        b.vx -= b.push * rel * ux; b.vz -= b.push * rel * uz;
        boat.vx += rel * b.kick * ux; boat.vz += rel * b.kick * uz;
        b.spin += (rng() - 0.5) * -rel * (b.kind === 'buoy' ? 1 : 1.8);
        if (rel < -5) { splash(b.x, b.z, -rel * 0.6); if (b.onBump) b.onBump(); }
      }
    }
    for (const c of colliders) {
      const ex = b.x - c.x, ez = b.z - c.z, e = Math.hypot(ex, ez), m2 = c.r + b.r;
      if (e < m2 && e > 1e-4) {
        const ux = ex / e, uz = ez / e; b.x = c.x + ux * m2; b.z = c.z + uz * m2;
        const vn = b.vx * ux + b.vz * uz; if (vn < 0) { b.vx -= 1.5 * vn * ux; b.vz -= 1.5 * vn * uz; }
      }
    }
    const bd = Math.hypot(b.x, b.z);
    if (bd > WORLD_R + 20) { b.vx -= b.x / bd * 3 * dt; b.vz -= b.z / bd * 3 * dt; }
  }
  for (let i = 0; i < floaters.length; i++) for (let j = i + 1; j < floaters.length; j++) {
    const a = floaters[i], c = floaters[j], dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz), min = a.r + c.r;
    if (d < min && d > 1e-4) {
      const ux = dx / d, uz = dz / d, push = (min - d) / 2;
      a.x -= ux * push; a.z -= uz * push; c.x += ux * push; c.z += uz * push;
      const rel = (c.vx - a.vx) * ux + (c.vz - a.vz) * uz;
      if (rel < 0) { const imp = -rel * 0.95; a.vx -= imp * ux; a.vz -= imp * uz; c.vx += imp * ux; c.vz += imp * uz; }
    }
  }
  for (const b of floaters) {
    b.g.position.set(b.x, waveH(b.x, b.z, time) + b.yOff, b.z);
    b.g.rotation.set(Math.sin(time * 1.3 + b.ph) * b.bob + clamp(b.vz * 0.04, -0.4, 0.4), b.yaw, -Math.cos(time * 1.1 + b.ph) * b.bob - clamp(b.vx * 0.04, -0.4, 0.4));
  }
}

function updateWake(dt) {
  const f = Math.exp(-1.6 * dt);
  for (const p of wake) {
    if (!p.m.visible) continue;
    p.life += dt;
    if (p.life >= p.max) { p.m.visible = false; continue; }
    const k = p.life / p.max;
    p.x += p.vx * dt; p.z += p.vz * dt; p.vx *= f; p.vz *= f;
    p.m.position.set(p.x, waveH(p.x, p.z, time) + 0.2, p.z);
    p.m.scale.setScalar(lerp(p.s0, p.s1, k));
    p.m.material.opacity = p.o * (1 - k) * (1 - k);
  }
}

function updateBottles(dt) {
  for (const b of bottles) {
    if (b.gone >= 1) continue;
    const y = waveH(b.x, b.z, time);
    b.g.position.set(b.x, y + 0.25 + b.gone * 3, b.z);
    b.g.rotation.y = time * 0.4 + b.ph;
    const p = ((time * 0.5 + b.ph) % 1.6) / 1.6;
    b.ping.position.set(b.x, y + 0.2, b.z);
    b.ping.scale.setScalar(1 + p * 5);
    b.ping.material.opacity = b.found ? 0 : 0.8 * (1 - p);
    if (!b.found && state.mode === 'sail' && Math.hypot(boat.x - b.x, boat.z - b.z) < 3.6) {
      b.found = true; state.bottles++; updateStats();
      toast(`<strong>Note ${state.bottles} of ${bottles.length}</strong>${b.note}`, 6200);
      if (state.bottles === bottles.length) toast(`<strong>Every bottle found</strong>${CONTENT.allBottles}`, 6000);
      splash(b.x, b.z, 4);
    }
    if (b.found) {
      b.gone = Math.min(1, b.gone + dt * 2.2);
      b.g.scale.setScalar(1.4 * (1 - b.gone));
      if (b.gone >= 1) { b.g.visible = false; b.ping.visible = false; }
    }
  }
}

function updateAmbient(dt) {
  wildlife.update(time, splash);
  for (const c of clouds) { c.g.position.x += c.sp * dt; if (c.g.position.x > 440) c.g.position.x = -440; }
}

/* ---------- camera ---------- */
const desired = new THREE.Vector3(), lookAt = new THREE.Vector3(0, 5, 20), lookDesired = new THREE.Vector3();
function updateCamera(dt) {
  if (state.mode === 'intro') {
    const a = (reduceMotion ? 0 : time * 0.05) + 0.9;
    camera.position.set(Math.sin(a) * 82, 44, Math.cos(a) * 82);
    camera.lookAt(lookAt);
    return;
  }
  cam.heading = lerpAngle(cam.heading, boat.h, damp(2.2, dt));
  const fx = Math.sin(cam.heading), fz = Math.cos(cam.heading);
  const portrait = view.h > view.w;
  const dist = cam.dist + Math.hypot(boat.vx, boat.vz) * 0.14 + (portrait ? 5 : 0);
  desired.set(boat.x - fx * dist, boat.y + 4 + dist * 0.32, boat.z - fz * dist);
  state.camBlend = Math.min(state.camBlend > 5 ? state.camBlend : 4.5, state.camBlend + dt * 1.2);
  const k = damp(state.camBlend, dt);
  camera.position.lerp(desired, k);
  for (const isl of islands) {
    const dx = camera.position.x - isl.x, dz = camera.position.z - isl.z, d = Math.hypot(dx, dz), min = isl.r * 1.25 + 2;
    if (d < min && camera.position.y < 26 && d > 1e-4) { camera.position.x = isl.x + dx / d * min; camera.position.z = isl.z + dz / d * min; }
  }
  camera.position.y = Math.max(camera.position.y, waveH(camera.position.x, camera.position.z, time) + 2.5);
  lookDesired.set(boat.x + fx * 6, boat.y + 1.8, boat.z + fz * 6);
  lookAt.lerp(lookDesired, Math.min(1, k * 1.6));
  state.shake *= Math.exp(-6 * dt);
  if (state.shake > 0.01) {
    camera.lookAt(lookAt.x + (rng() - 0.5) * state.shake, lookAt.y + (rng() - 0.5) * state.shake, lookAt.z + (rng() - 0.5) * state.shake);
  } else camera.lookAt(lookAt);
}

/* ---------- proximity and labels ---------- */
function updateProximity() {
  let best = null, bd = Infinity;
  if (state.mode === 'sail') {
    for (const isl of islands) {
      const d = Math.hypot(boat.x - isl.x, boat.z - isl.z) - isl.r;
      if (d < 17 && d < bd) { bd = d; best = isl; }
    }
  }
  if (best === state.near) return;
  state.near = best;
  refreshDock();
}
let dockKey = null;
function refreshDock() {
  const key = state.auto ? 'a' + state.auto.def.id : state.near ? 'n' + state.near.def.id : '';
  if (key === dockKey) return;
  dockKey = key;
  syncMapMarks();
  const isl = state.auto || state.near;
  islands.forEach(i => i.el.classList.toggle('is-near', i === isl));
  if (!isl) { ui.dock.classList.remove('show'); return; }
  ui.dockTitle.textContent = isl.def.title;
  ui.dockSub.textContent = state.auto ? 'Sailing there now' : isl.def.sub;
  ui.dockLabel.textContent = state.auto ? 'Take the helm' : (isl.def.action || 'Go ashore');
  ui.dockKbd.hidden = !!state.auto;
  ui.dockFlag.style.setProperty('--c', isl.def.color);
  ui.dock.classList.add('show');
}

/* ---------- the scroll map: the whole archipelago, north up, drawn from the real island geometry ---------- */
const SM = { open: false, narrow: null, groups: [], boat: null, trail: null, buoys: [], pts: [], lastX: NaN, lastZ: NaN, bt: 0, dirty: true };
const isNarrow = () => matchMedia('(max-width: 640px)').matches;
/* world (x, z) -> map: the top of the map is +z, the way the boat faces when you first set sail */
const MX = (x) => -x, MY = (z) => -z, r1 = (v) => Math.round(v * 10) / 10;
const polyD = (pts, ox, oz, k = 1) => pts.map(([x, z], i) => `${i ? 'L' : 'M'}${r1(MX(ox + x * k))} ${r1(MY(oz + z * k))}`).join('') + 'Z';
const GLYPH = {
  lighthouse: '<path d="M-2.6,6 L-1.5,-5 L1.5,-5 L2.6,6 Z"/><path d="M-2.4,-5 L0,-8.5 L2.4,-5 Z"/>',
  logbook: '<path d="M0,-2.5 Q-3.5,-5 -7,-3 L-7,4.5 Q-3.5,2.5 0,4.5 Q3.5,2.5 7,4.5 L7,-3 Q3.5,-5 0,-2.5 Z"/><path d="M0,-2.5 L0,4.5"/>',
  cabin: '<path d="M-5,5 L-5,-0.5 L0,-5.5 L5,-0.5 L5,5 Z"/>',
  crystal: '<path d="M0,-7.5 L4.5,0 L0,7.5 L-4.5,0 Z"/>',
  knot: '<circle cx="-2.2" cy="0" r="4.2"/><circle cx="2.2" cy="0" r="4.2" style="fill:none"/>',
  stack: '<path d="M-4.5,6 L4.5,6 L4.5,1.5 L-4.5,1.5 Z"/><path d="M-3.6,1.5 L3.6,1.5 L3.6,-2.6 L-3.6,-2.6 Z"/><path d="M-2.6,-2.6 L2.6,-2.6 L2.6,-6 L-2.6,-6 Z"/>',
  observatory: '<path d="M-5.5,4.5 L-5.5,0 A5.5,5.5 0 0 1 5.5,0 L5.5,4.5 Z"/><path d="M1,-3.5 L5.5,-7.5"/>',
  tower: '<path d="M-3.5,6 L0,-6 L3.5,6 Z" style="fill:none"/><circle cx="0" cy="-6.5" r="1.8"/>'
};
function buildMap() {
  const rhumbs = [];
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; rhumbs.push(`<line class="sm-rhumb" x1="-200" y1="200" x2="${r1(-200 + Math.cos(a) * 760)}" y2="${r1(200 + Math.sin(a) * 760)}"/>`); }
  const compass = `<g transform="translate(-200 200)" aria-hidden="true">
      <circle class="cp-ring" r="30"/><circle class="cp-ring" r="23"/>
      <path class="cp-light" d="M0,-30 L5,0 L0,30 L-5,0 Z"/><path class="cp-light" d="M-30,0 L0,-5 L30,0 L0,5 Z"/>
      <path class="cp-dark" d="M0,-30 L5,0 L-5,0 Z"/><path class="cp-dark" d="M30,0 L0,5 L0,-5 Z"/><path class="cp-dark" d="M0,30 L-5,0 L5,0 Z"/><path class="cp-dark" d="M-30,0 L0,-5 L0,5 Z" style="opacity:.35"/>
      <text class="cp-n" y="-35">N</text></g>`;
  const isls = islands.map((isl, i) => {
    const { x, z, def } = isl, X = r1(MX(x)), Y = r1(MY(z));
    const maxR = Math.max(...isl.coast.map(([a, b]) => Math.hypot(a, b)));
    const pc = Math.cos(isl.pier.a), ps = Math.sin(isl.pier.a);
    /* put the name on the side away from the pier so the two never collide */
    const nameY = MY(ps) > 0.35 ? Y - maxR * 1.3 - 8 : Y + maxR * 1.3 + 18;
    const dot = (c, lx, lz, rad) => `<circle class="${c}" cx="${r1(MX(x + lx))}" cy="${r1(MY(z + lz))}" r="${rad}"/>`;
    return `<g class="sm-isl" data-i="${i}" role="button" tabindex="0" aria-label="Sail to ${def.title}" style="--c:${def.color}">
      <title>Sail to ${def.title}</title>
      <circle class="sm-hit" cx="${X}" cy="${Y}" r="${r1(maxR * 1.9)}"/>
      <path class="sm-ripple sm-ripple2" d="${polyD(isl.coast, x, z, 1.55)}"/>
      <path class="sm-ripple" d="${polyD(isl.coast, x, z, 1.28)}"/>
      <line class="sm-pier" x1="${r1(MX(x + pc * isl.pier.from))}" y1="${r1(MY(z + ps * isl.pier.from))}" x2="${r1(MX(x + pc * isl.pier.to))}" y2="${r1(MY(z + ps * isl.pier.to))}"/>
      <path class="sm-coast" d="${polyD(isl.coast, x, z)}"/>
      <path class="sm-grass" d="${polyD(isl.grass, x, z)}"/>
      ${isl.rocks.map(([a, b, sz]) => dot('sm-rock', a, b, r1(sz * 0.8))).join('')}
      ${isl.trees.map(([a, b]) => dot('sm-tree', a, b, 1.9)).join('')}
      <g class="sm-mark" transform="translate(${X} ${Y})">${GLYPH[def.kind] || '<circle r="3"/>'}</g>
      <circle class="sm-ring" cx="${X}" cy="${Y}" r="${r1(maxR * 1.75)}"/>
      <text class="sm-name" x="${X}" y="${r1(nameY)}">${def.title}<tspan class="sm-tick" dx="4">✓</tspan></text>
    </g>`;
  }).join('');
  ui.smap.innerHTML = `<defs><radialGradient id="smSea"><stop offset="0" stop-color="#3f7f8c" stop-opacity=".05"/><stop offset="1" stop-color="#3f7f8c" stop-opacity=".22"/></radialGradient></defs>
    <circle class="sm-sea" r="${WORLD_R}"/>
    <g aria-hidden="true">${rhumbs.join('')}</g>
    <circle class="sm-edge" r="${WORLD_R}"/>
    ${compass}
    <path class="sm-trail" d="" aria-hidden="true"/>
    <g aria-hidden="true">${buoys.map(() => '<circle class="sm-buoy" r="2.2"/>').join('')}</g>
    ${isls}
    <g class="sm-boat" aria-hidden="true"><path d="M0,-10 L6.5,7 L0,3.5 L-6.5,7 Z"/></g>`;
  SM.groups = Array.from(ui.smap.querySelectorAll('.sm-isl'));
  SM.boat = ui.smap.querySelector('.sm-boat');
  SM.trail = ui.smap.querySelector('.sm-trail');
  SM.buoys = Array.from(ui.smap.querySelectorAll('.sm-buoy'));
  syncMapMarks();
}
function syncMapMarks() {
  SM.groups.forEach((g, i) => {
    g.classList.toggle('is-target', islands[i] === state.auto);
    g.classList.toggle('visited', state.visited.has(islands[i].def.id));
  });
}
function setScroll(open) {
  SM.open = open;
  ui.scroll.classList.toggle('rolled', !open);
  ui.scrollPaper.inert = !open;
  ui.scrollPaper.setAttribute('aria-hidden', String(!open));
  ui.scrollToggle.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('map-open', open);
  ui.scrollToggleText.textContent = open ? 'Hide map' : 'Show map';
  ui.scrollTop.title = ui.scrollBottom.title = open ? 'Roll up the map' : 'Unroll the map';
  if (open) { SM.dirty = true; SM.bt = 1; updateScroll(0); }
  setTimeout(measureAvoid, 620);
}
/* on phones the map floats over the scene, so it rolls itself up once it has done its job */
function closeMapOverlay() { if (islands.length && SM.open && isNarrow()) setScroll(false); }
function updateScroll(dt) {
  if (state.mode === 'sail') {
    const d = Math.hypot(boat.x - SM.lastX, boat.z - SM.lastZ);
    if (!(d <= 25) || d > 3) {
      SM.pts.push([d <= 25 ? 'L' : 'M', boat.x, boat.z]); SM.lastX = boat.x; SM.lastZ = boat.z; SM.dirty = true;
      if (SM.pts.length > 700) { SM.pts.splice(0, 100); SM.pts[0][0] = 'M'; }
    }
  }
  if (!SM.open || !SM.boat) return;
  SM.boat.setAttribute('transform', `translate(${r1(MX(boat.x))} ${r1(MY(boat.z))}) rotate(${r1(-boat.h * 180 / Math.PI)})`);
  if (SM.dirty) { SM.trail.setAttribute('d', SM.pts.map(([c, x, z]) => `${c}${r1(MX(x))} ${r1(MY(z))}`).join('')); SM.dirty = false; }
  if ((SM.bt += dt) > 0.25) {
    SM.bt = 0;
    buoys.forEach((b, i) => { const el = SM.buoys[i]; if (el) { el.setAttribute('cx', r1(MX(b.x))); el.setAttribute('cy', r1(MY(b.z))); } });
  }
}
buildMap();
SM.narrow = isNarrow();
setScroll(!SM.narrow);
ui.scrollToggle.addEventListener('click', (e) => {
  setScroll(!SM.open);
  if (SM.open && e.detail === 0) setTimeout(() => SM.groups[0] && SM.groups[0].focus(), 80);
});
ui.scrollTop.addEventListener('click', () => setScroll(!SM.open));
ui.scrollBottom.addEventListener('click', () => setScroll(!SM.open));
ui.smap.addEventListener('click', (e) => {
  const g = e.target instanceof Element && e.target.closest('.sm-isl');
  if (g) setCourse(islands[+g.dataset.i]);
});
ui.smap.addEventListener('keydown', (e) => {
  const g = e.target instanceof Element && e.target.closest('.sm-isl');
  if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setCourse(islands[+g.dataset.i]); }
});
document.addEventListener('pointerdown', (e) => {
  if (SM.open && isNarrow() && !ui.scroll.contains(e.target)) setScroll(false);
});

const _p = new THREE.Vector3();
let avoid = [];
function measureAvoid() {
  avoid = ['.brand', '.hud-right', SM.open ? '.scroll' : null].filter(Boolean).map(q => $(q)).filter(Boolean).map(el => el.getBoundingClientRect())
    .filter(r => r.width).map(r => ({ l: r.left - 6, t: r.top - 6, r: r.right + 6, b: r.bottom + 6 }));
  islands.forEach(i => { i.lw = 0; });
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureAvoid);
function updateLabels() {
  const w = view.w, h = view.h;
  for (const isl of islands) {
    _p.set(isl.x, isl.labelY, isl.z);
    const dist = camera.position.distanceTo(_p);
    _p.project(camera);
    if (_p.z > 1 || _p.z < -1 || Math.abs(_p.x) > 1.25 || Math.abs(_p.y) > 1.25) {
      if (isl.lv !== 0) { isl.el.style.opacity = '0'; isl.el.style.pointerEvents = 'none'; isl.lv = 0; }
      continue;
    }
    const sx = (_p.x * 0.5 + 0.5) * w, sy = (-_p.y * 0.5 + 0.5) * h;
    let o = clamp(1 - (dist - 190) / 130, 0, 1);
    const s = clamp(1.12 - dist / 420, 0.72, 1.04);
    if (!isl.lw) { isl.lw = isl.el.offsetWidth; isl.lh = isl.el.offsetHeight; }
    const hw = isl.lw * s / 2, top = sy - isl.lh * s - 8;
    if (avoid.some(a => sx + hw > a.l && sx - hw < a.r && sy > a.t && top < a.b)) o = Math.min(o, 0.12);
    isl.el.style.transform = `translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0) translate(-50%,-100%) scale(${s.toFixed(3)})`;
    if (Math.abs(o - isl.lv) > 0.01) { isl.el.style.opacity = o.toFixed(2); isl.el.style.pointerEvents = o > 0.3 ? '' : 'none'; isl.lv = o; }
  }
}


/* Mobile browsers fire resize continuously while the URL bar slides, so the cheap work
   (canvas + camera) runs every time and the layout work waits until it settles. */
function onResize() {
  const { width: w, height: h, ratio } = measureViewport();
  if (w === view.w && h === view.h) return;
  view.w = w; view.h = h;
  renderer.setSize(w, h);
  camera.aspect = ratio;
  camera.fov = w < h ? 66 : 55;
  camera.updateProjectionMatrix();
}
function onResizeSettled() {
  if (isNarrow() !== SM.narrow) { SM.narrow = isNarrow(); setScroll(!SM.narrow); }
  measureAvoid();
}
const view = { w: 0, h: 0 };
onViewportChange(onResize, onResizeSettled);
onResize();
onResizeSettled();

/* ---------- main loop ---------- */
let last = performance.now();
const perf = { acc: 0, n: 0, warm: 0, pr: renderer.getPixelRatio() };
function adaptQuality(dt) {
  if ((perf.warm += dt) < 4) return;
  perf.acc += dt; perf.n++;
  if (perf.acc < 2.5) return;
  const avg = perf.acc / perf.n; perf.acc = perf.n = 0;
  if (avg > 1 / 40 && perf.pr > 1) { perf.pr = Math.max(1, perf.pr - 0.25); renderer.setPixelRatio(perf.pr); renderer.setSize(view.w, view.h); }
}
function frame(now) {
  if (state.dead) return;
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  if (state.plain || state.resume) return; /* the scene is fully covered, so skip the work */
  time += dt;
  adaptQuality(dt);
  stepSky(dt);
  waterU.uTime.value = time;
  const inp = getInput(dt);
  stepBoat(dt, inp);
  stepFloaters(dt);
  poseBoat(dt);
  updateWake(dt);
  updateBottles(dt);
  updateAmbient(dt);
  for (const f of animators) f(time, dt);
  updateCamera(dt);
  const fx = state.mode === 'intro' ? 0 : boat.x, fz = state.mode === 'intro' ? 10 : boat.z;
  water.position.set(Math.round(fx / WSTEP) * WSTEP, 0, Math.round(fz / WSTEP) * WSTEP);
  sun.position.set(fx + SUN_OFF.x, SUN_OFF.y, fz + SUN_OFF.z);
  sun.target.position.set(fx, 0, fz);
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  updateProximity();
  renderer.render(scene, camera);
  updateLabels();
  updateScroll(dt);
}
requestAnimationFrame(frame);
ui.start.focus({ preventScroll: true });
})();
