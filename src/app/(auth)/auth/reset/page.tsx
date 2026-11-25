import type { Metadata } from 'next';
import { ResetPasswordClient } from './reset-password-client';

export const metadata: Metadata = {
  title: 'Atur Ulang Kata Sandi',
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
