import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function GuyubLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat halaman SEBAKUL Guyub" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
  );
}
