import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function SupportLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat pusat bantuan" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SkeletonCard className="h-96" />
        </div>
        <div className="space-y-4 lg:col-span-7">
          <Skeleton className="h-12 w-72 max-w-full" />
          <SkeletonCard className="h-44" />
          <SkeletonCard className="h-44" />
        </div>
      </div>
    </div>
  );
}
