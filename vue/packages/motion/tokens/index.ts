// M3-aligned motion token scale.
//
// Replaces the previous 5-axis scale (duration, easing, distance, stagger,
// intensity) with a 4-pattern × 2-tier model. Each pattern bundles all five
// axes together so the runtime never has to coordinate across independent
// dimensions — picking a pattern + tier fully determines the motion.
export type MotionPattern = 'emphasized' | 'standard' | 'decel' | 'accel'

export type MotionTier = 'short' | 'long'

export type MotionPatternBundle = {
  duration: string
  easing: string
  distance: string
  stagger: string
  intensity: string
}

export type MotionTokens = {
  patterns: Record<MotionPattern, Record<MotionTier, MotionPatternBundle>>
  instant: string
}

export const motionTokens: MotionTokens = {
  patterns: {
    // M3 emphasized: high-attention entry/exit, larger distance, longer stagger
    emphasized: {
      short: {
        duration: '320ms',
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        distance: '12px',
        stagger: '30ms',
        intensity: '0.96',
      },
      long: {
        duration: '360ms',
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        distance: '16px',
        stagger: '40ms',
        intensity: '0.94',
      },
    },
    // M3 standard: ordinary content settle, moderate distance and stagger
    standard: {
      short: {
        duration: '220ms',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        distance: '8px',
        stagger: '25ms',
        intensity: '0.97',
      },
      long: {
        duration: '360ms',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        distance: '12px',
        stagger: '35ms',
        intensity: '0.95',
      },
    },
    // M3 decel: outgoing, ends slowly so the eye lands on the result
    decel: {
      short: {
        duration: '180ms',
        easing: 'cubic-bezier(0, 0, 0.2, 1)',
        distance: '8px',
        stagger: '20ms',
        intensity: '0.97',
      },
      long: {
        duration: '300ms',
        easing: 'cubic-bezier(0, 0, 0.2, 1)',
        distance: '12px',
        stagger: '30ms',
        intensity: '0.95',
      },
    },
    // M3 accel: outgoing or quick entry, snaps out fast
    accel: {
      short: {
        duration: '150ms',
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        distance: '4px',
        stagger: '15ms',
        intensity: '0.98',
      },
      long: {
        duration: '220ms',
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        distance: '8px',
        stagger: '25ms',
        intensity: '0.96',
      },
    },
  },
  // Reduced/disabled terminal duration: forces the runtime to skip animation
  instant: '1ms',
}

export const motionCssVars = {
  patterns: {
    emphasized: {
      short: {
        duration: 'var(--fsus-motion-emphasized-short, 320ms)',
        easing: 'var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1))',
        distance: 'var(--fsus-motion-emphasized-short-distance, 12px)',
        stagger: 'var(--fsus-motion-emphasized-short-stagger, 30ms)',
        intensity: 'var(--fsus-motion-emphasized-short-intensity, 0.96)',
      },
      long: {
        duration: 'var(--fsus-motion-emphasized-long, 360ms)',
        easing: 'var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1))',
        distance: 'var(--fsus-motion-emphasized-long-distance, 16px)',
        stagger: 'var(--fsus-motion-emphasized-long-stagger, 40ms)',
        intensity: 'var(--fsus-motion-emphasized-long-intensity, 0.94)',
      },
    },
    standard: {
      short: {
        duration: 'var(--fsus-motion-standard-short, 220ms)',
        easing: 'var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1))',
        distance: 'var(--fsus-motion-standard-short-distance, 8px)',
        stagger: 'var(--fsus-motion-standard-short-stagger, 25ms)',
        intensity: 'var(--fsus-motion-standard-short-intensity, 0.97)',
      },
      long: {
        duration: 'var(--fsus-motion-standard-long, 360ms)',
        easing: 'var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1))',
        distance: 'var(--fsus-motion-standard-long-distance, 12px)',
        stagger: 'var(--fsus-motion-standard-long-stagger, 35ms)',
        intensity: 'var(--fsus-motion-standard-long-intensity, 0.95)',
      },
    },
    decel: {
      short: {
        duration: 'var(--fsus-motion-decel-short, 180ms)',
        easing: 'var(--fsus-motion-decel, cubic-bezier(0, 0, 0.2, 1))',
        distance: 'var(--fsus-motion-decel-short-distance, 8px)',
        stagger: 'var(--fsus-motion-decel-short-stagger, 20ms)',
        intensity: 'var(--fsus-motion-decel-short-intensity, 0.97)',
      },
      long: {
        duration: 'var(--fsus-motion-decel-long, 300ms)',
        easing: 'var(--fsus-motion-decel, cubic-bezier(0, 0, 0.2, 1))',
        distance: 'var(--fsus-motion-decel-long-distance, 12px)',
        stagger: 'var(--fsus-motion-decel-long-stagger, 30ms)',
        intensity: 'var(--fsus-motion-decel-long-intensity, 0.95)',
      },
    },
    accel: {
      short: {
        duration: 'var(--fsus-motion-accel-short, 150ms)',
        easing: 'var(--fsus-motion-accel, cubic-bezier(0.4, 0, 1, 1))',
        distance: 'var(--fsus-motion-accel-short-distance, 4px)',
        stagger: 'var(--fsus-motion-accel-short-stagger, 15ms)',
        intensity: 'var(--fsus-motion-accel-short-intensity, 0.98)',
      },
      long: {
        duration: 'var(--fsus-motion-accel-long, 220ms)',
        easing: 'var(--fsus-motion-accel, cubic-bezier(0.4, 0, 1, 1))',
        distance: 'var(--fsus-motion-accel-long-distance, 8px)',
        stagger: 'var(--fsus-motion-accel-long-stagger, 25ms)',
        intensity: 'var(--fsus-motion-accel-long-intensity, 0.96)',
      },
    },
  },
  instant: 'var(--fsus-motion-duration-instant, 1ms)',
} as const

export const viewTransitionTokens = {
  duration: motionCssVars.patterns.decel.long.duration,
  sharedDuration: motionCssVars.patterns.standard.long.duration,
  easing: motionCssVars.patterns.decel.long.easing,
  sharedEasing: motionCssVars.patterns.standard.long.easing,
  isolation: 'isolate',
  zIndex: 'var(--fsus-view-transition-z-index, 2147483000)',
} as const

// Backward-compat aliases for the previous 5-axis labels so external code
// that referenced `motionTokenAliases.fast` etc. continues to work.
export const motionTokenAliases = {
  fast: 'var(--fsus-motion-control-fast, 140ms)',
  control: 'var(--fsus-motion-control, 220ms)',
  panel: 'var(--fsus-motion-panel, 360ms)',
  overlay: 'var(--fsus-motion-overlay, 260ms)',
  route: 'var(--fsus-motion-duration-route, 240ms)',
  standardEase: motionCssVars.patterns.standard.short.easing,
  emphasizedEase: motionCssVars.patterns.emphasized.short.easing,
  decelEase: motionCssVars.patterns.decel.short.easing,
  accelEase: motionCssVars.patterns.accel.short.easing,
} as const

// Helper: resolve a preset's pattern-tier bundle.
export const resolvePatternBundle = (
  pattern: MotionPattern,
  tier: MotionTier,
): MotionPatternBundle => motionTokens.patterns[pattern][tier]
