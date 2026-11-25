import type { Metadata } from 'next';
import { getFacilityTickets, getWarungFacilityTickets } from '@/server/actions/lapak.actions';
import { getSupportRequests } from '@/server/actions/support.actions';
import { SupportCenterClient, type FacilityTicketItem } from './support-center-client';

export const metadata: Metadata = {
  title: 'Tiket & Bantuan',
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export default async function SupportPage() {
  const data = await getSupportRequests();
  const initialRequests = data.requests.map((request) => ({
    ...request,
    createdAt: toIsoString(request.createdAt),
  }));

  const facilityTickets: FacilityTicketItem[] =
    data.role === 'TENANT_MEMBER'
      ? (await getWarungFacilityTickets()).map((ticket) => ({
          id: ticket.id,
          category: ticket.category,
          description: ticket.description,
          photoUrl: ticket.photoUrl,
          feedback: ticket.feedback,
          status: ticket.status,
          createdAt: toIsoString(ticket.createdAt),
          resolvedAt: ticket.resolvedAt ? toIsoString(ticket.resolvedAt) : null,
        }))
      : (await getFacilityTickets()).map((ticket) => ({
          id: ticket.id,
          lapakCode: ticket.lapakCode,
          warungName: ticket.warungName,
          category: ticket.category,
          description: ticket.description,
          photoUrl: ticket.photoUrl,
          feedback: ticket.feedback,
          status: ticket.status,
          createdAt: toIsoString(ticket.createdAt),
          resolvedAt: ticket.resolvedAt ? toIsoString(ticket.resolvedAt) : null,
          contact: ticket.contact ?? null,
        }));

  return (
    <SupportCenterClient
      role={data.role}
      initialRequests={initialRequests}
      facilityTickets={facilityTickets}
    />
  );
}
