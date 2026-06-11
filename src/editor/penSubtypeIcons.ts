import type { PenSubtype, HighlighterSubtype } from '@/types/sketch'

const PENCIL_SVG = `<svg width="1em" height="1em" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M13.8 2.2a2.51 2.51 0 0 0-3.54 0l-6.9 6.91l-1.76 3.62a1.26 1.26 0 0 0 1.12 1.8a1.23 1.23 0 0 0 .55-.13l3.62-1.76l6-6l.83-.82l.06-.06a2.52 2.52 0 0 0 .02-3.56m-.89.89a1.25 1.25 0 0 1 0 1.77l-1.77-1.77a1.24 1.24 0 0 1 .86-.37a1.22 1.22 0 0 1 .91.37M2.73 13.27L4.29 10L6 11.71zm4.16-2.4L5.13 9.11L10.26 4L12 5.74z"/></svg>`

const BALLPOINT_SVG = `<svg width="1em" height="1em" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.71 7.04c-.34.34-.67.67-.68 1c-.03.32.31.65.63.96c.48.5.95.95.93 1.44s-.53 1-1.04 1.5l-4.13 4.14L15 14.66l4.25-4.24l-.96-.96l-1.42 1.41l-3.75-3.75l3.84-3.83c.39-.39 1.04-.39 1.41 0l2.34 2.34c.39.37.39 1.02 0 1.41M3 17.25l9.56-9.57l3.75 3.75L6.75 21H3z"/></svg>`

const FOUNTAIN_SVG = `<svg width="1em" height="1em" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M18.404 2.998c-.757-.754-2.077-.751-2.828.005l-1.784 1.791L11.586 7H7a.998.998 0 0 0-.939.658l-4 11c-.133.365-.042.774.232 1.049l2 2a.997.997 0 0 0 1.049.232l11-4A.998.998 0 0 0 17 17v-4.586l2.207-2.207v-.001h.001L21 8.409c.378-.378.586-.881.585-1.415c0-.535-.209-1.038-.588-1.415zm-3.111 8.295A.996.996 0 0 0 15 12v4.3l-9.249 3.363l4.671-4.671c.026.001.052.008.078.008A1.5 1.5 0 1 0 9 13.5c0 .026.007.052.008.078l-4.671 4.671L7.7 9H12c.266 0 .52-.105.707-.293L14.5 6.914L17.086 9.5zm3.206-3.208l-2.586-2.586l1.079-1.084l2.593 2.581z"/></svg>`

const BRUSH_SVG = `<svg width="1em" height="1em" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.53 16.122a3 3 0 0 0-5.78 1.128a2.25 2.25 0 0 1-2.4 2.245a4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128m0 0a16 16 0 0 0 3.388-1.62m-5.043-.025a16 16 0 0 1 1.622-3.395m3.42 3.42a16 16 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a16 16 0 0 0-4.649 4.764m3.42 3.42a6.78 6.78 0 0 0-3.42-3.42"/></svg>`

const ROUND_HIGHLIGHTER_SVG = `<svg width="1em" height="1em" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M398.789 22.31a31.762 31.762 0 0 0-22.771-9.52H376a31.769 31.769 0 0 0-22.783 9.552L87.534 292.234a32.086 32.086 0 0 0 .177 45.076l14.7 14.7L16 439.427V478h106.8l52.8-52.8l12.479 12.48a32 32 0 0 0 46-.77l258.234-276.14a31.913 31.913 0 0 0-.6-44.339ZM109.548 446H54.5l46.552-47.1l27.8 27.8Zm101.16-30.946L175.6 379.947l-24.127 24.127l-27.932-27.932l23.986-24.269l-37.191-37.189l48.338-49.105L257.8 364.7Zm68.958-73.74l-98.541-98.54L376.017 44.791l92.923 94.121Z"/></svg>`

const SQUARE_HIGHLIGHTER_SVG = `<svg width="1em" height="1em" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M398.789 22.31a31.762 31.762 0 0 0-22.771-9.52H376a31.769 31.769 0 0 0-22.783 9.552L87.534 292.234a32.086 32.086 0 0 0 .177 45.076l14.7 14.7L16 439.427V478h106.8l52.8-52.8l12.479 12.48a32 32 0 0 0 46-.77l258.234-276.14a31.913 31.913 0 0 0-.6-44.339ZM109.548 446H54.5l46.552-47.1l27.8 27.8Zm101.16-30.946L175.6 379.947l-24.127 24.127l-27.932-27.932l23.986-24.269l-37.191-37.189l48.338-49.105L257.8 364.7Zm68.958-73.74l-98.541-98.54L376.017 44.791l92.923 94.121Z"/><rect x="400" y="400" width="80" height="80" rx="8" fill="currentColor"/></svg>`

const WATERCOLOR_SVG = `<svg width="1em" height="1em" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M21.084 2.914c-1.178-1.179-3.234-1.179-4.412 0l-8.379 8.379a.999.999 0 0 0 0 1.414l3 3a.997.997 0 0 0 1.414 0l8.379-8.379a3.123 3.123 0 0 0-.002-4.414m-1.412 3L12 13.586L10.414 12l7.672-7.672a1.146 1.146 0 0 1 1.586.002a1.123 1.123 0 0 1 0 1.584M8 15c-1.265-.634-3.5 0-3.5 2c0 1.197.5 2-1.5 3c0 0 3.25 2.25 5.5 0c1.274-1.274 1.494-4-.5-5"/></svg>`

export const PEN_SUBTYPE_ICONS: Record<PenSubtype, string> = {
  pencil: PENCIL_SVG,
  ballpoint: BALLPOINT_SVG,
  fountain: FOUNTAIN_SVG,
  brush: BRUSH_SVG,
}

export const HIGHLIGHTER_SUBTYPE_ICONS: Record<HighlighterSubtype, string> = {
  round: ROUND_HIGHLIGHTER_SVG,
  square: SQUARE_HIGHLIGHTER_SVG,
  watercolor: WATERCOLOR_SVG,
}

export const PEN_SUBTYPE_LABEL_KEYS: Record<PenSubtype, string> = {
  pencil: 'penPencil',
  ballpoint: 'penBallpoint',
  fountain: 'penFountain',
  brush: 'penBrush',
}

export const HIGHLIGHTER_SUBTYPE_LABEL_KEYS: Record<HighlighterSubtype, string> = {
  round: 'highlighterRound',
  square: 'highlighterSquare',
  watercolor: 'highlighterWatercolor',
}
