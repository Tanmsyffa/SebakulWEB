import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/skeleton';

export default function KasSentraLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat kas sentra" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-12 w-44" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-60 w-full" />
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
        <Skeleton className="h-5 w-44" />
        <SkeletonText lines={5} />
      </div>
    </div>
  );
}
