import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function SkeletonTopicCard() {
  return (
    <Card className="border-2 border-gray-200 dark:border-gray-700">
      <CardContent className="p-4 sm:p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>

            {/* Title */}
            <Skeleton className="h-7 w-full max-w-md" />
            <Skeleton className="h-7 w-3/4" />

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>

          {/* View count */}
          <div className="text-center flex-shrink-0">
            <Skeleton className="h-6 w-12 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SkeletonTopicList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTopicCard key={i} />
      ))}
    </div>
  );
}
