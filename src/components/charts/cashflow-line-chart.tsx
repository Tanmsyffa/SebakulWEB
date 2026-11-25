'use client';

import { useHydratedReducedMotion } from '@/components/motion';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatRupiah } from '@/lib/utils/currency';

interface CashflowData {
  date: string;
  income: number;
  expense: number;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}rb`;
  return value.toString();
}

export function CashflowLineChart({ data }: { data: CashflowData[] }) {
  const prefersReduced = useHydratedReducedMotion();

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-border-subtle bg-surface-muted px-4 text-center text-sm text-text-secondary">
        Belum ada catatan pemasukan atau belanja dalam tujuh hari terakhir.
      </div>
    );
  }

  return (
    <>
      <div
        role="img"
        aria-label="Grafik pemasukan dan pengeluaran tujuh hari terakhir"
        className="h-56 w-full sm:h-64"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EAE6DF" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#68635D' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#68635D' }}
              tickFormatter={formatCompact}
            />
            <Tooltip
              contentStyle={{
                background: '#FFFFFF',
                border: '1px solid #EAE6DF',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#181715',
                boxShadow: '0 4px 12px -2px rgba(24, 23, 21, 0.06)',
              }}
              formatter={(value: number) => [formatRupiah(value), '']}
            />
            <Legend
              verticalAlign="top"
              height={32}
              wrapperStyle={{ fontSize: 12, color: '#57534E' }}
            />
            <Line
              type="monotone"
              dataKey="income"
              stroke="#0F766E"
              strokeWidth={1.75}
              dot={{ fill: '#0F766E', r: 2.5 }}
              activeDot={{ r: 4 }}
              name="Pemasukan"
              isAnimationActive={!prefersReduced}
            />
            <Line
              type="monotone"
              dataKey="expense"
              stroke="#B91C1C"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={{ fill: '#B91C1C', r: 2.5 }}
              activeDot={{ r: 4 }}
              name="Belanja"
              isAnimationActive={!prefersReduced}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="sr-only">
        {data.map((item) => (
          <li key={item.date}>
            {item.date}: pemasukan {formatRupiah(item.income)}, belanja{' '}
            {formatRupiah(item.expense)}
          </li>
        ))}
      </ul>
    </>
  );
}
