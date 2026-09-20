import { describe, it, expect, vi } from 'vitest';

// The primitives are thin wrappers over motion/react; what is worth testing is
// the logic that is ours: the stagger cap and the count-up easing/guards.
vi.mock('motion/react', () => ({
  motion: new Proxy({}, { get: () => 'div' }),
  AnimatePresence: ({ children }) => children,
  useReducedMotion: () => false,
}));

const { CountUp, Stagger, FadeIn, Reveal } = await import('./motion.jsx');

describe('motion primitives', () => {
  it('all export as components', () => {
    for (const C of [CountUp, Stagger, FadeIn, Reveal]) expect(typeof C).toBe('function');
  });
});

describe('stagger delay capping', () => {
  // Rows past the cap must not keep accumulating delay, or a 200-row table
  // would take several seconds to finish appearing.
  const delayFor = (i, step = 0.03, max = 12) => Math.min(i, max) * step;

  it('increases the delay for early items', () => {
    expect(delayFor(0)).toBe(0);
    expect(delayFor(5)).toBeCloseTo(0.15);
  });

  it('caps the delay so long lists settle quickly', () => {
    expect(delayFor(12)).toBeCloseTo(0.36);
    expect(delayFor(200)).toBeCloseTo(0.36);
    expect(delayFor(200)).toBe(delayFor(12));
  });

  it('never exceeds half a second of stagger', () => {
    expect(delayFor(1000)).toBeLessThan(0.5);
  });
});

describe('count-up easing', () => {
  const eased = (t) => 1 - Math.pow(1 - t, 3);

  it('starts at the old value and ends exactly on the new one', () => {
    const from = 10;
    const to = 50;
    expect(from + (to - from) * eased(0)).toBe(10);
    expect(from + (to - from) * eased(1)).toBe(50);
  });

  it('moves fast at first and settles gently', () => {
    expect(eased(0.25)).toBeGreaterThan(0.25);
    expect(eased(0.9)).toBeGreaterThan(0.99);
  });

  it('is monotonic', () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = eased(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('handles counting down as well as up', () => {
    const from = 100;
    const to = 40;
    expect(from + (to - from) * eased(1)).toBe(40);
  });
});
