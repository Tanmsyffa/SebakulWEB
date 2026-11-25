import { getAdminMasterData } from '@/server/actions/admin.actions';
import { getSuperAdminAnalytics } from '@/server/queries/dashboard-analytics';
import { AdminMasterClient } from './admin-master-client';

export default async function AdminMasterPage() {
  const [data, analytics] = await Promise.all([
    getAdminMasterData(),
    getSuperAdminAnalytics(),
  ]);

  return (
    <AdminMasterClient
      lapaks={data.lapaks}
      warungs={data.warungs}
      accounts={data.accounts}
      analytics={analytics}
    />
  );
}
