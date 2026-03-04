import 'dotenv/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { SEARCH_QUEUE_NAME, processSearchJob, type SearchJobData } from './jobs/search-job';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker<SearchJobData>(
  SEARCH_QUEUE_NAME,
  async (job) => {
    console.log(`[worker] Processing job ${job.id} for search ${job.data.searchId}`);
    await processSearchJob(job.data);
    console.log(`[worker] Completed job ${job.id}`);
  },
  { connection, concurrency: 2 },
);

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err);
});

worker.on('error', (err) => {
  console.error('[worker] Worker error:', err);
});

console.log('[worker] Started — waiting for jobs...');

async function shutdown(): Promise<void> {
  console.log('[worker] Shutting down gracefully...');
  await worker.close();
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
