/**
 * Day / dusk / night colour stops.
 *
 * The scene crossfades between these as the viewer's theme changes: `day` at 0,
 * `night` at 1, passing through `dusk` at 0.5. Keys are grouped by how they blend —
 * `SKY_COLS` are colours (lerped in RGB), `SKY_NUMS` are scalars.
 *
 *   top/hor        sky gradient        hs/hg/hi   hemisphere light colour + intensity
 *   sun/si         sun colour + power  beam       lighthouse beam opacity
 *   lamp/win/lan   emissive strengths  stars      star field opacity
 *   deep/shallow/crest/foamCol/glintCol + glint/fres/foam   water shading
 */

export const PALETTE = {
  day:   { top: 0x5b9cc4, hor: 0xf6d5ae, water: 0x2a8796, hs: 0xfff0d8, hg: 0x2f6e78, hi: 0.78, sun: 0xffdcb0, si: 1.05, beam: 0.2, lamp: 0, win: 0, lan: 0.4, stars: 0, cloud: 0xffffff, foam: 1,
           deep: 0x0f6784, shallow: 0x22a3a6, crest: 0x5cc4c2, foamCol: 0xf2fbf7, glintCol: 0xfff2d6, glint: 2.2, fres: 0.4 },
  dusk:  { top: 0x34457e, hor: 0xf09a6c, water: 0x1c4d66, hs: 0xffc7a3, hg: 0x2b4a5f, hi: 0.62, sun: 0xff9d66, si: 0.72, beam: 0.34, lamp: 1.1, win: 0.9, lan: 1.0, stars: 0.2, cloud: 0xf0b39a, foam: 0.8,
           deep: 0x19506f, shallow: 0x25899a, crest: 0x4f95a6, foamCol: 0xf7e6da, glintCol: 0xffc48f, glint: 2.2, fres: 0.5 },
  night: { top: 0x060b22, hor: 0x283462, water: 0x113a52, hs: 0x8fa6ff, hg: 0x08202e, hi: 0.5, sun: 0xa9bcff, si: 0.42, beam: 0.52, lamp: 2.2, win: 1.4, lan: 1.6, stars: 0.9, cloud: 0x3b4675, foam: 0.55,
           deep: 0x0a2a44, shallow: 0x17596c, crest: 0x1f6480, foamCol: 0x9ab9cc, glintCol: 0xd4e0ff, glint: 1.5, fres: 0.4 }
};

export const SKY_COLS = ['top', 'hor', 'hs', 'hg', 'sun', 'cloud', 'deep', 'shallow', 'crest', 'foamCol', 'glintCol'];
export const SKY_NUMS = ['hi', 'si', 'beam', 'lamp', 'win', 'lan', 'stars', 'foam', 'glint', 'fres'];
