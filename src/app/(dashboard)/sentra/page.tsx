import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getLapakGrid } from '@/server/actions/lapak.actions';
import { getSentraAdminAnalytics } from '@/server/queries/dashboard-analytics';
import { PageHeader, Section } from '@/components/layout';
import { FadeIn, PageTransition } from '@/components/motion';
import { SentraAdminCharts } from '@/components/charts/dashboard-overview-charts';
import { SentraPetaClient } from './sentra-peta-client';

export default async function SentraPetaPage() {
  const [lapaks, analytics] = await Promise.all([
    getLapakGrid(),
    getSentraAdminAnalytics(),
  ]);

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Pengelolaan sentra"
        title="Peta lapak sentra"
        description="Status fisik dan status tagihan terkini untuk seluruh lapak di sentra."
        actions={
          <Link
            href="/sentra/tagihan"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-brand-hover active:bg-brand-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <span>Kelola tagihan</span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
          </Link>
        }
      />

      <Section
        title="Ringkasan operasional"
        description="Tren pembayaran sewa enam bulan terakhir, tunggakan, dan komposisi kondisi lapak."
      >
        <FadeIn delay={0.04}>
          <SentraAdminCharts data={analytics} />
        </FadeIn>
      </Section>

      <SentraPetaClient initialLapaks={lapaks} />
    </PageTransition>
  );
}
