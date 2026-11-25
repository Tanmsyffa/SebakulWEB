import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat halaman" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-56" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
