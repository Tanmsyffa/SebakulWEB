'use client';

import Link from 'next/link';
import { useHydratedReducedMotion } from '@/components/motion';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatRupiah } from '@/lib/utils/currency';

const occupancyMeta: Record<string, { label: string; color: string }> = {
  TERISI: { label: 'Terisi', color: '#0F766E' },
  KOSONG: { label: 'Kosong', color: '#A8A29E' },
  LIBUR: { label: 'Libur', color: '#6B7280' },
  PERBAIKAN: { label: 'Perbaikan', color: '#C2410C' },
};

const compact = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)} jt`
    : value >= 1_000
    ? `${Math.round(value / 1_000)} rb`
    : String(value);

const tooltipStyle = {
  background: '#FFFFFF',
  border: '1px solid #EAE6DF',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#181715',
  boxShadow: '0 4px 12px -2px rgba(24, 23, 21, 0.06)',
};

export function SentraAdminCharts({
  data,
}: {
  data: {
    monthly: { month: string; rent: number }[];
    occupancy: { status: string; total: number }[];
    outstanding: number;
  };
}) {
  const prefersReduced = useHydratedReducedMotion();
  const occupancy = data.occupancy.map((item) => ({
    key: item.status,
    status: occupancyMeta[item.status]?.label ?? item.status,
    color: occupancyMeta[item.status]?.color ?? '#0F766E',
    total: item.total,
  }));
  const hasRentData = data.monthly.some((item) => item.rent > 0);
  const totalLapaks = occupancy.reduce((sum, item) => sum + item.total, 0);

  return (
    <section className="space-y-4" aria-label="Ringkasan operasional sentra">
      <article className="rounded-xl border border-border-subtle bg-surface p-4 sm:p-5">
        <h3 className="text-base font-semibold text-text-primary">Sewa terkumpul per bulan</h3>
        <p className="mt-0.5 text-xs text-text-secondary">
          Pembayaran sewa yang sudah dicatat dalam enam bulan terakhir.
        </p>

        {hasRentData ? (
          <div
            role="img"
            aria-label="Grafik sewa terkumpul bulanan"
            className="mt-4 h-56 w-full sm:h-64"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthly} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE6DF" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#68635D' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={compact}
                  tick={{ fontSize: 12, fill: '#68635D' }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [formatRupiah(value), 'Sewa terkumpul']}
                />
                <Line
                  dataKey="rent"
                  name="Sewa terkumpul"
                  stroke="#0F766E"
                  strokeWidth={1.75}
                  dot={{ fill: '#0F766E', r: 2.5 }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={!prefersReduced}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-border-subtle bg-surface-muted/50 p-4 text-sm text-text-secondary">
            <p>Belum ada pembayaran sewa yang tercatat dalam enam bulan terakhir.</p>
            <Link
              href="/sentra/tagihan"
              className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg border border-border-strong bg-surface px-3.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              Periksa tagihan sewa
            </Link>
          </div>
        )}

        {hasRentData && (
          <ul className="sr-only">
            {data.monthly.map((item) => (
              <li key={item.month}>
                {item.month}: sewa terkumpul {formatRupiah(item.rent)}
              </li>
            ))}
          </ul>
        )}
      </article>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="flex flex-col justify-between rounded-xl border border-border-subtle bg-surface p-4 sm:p-5">
          <div>
            <h3 className="text-[13px] font-medium text-text-secondary">
              Tunggakan sewa
            </h3>
            <p className="mt-2 font-mono text-2xl font-semibold text-status-danger tabular-nums">
              {formatRupiah(data.outstanding)}
            </p>
          </div>
          <p className="mt-3 text-xs text-text-muted">
            Total sisa tagihan yang berstatus belum bayar atau cicilan.
          </p>
        </article>

        <article className="rounded-xl border border-border-subtle bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-text-primary">Kondisi lapak</h3>
            <span className="font-mono text-xs font-medium text-text-secondary tabular-nums">
              {totalLapaks} lapak
            </span>
          </div>

          <div
            role="img"
            aria-label="Diagram donat kondisi lapak"
            className="mt-3 h-44 w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={occupancy}
                  dataKey="total"
                  nameKey="status"
                  innerRadius="54%"
                  outerRadius="76%"
                  paddingAngle={2}
                  strokeWidth={0}
                  isAnimationActive={!prefersReduced}
                >
                  {occupancy.map((item) => (
                    <Cell key={item.key} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [`${value} lapak`, 'Jumlah']}
                />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  wrapperStyle={{ fontSize: 12, color: '#57534E' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="mt-3 space-y-1.5 border-t border-border-subtle pt-3 text-xs text-text-secondary">
            {occupancy.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.status}</span>
                </span>
                <span className="font-mono font-medium text-text-primary tabular-nums">
                  {item.total} lapak
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

export function SuperAdminCharts({
  data,
}: {
  data: {
    monthly: { month: string; rent: number; expense: number }[];
    occupiedLapaks: number;
    warungs: number;
    outstanding: number;
  };
}) {
  const prefersReduced = useHydratedReducedMotion();
  const hasCashData = data.monthly.some((item) => item.rent > 0 || item.expense > 0);

  return (
    <section className="space-y-4" aria-label="Ringkasan usaha SEBAKUL">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-border-subtle bg-surface p-4">
          <p className="text-[13px] font-medium text-text-secondary">
            Warung aktif
          </p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-text-primary tabular-nums">
            {data.warungs}
          </p>
        </article>
        <article className="rounded-xl border border-border-subtle bg-surface p-4">
          <p className="text-[13px] font-medium text-text-secondary">
            Lapak terisi
          </p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-text-primary tabular-nums">
            {data.occupiedLapaks}
          </p>
        </article>
        <article className="rounded-xl border border-border-subtle bg-surface p-4">
          <p className="text-[13px] font-medium text-text-secondary">
            Tunggakan sewa
          </p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-status-danger tabular-nums sm:text-2xl">
            {formatRupiah(data.outstanding)}
          </p>
        </article>
      </div>

      <article className="rounded-xl border border-border-subtle bg-surface p-4 sm:p-5">
        <h3 className="text-base font-semibold text-text-primary">
          Pendapatan sewa dan pengeluaran sentra
        </h3>
        <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
          Sewa yang sudah dibayar dibanding pengeluaran yang dicatat di Kas Sentra selama enam
          bulan terakhir. Catatan ini bukan seluruh biaya operasional.
        </p>

        {hasCashData ? (
          <div
            role="img"
            aria-label="Grafik pendapatan sewa tercatat dan pengeluaran sentra tercatat"
            className="mt-4 h-60 w-full sm:h-72"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthly} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE6DF" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#68635D' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={compact}
                  tick={{ fontSize: 12, fill: '#68635D' }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => formatRupiah(value)}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  wrapperStyle={{ fontSize: 12, color: '#57534E' }}
                />
                <Line
                  dataKey="rent"
                  name="Pendapatan sewa tercatat"
                  stroke="#0F766E"
                  strokeWidth={1.75}
                  dot={{ fill: '#0F766E', r: 2.5 }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={!prefersReduced}
                />
                <Line
                  dataKey="expense"
                  name="Pengeluaran sentra tercatat"
                  stroke="#B91C1C"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={{ fill: '#B91C1C', r: 2.5 }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={!prefersReduced}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-border-subtle bg-surface-muted/50 p-4 text-sm text-text-secondary">
            <p>Belum ada pembayaran sewa atau pengeluaran sentra tercatat dalam enam bulan terakhir.</p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <Link
                href="/sentra/tagihan"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border-strong bg-surface px-3.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                Buka tagihan sewa
              </Link>
              <Link
                href="/sentra/kas-sentra"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border-strong bg-surface px-3.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                Catat pengeluaran sentra
              </Link>
            </div>
          </div>
        )}

        {hasCashData && (
          <ul className="sr-only">
            {data.monthly.map((item) => (
              <li key={item.month}>
                {item.month}: pendapatan sewa {formatRupiah(item.rent)}, pengeluaran sentra tercatat{' '}
                {formatRupiah(item.expense)}
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
