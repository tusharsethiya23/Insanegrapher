export const pad = (n, len = 2) => String(n).padStart(len, '0');

// Seconds → HH:MM:SS:FF at the given frame rate
export function formatTimecode(seconds, fps = 24) {
  const frames = Math.floor(seconds * fps);
  const s = Math.floor(frames / fps);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(frames % fps)}`;
}
