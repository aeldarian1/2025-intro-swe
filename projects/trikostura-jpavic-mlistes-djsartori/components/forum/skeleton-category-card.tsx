import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function SkeletonCategoryCard() {
  return (
    <Card className="border-gray-200 dark:border-gray-700">
      <CardContent className="p-4 sm:p-5 md:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
            {/* Icon */}
            <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-lg flex-shrink-0" />

            <div className="flex-1 min-w-0 space-y-2">
              {/* Title */}
              <Skeleton className="h-6 w-48" />

              {/* Description */}
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />

              {/* Latest topic */}
              <div className="mt-3">
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
          </div>

          {/* Topic count */}
          <div className="text-right flex-shrink-0">
            <Skeleton className="h-7 w-12 mb-1 ml-auto" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SkeletonCategoryList({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCategoryCard key={i} />
      ))}
    </div>
  );
}
