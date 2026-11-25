'use client';

import * as React from 'react';
import { m, type HTMLMotionProps } from 'motion/react';
import { useHydratedReducedMotion } from './use-hydrated-reduced-motion';

export interface PressableProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  disabled?: boolean;
}

export const Pressable = React.forwardRef<HTMLDivElement, PressableProps>(
  ({ disabled, children, ...props }, ref) => {
    const prefersReduced = useHydratedReducedMotion();

    return (
      <m.div
        ref={ref}
        whileTap={prefersReduced || disabled ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.12 }}
        {...props}
      >
        {children}
      </m.div>
    );
  }
);
Pressable.displayName = 'Pressable';
