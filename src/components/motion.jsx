/**
 * Shared motion primitives.
 *
 * Two rules shape everything here. First, this is a tool people use all day for
 * data entry, so motion is short (150-260ms) and never blocks input — nothing
 * animates a value the user is about to type into. Second, every animation is
 * skipped when the viewer prefers reduced motion; that is honoured by dropping
 * the animation entirely rather than shortening it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

/** Soft, quick spring used for anything that enters or leaves. */
const SPRING = { type: 'spring', stiffness: 380, damping: 32, mass: 0.7 };
const FADE = { duration: 0.18, ease: [0.22, 1, 0.36, 1] };

/** Fades and lifts its children in. Used for page and panel content. */
export function FadeIn({ children, delay = 0, y = 8, style, className }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div style={style} className={className}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...FADE, delay }}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggers its children in. `count` is capped deliberately: on a 200-row table
 * a per-row delay would take seconds to settle, so rows past the cap appear
 * with no delay at all.
 */
export function Stagger({ children, step = 0.03, max = 12, style, className }) {
  const reduce = useReducedMotion();
  const items = React.Children.toArray(children);
  if (reduce) {
    return (
      <div style={style} className={className}>
        {children}
      </div>
    );
  }
  return (
    <div style={style} className={className}>
      {items.map((child, i) => (
        <FadeIn key={child.key ?? i} delay={Math.min(i, max) * step}>
          {child}
        </FadeIn>
      ))}
    </div>
  );
}

/** Modal / drawer wrapper: springs in, fades out, escapes cleanly. */
export function Reveal({ show, children, style, className }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.97, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 4 }}
          transition={reduce ? FADE : SPRING}
          style={style}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Counts a number up to its new value.
 *
 * It animates on first paint too, not only on later changes — mounting straight
 * onto the final figure made this a no-op in the one case anyone actually sees,
 * which is opening the page. The run is short (500ms) and always lands exactly
 * on the target, and reduced-motion skips it entirely. Formatting is delegated
 * so currency and plain counts share the same component.
 */
export function CountUp({ value, duration = 500, format = (n) => n.toLocaleString(), style, className }) {
  const reduce = useReducedMotion();
  const target = Number(value) || 0;
  // Start from zero so the very first render has something to count up from.
  const [shown, setShown] = useState(reduce ? target : 0);
  const fromRef = useRef(reduce ? target : 0);

  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = target;
    if (reduce || from === target) {
      setShown(target);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic: quick to start, settles gently on the real number.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduce]);

  return (
    <span style={style} className={className}>
      {format(Math.round(shown))}
    </span>
  );
}

export { motion, AnimatePresence, useReducedMotion };
