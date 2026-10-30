// When the MOBILE photo crop + mobile lens values are used.
// Phones, plus portrait tablets (a 16:9 crop would hide the lens there).
// Keep in sync with the media query at the top of Hero.css.
export const MOBILE_QUERY = '(max-width: 767px), (max-aspect-ratio: 3/4)';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// All work is 16:9. On screens narrower than 4:3 (phones, portrait tablets)
// films are shown whole with a blurred backdrop instead of being cropped.
// (keep in sync with FitVideo.css)
export const FIT_CONTAIN_QUERY = '(max-aspect-ratio: 4/3)';

// Format readout in the viewfinder
export const MEDIA_LABEL = '16:9 HD';
