import { Navbar } from '@/components/layout/navbar';
import { CategorySidebar } from '@/components/layout/category-sidebar';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function ForumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  // Fetch categories for sidebar
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, icon, color, description')
    .order('order_index', { ascending: true });

  // Get topic counts for each category
  const { data: topicCounts } = await supabase
    .from('topics')
    .select('category_id');

  // Build topic count map
  const countMap = new Map<string, number>();
  topicCounts?.forEach((topic: { category_id: string }) => {
    countMap.set(topic.category_id, (countMap.get(topic.category_id) || 0) + 1);
  });

  // Add topic counts to categories
  const categoriesWithCounts = (categories || []).map((cat: any) => ({
    ...cat,
    topic_count: countMap.get(cat.id) || 0,
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-7xl xl:max-w-[1536px] mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8 xl:px-12 py-3 sm:py-5 md:py-7 xl:py-9">
        <div className="flex gap-6 xl:gap-8">
          <CategorySidebar categories={categoriesWithCounts} />
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
