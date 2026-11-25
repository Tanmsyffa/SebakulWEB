'use client';

import * as React from 'react';
import { animate } from 'motion/react';
import { cn } from '@/lib/utils';
import { MOTION_EASE } from './motion-tokens';
import { useHydratedReducedMotion } from './use-hydrated-reduced-motion';

export interface AnimatedNumberProps {
  value: number;
  format?: (value: number) => string;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  format,
  duration = 0.35,
  className,
}: AnimatedNumberProps) {
  const prefersReduced = useHydratedReducedMotion();
  const [displayValue, setDisplayValue] = React.useState(value);
  const prevValueRef = React.useRef(value);

  React.useEffect(() => {
    const from = prevValueRef.current;
    prevValueRef.current = value;

    if (prefersReduced || from === value) {
      setDisplayValue(value);
      return;
    }

    const controls = animate(from, value, {
      duration,
      ease: MOTION_EASE,
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
      onComplete: () => setDisplayValue(value),
    });

    return () => controls.stop();
  }, [value, duration, prefersReduced]);

  const formatted = format ? format(displayValue) : displayValue.toLocaleString('id-ID');

  return <span className={cn('tabular-nums', className)}>{formatted}</span>;
}
