'use client';

import * as React from 'react';

export function SkipToContent() {
  const handleSkip = () => {
    const target = document.getElementById('main-content');
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start' });
  };

  return (
    <button
      type="button"
      onClick={handleSkip}
      className="sr-only fixed left-4 top-4 z-[100] inline-flex min-h-11 items-center rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-text-primary shadow-md focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-brand-primary"
    >
      Lewati ke konten utama
    </button>
  );
}
