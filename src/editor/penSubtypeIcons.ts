import type { PenSubtype, HighlighterSubtype } from '@/types/sketch'

const PENCIL_SVG = `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M38.4 6L42 9.6L15.6 36H12V32.4L38.4 6Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M8 42H42" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M33 11.6L36.6 15.2" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`

const BALLPOINT_SVG = `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.32 43.5L13.81 43.5L44.92 12.39L36.44 3.9L5.32 35.01L5.32 43.5Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M27.95 12.39L36.44 20.87" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`

const FOUNTAIN_SVG = `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 4V18" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M18 18H30L34 42H14L18 18Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M14 30H34" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M20 4L28 4" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="44" r="2" fill="currentColor" stroke="none"/></svg>`

const BRUSH_SVG = `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 4C24 4 18 14 18 22C18 25.3 20.7 28 24 28C27.3 28 30 25.3 30 22C30 14 24 4 24 4Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M20 28V44" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M28 28V44" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M16 44H32" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`

const ROUND_HIGHLIGHTER_SVG = `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M34 5H6V20H34V5Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M34.03 12H43V28.1L19 31.2V43" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`

const SQUARE_HIGHLIGHTER_SVG = `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M34 5H6V20H34V5Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M34.03 12H43V28.1L19 31.2V43" stroke="currentColor" stroke-width="4" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M15 31H23" stroke="currentColor" stroke-width="6" stroke-linecap="butt"/></svg>`

const WATERCOLOR_SVG = `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M34 5H6V20H34V5Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M34.03 12H43V28.1L19 31.2V43" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="36" r="4" fill="none" stroke="currentColor" stroke-width="2" opacity="0.6"/><circle cx="20" cy="38" r="3" fill="none" stroke="currentColor" stroke-width="2" opacity="0.4"/></svg>`

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
