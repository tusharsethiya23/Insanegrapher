Site media (paths are configured in src/App.jsx -> HERO and src/data/projects.js):

  images/hero-lens-cutout-desktop.webp   – desktop hero photo, lens glass transparent
  images/hero-lens-cutout-mobile.webp    – mobile hero photo, lens glass transparent
  videos/showreel.mp4 (+ -poster.webp)   – showreel: in the lens, fullscreen, first timeline clip
  videos/<project>.mp4 (+ -poster.webp)  – one per project, 16:9 1280×720

Export videos as upright 16:9 H.264 MP4 with "fast start" enabled.
Original camera/export files live in /source-footage (outside public, never deployed).
