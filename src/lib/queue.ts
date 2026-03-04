import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { SEARCH_QUEUE_NAME, type SearchJobData } from '@/jobs/search-job';

function createConnection(): IORedis {
  return new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
}

let _queue: Queue<SearchJobData> | null = null;

function getQueue(): Queue<SearchJobData> {
  if (!_queue) {
    _queue = new Queue<SearchJobData>(SEARCH_QUEUE_NAME, {
      connection: createConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return _queue;
}

export async function enqueueSearch(searchId: string): Promise<void> {
  await getQueue().add('run-search', { searchId });
}
