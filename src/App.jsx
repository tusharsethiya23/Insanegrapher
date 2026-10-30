import { useEffect, useState } from 'react';
import Loader from './components/Loader/Loader';
import Hero from './components/Hero/Hero';
import EditTimeline from './components/Work/EditTimeline';
import { PROJECTS } from './data/projects';
import CrewFocus from './components/Crew/CrewFocus';
import { TEAM, TEAM_PHOTO } from './data/team';
import ExportContact from './components/Contact/ExportContact';
import EndCredits from './components/Credits/EndCredits';
import { CONTACT } from './data/contact';
import { MOBILE_QUERY } from './components/Hero/breakpoints';
import useLenis from './hooks/useLenis';
import './App.css';

/* ------------------------------------------------------------------
   Hero content. Lens values were measured from the transparent hole
   in each image's alpha channel (both holes are 109px circles).
   To fine-tune, set showLensMarker on <Hero> and nudge x / y / size.
   ------------------------------------------------------------------ */
const HERO = {
  name: ['INSANE', 'GRAPHER'], // one array item per line of the big hero name
  fullName: 'Insanegrapher', // what screen readers announce
  title: 'Video Editor & Videographer',
  photo: {
    alt: 'Insanegrapher holding a camera, lens pointed at the viewer',
    desktop: { src: '/assets/images/hero-desktop.webp', width: 2560, height: 1440 },
    mobile: { src: '/assets/images/hero-mobile.webp', width: 1080, height: 1969 },
  },
  // Lens centre, % of the image
  lensOrigin: {
    desktop: { x: 89.8, y: 75.55 },
    mobile: { x: 66.95, y: 75.55 },
  },
  // Lens hole diameter, % of the image WIDTH
  lensSize: { desktop: 2.4, mobile: 7.76 },
  // Showreel: plays inside the lens, then fullscreen, then as the first timeline clip.
  // Add `webm` too if you export one; browsers that support it will prefer it.
  video: {
    mp4: '/assets/videos/showreel.mp4',
    poster: '/assets/videos/showreel-poster.webp',
    duration: 52.5, // seconds, = width of the showreel clip on the timeline
  },
};

// The loader preloads exactly what this visitor will see first
function getLoaderAssets() {
  const isMobile = window.matchMedia(MOBILE_QUERY).matches;
  const canWebm = document.createElement('video').canPlayType('video/webm') !== '';
  return {
    images: [isMobile ? HERO.photo.mobile.src : HERO.photo.desktop.src],
    videos: [(canWebm && HERO.video.webm) || HERO.video.mp4],
    fonts: ['400 1em Anton', '400 1em "JetBrains Mono"', '700 1em "JetBrains Mono"'],
  };
}

export default function App() {
  // One Lenis for the app, synced with GSAP's ticker + ScrollTrigger
  const lenis = useLenis();

  const [loaderAssets] = useState(getLoaderAssets);
  const [showLoader, setShowLoader] = useState(true);
  const [heroReady, setHeroReady] = useState(false);

  // Every visit starts at the top, so the pinned zoom always begins at frame 1
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, []);

  // Loader cut → hero entrance. The Hero keeps Lenis stopped until its
  // entrance finishes, then starts it.
  const handleLoaderComplete = () => {
    setShowLoader(false);
    setHeroReady(true);
  };

  return (
    <>
      {showLoader && (
        <Loader
          images={loaderAssets.images}
          videos={loaderAssets.videos}
          fonts={loaderAssets.fonts}
          config={{ director: 'INSANEGRAPHER', camera: '[CAMERA MODEL]' }}
          onComplete={handleLoaderComplete}
        />
      )}

      <main>
        <Hero
          isReady={heroReady}
          lenis={lenis}
          name={HERO.name}
          fullName={HERO.fullName}
          title={HERO.title}
          photo={HERO.photo}
          video={HERO.video}
          lensOrigin={HERO.lensOrigin}
          lensSize={HERO.lensSize}
          showLensMarker={false} // true = red crosshair on the lens for tuning
        />

        {/* Continues straight out of the lens: the fullscreen showreel
            shrinks into the program monitor of an editing timeline */}
        <EditTimeline
          projects={PROJECTS}
          showreel={HERO.video}
          showreelDuration={HERO.video.duration}
          sequenceName="INSANEGRAPHER_2026"
          lenis={lenis}
        />

        {/* The crew: autofocus racks from face to face on the team photo */}
        <CrewFocus
          photo={TEAM_PHOTO}
          members={TEAM}
          title="Team Insane"
          showFaceMarkers={false} // true = red boxes on every face, to check positions
        />

        {/* Contact, staged as exporting a film: the render bar fills, then the form unlocks */}
        <ExportContact
          contact={CONTACT}
          frames={[HERO.video.poster, ...PROJECTS.map((p) => p.poster)].filter(Boolean)}
          sequenceName="INSANEGRAPHER_2026"
        />
      </main>

      <EndCredits
        name="INSANEGRAPHER"
        crewTitle="Team Insane"
        crew={TEAM.map((m) => m.name)}
        films={PROJECTS.map((p) => p.title)}
        contact={CONTACT}
        lenis={lenis}
      />
    </>
  );
}
