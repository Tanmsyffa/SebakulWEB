import { getAuditLogs } from '@/server/actions/admin.actions';
import { AuditLogClient } from './audit-log-client';

export default async function AuditLogPage() {
  const logs = await getAuditLogs();

  return <AuditLogClient initialLogs={logs} />;
}
