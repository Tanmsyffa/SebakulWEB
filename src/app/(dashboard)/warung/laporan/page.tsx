import { getBusinessDateString } from '@/lib/business-date';
import { getWarungPeriodReport } from '@/server/actions/warung.actions';
import { WarungReportClient } from './warung-report-client';

export default async function WarungLaporanPage() {
  const jakartaToday = getBusinessDateString();
  const initialStart = `${jakartaToday.slice(0, 8)}01`;
  const report = await getWarungPeriodReport({ startDate: initialStart, endDate: jakartaToday });
  return <WarungReportClient initialReport={report} />;
}
