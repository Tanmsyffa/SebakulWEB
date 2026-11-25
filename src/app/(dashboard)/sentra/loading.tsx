import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function SentraPetaLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat peta lapak sentra" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-40" />
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-56 w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}
