import { SkeletonCategoryList } from '@/components/forum/skeleton-category-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function ForumLoading() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>

      {/* Category cards skeleton */}
      <SkeletonCategoryList count={6} />

      {/* Trending section skeleton */}
      <div className="mt-8 sm:mt-12">
        <div className="flex items-center gap-2 mb-4 sm:mb-6">
          <Skeleton className="w-5 h-5" />
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Recent topics skeleton */}
      <div className="mt-8 sm:mt-12">
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="w-5 h-5" />
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
