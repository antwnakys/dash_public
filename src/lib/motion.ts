/**
 * One motion language for the whole app, so every moment feels like the same hand made it.
 * Springs (not fixed durations) everywhere: they can be interrupted mid-way and pick up the current speed,
 * which is what makes iOS feel fluid. Change the feel here, not in components.
 */
import type { Transition } from 'framer-motion'

export const spring = {
  /** Small UI that answers a tap: toggles, pills, the tab highlight. Quick with a hint of give. */
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 },
  /** Things that move across the screen: pages, sheets, lists. No overshoot. */
  smooth: { type: 'spring', stiffness: 300, damping: 32, mass: 1 },
  /** Content settling into place on entrance. Soft and unhurried. */
  gentle: { type: 'spring', stiffness: 170, damping: 26, mass: 1 },
  /** Moments of delight (a completed task, the + button, the setup's last screen). Visible bounce. */
  bouncy: { type: 'spring', stiffness: 420, damping: 18, mass: 0.9 },
} satisfies Record<string, Transition>

/** For drawn strokes and fades that should feel eased rather than sprung. */
export const ease = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
}

/** Blur is costly on phones (every frame re-blurs the glass beneath); only pointer devices get it. */
export const canBlur = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches
export const blur = (px: number) => (canBlur ? { filter: `blur(${px}px)` } : {})

/** Press feedback for anything tappable: a quick, slight sink. */
export const press = { scale: 0.97, transition: spring.snappy } as const
