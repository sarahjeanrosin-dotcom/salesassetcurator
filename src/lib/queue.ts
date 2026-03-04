import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const SEARCH_QUEUE_NAME = 'search-jobs';

export const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const searchQueue = new Queue(SEARCH_QUEUE_NAME, { connection: redis });

export interface SearchJobData {
  searchId: string;
}
