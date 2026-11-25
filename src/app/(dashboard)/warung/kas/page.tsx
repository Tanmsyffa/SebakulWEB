import { getWarungTransactions, getWarungDashboard } from '@/server/actions/warung.actions';
import { KasClient } from './kas-client';

export default async function WarungKasPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const [transactions, dashboard, params] = await Promise.all([
    getWarungTransactions(),
    getWarungDashboard(),
    searchParams,
  ]);

  return (
    <KasClient
      initialTransactions={transactions}
      warungName={dashboard.warung?.name || 'Warung Saya'}
      focusCreate={params?.action === 'create'}
    />
  );
}
