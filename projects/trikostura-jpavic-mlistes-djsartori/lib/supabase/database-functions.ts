/**
 * Database Functions Documentation
 * 
 * This file documents the optimized database functions available in the Supabase backend.
 * These functions are created via migrations and provide better performance than client-side logic.
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Increment topic view count with built-in rate limiting
 * 
 * Features:
 * - Rate limits views to once per hour per user/IP
 * - Prevents view count inflation from spam/bots
 * - Atomic operation - no race conditions
 * 
 * @param supabase - Supabase client instance
 * @param topicId - UUID of the topic to track view for
 * @param userId - UUID of authenticated user (optional, null for anonymous)
 * @param ipAddress - IP address for anonymous rate limiting (optional)
 * 
 * @example
 * ```typescript
 * const { error } = await supabase.rpc('increment_topic_view', {
 *   p_topic_id: 'topic-uuid-here',
 *   p_user_id: user?.id || null,
 *   p_ip_address: ipAddress || null,
 * });
 * ```
 */
export async function incrementTopicView(
  supabase: SupabaseClient,
  topicId: string,
  userId: string | null = null,
  ipAddress: string | null = null
) {
  return await supabase.rpc('increment_topic_view', {
    p_topic_id: topicId,
    p_user_id: userId,
    p_ip_address: ipAddress,
  });
}

/**
 * Check if current user is an admin
 * 
 * This is a cached stable function that's much faster than checking
 * the profiles table directly in RLS policies.
 * 
 * @param supabase - Supabase client instance
 * 
 * @example
 * ```typescript
 * const { data: isAdmin } = await supabase.rpc('is_admin');
 * if (isAdmin) {
 *   // Show admin features
 * }
 * ```
 */
export async function isAdmin(supabase: SupabaseClient) {
  return await supabase.rpc('is_admin');
}

/**
 * Get current user's role
 * 
 * Cached stable function for efficient role checking.
 * 
 * @param supabase - Supabase client instance
 * 
 * @example
 * ```typescript
 * const { data: role } = await supabase.rpc('user_role');
 * console.log(role); // 'student' | 'admin'
 * ```
 */
export async function getUserRole(supabase: SupabaseClient) {
  return await supabase.rpc('user_role');
}

/**
 * Perform database maintenance
 * 
 * This function should be called periodically (weekly/monthly) to:
 * - Clean old read notifications (30+ days)
 * - Clean old topic views (90+ days)
 * - Vacuum and analyze tables
 * 
 * Note: This should be called from an admin context only.
 * 
 * @param supabase - Supabase client instance (with admin privileges)
 * 
 * @example
 * ```typescript
 * const { data: results } = await supabase.rpc('perform_maintenance');
 * console.log(results); // Array of maintenance task results
 * ```
 */
export async function performMaintenance(supabase: SupabaseClient) {
  return await supabase.rpc('perform_maintenance');
}

/**
 * Type definitions for database function responses
 */
export type MaintenanceResult = {
  task: string;
  status: string;
  details: string;
};

export type AdvancedMaintenanceResult = MaintenanceResult & {
  duration_ms: number;
};

/**
 * Get category statistics (optimized)
 * 
 * Returns topic counts and latest topic for each category in a single query.
 * Much faster than fetching all topics and aggregating client-side.
 * 
 * @param supabase - Supabase client instance
 * 
 * @example
 * ```typescript
 * const { data: stats } = await supabase.rpc('get_category_stats');
 * // Returns: [{ category_id, topic_count, latest_topic_id, ... }]
 * ```
 */
export async function getCategoryStats(supabase: SupabaseClient) {
  return await supabase.rpc('get_category_stats');
}

/**
 * Get paginated topics with all related data
 * 
 * Optimized function that fetches topics with category and author data
 * in a single query. Supports filtering by category and solution status.
 * 
 * @param supabase - Supabase client instance
 * @param limit - Number of topics to fetch (default: 15)
 * @param offset - Offset for pagination (default: 0)
 * @param categoryId - Filter by category UUID (optional)
 * @param filter - Filter type: 'all' | 'solved' | 'unsolved' (default: 'all')
 * 
 * @example
 * ```typescript
 * const { data: topics } = await supabase.rpc('get_topics_paginated', {
 *   p_limit: 20,
 *   p_offset: 0,
 *   p_category_id: 'category-uuid',
 *   p_filter: 'solved'
 * });
 * ```
 */
