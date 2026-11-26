import { ErrorStatePage } from '@/components/layout/error-state-page';

export default function ForbiddenPage() {
  return <ErrorStatePage statusCode={403} />;
}
