import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function WarungMenuLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat menu usaha" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-12 w-36" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
        <Skeleton className="h-12 w-full" />
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}
