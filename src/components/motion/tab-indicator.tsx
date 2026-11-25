'use client';

import * as React from 'react';
import { m } from 'motion/react';
import { cn } from '@/lib/utils';
import { MOTION_DURATION, MOTION_EASE } from './motion-tokens';
import { useHydratedReducedMotion } from './use-hydrated-reduced-motion';

export interface TabIndicatorProps {
  layoutId: string;
  className?: string;
}

export function TabIndicator({ layoutId, className }: TabIndicatorProps) {
  const prefersReduced = useHydratedReducedMotion();

  return (
    <m.span
      aria-hidden="true"
      layoutId={prefersReduced ? undefined : layoutId}
      transition={
        prefersReduced
          ? { duration: 0.01 }
          : { duration: MOTION_DURATION.normal, ease: MOTION_EASE }
      }
      className={cn(className)}
    />
  );
}
