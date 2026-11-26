import { ErrorStatePage } from '@/components/layout/error-state-page';

export default function NotFound() {
  return <ErrorStatePage statusCode={404} />;
}
