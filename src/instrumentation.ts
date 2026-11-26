import type { Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const digest =
    typeof err === 'object' && err !== null && 'digest' in err
      ? String((err as { digest?: unknown }).digest ?? '')
      : '';

  // Ignore expected Next.js navigation interrupts (redirect, notFound, forbidden)
  if (
    digest.startsWith('NEXT_REDIRECT') ||
    digest.startsWith('NEXT_NOT_FOUND') ||
    digest.startsWith('NEXT_HTTP_ERROR_FALLBACK')
  ) {
    return;
  }

  const errorObj = err instanceof Error ? err : new Error(String(err));

  // Detailed error log stays strictly on the server/backend runtime logs
  console.error('[SEBAKUL Server Error]', {
    timestamp: new Date().toISOString(),
    method: request.method,
    path: request.path,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    digest: digest || undefined,
    name: errorObj.name,
    message: errorObj.message,
    stack: errorObj.stack,
  });
};
