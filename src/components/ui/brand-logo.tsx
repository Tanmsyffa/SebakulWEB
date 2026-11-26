import * as React from 'react';
import Image from 'next/image';
import { BRAND_LOGO_SRC } from '@/lib/brand';
import { cn } from '@/lib/utils';

const logoSizes = {
  sm: { box: 'h-9 w-9 rounded-lg', px: 36 },
  md: { box: 'h-11 w-11 rounded-xl', px: 44 },
  lg: { box: 'h-14 w-14 rounded-xl', px: 56 },
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
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-[#0F766E] ring-1 ring-border-subtle',
        box,
        className
      )}
    >
      <Image
        src={BRAND_LOGO_SRC}
        alt={decorative ? '' : 'Logo SEBAKUL'}
        aria-hidden={decorative || undefined}
        width={px}
        height={px}
        priority={priority}
        unoptimized
        className="h-full w-full object-cover"
      />
    </span>
  );
}
