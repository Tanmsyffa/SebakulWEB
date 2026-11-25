import type { Metadata } from 'next';
import { FinishAccountClient } from './finish-account-client';

export const metadata: Metadata = {
  title: 'Atur Kata Sandi',
};

export default function FinishAccountPage() {
  return <FinishAccountClient />;
}
