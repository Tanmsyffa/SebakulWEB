'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const avatarSizes = {
  xs: { box: 'h-7 w-7', px: 28 },
  sm: { box: 'h-9 w-9', px: 36 },
  md: { box: 'h-11 w-11', px: 44 },
  lg: { box: 'h-14 w-14', px: 56 },
} as const;

export interface UserAvatarProps {
  name?: string;
  src?: string | null;
  size?: keyof typeof avatarSizes;
  decorative?: boolean;
  className?: string;
}

export function UserAvatar({
  name,
  src,
  size = 'sm',
  decorative = true,
  className,
}: UserAvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const { box, px } = avatarSizes[size];
  const resolvedSrc = !failed && src?.trim() ? src.trim() : '/images/avatar-default.png';

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface-muted',
        box,
        className
      )}
    >
      <Image
        src={resolvedSrc}
        alt={decorative ? '' : name ? `Avatar ${name}` : 'Avatar pengguna'}
        aria-hidden={decorative || undefined}
        width={px}
        height={px}
        onError={() => {
          if (!failed) setFailed(true);
        }}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
