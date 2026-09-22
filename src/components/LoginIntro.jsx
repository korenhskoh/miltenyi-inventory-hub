import React, { useEffect, useRef } from 'react';
import { createTimeline, createDrawable, stagger, createScope } from 'animejs';

/**
 * The login entrance, choreographed with Anime.js.
 *
 * Motion handles the rest of the app, and does it better there: it is
 * declarative and built around React's mount/unmount. This is the one place
 * where Anime.js earns its own dependency — a hand-authored timeline with
 * several elements on different offsets, plus SVG line-drawing, which Motion
 * has no equivalent for. It also runs exactly once, on a screen nobody is
 * trying to type into, so the one place extra animation cannot slow real work
 * down is precisely this one.
 *
 * Everything is skipped under prefers-reduced-motion, and the animation only
 * ever moves elements from a hidden state to their natural one — so if the
 * script never runs, the screen still looks right.
 */
export default function LoginIntro({ children }) {
  const root = useRef(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const targets = el.querySelectorAll('[data-intro]');
    const strokes = el.querySelectorAll('[data-intro-draw] path, [data-intro-draw] line');

    if (reduce) {
      // Land on the finished state immediately rather than a faster animation.
      targets.forEach((t) => {
        t.style.opacity = '1';
        t.style.transform = 'none';
      });
      return undefined;
    }

    // A scope keeps every animation this component starts together, so the
    // cleanup below cannot leave a timer running against a removed node.
    const scope = createScope({ root: el }).add(() => {
      const tl = createTimeline({ defaults: { ease: 'out(3)' } });

      tl.add(targets, {
        opacity: [0, 1],
        translateY: [14, 0],
        duration: 620,
        // Each element starts a beat after the previous one.
        delay: stagger(90),
      });

      if (strokes.length) {
        tl.add(
          createDrawable(strokes),
          { draw: ['0 0', '0 1'], duration: 900, ease: 'inOut(2)' },
          // Overlaps the fade rather than waiting for it.
          '-=520',
        );
      }
    });

    return () => scope.revert();
  }, []);

  return (
    <div ref={root} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}

/**
 * A thin underline that draws itself in beneath the wordmark.
 * Pure decoration, and inert if the animation never runs — it simply sits there
 * fully drawn.
 */
export function IntroRule({ width = 148 }) {
  return (
    <svg
      data-intro-draw
      width={width}
      height="6"
      viewBox={`0 0 ${width} 6`}
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', margin: '10px auto 0' }}
    >
      <path d={`M1 3 H ${width - 1}`} stroke="url(#introGrad)" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="introGrad" x1="0" y1="0" x2={width} y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0B7A3E" stopOpacity="0.15" />
          <stop offset="0.5" stopColor="#0B7A3E" />
          <stop offset="1" stopColor="#0B7A3E" stopOpacity="0.15" />
        </linearGradient>
      </defs>
    </svg>
  );
}
