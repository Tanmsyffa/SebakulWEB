import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat halaman profil" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-11 w-40" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SkeletonCard className="h-72" />
        </div>
        <div className="lg:col-span-5">
          <SkeletonCard className="h-72" />
        </div>
      </div>
    </div>
  );
}
