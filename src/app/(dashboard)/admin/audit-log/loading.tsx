import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function AuditLogLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat riwayat audit log" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-12 w-96 max-w-full" />
        <Skeleton className="h-16 w-full" />
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
