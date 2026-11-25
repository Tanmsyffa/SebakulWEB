import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function WarungDashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat beranda warung" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-2.5">
          <Skeleton className="h-12 w-36" />
          <Skeleton className="h-12 w-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs lg:col-span-7 space-y-4">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-56 w-full" />
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs lg:col-span-5 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </div>
  );
}
