/**
 * Slate content — edit these to personalise the loader.
 * You can also override any key per-instance: <Loader config={{ director: 'JANE DOE' }} />
 */
export const SLATE_CONFIG = {
  prod: 'PORTFOLIO',
  director: 'INSANEGRAPHER',
  camera: '[CAMERA MODEL]',
  scene: '01',
  take: '01',
  roll: 'A001',
  // null = today's date, auto-formatted as DD.MM.YYYY. Set a string to force a date.
  date: null,

  // Field labels as written on the slate
  labels: {
    prod: 'PROD.',
    director: 'DIRECTOR',
    camera: 'CAMERA',
    scene: 'SCENE',
    take: 'TAKE',
    roll: 'ROLL',
    date: 'DATE',
    timecode: 'TC',
    progress: 'LOADED',
  },
};
