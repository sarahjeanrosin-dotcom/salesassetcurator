import { Worker } from 'bullmq';
import { SEARCH_QUEUE_NAME, redis } from '@/lib/queue';
import { runSearch } from '@/services/search-orchestrator';
import type { SearchJobData } from '@/lib/queue';

export function createSearchWorker(): Worker {
  return new Worker<SearchJobData>(
    SEARCH_QUEUE_NAME,
    async (job) => {
      console.log(`[worker] Starting search job ${job.id} for searchId=${job.data.searchId}`);
      await runSearch(job.data.searchId);
      console.log(`[worker] Completed search job ${job.id}`);
    },
    {
      connection: redis,
      concurrency: 3,
    },
  );
}
