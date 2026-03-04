import { runSearch } from '@/services/search-orchestrator';

/**
 * Enqueues a search by running it as a background async task in the same
 * Node.js process. No Redis or external queue required.
 *
 * For production scale, swap this for a proper queue (BullMQ + Redis, etc.).
 */
export function enqueueSearch(searchId: string): void {
  // Fire-and-forget — the API route responds immediately
  runSearch(searchId).catch((err: unknown) => {
    console.error(`[queue] Search ${searchId} failed:`, err);
  });
}
