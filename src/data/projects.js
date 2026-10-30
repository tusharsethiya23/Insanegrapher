/**
 * Work shown on the edit timeline (after the showreel clip), in this order.
 * All media is 16:9 (1280×720 here). Files live in public/assets/videos/.
 *
 * Required
 *  id, title
 *  duration – clip length on the timeline, in SECONDS (= the film's length)
 *
 * Optional
 *  type, client, role, year, description
 *  color    – clip label colour (like NLE label colours); also tints placeholders
 *  poster   – still: bin card, filmstrip on the clip, monitor before playback, grade reveal
 *  preview  – muted loop for the program monitor
 *  video    – the full film, played in the project's "Watch" tab (falls back to `preview`)
 *  grade    – { log, graded } stills for the grade reveal. Without them the
 *             poster is used for both and the LOG look is simulated with a filter.
 *  link     – URL of the film (YouTube / Instagram / Vimeo)
 *
 * TODO: titles/types below are read from the footage — check them, and add
 * client, role, year and a one-line description for each.
 */
export const PROJECTS = [
  {
    id: 'holi',
    title: 'Holi',
    type: 'Festival film',
    duration: 37.9,
    color: '#c2417a',
    poster: '/assets/videos/holi-poster.webp',
    preview: '/assets/videos/holi.mp4',
    video: '/assets/videos/holi.mp4',
  },
  {
    id: 'garba-delight',
    title: 'Garba Delight 2.0',
    type: 'Event film',
    duration: 40.5,
    color: '#5b6b8c',
    poster: '/assets/videos/garba-delight-poster.webp',
    preview: '/assets/videos/garba-delight.mp4',
    video: '/assets/videos/garba-delight.mp4',
  },
  {
    id: 'dholkal-monsoon',
    title: 'Dholkal in Monsoon',
    type: 'Travel film',
    duration: 14.4,
    color: '#3f8a56',
    poster: '/assets/videos/dholkal-monsoon-poster.webp',
    preview: '/assets/videos/dholkal-monsoon.mp4',
    video: '/assets/videos/dholkal-monsoon.mp4',
  },
];
