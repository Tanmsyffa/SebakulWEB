'use client';

import { ErrorStatePage } from '@/components/layout/error-state-page';

export default function DashboardErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorStatePage statusCode={500} onRetry={() => reset()} embedded />;
}
