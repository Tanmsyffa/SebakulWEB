'use client';

import * as React from 'react';
import { m, type HTMLMotionProps } from 'motion/react';
import { MOTION_DURATION, MOTION_EASE } from './motion-tokens';
import { useHydratedReducedMotion } from './use-hydrated-reduced-motion';

type MotionTag = 'div' | 'section' | 'article' | 'li';

export interface RevealProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  as?: MotionTag;
  delay?: number;
  duration?: number;
  y?: number;
}

const tagMap = {
  div: m.div,
  section: m.section,
  article: m.article,
  li: m.li,
} as const;

export function FadeIn({
  as = 'div',
  delay = 0,
  duration = MOTION_DURATION.normal,
  y = 6,
  children,
  ...props
}: RevealProps) {
  const prefersReduced = useHydratedReducedMotion();
  const Component = tagMap[as] as typeof m.div;
  const clampedY = Math.max(0, Math.min(8, y));

  return (
    <Component
      initial={prefersReduced ? false : { opacity: 0, y: clampedY }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReduced
          ? { duration: 0.01 }
          : { duration, delay, ease: MOTION_EASE }
      }
      {...props}
    >
      {children}
    </Component>
  );
}

export const Reveal = FadeIn;

export interface StaggerProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  as?: 'div' | 'ul' | 'ol' | 'section';
  staggerMs?: number;
  maxTotalMs?: number;
  itemCount?: number;
  delay?: number;
}

const staggerTagMap = {
  div: m.div,
  ul: m.ul,
  ol: m.ol,
  section: m.section,
} as const;

export function Stagger({
  as = 'div',
  staggerMs = 35,
  maxTotalMs = 280,
  itemCount,
  delay = 0,
  children,
  ...props
}: StaggerProps) {
  const prefersReduced = useHydratedReducedMotion();
  const Component = staggerTagMap[as] as typeof m.div;
  const count = itemCount ?? React.Children.count(children);
  const effectiveStep =
    count > 1 ? Math.min(staggerMs, maxTotalMs / count) / 1000 : staggerMs / 1000;

  return (
    <Component
      initial={prefersReduced ? false : 'hidden'}
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: prefersReduced
            ? { staggerChildren: 0 }
            : { staggerChildren: effectiveStep, delayChildren: delay },
        },
      }}
      {...props}
    >
      {children}
    </Component>
  );
}

export interface StaggerItemProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  as?: MotionTag;
  y?: number;
}

export function StaggerItem({
  as = 'div',
  y = 6,
  children,
  ...props
}: StaggerItemProps) {
  const prefersReduced = useHydratedReducedMotion();
  const Component = tagMap[as] as typeof m.div;
  const clampedY = Math.max(0, Math.min(8, y));

  return (
    <Component
      variants={
        prefersReduced
          ? {
              hidden: { opacity: 1, y: 0 },
              visible: { opacity: 1, y: 0 },
            }
          : {
              hidden: { opacity: 0, y: clampedY },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: MOTION_DURATION.normal, ease: MOTION_EASE },
              },
            }
      }
      {...props}
    >
      {children}
    </Component>
  );
}
