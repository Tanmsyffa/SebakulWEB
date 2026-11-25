import { getSentraDashboard, getSentraLedger } from '@/server/actions/lapak.actions';
import { getSentraCashflowAnalytics } from '@/server/queries/dashboard-analytics';
import { KasSentraClient } from './kas-sentra-client';

export default async function SentraKasPage() {
  const [dashboard, ledger, monthly] = await Promise.all([getSentraDashboard(), getSentraLedger(), getSentraCashflowAnalytics()]);

  return (
    <KasSentraClient
      ledger={ledger}
      monthly={monthly}
      sewaTerkumpul={dashboard.sewaTerkumpul}
      tunggakan={dashboard.tunggakan}
      invoiceCount={dashboard.invoiceCount}
      activeContractCount={dashboard.activeContractCount}
      biayaOperasional={dashboard.biayaOperasional}
    />
  );
}
