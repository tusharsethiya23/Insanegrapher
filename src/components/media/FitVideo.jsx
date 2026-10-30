import { useEffect, useRef, useState } from 'react';
import { FIT_CONTAIN_QUERY } from '../Hero/breakpoints';
import './FitVideo.css';

// true while the media query matches (kept in sync on resize/rotate)
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/**
 * A 16:9 film that fills any box:
 *  - landscape screens: the film simply covers the box
 *  - portrait / squarish screens (FIT_CONTAIN_QUERY): the film is shown whole
 *    and a blurred, darkened backdrop fills the space above and below — the
 *    poster still if there is one (no second video download), otherwise a
 *    copy of the video that mirrors play/pause/seek. Only rendered when needed.
 *
 * Props
 *  videoRef      – ref to the MAIN <video> (control playback through it)
 *  sources       – { webm, mp4, poster }
 *  mainClassName – extra class on the main <video>
 *  autoPlay, preload
 */
export default function FitVideo({ videoRef, sources, mainClassName = '', autoPlay = false, preload = 'auto' }) {
  const contain = useMediaQuery(FIT_CONTAIN_QUERY);
  const bgRef = useRef(null);

  // With a poster, the blurred backdrop is just that still image: it looks the
  // same under heavy blur and avoids downloading the video a second time
  const stillBackdrop = Boolean(sources.poster);

  // A video backdrop follows the main video
  useEffect(() => {
    const main = videoRef.current;
    const bg = bgRef.current;
    if (!main || !bg || stillBackdrop) return;
    const sync = () => {
      if (Math.abs(bg.currentTime - main.currentTime) > 0.3) bg.currentTime = main.currentTime;
    };
    const onPlay = () => {
      sync();
      bg.play().catch(() => {});
    };
    const onPause = () => bg.pause();
    main.addEventListener('play', onPlay);
    main.addEventListener('pause', onPause);
    main.addEventListener('seeked', sync);
    if (!main.paused) onPlay();
    return () => {
      main.removeEventListener('play', onPlay);
      main.removeEventListener('pause', onPause);
      main.removeEventListener('seeked', sync);
    };
  }, [contain, videoRef, stillBackdrop]);

  const sourceEls = (
    <>
      {sources.webm && <source src={sources.webm} type="video/webm" />}
      {sources.mp4 && <source src={sources.mp4} type="video/mp4" />}
    </>
  );

  return (
    <div className="fit">
      {contain &&
        (stillBackdrop ? (
          <img className="fit__bg" src={sources.poster} alt="" aria-hidden="true" />
        ) : (
          <video ref={bgRef} className="fit__bg" muted loop playsInline preload={preload} aria-hidden="true">
            {sourceEls}
          </video>
        ))}
      <video
        ref={videoRef}
        className={`fit__main ${mainClassName}`}
        muted
        loop
        playsInline
        autoPlay={autoPlay}
        preload={preload}
        poster={sources.poster}
      >
        {sourceEls}
      </video>
    </div>
  );
}
