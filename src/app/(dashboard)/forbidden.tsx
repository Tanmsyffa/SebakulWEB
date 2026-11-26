import { ErrorStatePage } from '@/components/layout/error-state-page';

export default function DashboardForbiddenPage() {
  return <ErrorStatePage statusCode={403} embedded />;
}
