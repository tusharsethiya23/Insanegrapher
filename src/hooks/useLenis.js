import { useEffect, useState } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * useLenis
 * ------------------------------------------------------------------
 * Creates ONE Lenis instance for the whole app and wires it to GSAP:
 *   - Lenis is driven by gsap.ticker (one shared rAF loop)
 *   - every Lenis scroll updates ScrollTrigger
 *   - lagSmoothing(0) so scrubbed timelines never "jump" after a hitch
 *
 * Any component can call useLenis(); they all get the same instance.
 * It returns null on the very first render (created in an effect).
 */
let instance = null;
let users = 0;
let raf = null;

export default function useLenis(options) {
  const [lenis, setLenis] = useState(instance);

  useEffect(() => {
    if (!instance) {
      instance = new Lenis(options);
      instance.on('scroll', ScrollTrigger.update);
      raf = (time) => instance.raf(time * 1000); // gsap time is in seconds
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }
    users += 1;
    setLenis(instance);

    return () => {
      users -= 1;
      if (users === 0) {
        gsap.ticker.remove(raf);
        instance.destroy();
        instance = null;
      }
    };
    // options are read once, on creation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return lenis;
}
