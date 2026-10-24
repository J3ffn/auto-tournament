/**
 * Fork (free mode): where the Arsenal's columns sit on screen. The site's top
 * bar is a 50px pill 12px under the window's top (and under the
 * impersonation banner when one shows); sticky columns stop 12px below it and
 * never grow past the window, so their buttons stay in reach on short screens.
 */

const BANNER = 'var(--mat-impersonation-height, 0px)';

/** `top` of a sticky column: under the top bar, with a gap. */
export const STICKY_TOP = `calc(${BANNER} + 86px)`;

/** The most a sticky column may be tall: the window under the bar, less a bottom gap. */
export const STICKY_MAX_HEIGHT = `calc(100dvh - ${BANNER} - 98px)`;

/** Screens this short get the compact header and smaller pictures. */
export const SHORT_SCREEN = '@media (max-height: 760px)';

/** Screens this short (a phone on its side) get the smallest pictures and the buttons in a row. */
export const TINY_SCREEN = '@media (max-height: 480px)';

/** Wide enough for the three columns (loadout, catalogue, panel). */
export const WIDE = '(min-width: 1200px)';

/** A thin scrollbar for the columns that scroll on their own. */
export const thinScroll = {
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  scrollbarWidth: 'thin',
} as const;
