import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat halaman admin master" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-12 w-36" />
          <Skeleton className="h-12 w-36" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-56 w-full" />
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
        <Skeleton className="h-11 w-72 max-w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    </div>
  );
}