export async function getTopicsPaginated(
  supabase: SupabaseClient,
  options: {
    limit?: number;
    offset?: number;
    categoryId?: string | null;
    filter?: 'all' | 'solved' | 'unsolved';
  } = {}
) {
  return await supabase.rpc('get_topics_paginated', {
    p_limit: options.limit || 15,
    p_offset: options.offset || 0,
    p_category_id: options.categoryId || null,
    p_filter: options.filter || 'all',
  });
}

/**
 * Refresh user statistics materialized view
 * 
 * Updates the cached user statistics. Should be called periodically
 * (e.g., every 15 minutes via cron) to keep stats fresh.
 * 
 * @param supabase - Supabase client instance
 * 
 * @example
 * ```typescript
 * await supabase.rpc('refresh_user_stats');
 * ```
 */
export async function refreshUserStats(supabase: SupabaseClient) {
  return await supabase.rpc('refresh_user_stats');
}

/**
 * Create multiple notifications in a single batch
 * 
 * More efficient than creating notifications one by one.
 * Automatically skips self-notifications.
 * 
 * @param supabase - Supabase client instance
 * @param notifications - Array of notification objects
 * 
 * @example
 * ```typescript
 * const { data: count } = await supabase.rpc('create_notifications_batch', {
 *   p_notifications: [{
 *     user_id: 'user-uuid',
 *     type: 'reply_to_topic',
 *     title: 'New reply',
 *     message: 'Someone replied to your topic',
 *     link: '/forum/topic/slug',
 *     actor_id: 'actor-uuid',
 *     topic_id: 'topic-uuid'
 *   }]
 * });
 * ```
 */
export async function createNotificationsBatch(
  supabase: SupabaseClient,
  notifications: Array<{
    user_id: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    actor_id?: string;
    topic_id?: string;
    reply_id?: string;
  }>
) {
  return await supabase.rpc('create_notifications_batch', {
    p_notifications: notifications,
  });
}

/**
 * Recalculate reply counts for topics
 * 
 * Useful for fixing inconsistencies or after bulk operations.
 * 
 * @param supabase - Supabase client instance (admin)
 * @param topicIds - Array of topic UUIDs (optional, null = all topics)
 * 
 * @example
 * ```typescript
 * const { data: updated } = await supabase.rpc('recalculate_topic_reply_counts', {
 *   p_topic_ids: ['topic-uuid-1', 'topic-uuid-2']
 * });
 * ```
 */
export async function recalculateTopicReplyCounts(
  supabase: SupabaseClient,
  topicIds?: string[] | null
) {
  return await supabase.rpc('recalculate_topic_reply_counts', {
    p_topic_ids: topicIds || null,
  });
}

/**
 * Recalculate vote counts for replies
 * 
 * Fixes vote count inconsistencies.
 * 
 * @param supabase - Supabase client instance (admin)
 * @param replyIds - Array of reply UUIDs (optional, null = all replies)
 * 
 * @example
 * ```typescript
 * const { data: updated } = await supabase.rpc('recalculate_reply_votes');
 * ```
 */
export async function recalculateReplyVotes(
  supabase: SupabaseClient,
  replyIds?: string[] | null
) {
  return await supabase.rpc('recalculate_reply_votes', {
    p_reply_ids: replyIds || null,
  });
}

/**
 * Perform advanced database maintenance
 * 
 * Enhanced version with timing and more tasks:
 * - VACUUM ANALYZE tables
 * - Clean old notifications
 * - Clean old topic views
 * - Refresh materialized views
 * - Reindex tables
 * 
 * @param supabase - Supabase client instance (admin)
 * 
 * @example
 * ```typescript
 * const { data: results } = await supabase.rpc('perform_maintenance_advanced');
 * results.forEach(r => {
 *   console.log(`${r.task}: ${r.status} (${r.duration_ms}ms)`);
 * });
 * ```
 */
export async function performMaintenanceAdvanced(supabase: SupabaseClient) {
  return await supabase.rpc('perform_maintenance_advanced');
}
