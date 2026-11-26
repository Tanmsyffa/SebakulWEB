import * as React from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Card, CardContent } from '@/components/ui/card';
import { PageTransition } from '@/components/motion';
import { BRAND_FULL_NAME, BRAND_NAME } from '@/lib/brand';

export function AuthCenteredLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-8 text-text-primary focus:outline-none sm:px-6"
    >
      <PageTransition className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <BrandLogo size="md" priority />
            <span className="text-left">
              <span className="block text-sm font-semibold tracking-tight text-text-primary">
                {BRAND_NAME}
              </span>
              <span className="block text-xs text-text-muted">
                {BRAND_FULL_NAME}
              </span>
            </span>
          </Link>
        </div>

        <Card>
          <CardContent className="pt-5 sm:pt-6">{children}</CardContent>
        </Card>
      </PageTransition>
    </main>
  );
}
