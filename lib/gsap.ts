/**
 * gsap.ts — single GSAP entry point. Registers plugins once so every
 * consumer (FloatIn, Parallax, IsometricTilt, Hero) shares one instance.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };
