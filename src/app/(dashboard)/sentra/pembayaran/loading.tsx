import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function SentraPembayaranLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat pengaturan rekening sewa" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <SkeletonCard />
    </div>
  );
}
