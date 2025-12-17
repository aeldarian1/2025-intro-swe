import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function SkeletonReplyCard() {
  return (
    <Card className="border-2 border-gray-200 dark:border-gray-700">
      <CardContent className="p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          {/* Mobile: Horizontal voting bar */}
          <div className="flex sm:hidden items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-800">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-10 w-20" />
          </div>

          {/* Desktop: Vertical voting bar */}
          <div className="hidden sm:flex flex-col items-center gap-2 p-2 rounded-xl">
            <Skeleton className="w-11 h-11 rounded-lg" />
            <Skeleton className="w-8 h-6" />
            <Skeleton className="w-11 h-11 rounded-lg" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Author info */}
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>

            {/* Reply content */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SkeletonReplyList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonReplyCard key={i} />
      ))}
    </div>
  );
}
