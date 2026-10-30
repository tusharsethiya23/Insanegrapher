/**
 * The crew section: the camera scans the group photo (Cam A, wide) and cuts
 * to each person's close-up (Cam B).
 *
 * TEAM_PHOTO is a DEMO group photo: only Gourav, Uttam, Sushank and Nitesh
 * are in it (the other three people aren't on the team and get no AF box).
 * When the real group photo arrives, swap the file and update each `face`.
 *
 * Each member (shown in this order):
 *  name      – shown on the AF box, the caption and Cam B
 *  role, bio – optional; the role line is hidden while empty
 *  portrait  – optional 4:5 close-up for Cam B (crew-<name>.webp, cropped from
 *              the full portraits in /source-footage/images: Adarsh.jpeg, Gourav.jpeg, …)
 *  face      – optional { x, y, size } of their face in TEAM_PHOTO:
 *              centre in % of photo width/height, size = face width in % of width.
 *              Without `face` the person is "off frame": Cam A goes soft and
 *              Cam B carries their moment.
 *
 * To check face positions visually, set showFaceMarkers on <CrewFocus>.
 */
export const TEAM_PHOTO = {
  src: '/assets/images/team-crop.webp',
  width: 895,
  height: 553,
  alt: 'Gourav, Uttam, Sushank and Nitesh of Team Insane with friends on an event stage',
};

export const TEAM = [
  {
    name: 'Gourav',
    role: '',
    portrait: '/assets/images/crew-gourav.webp',
    face: { x: 16, y: 31.5, size: 7.5 },
  },
  {
    name: 'Uttam',
    role: '',
    portrait: '/assets/images/crew-uttam.webp',
    face: { x: 24.5, y: 31.5, size: 6.5 },
  },
  {
    name: 'Sushank',
    role: '',
    portrait: '/assets/images/crew-sushank.webp',
    face: { x: 39.5, y: 33.5, size: 6 },
  },
  {
    name: 'Nitesh',
    role: '',
    portrait: '/assets/images/crew-nitesh.webp',
    face: { x: 52.5, y: 32, size: 6.5 },
  },
  // Not in the group photo yet
  { name: 'Adarsh', role: '', portrait: '/assets/images/crew-adarsh.webp' },
  { name: 'Srikant', role: '', portrait: '/assets/images/crew-srikant.webp' },
];
