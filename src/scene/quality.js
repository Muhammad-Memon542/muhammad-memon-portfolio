/**
 * Quality tiers and viewport sizing.
 *
 * Phones have a fraction of a laptop's fill rate, so the scene is built at one of two
 * tiers picked up front. The approach follows Bruno Simon's folio-2025 (`Game/Quality.js`
 * and `Game/Viewport.js`), adapted to what actually costs us frames here:
 *
 *   - Cap the pixel ratio. A phone at devicePixelRatio 3 would otherwise render ~9x the
 *     pixels of a CSS-pixel-sized buffer, and this scene is fragment-bound.
 *   - Only ask for MSAA below pixel ratio 2. Above that the extra samples are close to
 *     invisible and cost real milliseconds — this is Bruno's `antialias: pixelRatio < 2`.
 *   - Shrink the things that scale per-pixel (water shader work) and per-object
 *     (flotsam, stars, clouds, wake puffs, shadow casters).
 *
 * `measureViewport` deliberately prefers `visualViewport` over `innerWidth/innerHeight`:
 * on iOS Safari the latter includes the strip behind the URL bar, which makes the canvas
 * taller than the visible area and pushes the HUD off screen.
 */

/** @typedef {ReturnType<typeof detectQuality>} Quality */

const TIERS = {
  high: {
    name: 'high',
    pixelRatioMax: 2,
    shadowMapSize: 2048,
    softShadows: true,
    waterSegments: 256,
    cheapWater: false,
    stars: 700,
    clouds: 14,
    wakePuffs: 110,
    dolphinPods: 3,
    flotsamRafts: 5,
    flotsamSingles: 7,
    extraBuoys: 8,
    flotsamShadows: true,
  },
  low: {
    name: 'low',
    pixelRatioMax: 1.5,
    shadowMapSize: 1024,
    softShadows: false,
    waterSegments: 144,
    cheapWater: true,
    stars: 350,
    clouds: 8,
    wakePuffs: 60,
    dolphinPods: 2,
    flotsamRafts: 3,
    flotsamSingles: 4,
    extraBuoys: 6,
    flotsamShadows: false,
  },
};

/**
 * Pick a tier. Mobile user agents and coarse pointers go low, and so do machines that
 * report few cores or little memory (those hints are absent on Safari, hence the
 * belt-and-braces checks).
 */
export function detectQuality() {
  const ua = navigator.userAgent || '';
  const mobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  // iPadOS 13+ reports a desktop UA, so fall back to the touch-points hint.
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = navigator.deviceMemory || 8;

  const low = mobileUA || iPadOS || coarse || cores <= 4 || memory <= 4;
  const tier = low ? TIERS.low : TIERS.high;

  const pixelRatio = Math.min(window.devicePixelRatio || 1, tier.pixelRatioMax);
  return {
    ...tier,
    pixelRatio,
    /*
     * MSAA stops being worth its cost once we're already supersampling, which is
     * Bruno's `antialias: pixelRatio < 2` rule. That rule assumes everyone is capped
     * at 2; because phones are capped at 1.5 here it would switch MSAA back *on* for
     * exactly the devices that can least afford it, so the low tier opts out flatly
     * and leans on pixel-ratio supersampling for smooth edges instead.
     */
    antialias: !low && pixelRatio < 2,
  };
}

/**
 * Measure the drawing area.
 *
 * `visualViewport` tracks the actually-visible region, so the canvas stays the right
 * size while a mobile URL bar slides in and out, and while a pinch-zoom is active.
 */
export function measureViewport() {
  const vv = window.visualViewport;
  const width = Math.round(vv ? vv.width : window.innerWidth);
  const height = Math.round(vv ? vv.height : window.innerHeight);
  return { width, height, ratio: width / Math.max(1, height) };
}

/**
 * Listen for anything that changes the drawing area.
 *
 * Mobile browsers fire `resize` continuously while the URL bar animates, so callers get
 * an immediate `onChange` (cheap: camera + renderer size) and a trailing `onSettled`
 * for anything expensive enough that it should only run once the dust has settled.
 *
 * @returns {() => void} unsubscribe
 */
export function onViewportChange(onChange, onSettled, settleMs = 300) {
  let timer = null;
  const handle = () => {
    onChange();
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; if (onSettled) onSettled(); }, settleMs);
  };

  addEventListener('resize', handle);
  addEventListener('orientationchange', handle);
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', handle);
    /* iOS shifts the visual viewport when the URL bar collapses; keep the canvas glued. */
    vv.addEventListener('scroll', handle);
  }

  return () => {
    removeEventListener('resize', handle);
    removeEventListener('orientationchange', handle);
    if (vv) {
      vv.removeEventListener('resize', handle);
      vv.removeEventListener('scroll', handle);
    }
    if (timer) clearTimeout(timer);
  };
}
