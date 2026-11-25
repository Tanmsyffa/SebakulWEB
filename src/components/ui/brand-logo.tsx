import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const logoSizes = {
  sm: { box: 'h-9 w-9 rounded-xl', px: 36 },
  md: { box: 'h-11 w-11 rounded-xl', px: 44 },
  lg: { box: 'h-12 w-12 rounded-2xl', px: 48 },
} as const;

export interface BrandLogoProps {
  size?: keyof typeof logoSizes;
  decorative?: boolean;
  priority?: boolean;
  className?: string;
}

export function BrandLogo({
  size = 'sm',
  decorative = true,
  priority = false,
  className,
}: BrandLogoProps) {
  const { box, px } = logoSizes[size];
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-brand-primary shadow-xs ring-1 ring-brand-primary/15',
        box,
        className
      )}
    >
      <Image
        src="/images/sebakul-logo.png"
        alt={decorative ? '' : 'Logo SEBAKUL'}
        aria-hidden={decorative || undefined}
        width={px}
        height={px}
        priority={priority}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
