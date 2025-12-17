import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Breadcrumb } from '@/components/forum/breadcrumb';
import { CategoryTopicsList } from '@/components/forum/category-topics-list';

// Revalidate every 60 seconds (1 minute) for better cache performance
export const revalidate = 60;

const TOPICS_PER_PAGE = 20;

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: category } = await (supabase as any)
    .from('categories')
    .select('name, description')
    .eq('slug', slug)
    .single();

  if (!category) {
    return {
      title: 'Kategorija nije pronađena',
    };
  }

  const categoryData = category as any;

  return {
    title: `${categoryData.name} | Skripta Forum`,
    description: categoryData.description || `Pregledajte teme u kategoriji ${categoryData.name}`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page || '1', 10));
  const offset = (currentPage - 1) * TOPICS_PER_PAGE;
  const supabase = await createServerSupabaseClient();

  // Get category
  const { data: category } = await (supabase as any)
    .from('categories')
    .select('id, name, slug, description, icon, color')
    .eq('slug', slug)
    .single();

  if (!category) {
    notFound();
  }

  // Get topics with count in single query for better performance
  const { data: topics, count: totalCount } = await (supabase as any)
    .from('topics')
    .select(`
      id,
      title,
      slug,
      created_at,
      is_pinned,
      is_locked,
      has_solution,
      view_count,
      reply_count,
      last_reply_at,
      author:profiles!topics_author_id_fkey(username, avatar_url),
      category:categories(name, slug, color)
    `, { count: 'exact' })
    .eq('category_id', (category as any).id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + TOPICS_PER_PAGE - 1);

  const totalPages = Math.ceil((totalCount || 0) / TOPICS_PER_PAGE);

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-0">
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { label: 'Forum', href: '/forum' },
          { label: category.name },
        ]}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1 w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <div
              className="text-3xl sm:text-4xl flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-lg flex-shrink-0"
              style={{ backgroundColor: category.color + '20' }}
            >
              {category.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold truncate">{category.name}</h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {category.description}
              </p>
            </div>
          </div>
        </div>
        <Link href="/forum/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">Nova tema</Button>
        </Link>
      </div>

      {/* Topic count */}
      <div className="text-sm text-gray-500">
        {totalCount} {totalCount === 1 ? 'tema' : 'tema'} ukupno
        {totalPages > 1 && ` - Stranica ${currentPage} od ${totalPages}`}
      </div>

      {topics && topics.length > 0 ? (
        <CategoryTopicsList topics={topics} />
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">
              Nema jos tema u ovoj kategoriji. Budi prvi i stvori novu!
            </p>
            <Link href="/forum/new">
              <Button className="mt-4">Stvori prvu temu</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        baseUrl={`/forum/category/${slug}`}
      />
    </div>
  );
}
