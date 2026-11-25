'use client';

import * as React from 'react';
import { m } from 'motion/react';
import { cn } from '@/lib/utils';
import { MOTION_DURATION, MOTION_EASE } from './motion-tokens';
import { useHydratedReducedMotion } from './use-hydrated-reduced-motion';

export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const prefersReduced = useHydratedReducedMotion();

  return (
    <m.div
      initial={prefersReduced ? false : { opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReduced
          ? { duration: 0.01 }
          : { duration: MOTION_DURATION.normal, ease: MOTION_EASE }
      }
      className={cn(className)}
    >
      {children}
    </m.div>
  );
}
