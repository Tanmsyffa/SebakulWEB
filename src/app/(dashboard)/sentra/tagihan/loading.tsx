import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/skeleton';

export default function SentraTagihanLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat daftar tagihan" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-12 w-44" />
          <Skeleton className="h-12 w-36" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <Skeleton className="h-20 w-full rounded-2xl" />

      <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
        <Skeleton className="h-5 w-40" />
        <SkeletonText lines={6} />
      </div>
    </div>
  );
}
